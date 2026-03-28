import { useMemo } from "react";

import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  GRID_FEET_PER_CELL,
  makeGridCellKey,
} from "../../contracts/ui";
import { TERRAIN_KINDS } from "../../contracts/map";
import { buildSceneMapLayout } from "../../../shared/mapTemplates";

function buildCombatantCellMap(combatants) {
  const byCell = new Map();
  for (const combatant of combatants || []) {
    const x = Math.floor((combatant.positionXFeet ?? combatant.positionFeet ?? 0) / GRID_FEET_PER_CELL);
    const y = Math.floor((combatant.positionYFeet ?? 0) / GRID_FEET_PER_CELL);
    byCell.set(makeGridCellKey(x, y), combatant);
  }
  return byCell;
}

function buildParticipantCellMap(participants, currentParticipantId) {
  const byCell = new Map();
  for (const participant of participants || []) {
    if (participant.status === "left") {
      continue;
    }
    if (participant.sceneX == null || participant.sceneY == null) {
      continue;
    }
    byCell.set(makeGridCellKey(participant.sceneX, participant.sceneY), {
      ...participant,
      isCurrentPlayer: participant._id === currentParticipantId,
    });
  }
  return byCell;
}

function getTokenShape(combatant) {
  if (combatant.side === "party") {
    return "circle";
  }
  if ((combatant.displayName || "").toLowerCase().includes("captain")) {
    return "diamond";
  }
  return "square";
}

function getInteractableMarker(interactable) {
  switch (interactable?.kind) {
    case "clue":
      return { icon: "!", label: "Clue", tone: "clue" };
    case "door":
      return { icon: ">", label: "Exit", tone: "door" };
    case "hazard":
      return { icon: "x", label: "Hazard", tone: "hazard" };
    case "npc_anchor":
      return { icon: "@", label: "Talk", tone: "npc" };
    default:
      return { icon: "*", label: "Point", tone: "object" };
  }
}

function getTerrainClass(templateCell) {
  const terrainKind = templateCell?.terrainKind || templateCell?.kind;
  switch (terrainKind) {
    case TERRAIN_KINDS.ROAD:
    case TERRAIN_KINDS.TRAIL:
    case TERRAIN_KINDS.LANE:
    case TERRAIN_KINDS.BRIDGE:
      return "road";
    case TERRAIN_KINDS.GRASS:
      return "grass";
    case TERRAIN_KINDS.STONE:
    case TERRAIN_KINDS.HALL:
      return "stone";
    case TERRAIN_KINDS.BUILDING:
    case TERRAIN_KINDS.WALL:
    case TERRAIN_KINDS.PILLAR:
    case TERRAIN_KINDS.CLIFF:
      return "blocked";
    case TERRAIN_KINDS.DOORWAY:
      return "doorway";
    case TERRAIN_KINDS.CHASM:
      return "void";
    default:
      return templateCell?.blocked ? "blocked" : "open";
  }
}

function getTerrainGlyph(templateCell) {
  const terrainKind = templateCell?.terrainKind || templateCell?.kind;
  switch (terrainKind) {
    case TERRAIN_KINDS.BUILDING:
      return "roof";
    case TERRAIN_KINDS.WALL:
      return "wall";
    case TERRAIN_KINDS.PILLAR:
      return "pillar";
    case TERRAIN_KINDS.CLIFF:
      return "cliff";
    case TERRAIN_KINDS.DOORWAY:
      return "door";
    case TERRAIN_KINDS.SIGNPOST:
      return "sign";
    case TERRAIN_KINDS.TORCH:
      return "torch";
    case TERRAIN_KINDS.CHASM:
      return "void";
    default:
      return "";
  }
}

