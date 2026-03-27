import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { buildNpcMemoryRecord } from "./domain/npc/memory";
import { getSceneMapCell } from "../shared/mapTemplates";

function buildOpeningNarration(scene, run) {
  if (scene.sceneOpener) {
    return `${scene.sceneOpener} The party's current objective is ${scene.objective || run.objective}.`;
  }
  if (scene.type === "combat") {
    return `The pressure breaks at ${scene.title}. ${scene.summary} Weapons come free, footing matters, and the next decision will be made under threat.`;
  }
  if (scene.type === "resolution") {
    return `The final pressure gives way at ${scene.title}. ${scene.summary} What the party says and chooses here will color the end of the quest.`;
  }
  return `The scene opens on ${scene.title}. ${scene.summary} The party's current objective is ${scene.objective || run.objective}.`;
}

async function getOrCreateAppUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("appUsers")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  const payload = {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
    email: identity.email ?? undefined,
    displayName: identity.name ?? identity.nickname ?? identity.givenName ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const userId = await ctx.db.insert("appUsers", {
    ...payload,
    createdAt: now,
  });
  return ctx.db.get(userId);
}

async function getParticipantForSession(ctx, sessionId, userId) {
  return ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", sessionId).eq("userId", userId))
    .unique();
}

async function loadSceneRuntimeSnapshot(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    return null;
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run) {
    return null;
  }

  const scenes = (
    await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect()
  ).sort((left, right) => left.order - right.order);

  const activeScene = scenes.find((scene) => scene.order === run.activeSceneOrder) || null;
  if (!activeScene) {
    return {
      session,
      run,
      scenes,
      activeScene: null,
      messages: [],
    };
  }

  const messages = await ctx.db
    .query("sceneMessages")
    .withIndex("by_scene", (q) => q.eq("sceneId", activeScene._id))
    .order("asc")
    .take(40);
  const voiceEvents = await ctx.db
    .query("voiceEvents")
    .withIndex("by_room", (q) => q.eq("roomId", sessionId))
    .order("desc")
    .take(20);

  return {
    session,
    run,
    scenes,
    activeScene,
    messages,
    voiceEvents: voiceEvents.reverse(),
  };
}

export async function ensureOpeningMessageForScene(ctx, { sessionId, runId, scene }) {
  const existing = await ctx.db
    .query("sceneMessages")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .order("asc")
    .take(1);

  if (existing.length > 0) {
    return existing[0]._id;
  }

  const content = buildOpeningNarration(scene, { objective: scene.objective });
  const messageId = await ctx.db.insert("sceneMessages", {
    sessionId,
    runId,
    sceneId: scene._id,
    participantId: undefined,
    speakerType: "dm",
    speakerLabel: "DM",
    messageType: "narration",
    content,
    createdAt: Date.now(),
  });
  return messageId;
}

export const getForSession = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const runtime = await loadSceneRuntimeSnapshot(ctx, args.sessionId);
    if (!runtime) {
      return null;
    }

    return {
      run: runtime.run,
      activeScene: runtime.activeScene,
      messages: runtime.messages,
      liveTranscript: runtime.voiceEvents.slice(-3),
      transcriptHistory: runtime.voiceEvents,
      promptRail: [
        { key: "ask", label: "Ask For A Ruling" },
        { key: "inspect", label: "Survey The Scene" },
        { key: "speak", label: "Speak In Character" },
        { key: "declare", label: "Declare Intent" },
      ],
    };
  },
});

