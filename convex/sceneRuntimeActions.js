"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { describeSceneMapLayout } from "../shared/mapTemplates";

const DM_FALLBACK_MODEL = process.env.OPENAI_DM_MODEL || "gpt-4.1-mini";

function inferPromptMode(promptMode, content, combat) {
  if (promptMode && promptMode !== "auto") {
    return promptMode;
  }

  const normalized = content.trim().toLowerCase();
  const actionHints = [
    "attack",
    "cast",
    "move",
    "dash",
    "shoot",
    "swing",
    "stab",
    "fire bolt",
    "burning hands",
    "healing word",
    "end turn",
  ];
  if (combat?.encounter?.status === "active" && actionHints.some((hint) => normalized.includes(hint))) {
    return "declare";
  }
  if (normalized.includes("?") || normalized.startsWith("what ") || normalized.startsWith("can ")) {
    return "ask";
  }
  if (normalized.includes("look") || normalized.includes("inspect") || normalized.includes("search")) {
    return "inspect";
  }
  return "speak";
}

function summarizeCombat(combat) {
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
      "Answer like a DM describing what the party can immediately perceive, infer, or test next.",
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

function buildSystemPrompt({ runtime, combat, promptMode, playerName, retrieval }) {
  const mapSummary = describeSceneMapLayout(runtime.activeScene);
  const interactableSummary = (runtime.activeScene.interactables || [])
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
    `Scene summary: ${runtime.activeScene.summary}.`,
    `Scene objective: ${runtime.activeScene.objective}.`,
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

function normalizeDmReply(reply) {
  return (reply || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function retrieveDmContext(ctx, { playerPrompt, runtime, promptMode }) {
  const sceneQuery = [
    playerPrompt,
    runtime.activeScene.title,
    runtime.activeScene.summary,
    runtime.activeScene.objective,
    promptMode,
  ]
    .filter(Boolean)
    .join(" | ");

  const domain =
    promptMode === "ask"
      ? "player_rules"
      : promptMode === "inspect"
        ? "project_docs"
        : undefined;

  try {
    return await ctx.runAction(api.corpusActions.search, {
      queryText: sceneQuery,
      limit: 3,
      rulesDomain: domain,
    });
  } catch (error) {
    console.error("DM corpus lookup failed.", error);
    return [];
  }
}

async function generateDmReply({ runtime, combat, playerPrompt, promptMode, playerName, retrieval }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (combat?.encounter?.status === "active" && promptMode === "declare") {
      return "Steel is already in motion. Commit that choice on the battle controls, then I will carry the scene forward from the result.";
    }
    return `The pressure in ${runtime.activeScene.title} tightens around ${playerName}. ${runtime.activeScene.summary} State what you test, ask, or attempt next and the table will answer from there.`;
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

async function streamDmReply({
  ctx,
  runtime,
  combat,
  playerPrompt,
  promptMode,
  playerName,
  retrieval,
  draftMessageId,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = await generateDmReply({
      runtime,
      combat,
      playerPrompt,
      promptMode,
      playerName,
      retrieval,
    });
    const normalized = normalizeDmReply(fallback);
    await ctx.runMutation(internal.sceneRuntime.replaceSceneMessage, {
      messageId: draftMessageId,
      content: normalized,
    });
    return normalized;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DM_FALLBACK_MODEL,
      stream: true,
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

  if (!response.body) {
    const fallback = await generateDmReply({
      runtime,
      combat,
      playerPrompt,
      promptMode,
      playerName,
      retrieval,
    });
    const normalized = normalizeDmReply(fallback);
    await ctx.runMutation(internal.sceneRuntime.replaceSceneMessage, {
      messageId: draftMessageId,
      content: normalized,
    });
    return normalized;
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let accumulated = "";
  let flushBuffer = "";

  async function flushChunk(force = false) {
    if (!flushBuffer) {
      return;
    }
    if (!force && flushBuffer.length < 8 && !/[.!?\n]\s*$/.test(flushBuffer)) {
      return;
    }
    const chunk = flushBuffer;
    flushBuffer = "";
    await ctx.runMutation(internal.sceneRuntime.appendToSceneMessage, {
      messageId: draftMessageId,
      chunk,
    });
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n").map((line) => line.trim());
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }
        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          accumulated += parsed.delta;
          flushBuffer += parsed.delta;
          await flushChunk(false);
        }
      }
    }
  }

  await flushChunk(true);
  const normalized = normalizeDmReply(accumulated);
  await ctx.runMutation(internal.sceneRuntime.replaceSceneMessage, {
    messageId: draftMessageId,
    content: normalized,
  });
  return normalized;
}

export const respondToPrompt = action({
  args: {
    sessionId: v.id("gameSessions"),
    playerMessageId: v.id("sceneMessages"),
    promptMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const runtime = await ctx.runQuery(api.sceneRuntime.getForSession, {
      sessionId: args.sessionId,
    });
    if (!runtime?.activeScene) {
      throw new Error("No active scene is available.");
    }

    const playerMessage = runtime.messages.find((message) => message._id === args.playerMessageId);
    if (!playerMessage) {
      throw new Error("Player prompt not found in the active scene.");
    }

    await ctx.runMutation(internal.sceneRuntime.setDmStatus, {
      sessionId: args.sessionId,
      dmStatus: "retrieving",
    });

    try {
      const combat = await ctx.runQuery(api.combat.getForSession, {
        sessionId: args.sessionId,
      });
      const promptMode = inferPromptMode(args.promptMode, playerMessage.content, combat);
      const retrieval = await retrieveDmContext(ctx, {
        playerPrompt: playerMessage.content,
        runtime,
        promptMode,
      });
      const draftMessageId = await ctx.runMutation(internal.sceneRuntime.createDmReplyDraft, {
        sessionId: args.sessionId,
        runId: runtime.run._id,
        sceneId: runtime.activeScene._id,
        messageType: "reply",
      });
      await ctx.runMutation(internal.sceneRuntime.setDmStatus, {
        sessionId: args.sessionId,
        dmStatus: "responding",
      });
      const reply = await streamDmReply({
        ctx,
        runtime,
        combat,
        playerPrompt: playerMessage.content,
        promptMode,
        playerName: playerMessage.speakerLabel,
        retrieval,
        draftMessageId,
      });
      if (runtime.activeScene.npcBriefs?.length) {
        await ctx.runMutation(internal.sceneRuntime.persistNpcMemories, {
          sessionId: args.sessionId,
          sceneId: runtime.activeScene._id,
          npcIds: runtime.activeScene.npcBriefs.map((npc) => npc.name),
          eventSummary: playerMessage.content,
          sourceEventId: String(playerMessage._id),
        });
      }

      return {
        promptMode,
        reply,
      };
    } finally {
      await ctx.runMutation(internal.sceneRuntime.setDmStatus, {
        sessionId: args.sessionId,
        dmStatus: "idle",
      });
    }
  },
});
