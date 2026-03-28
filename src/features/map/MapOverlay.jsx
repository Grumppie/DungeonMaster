import React from "react";

function getSelectedLabel(selectedCell) {
  if (!selectedCell) {
    return null;
  }
  if (selectedCell.interactable?.label) {
    return selectedCell.interactable.label;
  }
  if (selectedCell.combatant?.displayName || selectedCell.combatant?.name) {
    return selectedCell.combatant.displayName || selectedCell.combatant.name;
  }
  return `Tile ${selectedCell.x},${selectedCell.y}`;
}

export function MapOverlay({ sceneProgress, selectedCell, speakerName }) {
  const selectedLabel = getSelectedLabel(selectedCell);

  return (
    <div className="runtime-map-overlay">
      <div className="overview-chips runtime-map-overlay-chips">
        <span className="status-pill">
          Discovery {sceneProgress?.discoveryCompleted ? "1/1" : "0/1"}
        </span>
        <span className="status-pill">
          Commitment {sceneProgress?.commitmentCompleted ? "1/1" : "0/1"}
        </span>
        {sceneProgress?.pressureTier ? (
          <span className="status-pill">Pressure {sceneProgress.pressureTier}</span>
        ) : null}
        {speakerName ? <span className="status-pill">Speaker {speakerName}</span> : null}
        {selectedLabel ? (
          <span className="status-pill runtime-map-selected-label">Selected {selectedLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
