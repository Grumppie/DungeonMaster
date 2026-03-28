import { cleanupSessionIfInactive } from "./cleanupPolicy";
import { projectParticipant } from "./participantProjection";

export async function getSessionProjectionByJoinCode(ctx, joinCode) {
  const session = await ctx.db
    .query("gameSessions")
    .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode.trim().toUpperCase()))
    .unique();
  if (!session) {
    return null;
  }
  const cleanedSession = await cleanupSessionIfInactive(ctx, session, { mutate: false });
  if (cleanedSession?.status === "archived") {
    return null;
  }

  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", cleanedSession._id))
    .collect();

  return {
    ...cleanedSession,
    participants: participants
      .sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))
      .map(projectParticipant),
  };
}

export async function listPublicSessions(ctx) {
  const sessions = await ctx.db.query("gameSessions").collect();
  const cleanedSessions = [];
  for (const session of sessions) {
    const cleaned = await cleanupSessionIfInactive(ctx, session, { mutate: false });
    if (cleaned) {
      cleanedSessions.push(cleaned);
    }
  }
  const publicSessions = cleanedSessions
    .filter((session) => session.roomPrivacy === "public" && session.status === "lobby")
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 20);

  const projections = [];
  for (const session of publicSessions) {
    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    projections.push({
      ...session,
      seatsOpen: Math.max(0, session.maxPlayers - session.currentPlayerCount),
      participantCount: session.currentPlayerCount,
      hostCharacterName:
        participants.find((participant) => participant.userId === session.hostUserId)
          ?.characterName || "Host",
    });
  }

  return projections;
}

export async function getSessionBootstrap(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    return null;
  }

  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();

  return {
    session,
    participants,
  };
}

export async function getAdventureForSession(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    return null;
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run) {
    return null;
  }

  const scenes = await ctx.db
    .query("adventureScenes")
    .withIndex("by_run", (q) => q.eq("runId", run._id))
    .collect();

  return {
    ...run,
    scenes: scenes.sort((left, right) => left.order - right.order),
  };
}