export const submitPlayerPrompt = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    content: v.string(),
    promptMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const runtime = await loadSceneRuntimeSnapshot(ctx, args.sessionId);
    if (!runtime?.activeScene) {
      throw new Error("No active scene is available.");
    }

    const participant = await getParticipantForSession(ctx, args.sessionId, user._id);
    if (!participant) {
      throw new Error("You are not part of this session.");
    }

    const content = args.content.trim();
    if (!content) {
      throw new Error("Prompt cannot be empty.");
    }

    const messageId = await ctx.db.insert("sceneMessages", {
      sessionId: args.sessionId,
      runId: runtime.run._id,
      sceneId: runtime.activeScene._id,
      participantId: participant._id,
      speakerType: "player",
      speakerLabel: participant.characterName || participant.displayName,
      messageType: "prompt",
      content,
      createdAt: Date.now(),
    });

    return {
      messageId,
      promptMode: args.promptMode ?? "auto",
    };
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

    const runtime = await loadSceneRuntimeSnapshot(ctx, args.sessionId);
    if (!runtime?.activeScene) {
      throw new Error("No active scene is available.");
    }

    const inBounds = args.x >= 0 && args.x < 12 && args.y >= 0 && args.y < 8;
    if (!inBounds) {
      throw new Error("That tile is outside the current map.");
    }

    const mapCell = getSceneMapCell(runtime.activeScene, args.x, args.y);
    if (mapCell?.blocked) {
      throw new Error("That tile is blocked by the current terrain.");
    }

    const occupied = (
      await ctx.db
        .query("sessionParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()
    ).find(
      (entry) =>
        entry._id !== participant._id &&
        entry.status !== "left" &&
        entry.sceneX === args.x &&
        entry.sceneY === args.y,
    );

    if (occupied) {
      throw new Error("Another player is already on that tile.");
    }

    await ctx.db.patch(participant._id, {
      sceneX: args.x,
      sceneY: args.y,
      updatedAt: Date.now(),
    });

    const interactable = (runtime.activeScene.interactables || []).find(
      (entry) => entry.position?.x === args.x && entry.position?.y === args.y,
    );
    const shouldAdvanceScene = interactable?.kind === "door";

    if (shouldAdvanceScene) {
      await ctx.runMutation(internal.sessions.advanceSceneFromMapTransition, {
        sessionId: args.sessionId,
      });
    }

    return {
      participantId: participant._id,
      x: args.x,
      y: args.y,
      transitioned: shouldAdvanceScene,
    };
  },
});

export const persistDmReply = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    content: v.string(),
    messageType: v.union(v.literal("reply"), v.literal("narration"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sceneMessages", {
      sessionId: args.sessionId,
      runId: args.runId,
      sceneId: args.sceneId,
      participantId: undefined,
      speakerType: "dm",
      speakerLabel: "DM",
      messageType: args.messageType,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const createDmReplyDraft = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    messageType: v.union(v.literal("reply"), v.literal("narration"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sceneMessages", {
      sessionId: args.sessionId,
      runId: args.runId,
      sceneId: args.sceneId,
      participantId: undefined,
      speakerType: "dm",
      speakerLabel: "DM",
      messageType: args.messageType,
      content: "",
      createdAt: Date.now(),
    });
  },
});

export const appendToSceneMessage = internalMutation({
  args: {
    messageId: v.id("sceneMessages"),
    chunk: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    const nextContent = `${message.content || ""}${args.chunk}`;
    await ctx.db.patch(args.messageId, {
      content: nextContent,
    });
    return nextContent;
  },
});

export const replaceSceneMessage = internalMutation({
  args: {
    messageId: v.id("sceneMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });
    return args.content;
  },
});

export const persistVoiceEvent = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    speakerType: v.union(v.literal("dm"), v.literal("npc")),
    speakerId: v.optional(v.string()),
    speakerName: v.string(),
    transcript: v.string(),
    provider: v.union(v.literal("deepgram"), v.literal("elevenlabs")),
    voiceProfileKey: v.string(),
    audioCacheKey: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      createdAt: Date.now(),
    });
  },
});

export const persistNpcMemories = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    sceneId: v.id("adventureScenes"),
    npcIds: v.array(v.string()),
    eventSummary: v.string(),
    sourceEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  },
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
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }
    await ctx.db.patch(args.sessionId, {
      dmStatus: args.dmStatus,
      updatedAt: Date.now(),
    });
    return args.dmStatus;
  },
});
