import { buildNpcMemoryRecord } from "../npc/memory";

function buildDmMessagePayload(args) {
  return {
    sessionId: args.sessionId,
    runId: args.runId,
    sceneId: args.sceneId,
    participantId: undefined,
    targetParticipantId: args.targetParticipantId,
    visibility: args.visibility || "party",
    speakerType: "dm",
    speakerLabel: "DM",
    messageType: args.messageType,
    sourceKind: args.sourceKind,
    sourceId: args.sourceId,
    landmarkRef: undefined,
    sceneVersion: 1,
  };
}

export async function persistDmReplyMessage(ctx, args) {
  return ctx.db.insert("sceneMessages", {
    ...buildDmMessagePayload(args),
    content: args.content,
    createdAt: Date.now(),
  });
}

export async function createDmReplyDraftMessage(ctx, args) {
  return ctx.db.insert("sceneMessages", {
    ...buildDmMessagePayload(args),
    content: "",
    createdAt: Date.now(),
  });
}

export async function appendSceneMessageChunk(ctx, args) {
  const message = await ctx.db.get(args.messageId);
  if (!message) {
    return null;
  }
  const nextContent = `${message.content || ""}${args.chunk}`;
  await ctx.db.patch(args.messageId, {
    content: nextContent,
  });
  return nextContent;
}

export async function replaceSceneMessageContent(ctx, args) {
  const message = await ctx.db.get(args.messageId);
  if (!message) {
    return null;
  }
  await ctx.db.patch(args.messageId, {
    content: args.content,
  });
  return args.content;
}

export async function persistVoiceEventRecord(ctx, args) {
  return ctx.db.insert("voiceEvents", {
    roomId: args.sessionId,
    speakerType: args.speakerType,
    speakerId: args.speakerId,
    speakerName: args.speakerName,
    transcript: args.transcript,
    provider: args.provider,
    voiceProfileKey: args.voiceProfileKey,
    audioCacheKey: args.audioCacheKey,
    audioUrl: args.audioUrl,
    visibility: args.visibility || "party",
    targetParticipantId: args.targetParticipantId,
    createdAt: Date.now(),
  });
}

export async function persistNpcMemoryRecords(ctx, args) {
  const scene = await ctx.db.get(args.sceneId);
  if (!scene) {
    return [];
  }
  const npcByName = new Map((scene.npcBriefs || []).map((npc) => [npc.name, npc]));
  const now = Date.now();
  const writes = [];

  for (const npcId of args.npcIds) {
    const npc = npcByName.get(npcId) || { name: npcId, role: "npc", motive: "" };
    const record = buildNpcMemoryRecord({
      npcId,
      npc,
      scene,
      event: {
        summary: args.eventSummary,
        sourceEventId: args.sourceEventId,
      },
    });
    writes.push(
      ctx.db.insert("npcMemories", {
        ...record,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  return Promise.all(writes);
}

export async function setSessionDmStatus(ctx, args) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return null;
  }
  await ctx.db.patch(args.sessionId, {
    dmStatus: args.dmStatus,
    updatedAt: Date.now(),
  });
  return args.dmStatus;
}
