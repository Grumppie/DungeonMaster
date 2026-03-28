import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getOrCreateAppUser } from "./lib/auth";
import {
  getCurrentViewerParticipant,
  getParticipantForSession,
} from "./domain/session/participantAccess";
import {
  appendSceneMessageChunk,
  createDmReplyDraftMessage,
  persistDmReplyMessage,
  persistNpcMemoryRecords,
  persistVoiceEventRecord,
  replaceSceneMessageContent,
  setSessionDmStatus,
} from "./domain/world/messagePersistence";
import { moveParticipantTokenForScene } from "./domain/world/playerMovement";
import { submitPlayerPromptForParticipant } from "./domain/world/playerPrompts";
import { getSessionRuntimePayload } from "./domain/world/runtimeQueries";

export const getForSession = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const viewerParticipant = await getCurrentViewerParticipant(ctx, args.sessionId);
    return getSessionRuntimePayload(ctx, args.sessionId, viewerParticipant?._id);
  },
});

export const submitPlayerPrompt = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    content: v.string(),
    promptMode: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("party"), v.literal("private"))),
    sourceKind: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const participant = await getParticipantForSession(ctx, args.sessionId, user._id);
    if (!participant) {
      throw new Error("You are not part of this session.");
    }
    return submitPlayerPromptForParticipant(ctx, {
      sessionId: args.sessionId,
      participant,
      content: args.content,
      promptMode: args.promptMode,
      visibility: args.visibility,
      sourceKind: args.sourceKind,
      sourceId: args.sourceId,
      sourceLabel: args.sourceLabel,
    });
  },
});

export const shareSceneMessage = mutation({
  args: {
    messageId: v.id("sceneMessages"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found.");
    }

    const ownerParticipantId = message.participantId || message.targetParticipantId;
    if (!ownerParticipantId) {
      throw new Error("Only player-scoped private interactions can be shared.");
    }

    const participant = await ctx.db.get(ownerParticipantId);
    if (!participant || participant.userId !== user._id) {
      throw new Error("Only the owning participant can share this interaction.");
    }

    await ctx.db.patch(message._id, {
      visibility: "party",
      targetParticipantId: undefined,
    });

    const voiceEvents = await ctx.db
      .query("voiceEvents")
      .withIndex("by_room", (q) => q.eq("roomId", message.sessionId))
      .order("desc")
      .take(40);
    const matchingVoiceEvents = voiceEvents.filter(
      (entry) => entry.sceneMessageId === message._id,
    );
    await Promise.all(
      matchingVoiceEvents.map((entry) =>
        ctx.db.patch(entry._id, {
          visibility: "party",
          targetParticipantId: undefined,
        }),
      ),
    );

    const matchingFacts = await ctx.db
      .query("sceneFacts")
      .withIndex("by_scene_source", (q) => q.eq("sceneId", message.sceneId).eq("sourceMessageId", message._id))
      .collect();
    await Promise.all(
      matchingFacts.map((entry) =>
        ctx.db.patch(entry._id, {
          isPublic: true,
          targetParticipantId: undefined,
        }),
      ),
    );
    return { shared: true };
  },
});

export const movePlayerToken = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const participant = await getParticipantForSession(ctx, args.sessionId, user._id);
    if (!participant) {
      throw new Error("You are not part of this session.");
    }
    return moveParticipantTokenForScene(ctx, {
      sessionId: args.sessionId,
      participant,
      x: args.x,
      y: args.y,
    });
  },
});

export const persistDmReply = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    content: v.string(),
    messageType: v.union(v.literal("reply"), v.literal("narration"), v.literal("system")),
    visibility: v.optional(v.union(v.literal("party"), v.literal("private"))),
    targetParticipantId: v.optional(v.id("sessionParticipants")),
    sourceKind: v.optional(v.string()),
    sourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => persistDmReplyMessage(ctx, args),
});

export const createDmReplyDraft = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    messageType: v.union(v.literal("reply"), v.literal("narration"), v.literal("system")),
    visibility: v.optional(v.union(v.literal("party"), v.literal("private"))),
    targetParticipantId: v.optional(v.id("sessionParticipants")),
    sourceKind: v.optional(v.string()),
    sourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => createDmReplyDraftMessage(ctx, args),
});

export const appendToSceneMessage = internalMutation({
  args: {
    messageId: v.id("sceneMessages"),
    chunk: v.string(),
  },
  handler: async (ctx, args) => appendSceneMessageChunk(ctx, args),
});

export const replaceSceneMessage = internalMutation({
  args: {
    messageId: v.id("sceneMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => replaceSceneMessageContent(ctx, args),
});

export const persistVoiceEvent = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    sceneMessageId: v.optional(v.id("sceneMessages")),
    speakerType: v.union(v.literal("dm"), v.literal("npc")),
    speakerId: v.optional(v.string()),
    speakerName: v.string(),
    transcript: v.string(),
    provider: v.union(v.literal("deepgram"), v.literal("elevenlabs")),
    voiceProfileKey: v.string(),
    audioCacheKey: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("party"), v.literal("private"))),
    targetParticipantId: v.optional(v.id("sessionParticipants")),
  },
  handler: async (ctx, args) => persistVoiceEventRecord(ctx, args),
});

export const persistNpcMemories = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    sceneId: v.id("adventureScenes"),
    npcIds: v.array(v.string()),
    eventSummary: v.string(),
    sourceEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => persistNpcMemoryRecords(ctx, args),
});

export const setDmStatus = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    dmStatus: v.union(
      v.literal("idle"),
      v.literal("retrieving"),
      v.literal("responding"),
      v.literal("speaking"),
    ),
  },
  handler: async (ctx, args) => setSessionDmStatus(ctx, args),
});
