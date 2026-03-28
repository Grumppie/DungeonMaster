import { DEFAULT_PROMPT_RAIL, loadSceneRuntimeSnapshot } from "./runtimeSnapshot";

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
    sceneFacts: runtime.sceneFacts,
    messages: runtime.messages,
    liveTranscript: runtime.transcriptHistory.slice(-3),
    transcriptHistory: runtime.transcriptHistory,
    promptRail: DEFAULT_PROMPT_RAIL,
  };
}
