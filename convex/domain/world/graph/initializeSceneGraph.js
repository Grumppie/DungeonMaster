import { ensureSceneFactsSeeded } from "../sceneFacts";
import { ensureSceneMapInstance } from "../mapInstances";
import { ensureSceneProgress, syncSceneTransitionUnlock } from "../sceneProgress";
import { ensureOpeningMessageForScene } from "../sceneMessages";
import { ensureSceneState, syncSceneStateFromProgress } from "../sceneState";

export async function runInitializeSceneGraph(ctx, { run, scene }) {
  const mapInstance = await ensureSceneMapInstance(ctx, { scene });
  const sceneProgress = await ensureSceneProgress(ctx, {
    scene,
    transitionAnchors: mapInstance?.transitionAnchors || [],
  });
  const sceneFacts = await ensureSceneFactsSeeded(ctx, { scene });
  await syncSceneTransitionUnlock(ctx, { sceneId: scene._id });
  const sceneState = await ensureSceneState(ctx, { scene, sceneProgress, mapInstance });
  await syncSceneStateFromProgress(ctx, { sceneId: scene._id });
  await ensureOpeningMessageForScene(ctx, {
    sessionId: scene.sessionId,
    run,
    scene,
  });

  return {
    mapInstance,
    sceneProgress,
    sceneFacts,
    sceneState,
  };
}
