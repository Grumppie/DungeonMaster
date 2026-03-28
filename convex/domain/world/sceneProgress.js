import { inferRequiredCommitment, inferRequiredDiscovery } from "./sceneProgressDefaults";

export async function getSceneProgress(ctx, sceneId) {
  return ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();
}

export async function ensureSceneProgress(ctx, { scene, transitionAnchors }) {
  const existing = await getSceneProgress(ctx, scene._id);
  if (existing) {
    return existing;
  }
  const progressId = await ctx.db.insert("sceneProgress", {
    sceneId: scene._id,
    requiredDiscovery: inferRequiredDiscovery(scene),
    requiredCommitment: inferRequiredCommitment(scene),
    discoveryCompleted: false,
    commitmentCompleted: false,
    transitionUnlocked: false,
    stallCounter: 0,
    hintBudget: 2,
    transitionAnchorIds: (transitionAnchors || []).map((anchor) => anchor.anchorId),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ctx.db.get(progressId);
}

export async function markSceneDiscovery(ctx, sceneId) {
  const progress = await getSceneProgress(ctx, sceneId);
  if (!progress || progress.discoveryCompleted) {
    return progress;
  }
  await ctx.db.patch(progress._id, {
    discoveryCompleted: true,
    updatedAt: Date.now(),
  });
  return ctx.db.get(progress._id);
}

export async function markSceneCommitment(ctx, sceneId) {
  const progress = await getSceneProgress(ctx, sceneId);
  if (!progress || progress.commitmentCompleted) {
    return progress;
  }
  await ctx.db.patch(progress._id, {
    commitmentCompleted: true,
    updatedAt: Date.now(),
  });
  return ctx.db.get(progress._id);
}

export async function incrementSceneStall(ctx, sceneId) {
  const progress = await getSceneProgress(ctx, sceneId);
  if (!progress) {
    return null;
  }
  await ctx.db.patch(progress._id, {
    stallCounter: (progress.stallCounter || 0) + 1,
    updatedAt: Date.now(),
  });
  return ctx.db.get(progress._id);
}

export async function syncSceneTransitionUnlock(ctx, { sceneId }) {
  const progress = await getSceneProgress(ctx, sceneId);
  if (!progress) {
    return null;
  }
  const unlocked = Boolean(progress.discoveryCompleted && progress.commitmentCompleted);
  if (progress.transitionUnlocked === unlocked) {
    return progress;
  }
  await ctx.db.patch(progress._id, {
    transitionUnlocked: unlocked,
    updatedAt: Date.now(),
  });
  return ctx.db.get(progress._id);
}
