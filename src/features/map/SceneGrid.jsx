import React from "react";
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, GRID_FEET_PER_CELL, makeGridCellKey } from "../../contracts/ui";
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
  switch (templateCell?.kind) {
    case "road":
    case "trail":
    case "lane":
    case "bridge":
      return "road";
    case "grass":
      return "grass";
    case "stone":
    case "hall":
      return "stone";
    case "building":
    case "wall":
    case "pillar":
    case "cliff":
      return "blocked";
    case "doorway":
      return "doorway";
    case "chasm":
      return "void";
    default:
      return templateCell?.blocked ? "blocked" : "open";
  }
}

function getTerrainGlyph(templateCell) {
  switch (templateCell?.kind) {
    case "building":
      return "roof";
    case "wall":
      return "wall";
    case "pillar":
      return "pillar";
    case "cliff":
      return "cliff";
    case "doorway":
      return "door";
    case "signpost":
      return "sign";
    case "torch":
      return "torch";
    case "chasm":
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
  return (participant.visibleName || participant.characterName || participant.displayName || "?").slice(0, 2).toUpperCase();
}

export function SceneGrid({
  participants,
  currentParticipantId,
  combat,
  activeScene,
  selectedCell,
  onSelectCell,
  onMovePlayerToken,
  selectedCombatTarget,
  onSelectTarget,
  speakerName,
}) {
  const width = DEFAULT_MAP_WIDTH;
  const height = DEFAULT_MAP_HEIGHT;
  const mapLayout = buildSceneMapLayout(activeScene);
  const combatantMap = buildCombatantCellMap(combat?.combatants || []);
  const participantMap = buildParticipantCellMap(participants || [], currentParticipantId);
  const combatActive = combat?.encounter?.status === "active";
  const interactables = activeScene?.interactables || [];
  const objectiveKeywords = buildObjectiveKeywords(activeScene);
  const interactableMap = new Map(
    interactables.map((item) => [makeGridCellKey(item.position.x, item.position.y), item]),
  );

  return (
    <section className="panel runtime-map-shell">
      <div className="runtime-map-head">
        <div>
          <p className="eyebrow">Map</p>
          <h2>{activeScene?.title || "Awaiting Scene"}</h2>
          <p className="runtime-map-objective">{activeScene?.objective || "No current objective."}</p>
        </div>
        <div className="overview-chips">
          <span className="status-pill">{activeScene?.mapTemplateKey || "grid_beta"}</span>
          <span className="status-pill">5 ft grid</span>
          <span className="status-pill">! clue</span>
          <span className="status-pill">x hazard</span>
        </div>
      </div>
      <div className="runtime-map-stage">
        <div className="runtime-map-grid">
          {Array.from({ length: width * height }, (_, index) => {
            const x = index % width;
            const y = Math.floor(index / width);
            const key = makeGridCellKey(x, y);
            const combatant = combatantMap.get(key);
            const interactable = interactableMap.get(key);
            const templateCell = mapLayout.cells.get(key);
            const isSelected = selectedCell?.x === x && selectedCell?.y === y;
            const isTargeted = combatant?._id && combatant._id === selectedCombatTarget;
            const isSpeaking =
              combatant && speakerName && [combatant.displayName, combatant.name].filter(Boolean).includes(speakerName);
            const terrainClass = getTerrainClass(templateCell);
            const marker = interactable ? getInteractableMarker(interactable) : null;
            const objectiveLead = isObjectiveLead(interactable, objectiveKeywords);
            const boundaryCell = isBoundaryCell(x, y, width, height);
            const terrainGlyph = getTerrainGlyph(templateCell);

            return (
              <button
                key={key}
                type="button"
                className={`runtime-map-cell terrain-${terrainClass} ${templateCell?.blocked ? "blocked" : ""} ${boundaryCell ? "boundary" : ""} ${objectiveLead ? "objective-lead" : ""} ${isSelected ? "selected" : ""} ${isTargeted ? "targeted" : ""}`}
                onClick={() => {
                  onSelectCell({ x, y, combatant, interactable, terrain: templateCell });
                  if (combatant?.side === "enemy" && onSelectTarget) {
                    onSelectTarget(combatant._id);
                  }
                  if (!combatActive && !combatant && !templateCell?.blocked && onMovePlayerToken) {
                    void onMovePlayerToken(x, y);
                  }
                }}
              >
                {combatant ? (
                  <span
                    className={`runtime-token ${combatant.side} ${getTokenShape(combatant)} ${isSpeaking ? "speaking" : ""} ${combatant._id === combat?.currentCombatant?._id ? "current" : ""}`}
                  >
                    <strong>{combatant.displayName || combatant.name}</strong>
                    <small>{combatant.currentHp}/{combatant.maxHp}</small>
                  </span>
                ) : participantMap.get(key) ? (
                  <span className={`runtime-player-token ${participantMap.get(key).isCurrentPlayer ? "self" : ""}`}>
                    <strong>{getParticipantTokenLabel(participantMap.get(key))}</strong>
                    <small>{participantMap.get(key).visibleName}</small>
                  </span>
                ) : interactable ? (
                  <span className={`runtime-interactable marker-${marker?.tone || interactable.kind || "object"} ${objectiveLead ? "lead" : ""}`}>
                    <b>{marker?.icon}</b>
                    <span>{interactable.label}</span>
                    <small>{marker?.label}</small>
                  </span>
                ) : terrainGlyph ? (
                  <span className={`runtime-terrain-glyph ${terrainGlyph}`}>
                    <small>{terrainGlyph}</small>
                  </span>
                ) : (
                  <span className={`runtime-cell-label ${isSelected ? "visible" : ""}`}>
                    <i />
                    <small>{x},{y}</small>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
