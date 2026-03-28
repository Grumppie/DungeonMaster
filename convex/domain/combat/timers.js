export async function getEncounterTurnTimerSeconds(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  return session?.turnTimerSeconds || 20;
}

export async function buildEncounterTurnDeadline(ctx, sessionId, now = Date.now()) {
  const turnTimerSeconds = await getEncounterTurnTimerSeconds(ctx, sessionId);
  return now + turnTimerSeconds * 1000;
}
