import {
  incrementSceneStall,
  markSceneCommitment,
  markSceneDiscovery,
  syncSceneTransitionUnlock,
} from "./sceneProgress";
import { internal } from "../../_generated/api";
import { recordSceneFact } from "./sceneFacts";
import { applySceneStateDelta, syncSceneStateFromProgress } from "./sceneState";
import { applyMapInstanceDelta, deriveChangedCellsForInteractable } from "./mapInstances";
import { runInspectResolverGraph } from "./graph/inspectResolverGraph";
import { runSceneActionGraph } from "./graph/sceneActionGraph";
import { resolveSceneScenarioUpdates } from "./scenarioUpdates";
import { runNpcConversationGraph } from "../npc/graph/npcConversationGraph";
import { applyNpcStateDelta } from "../npc/state";
import { getTransitionResultForCell } from "./transitions";

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
  messageId,
  content,
  promptMode,
  sourceKind,
  sourceId,
  sourceLabel,
  visibility = "private",
}) {
  const sceneProgressBefore = await ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  let contribution;
  const interactable = sourceId
    ? (scene.interactables || []).find((entry) => entry.id === sourceId)
    : null;
  const npc = interactable?.kind === "npc_anchor"
    ? (scene.npcBriefs || []).find((entry) => {
        const normalizedLabel = String(interactable.label || "").toLowerCase();
        const normalizedName = String(entry.name || "").toLowerCase();
        return normalizedLabel.includes(normalizedName) || normalizedName.includes(normalizedLabel);
      }) || (scene.npcBriefs || [])[0]
    : sourceKind === "npc"
      ? (scene.npcBriefs || []).find((entry) => String(entry.name) === String(sourceLabel)) || (scene.npcBriefs || [])[0]
      : null;

  if (npc && promptMode === "speak") {
    const memories = await ctx.db
      .query("npcMemories")
      .withIndex("by_npc", (q) => q.eq("npcId", npc.name))
      .order("desc")
      .take(12);
    contribution = await runNpcConversationGraph(ctx, {
      npc,
      scene,
      memories,
      visibility,
    });
  } else if (promptMode === "inspect" || sourceKind === "interactable") {
    contribution = await runInspectResolverGraph({
      scene,
      sourceId,
      sourceLabel,
      visibility,
      sceneProgress: sceneProgressBefore,
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
  const sceneFactsToPersist = [];
  const relatedIds = [String(sessionId), String(runId), sourceId].filter(Boolean);

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

  sceneFactsToPersist.push({
    sceneId: scene._id,
    sourceMessageId: messageId,
    factType: contribution.factType,
    summary: contribution.factSummary || summary,
    isPublic: contribution.isPublic ?? visibility === "party",
    targetParticipantId: visibility === "private" ? participant._id : undefined,
    relatedIds,
  });

  for (const unlock of contribution.unlocks || []) {
    sceneFactsToPersist.push({
      sceneId: scene._id,
      sourceMessageId: messageId,
      factType: "unlock",
      summary: `${participant.characterName || participant.displayName} uncovers ${String(unlock).replace(/[_-]+/g, " ")}.`,
      isPublic: visibility === "party",
      targetParticipantId: visibility === "private" ? participant._id : undefined,
      relatedIds: [...relatedIds, String(unlock)],
    });
  }

  const currentProgress = await ctx.db
    .query("sceneProgress")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  const { scenarioUpdate, scenarioKey, stallRecovery, sceneFactsToPersist: scenarioFacts } =
    await resolveSceneScenarioUpdates(ctx, {
      scene,
      sessionId,
      trigger: sourceKind || promptMode,
      relatedIds,
      currentProgress,
    });
  sceneFactsToPersist.push(...scenarioFacts);

  const changedCells = [
    ...(contribution.changedCells || []),
    ...(sourceId && !npc ? deriveChangedCellsForInteractable(scene, sourceId) : []),
    ...(scenarioUpdate?.changedCells || []),
  ];
  const revealedInteractableIds = [
    ...(contribution.revealInteractableIds || []),
    ...(stallRecovery?.revealInteractableIds || []),
  ];
  const activateTransitionAnchors = Boolean(
    contribution.activateTransitionAnchors ||
      scenarioUpdate?.activateTransitionAnchors ||
      currentProgress?.transitionUnlocked,
  );

  await applyMapInstanceDelta(ctx, {
    sceneId: scene._id,
    revealedInteractableIds,
    changedCells,
    activateTransitionAnchors,
  });

  await applySceneStateDelta(ctx, {
    sceneId: scene._id,
    revealInteractableIds: revealedInteractableIds,
    changedTiles: changedCells,
    addMicroScenarioIds: scenarioKey ? [scenarioKey] : [],
    pressureDelta: Math.max(contribution.pressureDelta || 0, scenarioUpdate?.pressureDelta || 0, stallRecovery?.pressureDelta || 0),
    pressureLabel:
      scenarioUpdate?.pressureDelta || stallRecovery?.pressureDelta
        ? "The scene pressure hardens around the party's position."
        : undefined,
  });

  if (npc) {
    await applyNpcStateDelta(ctx, {
      sceneId: scene._id,
      npcId: npc.name,
      trustDelta: contribution.trustDelta || 0,
      hostilityDelta: contribution.hostilityDelta || 0,
      mood: contribution.mood,
      alertState: contribution.alertState,
    });
  }

  await Promise.all(sceneFactsToPersist.map((fact) => recordSceneFact(ctx, fact)));

  const sessionParticipants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  for (const sessionParticipant of sessionParticipants) {
    if (sessionParticipant.status === "left") {
      continue;
    }

    const refreshedTransitionResult = await getTransitionResultForCell(ctx, {
      scene,
      x: sessionParticipant.sceneX,
      y: sessionParticipant.sceneY,
    });

    if (refreshedTransitionResult?.transitioned) {
      await ctx.runMutation(internal.sessions.advanceSceneFromMapTransition, {
        sessionId,
      });
      break;
    }
  }
}
