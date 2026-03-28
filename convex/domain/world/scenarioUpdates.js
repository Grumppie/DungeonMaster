import { runScenarioUpdateGraph } from "./graph/scenarioUpdateGraph";
import { runStallRecoveryGraph } from "./graph/stallRecoveryGraph";

async function insertScenarioIfNew(ctx, sceneId, scenarioUpdate) {
  if (!scenarioUpdate) {
    return { scenarioKey: null, scenarioFact: null };
  }

  const existingScenarios = await ctx.db
    .query("sceneMicroScenarios")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  const duplicateScenario = existingScenarios.find(
    (entry) => entry.scenarioKey === scenarioUpdate.scenarioKey && entry.status === "active",
  );
  if (duplicateScenario) {
    return { scenarioKey: null, scenarioFact: null };
  }

  const insertedScenarioId = await ctx.db.insert("sceneMicroScenarios", {
    sceneId,
    scenarioKey: scenarioUpdate.scenarioKey,
    status: "active",
    summary: scenarioUpdate.summary,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    scenarioKey: scenarioUpdate.scenarioKey,
    scenarioFact: {
      sceneId,
      factType: "micro_scenario",
      summary: scenarioUpdate.summary,
      isPublic: true,
      relatedIds: [String(insertedScenarioId)],
    },
  };
}

export async function resolveSceneScenarioUpdates(ctx, {
  scene,
  sessionId,
  trigger,
  relatedIds,
  currentProgress,
}) {
  const scenarioUpdate = await runScenarioUpdateGraph({
    scene,
    trigger,
  });
  const { scenarioKey, scenarioFact } = await insertScenarioIfNew(ctx, scene._id, scenarioUpdate);

  const stallRecovery = await runStallRecoveryGraph({
    scene,
    stallCounter: currentProgress?.stallCounter || 0,
  });

  return {
    scenarioUpdate,
    scenarioKey,
    stallRecovery,
    sceneFactsToPersist: [
      ...(scenarioFact
        ? [
            {
              ...scenarioFact,
              relatedIds: [...(relatedIds || []), ...(scenarioFact.relatedIds || [])],
            },
          ]
        : []),
      ...(stallRecovery
        ? [
            {
              sceneId: scene._id,
              factType: "stall_recovery",
              summary: stallRecovery.summary,
              isPublic: true,
              relatedIds: [String(sessionId)],
            },
          ]
        : []),
    ],
  };
}
