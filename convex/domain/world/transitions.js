import { seedCombatForScene } from "../../combat";
import { getDefaultScenePosition } from "../session/participantProjection";
import { getSceneMapInstance, getTransitionAnchorForCell } from "./mapInstances";
import { runInitializeSceneGraph } from "./graph/initializeSceneGraph";
import { runTransitionGraph } from "./graph/transitionGraph";

export async function initializeSceneRuntimeArtifacts(ctx, { run, scene }) {
  return runInitializeSceneGraph(ctx, { run, scene });
}

export async function persistAdventureRunFromBlueprint(ctx, { session, activeParticipants, blueprint }) {
  const now = Date.now();
  const runId = await ctx.db.insert("adventureRuns", {
    sessionId: session._id,
    title: blueprint.title,
    status: "active",
    partySize: activeParticipants.length,
    questHook: blueprint.questHook,
    objective: blueprint.objective,
    summary: blueprint.summary,
    activeSceneOrder: 1,
    totalScenes: blueprint.scenes.length,
    createdAt: now,
    startedAt: now,
    updatedAt: now,
  });

  let firstSceneRecord = null;

  for (const scene of blueprint.scenes) {
    const sceneId = await ctx.db.insert("adventureScenes", {
      runId,
      sessionId: session._id,
      order: scene.order,
      type: scene.type,
      status: scene.order === 1 ? "active" : "pending",
      title: scene.title,
      objective: scene.objective,
      objectiveText: scene.objectiveText,
      summary: scene.summary,
      pressure: scene.pressure,
      scenePurpose: scene.scenePurpose,
      actState: scene.actState,
      requiredDiscovery: scene.requiredDiscovery,
      requiredCommitment: scene.requiredCommitment,
      stallRecoveryPlan: scene.stallRecoveryPlan,
      allowedMicroScenarios: scene.allowedMicroScenarios,
      transitionRule: scene.transitionRule,
      landmarks: scene.landmarks,
      themeTags: scene.themeTags,
      encounterScale: scene.encounterScale,
      mapTemplateKey: scene.mapTemplateKey,
      enemyTheme: scene.enemyTheme,
      rewardPreview: scene.rewardPreview,
      sceneOpener: scene.sceneOpener,
      npcBriefs: scene.npcBriefs,
      interactables: scene.interactables,
      investigationRules: scene.investigationRules,
      createdAt: now,
      updatedAt: now,
    });

    const hydratedScene = { _id: sceneId, runId, sessionId: session._id, ...scene };

    if (scene.type === "combat") {
      const encounterId = await seedCombatForScene(ctx, {
        sessionId: session._id,
        runId,
        scene: {
          _id: sceneId,
          encounterScale: scene.encounterScale,
          title: scene.title,
        },
        participants: activeParticipants,
        activate: scene.order === 1,
      });
      await ctx.db.patch(sceneId, {
        combatEncounterId: encounterId,
        updatedAt: now,
      });
      if (scene.order === 1) {
        await ctx.db.patch(runId, {
          currentCombatEncounterId: encounterId,
          updatedAt: now,
        });
      }
    }

    await initializeSceneRuntimeArtifacts(ctx, {
      run: { _id: runId, objective: blueprint.objective },
      scene: hydratedScene,
    });

    if (scene.order === 1) {
      firstSceneRecord = hydratedScene;
    }
  }

  await ctx.db.patch(session._id, {
    currentRunId: runId,
    status: "active",
    startedAt: now,
    updatedAt: now,
  });

  return {
    runId,
    firstSceneRecord,
    sceneCount: blueprint.scenes.length,
    partySize: activeParticipants.length,
  };
}

export async function advanceSceneState(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    throw new Error("No active adventure run found for this session.");
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run || run.status !== "active") {
    throw new Error("Adventure is not in an active state.");
  }

  const scenes = (
    await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect()
  ).sort((left, right) => left.order - right.order);

  const currentScene = scenes.find((scene) => scene.order === run.activeSceneOrder);
  if (!currentScene) {
    throw new Error("Current scene not found.");
  }

  if (currentScene.type === "combat") {
    if (!currentScene.combatEncounterId) {
      throw new Error("Current combat scene is missing its encounter.");
    }
    const currentEncounter = await ctx.db.get(currentScene.combatEncounterId);
    if (!currentEncounter || currentEncounter.status !== "completed") {
      throw new Error("Finish the current combat encounter before advancing.");
    }
  }

  const now = Date.now();
  await ctx.db.patch(currentScene._id, {
    status: "completed",
    updatedAt: now,
  });

  const nextScene = scenes.find((scene) => scene.order === run.activeSceneOrder + 1);
  if (!nextScene) {
    await ctx.db.patch(run._id, {
      status: "completed",
      currentCombatEncounterId: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(session._id, {
      status: "completed",
      updatedAt: now,
    });
    return {
      completed: true,
      nextSceneId: null,
    };
  }

  await ctx.db.patch(nextScene._id, {
    status: "active",
    updatedAt: now,
  });
  await ctx.db.patch(run._id, {
    activeSceneOrder: nextScene.order,
    currentCombatEncounterId: nextScene.combatEncounterId,
    updatedAt: now,
  });

  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  await Promise.all(
    participants
      .filter((participant) => participant.status !== "left")
      .map((participant) =>
        ctx.db.patch(participant._id, {
          ...getDefaultScenePosition(participant.seatIndex ?? 0),
          updatedAt: now,
        }),
      ),
  );

  await initializeSceneRuntimeArtifacts(ctx, {
    run,
    scene: nextScene,
  });

  return {
    completed: false,
    nextSceneId: nextScene._id,
  };
}

export async function getTransitionResultForCell(ctx, { scene, x, y }) {
  const mapInstance = await getSceneMapInstance(ctx, scene._id);
  const anchor = getTransitionAnchorForCell(mapInstance, x, y);
  const progress = await ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const result = await runTransitionGraph({
    sceneProgress: progress,
    anchor,
  });

  if (!anchor) {
    return null;
  }

  if (!result.allowed) {
    return {
      transitioned: false,
      blocked: true,
      anchor,
      blockerReason: result.blockerReason,
    };
  }

  return {
    transitioned: true,
    blocked: false,
    anchor: {
      ...anchor,
      isActive: true,
    },
  };
}
