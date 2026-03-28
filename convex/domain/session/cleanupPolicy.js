export async function cleanupSessionIfInactive(ctx, session, { mutate = true } = {}) {
  if (!session || session.status === "archived") {
    return session;
  }
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();
  const activeParticipants = participants.filter((participant) => participant.status !== "left");
  const anyConnected = activeParticipants.some(
    (participant) =>
      participant.presenceState === "online" || participant.presenceState === "reconnecting",
  );
  if (activeParticipants.length || anyConnected) {
    if (activeParticipants.length && !anyConnected) {
      const archivedProjection = {
        ...session,
        status: "archived",
        lockedAt: Date.now(),
        currentPlayerCount: 0,
        hostUserId: undefined,
        updatedAt: Date.now(),
      };
      if (mutate) {
        await ctx.db.patch(session._id, {
          status: archivedProjection.status,
          lockedAt: archivedProjection.lockedAt,
          currentPlayerCount: archivedProjection.currentPlayerCount,
          hostUserId: archivedProjection.hostUserId,
          updatedAt: archivedProjection.updatedAt,
        });
      }
      return archivedProjection;
    }
    return session;
  }
  const archivedProjection = {
    ...session,
    status: "archived",
    lockedAt: Date.now(),
    currentPlayerCount: 0,
    hostUserId: undefined,
    updatedAt: Date.now(),
  };
  if (mutate) {
    await ctx.db.patch(session._id, {
      status: archivedProjection.status,
      lockedAt: archivedProjection.lockedAt,
      currentPlayerCount: archivedProjection.currentPlayerCount,
      hostUserId: archivedProjection.hostUserId,
      updatedAt: archivedProjection.updatedAt,
    });
  }
  return archivedProjection;
}
