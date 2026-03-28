import { api, internal } from "../../../_generated/api";
import { buildRetrievalRequest } from "../../retrieval/searchPolicy";
import { inferPromptMode } from "./interactionRouterGraph";
import {
  buildSystemPrompt,
  generateDmReply,
  normalizeDmReply,
} from "./dmResponseGraph";
import { synthesizeAndPersistVoiceEvent } from "../../../voice";

const DM_VOICE_PROFILE_KEY = "dm-narrator";
const DM_VOICE_STYLE = "Measured dungeon master narration with clear pacing and grounded scene authority.";
const DM_VOICE_PROVIDER = "deepgram";

function getDmVoiceId() {
  return process.env.DEEPGRAM_DM_VOICE || process.env.DEEPGRAM_VOICE || "aura-2-thalia-en";
}

function extractSpeakableChunks(buffer, force = false) {
  const chunks = [];
  let remaining = buffer;

  while (remaining.length) {
    const sentenceMatch = remaining.match(/^([\s\S]*?[.!?])(\s+|$)/);
    if (sentenceMatch && sentenceMatch[1].trim().length >= 12) {
      chunks.push(sentenceMatch[1].trim());
      remaining = remaining.slice(sentenceMatch[0].length);
      continue;
    }

    const softBreakIndex = remaining.search(/[;:]\s/);
    if (softBreakIndex >= 56) {
      const chunk = remaining.slice(0, softBreakIndex + 1).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      remaining = remaining.slice(softBreakIndex + 1).trimStart();
      continue;
    }

    if (remaining.length >= 140) {
      const window = remaining.slice(0, 140);
      const splitAt = Math.max(window.lastIndexOf(" "), window.lastIndexOf("-"));
      const chunk = remaining.slice(0, splitAt > 64 ? splitAt : 140).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      remaining = remaining.slice(chunk.length).trimStart();
      continue;
    }

    if (force && remaining.trim()) {
      chunks.push(remaining.trim());
      remaining = "";
    }
    break;
  }

  return { chunks, remaining };
}

async function retrieveDmContext(ctx, { playerPrompt, runtime, promptMode }) {
  try {
    return await ctx.runAction(api.corpusActions.search, buildRetrievalRequest({
      playerPrompt,
      runtime,
      promptMode,
    }));
  } catch (error) {
    console.error("DM corpus lookup failed.", error);
    return [];
  }
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
  sessionId,
  visibility,
  targetParticipantId,
}) {
  let hasQueuedSpeech = false;
  let speechBuffer = "";
  let speechQueue = Promise.resolve();

  function queueSpeech(chunks) {
    if (!chunks.length) {
      return;
    }

    if (!hasQueuedSpeech) {
      hasQueuedSpeech = true;
      speechQueue = speechQueue.then(() =>
        ctx.runMutation(internal.sceneRuntime.setDmStatus, {
          sessionId,
          dmStatus: "speaking",
        })
      );
    }

    for (const chunk of chunks) {
      speechQueue = speechQueue
        .then(() =>
          synthesizeAndPersistVoiceEvent(ctx, {
            sessionId,
            sceneMessageId: draftMessageId,
            speakerType: "dm",
            speakerName: "DM",
            transcript: chunk,
            provider: DM_VOICE_PROVIDER,
            voiceId: getDmVoiceId(),
            voiceProfileKey: DM_VOICE_PROFILE_KEY,
            stylePrompt: DM_VOICE_STYLE,
            visibility,
            targetParticipantId,
            disableThrottle: true,
          })
        )
        .catch((error) => {
          console.error("DM voice synthesis failed.", error);
        });
    }
  }

  async function finalizeSpeech(forceText = "") {
    if (forceText?.trim()) {
      speechBuffer += forceText;
    }
    const { chunks, remaining } = extractSpeakableChunks(speechBuffer, true);
    speechBuffer = remaining;
    queueSpeech(chunks);
    await speechQueue;
  }

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
    await finalizeSpeech(normalized);
    return normalized;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DM_MODEL || "gpt-4.1-mini",
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
          speechBuffer += parsed.delta;
          await flushChunk(false);
          const { chunks, remaining } = extractSpeakableChunks(speechBuffer, false);
          speechBuffer = remaining;
          queueSpeech(chunks);
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
  await finalizeSpeech();
  return normalized;
}

export async function respondToPromptAction(ctx, { sessionId, playerMessageId, promptMode: requestedPromptMode }) {
  const runtime = await ctx.runQuery(api.sceneRuntime.getForSession, {
    sessionId,
  });
  if (!runtime?.activeScene) {
    throw new Error("No active scene is available.");
  }

  const playerMessage = runtime.messages.find((message) => message._id === playerMessageId);
  if (!playerMessage) {
    throw new Error("Player prompt not found in the visible scene log.");
  }

  await ctx.runMutation(internal.sceneRuntime.setDmStatus, {
    sessionId,
    dmStatus: "retrieving",
  });

  try {
    const combat = await ctx.runQuery(api.combat.getForSession, {
      sessionId,
    });
    const promptMode = inferPromptMode(requestedPromptMode, playerMessage.content, combat);
    const retrieval = await retrieveDmContext(ctx, {
      playerPrompt: playerMessage.content,
      runtime,
      promptMode,
    });
    const draftMessageId = await ctx.runMutation(internal.sceneRuntime.createDmReplyDraft, {
      sessionId,
      runId: runtime.run._id,
      sceneId: runtime.activeScene._id,
      messageType: "reply",
      visibility: playerMessage.visibility || "party",
      targetParticipantId: playerMessage.visibility === "private" ? playerMessage.participantId : undefined,
      sourceKind: playerMessage.sourceKind,
      sourceId: playerMessage.sourceId,
    });
    await ctx.runMutation(internal.sceneRuntime.setDmStatus, {
      sessionId,
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
      sessionId,
      visibility: playerMessage.visibility || "party",
      targetParticipantId: playerMessage.visibility === "private" ? playerMessage.participantId : undefined,
    });

    if (runtime.activeScene.npcBriefs?.length) {
      await ctx.runMutation(internal.sceneRuntime.persistNpcMemories, {
        sessionId,
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
      sessionId,
      dmStatus: "idle",
    });
  }
}
