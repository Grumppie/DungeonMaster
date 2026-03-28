function buildOpeningNarration(scene, run) {
  if (scene.sceneOpener) {
    return `${scene.sceneOpener} The party's current objective is ${scene.objectiveText || scene.objective || run.objective}.`;
  }
  if (scene.type === "combat") {
    return `The pressure breaks at ${scene.title}. ${scene.summary} Weapons come free, footing matters, and the next decision will be made under threat.`;
  }
  if (scene.type === "resolution") {
    return `The final pressure gives way at ${scene.title}. ${scene.summary} What the party says and chooses here will color the end of the quest.`;
  }
  return `The scene opens on ${scene.title}. ${scene.summary} The party's current objective is ${scene.objectiveText || scene.objective || run.objective}.`;
}

export async function ensureOpeningMessageForScene(ctx, { sessionId, run, scene }) {
  const existing = await ctx.db
    .query("sceneMessages")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .order("asc")
    .take(1);

  if (existing.length > 0) {
    return existing[0]._id;
  }

  return ctx.db.insert("sceneMessages", {
    sessionId,
    runId: run._id,
    sceneId: scene._id,
    participantId: undefined,
    targetParticipantId: undefined,
    visibility: "party",
    speakerType: "dm",
    speakerLabel: "DM",
    messageType: "narration",
    sourceKind: "scene_opening",
    sourceId: scene._id,
    landmarkRef: undefined,
    sceneVersion: 1,
    content: buildOpeningNarration(scene, run),
    createdAt: Date.now(),
  });
}
