import { getOrCreateAppUser } from "../../lib/auth";
import { getDefaultScenePosition, getNextSeatIndex } from "./participantProjection";
import { cleanupSessionIfInactive } from "./cleanupPolicy";
import { getNextEligibleHostUserId } from "./hostPolicy";
import { markParticipantLeft, setParticipantPresence } from "./presencePolicy";
import { persistAdventureRunFromBlueprint } from "../world/transitions";
import { buildFallbackAdventureBlueprint } from "../world/fallbackBlueprint";

function randomJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function generateUniqueJoinCode(ctx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = randomJoinCode();
    const existing = await ctx.db
      .query("gameSessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode))
      .unique();
    if (!existing) {
      return joinCode;
    }
  }
  throw new Error("Failed to generate a unique join code.");
}

export async function createSession(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const now = Date.now();
  const joinCode = await generateUniqueJoinCode(ctx);

  const sessionId = await ctx.db.insert("gameSessions", {
    joinCode,
    hostUserId: user._id,
    currentRunId: undefined,
    title: args.title.trim() || "Untitled quest",
    worldPrompt: args.worldPrompt?.trim() || undefined,
    roomPrivacy: args.roomPrivacy || "private",
    allowOpenJoin: (args.roomPrivacy || "private") === "public",
    turnTimerSeconds: args.turnTimerSeconds || 20,
    lockedAt: undefined,
    dmStatus: "idle",
    status: "lobby",
    minPlayers: 1,
    maxPlayers: 4,
    currentPlayerCount: 1,
    storylineMode: "adaptive_party_size",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("sessionParticipants", {
    sessionId,
    userId: user._id,
    displayName: args.displayName.trim() || user.displayName || "Host",
    characterName:
      args.characterName?.trim() || args.displayName.trim() || user.displayName || "Host",
    status: "joined",
    presenceState: "online",
    lastSeenAt: now,
    seatIndex: 0,
    ...getDefaultScenePosition(0),
    isAnonymous: args.isAnonymous ?? true,
    joinedAt: now,
    updatedAt: now,
  });

  return {
    sessionId,
    joinCode,
  };
}

export async function joinSession(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const now = Date.now();
  const session = await ctx.db
    .query("gameSessions")
    .withIndex("by_join_code", (q) => q.eq("joinCode", args.joinCode.trim().toUpperCase()))
    .unique();

  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.status !== "lobby") {
    throw new Error("Session is no longer accepting joins.");
  }
  if (session.lockedAt) {
    throw new Error("Session is currently locked.");
  }

  const existingParticipant = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
    .unique();

  if (existingParticipant) {
    await ctx.db.patch(existingParticipant._id, {
      displayName: args.displayName.trim() || existingParticipant.displayName,
      characterName:
        args.characterName?.trim() ||
        existingParticipant.characterName ||
        existingParticipant.displayName,
      status: "joined",
      presenceState: "online",
      lastSeenAt: now,
      isAnonymous: args.isAnonymous ?? existingParticipant.isAnonymous,
      updatedAt: now,
    });
    return { sessionId: session._id, joinCode: session.joinCode };
  }

  if (session.currentPlayerCount >= session.maxPlayers) {
    throw new Error("Session is full.");
  }

  const sessionParticipants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();
  const seatIndex = getNextSeatIndex(sessionParticipants);
  await ctx.db.insert("sessionParticipants", {
    sessionId: session._id,
    userId: user._id,
    displayName: args.displayName.trim() || user.displayName || "Adventurer",
    characterName:
      args.characterName?.trim() || args.displayName.trim() || user.displayName || "Adventurer",
    status: "joined",
    presenceState: "online",
    lastSeenAt: now,
    seatIndex,
    ...getDefaultScenePosition(seatIndex),
    isAnonymous: args.isAnonymous ?? true,
    joinedAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(session._id, {
    currentPlayerCount: session.currentPlayerCount + 1,
    updatedAt: now,
  });

  return { sessionId: session._id, joinCode: session.joinCode };
}

export async function chooseParticipantArchetype(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const participant = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
    .unique();

  if (!participant) {
    throw new Error("Participant not found in this session.");
  }

  await ctx.db.patch(participant._id, {
    archetypeKey: args.archetypeKey,
    status: "ready",
    presenceState: "online",
    lastSeenAt: Date.now(),
    updatedAt: Date.now(),
  });

  return ctx.db.get(participant._id);
}

export async function transferSessionHost(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.hostUserId !== user._id) {
    throw new Error("Only the current host can transfer control.");
  }

  const participant = await ctx.db.get(args.targetParticipantId);
  if (!participant || participant.sessionId !== session._id || !participant.userId) {
    throw new Error("Target participant is not eligible to host.");
  }

  await ctx.db.patch(session._id, {
    hostUserId: participant.userId,
    updatedAt: Date.now(),
  });

  return { hostUserId: participant.userId };
}

export async function updateParticipantPresence(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const participant = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
    .unique();
  if (!participant) {
    throw new Error("Participant not found.");
  }

  const now = await setParticipantPresence(ctx, participant._id, args.presenceState);

  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return { ok: true };
  }

  if (args.presenceState === "offline" && session.hostUserId === user._id) {
    const nextHostUserId = await getNextEligibleHostUserId(ctx, session._id, user._id);
    await ctx.db.patch(session._id, {
      hostUserId: nextHostUserId,
      updatedAt: now,
    });
  }
  await cleanupSessionIfInactive(ctx, session);

  return { ok: true };
}

export async function leaveSessionByUser(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const participant = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
    .unique();
  if (!participant) {
    throw new Error("Participant not found.");
  }

  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const now = await markParticipantLeft(ctx, participant._id);

  const remainingParticipants = (
    await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()
  ).filter((entry) => entry._id !== participant._id && entry.status !== "left");

  if (!remainingParticipants.length) {
    await ctx.db.patch(session._id, {
      currentPlayerCount: 0,
      hostUserId: undefined,
      status: "archived",
      lockedAt: now,
      updatedAt: now,
    });
    return { removed: true };
  }

  const nextHostUserId =
    session.hostUserId === user._id
      ? remainingParticipants.sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))[0]
          ?.userId
      : session.hostUserId;

  await ctx.db.patch(session._id, {
    currentPlayerCount: remainingParticipants.length,
    hostUserId: nextHostUserId,
    updatedAt: now,
  });

  return { removed: false };
}

