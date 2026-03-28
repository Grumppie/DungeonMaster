import React from "react";

import { MapLegend } from "./MapLegend";
import { MapOverlay } from "./MapOverlay";
import { useMapState } from "./useMapState";

export function SceneGrid({
  participants,
  currentParticipantId,
  combat,
  activeScene,
  mapInstance,
  sceneProgress,
  selectedCell,
  onSelectCell,
  onMovePlayerToken,
  selectedCombatTarget,
  onSelectTarget,
  speakerName,
}) {
  const mapState = useMapState({
    participants,
    currentParticipantId,
    combat,
    activeScene,
    mapInstance,
    sceneProgress,
    selectedCell,
    selectedCombatTarget,
    speakerName,
  });

  return (
    <section className="panel runtime-map-shell">
      <div className="runtime-map-head">
        <div>
          <p className="eyebrow">Map</p>
          <h2>{activeScene?.title || "Awaiting Scene"}</h2>
          <p className="runtime-map-objective">{activeScene?.objective || "No current objective."}</p>
        </div>
        <MapLegend activeScene={activeScene} mapState={mapState} sceneProgress={sceneProgress} />
      </div>
      <div className="runtime-map-stage">
        <MapOverlay
          sceneProgress={sceneProgress}
          selectedCell={selectedCell}
          speakerName={speakerName}
          activeScene={activeScene}
        />
        <div className="runtime-map-grid">
          {mapState.cells.map((cell) => (
            <button
              key={cell.key}
              type="button"
              className={`runtime-map-cell terrain-${cell.terrainClass} ${cell.templateCell?.blocked ? "blocked" : ""} ${cell.boundaryCell ? "boundary" : ""} ${cell.objectiveLead ? "objective-lead" : ""} ${cell.isChanged ? "changed" : ""} ${cell.isSelected ? "selected" : ""} ${cell.isTargeted ? "targeted" : ""} ${cell.isTransitionAnchor ? (cell.transitionUnlocked ? "transition-open" : "transition-locked") : ""}`}
              onClick={() => {
                onSelectCell({
                  x: cell.x,
                  y: cell.y,
                  combatant: cell.combatant,
                  interactable: cell.interactable,
                  terrain: cell.templateCell,
                });
                if (cell.combatant?.side === "enemy" && onSelectTarget) {
                  onSelectTarget(cell.combatant._id);
                }
                if (
                  !mapState.combatActive &&
                  !cell.combatant &&
                  !cell.templateCell?.blocked &&
                  onMovePlayerToken
                ) {
                  void onMovePlayerToken(cell.x, cell.y);
                }
              }}
            >
              {cell.combatant ? (
                <span
                  className={`runtime-token ${cell.combatant.side} ${cell.tokenShape} ${cell.isSpeaking ? "speaking" : ""} ${cell.combatant._id === combat?.currentCombatant?._id ? "current" : ""}`}
                >
                  <strong>{cell.combatant.displayName || cell.combatant.name}</strong>
                  <small>{cell.combatant.currentHp}/{cell.combatant.maxHp}</small>
                </span>
              ) : cell.participant ? (
                <span className={`runtime-player-token ${cell.participant.isCurrentPlayer ? "self" : ""}`}>
                  <strong>{cell.participantLabel}</strong>
                  <small>{cell.participant.visibleName}</small>
                </span>
              ) : cell.interactable ? (
                <span className={`runtime-interactable marker-${cell.marker?.tone || cell.interactable.kind || "object"} ${cell.objectiveLead ? "lead" : ""}`}>
                  <b>{cell.marker?.icon}</b>
                  <span>{cell.interactable.label}</span>
                  <small>{cell.marker?.label}</small>
                </span>
              ) : cell.terrainGlyph ? (
                <span className={`runtime-terrain-glyph ${cell.terrainGlyph}`}>
                  <small>{cell.terrainGlyph}</small>
                </span>
              ) : (
                <span className={`runtime-cell-label ${cell.isSelected ? "visible" : ""}`}>
                  <i />
                  <small>{cell.x},{cell.y}</small>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
