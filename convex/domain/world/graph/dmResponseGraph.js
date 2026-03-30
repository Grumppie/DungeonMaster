import { buildConservativeRetrievalFallback } from "../../retrieval/conservativeFallback";

const DM_FALLBACK_MODEL = process.env.OPENAI_DM_MODEL || "gpt-4.1-mini";

export function summarizeCombat(combat) {
  if (!combat?.encounter) {
    return "No active combat encounter.";
  }

  const current = combat.currentCombatant
    ? combat.currentCombatant.displayName || combat.currentCombatant.name
    : "none";
  const party = combat.combatants
    .filter((combatant) => combatant.side === "party")
    .map((combatant) => `${combatant.displayName || combatant.name} ${combatant.currentHp}/${combatant.maxHp}HP`)
    .join("; ");
  const enemies = combat.combatants
    .filter((combatant) => combatant.side === "enemy" && !combatant.isDead)
    .map((combatant) => `${combatant.displayName || combatant.name} ${combatant.currentHp}/${combatant.maxHp}HP`)
    .join("; ");

  return `Round ${combat.encounter.round}. Current turn: ${current}. Party: ${party || "none"}. Enemies still up: ${enemies || "none"}.`;
}

function buildModeInstructions(promptMode, combat) {
  if (promptMode === "ask") {
    return [
      "Answer like a table DM giving a crisp ruling or clarification.",
      "Use the retrieved canon when it is relevant.",
      "If the evidence is thin, say what is clear and what still needs adjudication.",
      "Do not append a generic next-step hint unless the player explicitly asks what to do next.",
    ].join(" ");
  }

  if (promptMode === "inspect") {
    return [
      "Answer like a DM describing what the player can immediately perceive, infer, or test next.",
      "Give sensory detail, then 1-2 actionable leads.",
      "Do not reveal hidden facts as certainty unless the provided context already establishes them.",
      "Keep recommendations grounded in the visible board and listed interactables only.",
    ].join(" ");
  }

  if (promptMode === "declare") {
    if (combat?.encounter?.status === "active") {
      return [
        "Treat this as battle-table intent during live initiative.",
        "Do not resolve mechanics. Redirect the player to the tactical controls in one sentence,",
        "then give one short battlefield line that keeps the pressure alive.",
        "Keep the whole reply under 3 short sentences.",
      ].join(" ");
    }

    return [
      "Treat this as declared intent outside initiative.",
      "Frame consequences, resistance, or the next decision point like a real DM.",
      "Do not convert it into solved mechanics or free success.",
      "Only reference visible scene elements or named scene actors.",
    ].join(" ");
  }

  return [
    "Treat this as in-character table talk.",
    "Respond in a live DM voice that acknowledges the fiction and pushes the scene forward.",
    "Keep it grounded in the present objective and pressure.",
    "Keep the reply tight and do not tack on a generic next-step line.",
  ].join(" ");
}

function buildRetrievedContext(retrieval) {
  if (!retrieval.length) {
    return "No local corpus excerpts were retrieved for this prompt.";
  }

  return retrieval
    .map((entry, index) => {
      const pageNumber = entry.metadata?.pageNumber ? ` p.${entry.metadata.pageNumber}` : "";
      return `[${index + 1}] ${entry.sourceLabel}${pageNumber} (${entry.rulesDomain}): ${entry.excerpt}`;
    })
    .join("\n");
}

