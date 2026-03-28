export async function getNextEligibleHostUserId(ctx, sessionId, excludeUserId) {
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  return participants
    .filter(
      (participant) =>
        participant.userId &&
        participant.status !== "left" &&
        participant.userId !== excludeUserId,
    )
    .sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))[0]?.userId;
}
