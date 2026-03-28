import { applyScenePromptImpact } from "./interactions";
import { loadSceneRuntimeSnapshot } from "./runtimeSnapshot";

export async function submitPlayerPromptForParticipant(ctx, {
  sessionId,
  participant,
  content,
  promptMode,
  visibility,
  sourceKind,
  sourceId,
  sourceLabel,
}) {
  const runtime = await loadSceneRuntimeSnapshot(ctx, sessionId, participant._id);
  if (!runtime?.activeScene) {
    throw new Error("No active scene is available.");
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error("Prompt cannot be empty.");
  }

  const resolvedVisibility = visibility || "private";
  const messageId = await ctx.db.insert("sceneMessages", {
    sessionId,
    runId: runtime.run._id,
    sceneId: runtime.activeScene._id,
    participantId: participant._id,
    targetParticipantId: resolvedVisibility === "private" ? participant._id : undefined,
    visibility: resolvedVisibility,
    speakerType: "player",
    speakerLabel: participant.characterName || participant.displayName,
    messageType: "prompt",
    sourceKind,
    sourceId,
    landmarkRef: undefined,
    sceneVersion: 1,
    content: trimmedContent,
    createdAt: Date.now(),
  });

  await applyScenePromptImpact(ctx, {
    sessionId,
    runId: runtime.run._id,
    scene: runtime.activeScene,
    participant,
    messageId,
    content: trimmedContent,
    promptMode: promptMode ?? "auto",
    sourceKind,
    sourceId,
    sourceLabel,
    visibility: resolvedVisibility,
  });

  return {
    messageId,
    promptMode: promptMode ?? "auto",
    visibility: resolvedVisibility,
  };
}