function parseCoordinateSourceId(sourceId) {
  const match = String(sourceId || "").match(/^(-?\d+):(-?\d+)$/);
  if (!match) {
    return null;
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function getCompassDirection(fromX, fromY, toX, toY) {
  const horizontal = toX > fromX ? "east" : toX < fromX ? "west" : "";
  const vertical = toY > fromY ? "south" : toY < fromY ? "north" : "";

  if (horizontal && vertical) {
    return `${vertical}-${horizontal}`;
  }

  return horizontal || vertical || "here";
}

function buildPromptFocusBlock({ runtime, sourceKind, sourceId, sourceLabel }) {
  const sceneContext = runtime.sceneContext;
  if (!sceneContext) {
    return "Prompt focus is unavailable.";
  }

  let focusPosition = null;
  let focusLines = [];

  if (sourceKind === "tile") {
    focusPosition = parseCoordinateSourceId(sourceId);
    if (focusPosition) {
      const mapCell = runtime.mapInstance?.cells?.find(
        (entry) => entry.x === focusPosition.x && entry.y === focusPosition.y,
      );
      focusLines.push(
        `Focused tile: (${focusPosition.x},${focusPosition.y})${mapCell?.terrainKind ? ` terrain ${mapCell.terrainKind}` : ""}.`,
      );
    }
  } else if (sourceKind === "interactable") {
    const interactable = sceneContext.visibleInteractables.find((entry) => entry.id === sourceId);
    if (interactable) {
      focusPosition = interactable.position;
      focusLines.push(
        `Focused interactable: ${interactable.label} [${interactable.kind}] at (${interactable.position.x},${interactable.position.y}).`,
      );
    }
  }

  if (!focusPosition && sceneContext.viewer?.position) {
    focusPosition = sceneContext.viewer.position;
    focusLines.push(
      `Fallback focus: viewer position (${focusPosition.x},${focusPosition.y}).`,
    );
  }

  if (!focusPosition) {
    return `Prompt source: ${sourceKind || "freeform"} ${sourceLabel || ""}`.trim();
  }

  const nearbyInteractables = sceneContext.visibleInteractables
    .map((entry) => ({
      ...entry,
      distance:
        Math.abs(entry.position.x - focusPosition.x) +
        Math.abs(entry.position.y - focusPosition.y),
      direction: getCompassDirection(
        focusPosition.x,
        focusPosition.y,
        entry.position.x,
        entry.position.y,
      ),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 4);

  const nearbyLandmarks = sceneContext.map.landmarks
    .map((entry) => {
      const distances = (entry.cells || []).map(
        ([x, y]) => Math.abs(x - focusPosition.x) + Math.abs(y - focusPosition.y),
      );
      const bestDistance = Math.min(...distances);
      const bestCell = (entry.cells || []).find(
        ([x, y]) => Math.abs(x - focusPosition.x) + Math.abs(y - focusPosition.y) === bestDistance,
      );
      return {
        name: entry.name,
        distance: bestDistance,
        direction: bestCell
          ? getCompassDirection(focusPosition.x, focusPosition.y, bestCell[0], bestCell[1])
          : "unknown",
      };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 4);

  const nearbyTransitions = sceneContext.transitions
    .map((entry) => ({
      ...entry,
      distance: Math.abs(entry.x - focusPosition.x) + Math.abs(entry.y - focusPosition.y),
      direction: getCompassDirection(focusPosition.x, focusPosition.y, entry.x, entry.y),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 2);

  focusLines = [
    ...focusLines,
    `Nearest interactables: ${
      nearbyInteractables.length
        ? nearbyInteractables
          .map((entry) => `${entry.label} at (${entry.position.x},${entry.position.y}), distance ${entry.distance}, ${entry.direction}`)
          .join("; ")
        : "none"
    }.`,
    `Nearest landmarks: ${
      nearbyLandmarks.length
        ? nearbyLandmarks
          .map((entry) => `${entry.name}, distance ${entry.distance}, ${entry.direction}`)
          .join("; ")
        : "none"
    }.`,
    `Nearest exits: ${
      nearbyTransitions.length
        ? nearbyTransitions
          .map((entry) => `${entry.label} at (${entry.x},${entry.y}), distance ${entry.distance}, ${entry.direction}, ${entry.isActive ? "open" : "locked"}`)
          .join("; ")
        : "none"
    }.`,
    "When the player inspects a tile or selected object, answer from this focus first and prefer the nearest matching landmark or interactable over farther ones.",
  ];

  return focusLines.join("\n");
}

function buildSceneContextBlock(sceneContext) {
  if (!sceneContext) {
    return "Scene context is unavailable. Stay conservative and only restate visible facts from recent transcript.";
  }

  const interactables = sceneContext.visibleInteractables.length
    ? sceneContext.visibleInteractables
      .map((entry) => {
        const consequences = [];
        if (entry.requiredMode) {
          consequences.push(`scripted mode: ${entry.requiredMode}`);
        }
        if (entry.unlocks.length) {
          consequences.push(`reveals ${entry.unlocks.join(", ")}`);
        }
        if (entry.progressDelta) {
          consequences.push(`progress delta ${entry.progressDelta}`);
        }
        if (!consequences.length) {
          consequences.push("no explicit scripted unlock");
        }
        return `- ${entry.label} [${entry.kind}] at (${entry.position.x},${entry.position.y}); modes: ${entry.interactionModes.join(", ") || "none"}; ${consequences.join("; ")}.`;
      })
      .join("\n")
    : "- none";

  const transitions = sceneContext.transitions.length
    ? sceneContext.transitions
      .map((entry) => `- ${entry.label} at (${entry.x},${entry.y}) is ${entry.isActive ? "open" : "locked"}${entry.blockerReason ? `; blocker: ${entry.blockerReason}` : ""}.`)
      .join("\n")
    : "- none";

  const party = sceneContext.party.length
    ? sceneContext.party
      .map((entry) => {
        const location = [`(${entry.position.x},${entry.position.y})`];
        if (entry.landmark) {
          location.push(`near ${entry.landmark}`);
        }
        if (entry.onTransitionAnchor) {
          location.push(`standing on ${entry.transitionAnchorLabel}`);
        }
        return `- ${entry.displayName}: ${location.join(", ")}.`;
      })
      .join("\n")
    : "- none";

  const facts = sceneContext.recentFacts.length
    ? sceneContext.recentFacts.map((entry) => `- ${entry.summary}`).join("\n")
    : "- none";

  return [
    `Scene order: ${sceneContext.scene.order}.`,
    `Scene title: ${sceneContext.scene.title}.`,
    `Scene type: ${sceneContext.scene.type}.`,
    `Scene purpose: ${sceneContext.scene.purpose}.`,
    `Act state: ${sceneContext.scene.actState}.`,
    `Scene summary: ${sceneContext.scene.summary}.`,
    `Scene objective: ${sceneContext.scene.objective}.`,
    `Pressure: ${sceneContext.scene.pressure} (${sceneContext.scene.pressureTier}).`,
    `Map footprint: ${sceneContext.map.width} by ${sceneContext.map.height}.`,
    `Terrain summary: ${sceneContext.map.terrainSummary.join(", ") || "none listed"}.`,
    `Named landmarks: ${sceneContext.map.landmarks.map((entry) => entry.name).join("; ") || "none listed"}.`,
    `Changed tiles: ${sceneContext.map.changedTiles.join(", ") || "none"}.`,
    `Scene gates: discovery ${sceneContext.gates.discovery}; commitment ${sceneContext.gates.commitment}; exit ${sceneContext.gates.transition}; stall ${sceneContext.gates.stallCounter}; hints ${sceneContext.gates.hintBudget}.`,
    sceneContext.viewer
      ? `Current viewer: ${sceneContext.viewer.displayName} at (${sceneContext.viewer.position.x},${sceneContext.viewer.position.y})${sceneContext.viewer.landmark ? ` near ${sceneContext.viewer.landmark}` : ""}.`
      : "Current viewer: unknown.",
    "Party positions:",
    party,
    "Visible interactables and scripted consequences:",
    interactables,
    "Transition anchors:",
    transitions,
    "Recent established scene facts:",
    facts,
    "Scene authority rules:",
    "- Exits only exist at the listed transition anchors.",
    "- Do not describe a new room, map, or downstream scene until an anchor is open and the state has actually advanced.",
    "- Do not invent extra interactables, props, clues, hazards, or NPCs beyond the listed landmarks, interactables, transcript, and facts.",
    "- When an interactable has no scripted unlock, treat it as flavor, clarification, or minor observation rather than a world-state rewrite.",
  ].join("\n");
}

export function buildSystemPrompt({
  runtime,
  combat,
  promptMode,
  playerName,
  retrieval,
  sourceKind,
  sourceId,
  sourceLabel,
}) {
  const recentMessages = runtime.messages
    .slice(-8)
    .map((message) => `${message.speakerLabel}: ${message.content}`)
    .join("\n");

  return [
    "You are the active dungeon master for a 2014 5e-inspired tactical quest runner.",
    "Act like a real DM at the table: short, atmospheric, decisive, and grounded in the current scene.",
    "Narration is downstream from state. Never invent combat resolution or rewrite the encounter state.",
    "Do not decide hit rolls, damage, saves, HP changes, movement legality, initiative, or encounter completion.",
    "When combat is active, mechanics stay in the tactical controls and encounter state.",
    "Keep replies to 2-4 short sentences.",
    "Do not monologue. Prefer one crisp description and one grounded response.",
    "Never mention the engine, system updates, internal processing, or waiting for the game to update.",
    "Never invent objects, NPCs, hazards, symbols, exits, clues, or landmarks beyond the authoritative scene context below.",
    "If the player asks about something not currently visible on the board or in the scene state, say it is not presently visible instead of inventing it.",
    buildModeInstructions(promptMode, combat),
    `Current run: ${runtime.run.title}.`,
    `Prompt mode: ${promptMode}.`,
    `Player name: ${playerName}.`,
    `Combat snapshot: ${summarizeCombat(combat)}`,
    `Prompt focus:\n${buildPromptFocusBlock({ runtime, sourceKind, sourceId, sourceLabel })}`,
    `Authoritative scene context:\n${buildSceneContextBlock(runtime.sceneContext)}`,
    `Local canon retrieved for this prompt:\n${buildRetrievedContext(retrieval)}`,
    recentMessages ? `Recent transcript:\n${recentMessages}` : "Recent transcript: none.",
  ].join("\n");
}

export function normalizeDmReply(reply) {
  return (reply || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generateDmReply({
  runtime,
  combat,
  playerPrompt,
  promptMode,
  playerName,
  retrieval,
  sourceKind,
  sourceId,
  sourceLabel,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildConservativeRetrievalFallback({ runtime, playerName, combat, promptMode });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DM_FALLBACK_MODEL,
      input: [
        {
          role: "system",
          content: buildSystemPrompt({
            runtime,
            combat,
            promptMode,
            playerName,
            retrieval,
            sourceKind,
            sourceId,
            sourceLabel,
          }),
        },
        {
          role: "user",
          content: playerPrompt,
        },
      ],
      max_output_tokens: 180,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`DM response generation failed: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const outputText = payload.output_text?.trim();
  if (outputText) {
    return outputText;
  }

  const fallback = payload.output
    ?.flatMap((entry) => entry.content || [])
    ?.map((contentPart) => contentPart.text || "")
    ?.join("")
    ?.trim();
  if (!fallback) {
    throw new Error("DM response generation returned no text.");
  }
  return fallback;
}