function ensureAdventureCanStart(session, participants) {
  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.status !== "lobby") {
    throw new Error("This session has already started.");
  }

  const activeParticipants = participants.filter((participant) => participant.status !== "left");
  if (activeParticipants.length < 1) {
    throw new Error("At least one participant must be present to start.");
  }
  const unreadyParticipants = activeParticipants.filter((participant) => !participant.archetypeKey);
  if (unreadyParticipants.length > 0) {
    throw new Error("Every active participant must choose an archetype before the quest begins.");
  }

  return activeParticipants;
}

export async function startAdventureWithBlueprint(ctx, args) {
  const session = await ctx.db.get(args.sessionId);
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
    .collect();
  const activeParticipants = ensureAdventureCanStart(session, participants);

  return persistAdventureRunFromBlueprint(ctx, {
    session,
    activeParticipants,
    blueprint: args.blueprint,
  });
}

export async function startAdventureWithFallbackBlueprint(ctx, args) {
  const user = await getOrCreateAppUser(ctx);
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  if (!session.hostUserId || session.hostUserId !== user._id) {
    throw new Error("Only the host can start the adventure.");
  }

  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
    .collect();
  const activeParticipants = ensureAdventureCanStart(session, participants);
  const blueprint = buildFallbackAdventureBlueprint(session.title, activeParticipants.length, {
    worldPrompt: session.worldPrompt,
  });

  return persistAdventureRunFromBlueprint(ctx, {
    session,
    activeParticipants,
    blueprint,
  });
}
