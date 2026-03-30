import { buildSceneMapInstance } from "./mapInstances";
import { buildAuthoritativeSceneContext } from "./sceneContext";
import { buildSceneProjection } from "./sceneState";
import { normalizeVisibleMessages, normalizeVisibleSceneFacts, normalizeVoiceEvents } from "./runtimeVisibility";

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
      sceneContext: null,
      sceneFacts: [],
      npcStates: [],
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
  const visibleSceneFacts = normalizeVisibleSceneFacts(projection.sceneFacts || [], participantId);
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  const { _id: _sceneStateId, _creationTime: _sceneStateCreatedAt, ...sceneStateFields } =
    projection.sceneState || {};
  const activeSceneWithProjection = {
    ...activeScene,
    ...sceneStateFields,
  };
  const sceneContext = buildAuthoritativeSceneContext({
    run,
    activeScene: activeSceneWithProjection,
    sceneState: projection.sceneState || null,
    sceneProgress: projection.sceneProgress || null,
    mapInstance,
    sceneFacts: visibleSceneFacts,
    messages: visibleMessages,
    participants,
    viewerParticipantId: participantId,
  });

  return {
    session,
    run,
    scenes,
    activeScene: activeSceneWithProjection,
    sceneState: projection.sceneState || null,
    sceneProgress: projection.sceneProgress || null,
    mapInstance,
    sceneContext,
    sceneFacts: visibleSceneFacts,
    npcStates: projection.npcStates || [],
    messages: visibleMessages,
    transcriptHistory: visibleVoiceEvents,
  };
}