function buildObjectiveKeywords(activeScene) {
  return String(activeScene?.objective || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function isObjectiveLead(interactable, objectiveKeywords) {
  if (!interactable) {
    return false;
  }
  const haystack = `${interactable.label || ""} ${interactable.kind || ""}`.toLowerCase();
  return objectiveKeywords.some((token) => haystack.includes(token));
}

function isBoundaryCell(x, y, width, height) {
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

function getParticipantTokenLabel(participant) {
  return (participant.visibleName || participant.characterName || participant.displayName || "?")
    .slice(0, 2)
    .toUpperCase();
}

export function useMapState({
  participants,
  currentParticipantId,
  combat,
  activeScene,
  mapInstance,
  sceneProgress,
  selectedCell,
  selectedCombatTarget,
  speakerName,
}) {
  return useMemo(() => {
    const fallbackLayout = buildSceneMapLayout(activeScene);
    const width = mapInstance?.width || DEFAULT_MAP_WIDTH;
    const height = mapInstance?.height || DEFAULT_MAP_HEIGHT;
    const mapCellsByKey = new Map(
      (mapInstance?.cells || []).map((cell) => [makeGridCellKey(cell.x, cell.y), cell]),
    );
    const combatantMap = buildCombatantCellMap(combat?.combatants || []);
    const participantMap = buildParticipantCellMap(participants || [], currentParticipantId);
    const combatActive = combat?.encounter?.status === "active";
    const revealedInteractableIds = new Set(mapInstance?.revealedInteractableIds || []);
    const interactables = (activeScene?.interactables || []).filter(
      (item) => !item.hidden || revealedInteractableIds.has(item.id),
    );
    const objectiveKeywords = buildObjectiveKeywords(activeScene);
    const interactableMap = new Map(
      interactables.map((item) => [makeGridCellKey(item.position.x, item.position.y), item]),
    );
    const transitionUnlocked = Boolean(sceneProgress?.transitionUnlocked);
    const changedCells = new Set(mapInstance?.changedCells || []);

    const cells = Array.from({ length: width * height }, (_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      const key = makeGridCellKey(x, y);
      const combatant = combatantMap.get(key);
      const participant = participantMap.get(key);
      const interactable = interactableMap.get(key);
      const templateCell = mapCellsByKey.get(key) || fallbackLayout.cells.get(key);
      const isSelected = selectedCell?.x === x && selectedCell?.y === y;
      const isTargeted = combatant?._id && combatant._id === selectedCombatTarget;
      const isSpeaking =
        combatant &&
        speakerName &&
        [combatant.displayName, combatant.name].filter(Boolean).includes(speakerName);
      const terrainClass = getTerrainClass(templateCell);
      const marker = interactable ? getInteractableMarker(interactable) : null;
      const objectiveLead = isObjectiveLead(interactable, objectiveKeywords);
      const boundaryCell = isBoundaryCell(x, y, width, height);
      const terrainGlyph = getTerrainGlyph(templateCell);
      const isTransitionAnchor = Boolean(
        mapInstance?.transitionAnchors?.some((anchor) => anchor.x === x && anchor.y === y),
      );
      const isChanged = changedCells.has(key);

      return {
        x,
        y,
        key,
        combatant,
        participant,
        interactable,
        templateCell,
        isSelected,
        isTargeted,
        isSpeaking,
        terrainClass,
        marker,
        tokenShape: combatant ? getTokenShape(combatant) : null,
        participantLabel: participant ? getParticipantTokenLabel(participant) : null,
        objectiveLead,
        boundaryCell,
        terrainGlyph,
        isTransitionAnchor,
        transitionUnlocked,
        isChanged,
      };
    });

    return {
      width,
      height,
      cells,
      combatActive,
      interactables,
      transitionUnlocked,
      hasClues: interactables.some((item) => item.kind === "clue"),
      hasHazards: interactables.some((item) => item.kind === "hazard"),
      hasNpcAnchors: interactables.some((item) => item.kind === "npc_anchor"),
    };
  }, [
    activeScene,
    combat,
    currentParticipantId,
    mapInstance,
    participants,
    sceneProgress?.transitionUnlocked,
    selectedCell,
    selectedCombatTarget,
    speakerName,
  ]);
}
