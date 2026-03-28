import { buildSceneMapInstance } from "./mapInstances";
import { buildSceneProjection } from "./sceneState";
import { normalizeVisibleMessages, normalizeVoiceEvents } from "./runtimeVisibility";

export const DEFAULT_PROMPT_RAIL = [
  { key: "ask", label: "Ask For A Ruling" },
  { key: "inspect", label: "Survey The Scene" },
  { key: "speak", label: "Speak In Character" },
  { key: "declare", label: "Declare Intent" },
];

export async function loadSceneRuntimeSnapshot(ctx, sessionId, participantId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    return null;
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run) {
    return null;
  }

  const scenes = (
    await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect()
  ).sort((left, right) => left.order - right.order);

  const activeScene = scenes.find((scene) => scene.order === run.activeSceneOrder) || null;
  if (!activeScene) {
    return {
      session,
      run,
      scenes,
      activeScene: null,
      sceneState: null,
      sceneProgress: null,
      mapInstance: null,
      sceneFacts: [],
      messages: [],
      transcriptHistory: [],
    };
  }

  const messages = await ctx.db
    .query("sceneMessages")
    .withIndex("by_scene", (q) => q.eq("sceneId", activeScene._id))
    .order("asc")
    .take(80);
  const voiceEvents = await ctx.db
    .query("voiceEvents")
    .withIndex("by_room", (q) => q.eq("roomId", sessionId))
    .order("desc")
    .take(30);

  const projection = await buildSceneProjection(ctx, { scene: activeScene });
  const mapInstance = projection.mapInstance || buildSceneMapInstance(activeScene);
  const visibleMessages = normalizeVisibleMessages(messages, participantId);
  const visibleVoiceEvents = normalizeVoiceEvents(voiceEvents.reverse(), participantId);
  const { _id: _sceneStateId, _creationTime: _sceneStateCreatedAt, ...sceneStateFields } =
    projection.sceneState || {};

  return {
    session,
    run,
    scenes,
    activeScene: {
      ...activeScene,
      ...sceneStateFields,
    },
    sceneState: projection.sceneState || null,
    sceneProgress: projection.sceneProgress || null,
    mapInstance,
    sceneFacts: projection.sceneFacts || [],
    messages: visibleMessages,
    transcriptHistory: visibleVoiceEvents,
  };
}
