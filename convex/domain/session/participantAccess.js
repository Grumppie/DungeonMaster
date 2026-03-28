import { getCurrentAppUser } from "../../lib/auth";

export async function getCurrentViewerParticipant(ctx, sessionId) {
  const user = await getCurrentAppUser(ctx);
  if (!user) {
    return null;
  }
  return ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", sessionId).eq("userId", user._id))
    .unique();
}

export async function getParticipantForSession(ctx, sessionId, userId) {
  return ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", sessionId).eq("userId", userId))
    .unique();
}
