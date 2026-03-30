import { loadSceneRuntimeSnapshot } from "./runtimeSnapshot";

export async function getSessionRuntimePayload(ctx, sessionId, participantId) {
  const runtime = await loadSceneRuntimeSnapshot(ctx, sessionId, participantId);
  if (!runtime) {
    return null;
  }

  return {
    run: runtime.run,
    activeScene: runtime.activeScene,
    sceneState: runtime.sceneState,
    sceneProgress: runtime.sceneProgress,
    mapInstance: runtime.mapInstance,
    sceneContext: runtime.sceneContext,
    sceneFacts: runtime.sceneFacts,
    npcStates: runtime.npcStates,
    messages: runtime.messages,
    liveTranscript: runtime.transcriptHistory.slice(-3),
    transcriptHistory: runtime.transcriptHistory,
  };
}
