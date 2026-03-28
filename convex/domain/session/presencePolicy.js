export async function setParticipantPresence(ctx, participantId, presenceState) {
  const now = Date.now();
  await ctx.db.patch(participantId, {
    presenceState,
    lastSeenAt: now,
    updatedAt: now,
  });
  return now;
}

export async function markParticipantLeft(ctx, participantId) {
  const now = Date.now();
  await ctx.db.patch(participantId, {
    status: "left",
    presenceState: "offline",
    lastSeenAt: now,
    updatedAt: now,
  });
  return now;
}
