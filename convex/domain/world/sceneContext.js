function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function formatUnlockLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeTerrain(mapInstance) {
  const counts = new Map();
  for (const cell of mapInstance?.cells || []) {
    const terrainKind = cell.terrainKind || "unknown";
    counts.set(terrainKind, (counts.get(terrainKind) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([terrainKind, count]) => `${terrainKind} x${count}`);
}

function buildLandmarkMap(mapInstance) {
  const byCell = new Map();

  for (const landmark of mapInstance?.landmarks || []) {
    for (const [x, y] of landmark.cells || []) {
      byCell.set(`${x}:${y}`, landmark.name);
    }
  }

  return byCell;
}

function buildAnchorMap(mapInstance) {
  return new Map(
    (mapInstance?.transitionAnchors || []).map((anchor) => [`${anchor.x}:${anchor.y}`, anchor]),
  );
}

function buildInteractableRuleMap(activeScene) {
  return new Map(
    (activeScene?.investigationRules || []).map((rule) => [rule.sourceId, rule]),
  );
}

function buildVisibleInteractables(activeScene, mapInstance) {
  const revealedIds = new Set(mapInstance?.revealedInteractableIds || []);
  const ruleBySourceId = buildInteractableRuleMap(activeScene);

  return (activeScene?.interactables || [])
    .filter((entry) => !entry.hidden || revealedIds.has(entry.id))
    .map((entry) => {
      const rule = ruleBySourceId.get(entry.id) || null;
      return {
        id: entry.id,
        label: entry.label,
        kind: entry.kind,
        position: entry.position,
        interactionModes: entry.interactionModes || [],
        requiredMode: rule?.requiredMode || null,
        unlocks: (rule?.unlocks || []).map(formatUnlockLabel),
        progressDelta: rule?.progressDelta || 0,
        hasScriptedReveal: Boolean(rule),
      };
    });
}

function buildPartyState(participants, viewerParticipantId, landmarkByCell, anchorByCell) {
  return (participants || [])
    .filter((participant) => participant.status !== "left")
    .sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))
    .map((participant) => {
      const key = `${participant.sceneX}:${participant.sceneY}`;
      const anchor = anchorByCell.get(key) || null;

      return {
        participantId: participant._id,
        displayName:
          participant.characterName ||
          participant.visibleName ||
          participant.displayName ||
          "Player",
        seatIndex: participant.seatIndex ?? 0,
        position: {
          x: participant.sceneX,
          y: participant.sceneY,
        },
        landmark: landmarkByCell.get(key) || null,
        onTransitionAnchor: Boolean(anchor),
        transitionAnchorLabel: anchor?.label || null,
        isViewer: participant._id === viewerParticipantId,
      };
    });
}

function buildTransitionState(mapInstance) {
  return (mapInstance?.transitionAnchors || []).map((anchor) => ({
    anchorId: anchor.anchorId,
    label: anchor.label,
    x: anchor.x,
    y: anchor.y,
    isActive: Boolean(anchor.isActive),
    requiresTransitionUnlock: Boolean(anchor.requiresTransitionUnlock),
    blockerReason: anchor.blockerReason || null,
    destinationSceneOrder: anchor.destinationSceneOrder ?? null,
  }));
}

export function buildAuthoritativeSceneContext({
  run,
  activeScene,
  sceneState,
  sceneProgress,
  mapInstance,
  sceneFacts,
  messages,
  participants,
  viewerParticipantId,
}) {
  if (!run || !activeScene || !mapInstance) {
    return null;
  }

  const landmarkByCell = buildLandmarkMap(mapInstance);
  const anchorByCell = buildAnchorMap(mapInstance);
  const party = buildPartyState(participants, viewerParticipantId, landmarkByCell, anchorByCell);
  const visibleInteractables = buildVisibleInteractables(activeScene, mapInstance);
  const transitions = buildTransitionState(mapInstance);
  const currentViewer = party.find((entry) => entry.isViewer) || null;

  return {
    runTitle: run.title,
    scene: {
      id: activeScene._id,
      order: activeScene.order,
      title: activeScene.title,
      type: activeScene.type,
      purpose: activeScene.scenePurpose || "unknown",
      actState: activeScene.actState || "approach",
      summary: activeScene.summary,
      objective: activeScene.objectiveText || activeScene.objective,
      pressure: sceneState?.currentPressure || activeScene.pressure || "steady",
      pressureTier: sceneState?.pressureTier || activeScene.pressureTier || "medium",
    },
    map: {
      width: mapInstance.width,
      height: mapInstance.height,
      terrainSummary: summarizeTerrain(mapInstance),
      landmarks: (mapInstance.landmarks || []).map((landmark) => ({
        landmarkId: landmark.landmarkId,
        name: landmark.name,
        cells: landmark.cells,
      })),
      changedTiles: unique(mapInstance.changedCells || sceneState?.changedTiles || []),
    },
    gates: {
      discovery: sceneProgress?.discoveryCompleted ? "complete" : "pending",
      commitment: sceneProgress?.commitmentCompleted ? "complete" : "pending",
      transition: sceneProgress?.transitionUnlocked ? "open" : "locked",
      stallCounter: sceneProgress?.stallCounter || 0,
      hintBudget: sceneProgress?.hintBudget ?? sceneState?.hintBudget ?? 0,
    },
    party,
    viewer: currentViewer,
    visibleInteractables,
    transitions,
    recentFacts: (sceneFacts || []).slice(-6).map((fact) => ({
      factType: fact.factType,
      summary: fact.summary,
      isPublic: Boolean(fact.isPublic),
    })),
    recentMessages: (messages || []).slice(-8).map((message) => ({
      speakerLabel: message.speakerLabel,
      speakerType: message.speakerType,
      visibility: message.visibility,
      content: message.content,
    })),
  };
}
