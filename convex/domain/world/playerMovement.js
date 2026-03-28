import { internal } from "../../_generated/api";
import { getMapCellByCoordinates, getSceneMapInstance } from "./mapInstances";
import { loadSceneRuntimeSnapshot } from "./runtimeSnapshot";
import { getTransitionResultForCell } from "./transitions";

export async function moveParticipantTokenForScene(ctx, {
  sessionId,
  participant,
  x,
  y,
}) {
  const runtime = await loadSceneRuntimeSnapshot(ctx, sessionId, participant._id);
  if (!runtime?.activeScene) {
    throw new Error("No active scene is available.");
  }

  const mapInstance = runtime.mapInstance || (await getSceneMapInstance(ctx, runtime.activeScene._id));
  const inBounds =
    x >= 0 &&
    x < (mapInstance?.width || 12) &&
    y >= 0 &&
    y < (mapInstance?.height || 8);
  if (!inBounds) {
    throw new Error("That tile is outside the current map.");
  }

  const mapCell = getMapCellByCoordinates(mapInstance, x, y);
  if (!mapCell || mapCell.blocked) {
    throw new Error("That tile is blocked by the current terrain.");
  }

  const occupied = (
    await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect()
  ).find(
    (entry) =>
      entry._id !== participant._id &&
      entry.status !== "left" &&
      entry.sceneX === x &&
      entry.sceneY === y,
  );

  if (occupied) {
    throw new Error("Another player is already on that tile.");
  }

  await ctx.db.patch(participant._id, {
    sceneX: x,
    sceneY: y,
    updatedAt: Date.now(),
  });

  const transitionResult = await getTransitionResultForCell(ctx, {
    scene: runtime.activeScene,
    x,
    y,
  });

  if (transitionResult?.transitioned) {
    await ctx.runMutation(internal.sessions.advanceSceneFromMapTransition, {
      sessionId,
    });
  }

  return {
    participantId: participant._id,
    x,
    y,
    transitioned: Boolean(transitionResult?.transitioned),
    transitionBlocked: Boolean(transitionResult?.blocked),
    blockerReason: transitionResult?.blockerReason,
  };
}
