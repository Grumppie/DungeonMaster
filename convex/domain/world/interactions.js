import {
  incrementSceneStall,
  markSceneCommitment,
  markSceneDiscovery,
  syncSceneTransitionUnlock,
} from "./sceneProgress";
import { recordSceneFact } from "./sceneFacts";
import { syncSceneStateFromProgress } from "./sceneState";
import { runInspectResolverGraph } from "./graph/inspectResolverGraph";
import { runSceneActionGraph } from "./graph/sceneActionGraph";
import { runScenarioUpdateGraph } from "./graph/scenarioUpdateGraph";
import { runStallRecoveryGraph } from "./graph/stallRecoveryGraph";

function normalizePromptText(content) {
  return String(content || "").trim().toLowerCase();
}

function inferContribution(promptMode, content, sourceKind) {
  const normalized = normalizePromptText(content);
  if (sourceKind === "transition_anchor") {
    return { discovery: false, commitment: true, factType: "transition_attempt" };
  }
  if (sourceKind === "interactable" && promptMode === "inspect") {
    return { discovery: true, commitment: false, factType: "investigation" };
  }
  if (promptMode === "inspect" || normalized.includes("inspect") || normalized.includes("search")) {
    return { discovery: true, commitment: false, factType: "investigation" };
  }
  if (
    promptMode === "declare" ||
    normalized.includes("open") ||
    normalized.includes("push") ||
    normalized.includes("take") ||
    normalized.includes("move") ||
    normalized.includes("force")
  ) {
    return { discovery: false, commitment: true, factType: "commitment" };
  }
  if (promptMode === "speak" || sourceKind === "npc") {
    return { discovery: true, commitment: false, factType: "conversation" };
  }
  return { discovery: false, commitment: false, factType: "note" };
}

export async function applyScenePromptImpact(ctx, {
  sessionId,
  runId,
  scene,
  participant,
  content,
  promptMode,
  sourceKind,
  sourceId,
  sourceLabel,
  visibility = "private",
}) {
  let contribution;
  if (promptMode === "inspect" || sourceKind === "interactable") {
    contribution = await runInspectResolverGraph({
      scene,
      sourceId,
      sourceLabel,
      visibility,
    });
  } else {
    contribution = await runSceneActionGraph({
      scene,
      promptMode,
      sourceKind,
      sourceLabel,
      visibility,
    });
  }

  contribution ||= inferContribution(promptMode, content, sourceKind);

  if (contribution.discovery) {
    await markSceneDiscovery(ctx, scene._id);
  }
  if (contribution.commitment) {
    await markSceneCommitment(ctx, scene._id);
  }
  if (!contribution.discovery && !contribution.commitment) {
    await incrementSceneStall(ctx, scene._id);
  }
  await syncSceneTransitionUnlock(ctx, { sceneId: scene._id });
  await syncSceneStateFromProgress(ctx, { sceneId: scene._id });

  await ctx.db.patch(participant._id, {
    sceneContributionCounter: (participant.sceneContributionCounter || 0) + 1,
    lastMeaningfulSceneActionAt: Date.now(),
    updatedAt: Date.now(),
  });

  const summary =
    visibility === "private"
      ? `${participant.characterName || participant.displayName} privately investigates ${sourceLabel || "the scene"}.`
      : `${participant.characterName || participant.displayName} acts on ${sourceLabel || "the scene"}.`;

  await recordSceneFact(ctx, {
    sceneId: scene._id,
    factType: contribution.factType,
    summary: contribution.factSummary || summary,
    isPublic: contribution.isPublic ?? visibility === "party",
    relatedIds: [String(sessionId), String(runId), sourceId].filter(Boolean),
  });

  const scenarioUpdate = await runScenarioUpdateGraph({
    scene,
    trigger: sourceKind || promptMode,
  });
  if (scenarioUpdate) {
    await ctx.db.insert("sceneMicroScenarios", {
      sceneId: scene._id,
      scenarioKey: scenarioUpdate.scenarioKey,
      status: "active",
      summary: scenarioUpdate.summary,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const currentProgress = await ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const stallRecovery = await runStallRecoveryGraph({
    scene,
    stallCounter: currentProgress?.stallCounter || 0,
  });
  if (stallRecovery) {
    await recordSceneFact(ctx, {
      sceneId: scene._id,
      factType: "stall_recovery",
      summary: stallRecovery.summary,
      isPublic: true,
      relatedIds: [String(sessionId)],
    });
  }
}
