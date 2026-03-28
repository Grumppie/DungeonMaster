export async function listSceneFacts(ctx, sceneId) {
  return ctx.db
    .query("sceneFacts")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .order("asc")
    .collect();
}

export async function recordSceneFact(ctx, { sceneId, factType, summary, isPublic = true, relatedIds }) {
  return ctx.db.insert("sceneFacts", {
    sceneId,
    factType,
    summary,
    isPublic,
    relatedIds: relatedIds || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function ensureSceneFactsSeeded(ctx, { scene }) {
  const existing = await listSceneFacts(ctx, scene._id);
  if (existing.length > 0) {
    return existing;
  }

  const facts = [
    {
      factType: "objective",
      summary: scene.objectiveText || scene.objective,
      isPublic: true,
    },
    ...(scene.landmarks || []).map((landmark) => ({
      factType: "landmark",
      summary: `${landmark.name} is visible in the current scene.`,
      isPublic: true,
    })),
    ...((scene.interactables || []).filter((entry) => !entry.hidden).map((entry) => ({
      factType: "interactable",
      summary: `${entry.label} can be examined in the current scene.`,
      isPublic: true,
      relatedIds: [entry.id],
    }))),
  ];

  await Promise.all(
    facts.map((fact) =>
      recordSceneFact(ctx, {
        sceneId: scene._id,
        factType: fact.factType,
        summary: fact.summary,
        isPublic: fact.isPublic,
        relatedIds: fact.relatedIds,
      }),
    ),
  );

  return listSceneFacts(ctx, scene._id);
}
