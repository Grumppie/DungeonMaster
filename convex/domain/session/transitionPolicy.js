import { getOrCreateAppUser } from "../../lib/auth";
import { advanceSceneState } from "../world/transitions";

export async function advanceSceneAsHost(ctx, sessionId) {
  const user = await getOrCreateAppUser(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    throw new Error("No active adventure run found for this session.");
  }
  if (!session.hostUserId || session.hostUserId !== user._id) {
    throw new Error("Only the host can advance the adventure.");
  }
  return advanceSceneState(ctx, sessionId);
}

export async function advanceSceneFromMap(ctx, sessionId) {
  return advanceSceneState(ctx, sessionId);
}
