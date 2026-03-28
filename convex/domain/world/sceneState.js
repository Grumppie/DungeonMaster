import { getSceneProgress } from "./sceneProgress";

function toGateState(completed) {
  return completed ? "complete" : "pending";
}

export async function ensureSceneState(ctx, { scene, sceneProgress, mapInstance }) {
  const existing = await ctx.db
    .query("sceneStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();

  if (existing) {
    return existing;
  }

  const sceneStateId = await ctx.db.insert("sceneStates", {
    sceneId: scene._id,
    sessionId: scene.sessionId,
    runId: scene.runId,
    actState: scene.actState || "approach",
    scenePurpose: scene.scenePurpose || "introduce",
    objectiveText: scene.objectiveText || scene.objective,
    currentPressure: scene.pressure || "steady",
    pressureTier: scene.pressureTier || "medium",
    requiredDiscoveryState: toGateState(sceneProgress?.discoveryCompleted),
    requiredCommitmentState: toGateState(sceneProgress?.commitmentCompleted),
    transitionUnlocked: Boolean(sceneProgress?.transitionUnlocked),
    stallCounter: sceneProgress?.stallCounter || 0,
    lastMeaningfulActionAt: Date.now(),
    visibleLandmarkIds: (mapInstance?.landmarks || []).map((entry) => entry.landmarkId),
    revealedInteractableIds: mapInstance?.revealedInteractableIds || [],
    consumedInteractableIds: [],
    changedTiles: mapInstance?.changedCells || [],
    activeMicroScenarioIds: [],
    hintBudget: sceneProgress?.hintBudget ?? 2,
    updatedAt: Date.now(),
  });

  return ctx.db.get(sceneStateId);
}

export async function syncSceneStateFromProgress(ctx, { sceneId }) {
  const sceneState = await ctx.db
    .query("sceneStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();
  const sceneProgress = await getSceneProgress(ctx, sceneId);

  if (!sceneState || !sceneProgress) {
    return sceneState;
  }

  await ctx.db.patch(sceneState._id, {
    requiredDiscoveryState: toGateState(sceneProgress.discoveryCompleted),
    requiredCommitmentState: toGateState(sceneProgress.commitmentCompleted),
    transitionUnlocked: sceneProgress.transitionUnlocked,
    stallCounter: sceneProgress.stallCounter || 0,
    hintBudget: sceneProgress.hintBudget ?? sceneState.hintBudget,
    updatedAt: Date.now(),
  });

  return ctx.db.get(sceneState._id);
}

export async function buildSceneProjection(ctx, { scene }) {
  const sceneState = await ctx.db
    .query("sceneStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const sceneProgress = await ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const mapInstance = await ctx.db
    .query("sceneMapInstances")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const facts = await ctx.db
    .query("sceneFacts")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .order("asc")
    .collect();

  return {
    sceneState,
    sceneProgress,
    mapInstance,
    sceneFacts: facts,
  };
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function advancePressureTier(current, delta = 0) {
  const order = ["low", "medium", "high", "critical"];
  const index = Math.max(0, order.indexOf(current || "low"));
  return order[Math.min(order.length - 1, index + Math.max(0, delta))];
}

export async function applySceneStateDelta(
  ctx,
  {
    sceneId,
    revealInteractableIds = [],
    changedTiles = [],
    addMicroScenarioIds = [],
    pressureDelta = 0,
    pressureLabel,
  },
) {
  const sceneState = await ctx.db
    .query("sceneStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();

  if (!sceneState) {
    return null;
  }

  await ctx.db.patch(sceneState._id, {
    revealedInteractableIds: unique([
      ...(sceneState.revealedInteractableIds || []),
      ...revealInteractableIds,
    ]),
    changedTiles: unique([...(sceneState.changedTiles || []), ...changedTiles]),
    activeMicroScenarioIds: unique([
      ...(sceneState.activeMicroScenarioIds || []),
      ...addMicroScenarioIds,
    ]),
    currentPressure: pressureLabel || sceneState.currentPressure,
    pressureTier: advancePressureTier(sceneState.pressureTier, pressureDelta),
    lastMeaningfulActionAt: Date.now(),
    updatedAt: Date.now(),
  });

  return ctx.db.get(sceneState._id);
}
