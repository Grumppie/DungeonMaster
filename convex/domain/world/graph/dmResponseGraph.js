import { describeSceneMapLayout } from "../../../../shared/mapTemplates";
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

export function buildSystemPrompt({ runtime, combat, promptMode, playerName, retrieval }) {
  const mapSummary = describeSceneMapLayout(runtime.activeScene);
  const interactableSummary = (runtime.activeScene.interactables || [])
    .filter((entry) => !entry.hidden)
    .map((entry) => `${entry.label} [${entry.kind}] at ${entry.position?.x},${entry.position?.y}`)
    .join("; ");
  const recentMessages = runtime.messages
    .slice(-8)
    .map((message) => `${message.speakerLabel}: ${message.content}`)
    .join("\n");

  return [
    "You are the active dungeon master for a 2014 5e-inspired tactical quest runner.",
    "Act like a real DM at the table: short, atmospheric, decisive, and grounded in the current scene.",
    "Narration is downstream from state. Never invent combat resolution or rewrite the encounter state.",
    "Do not decide hit rolls, damage, saves, HP changes, movement legality, initiative, or encounter completion.",
    "When combat is active, mechanics stay in the engine and battle map controls.",
    "Keep replies to 2-4 short sentences.",
    "Do not monologue. Prefer one crisp description and one grounded response.",
    "Never invent objects, NPCs, hazards, symbols, elders, totems, notes, or landmarks that are not present in the current scene summary, map features, interactables, or recent transcript.",
    "If the player asks about something not currently visible on the board or in the scene state, say it is not presently visible instead of inventing it.",
    buildModeInstructions(promptMode, combat),
    `Current run: ${runtime.run.title}.`,
    `Active scene: ${runtime.activeScene.title}.`,
    `Scene type: ${runtime.activeScene.type}.`,
    `Scene purpose: ${runtime.activeScene.scenePurpose || "unknown"}.`,
    `Scene summary: ${runtime.activeScene.summary}.`,
    `Scene objective: ${runtime.activeScene.objectiveText || runtime.activeScene.objective}.`,
    `Pressure: ${runtime.activeScene.pressure}.`,
    `Map footprint: ${mapSummary.width} by ${mapSummary.height}.`,
    `Visible map features: ${mapSummary.features.join(", ") || "none listed"}.`,
    `Named landmarks: ${mapSummary.landmarks.map((entry) => `${entry.name} at ${entry.cells.map((cell) => cell.join(",")).join(" / ")}`).join("; ") || "none listed"}.`,
    `Visible interactables: ${interactableSummary || "none listed"}.`,
    `Prompt mode: ${promptMode}.`,
    `Player name: ${playerName}.`,
    `Combat snapshot: ${summarizeCombat(combat)}`,
    `Local canon retrieved for this prompt:\n${buildRetrievedContext(retrieval)}`,
    recentMessages ? `Recent transcript:\n${recentMessages}` : "Recent transcript: none.",
  ].join("\n");
}

export function normalizeDmReply(reply) {
  return (reply || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generateDmReply({ runtime, combat, playerPrompt, promptMode, playerName, retrieval }) {
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
          content: buildSystemPrompt({ runtime, combat, promptMode, playerName, retrieval }),
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
