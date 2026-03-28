import React from "react";

export function MapLegend({ activeScene, mapState, sceneProgress }) {
  return (
    <div className="overview-chips">
      <span className="status-pill">{activeScene?.mapTemplateKey || "grid_beta"}</span>
      <span className="status-pill">5 ft grid</span>
      {mapState?.hasClues ? <span className="status-pill">! clue</span> : null}
      {mapState?.hasHazards ? <span className="status-pill">x hazard</span> : null}
      {mapState?.hasNpcAnchors ? <span className="status-pill">@ talk</span> : null}
      <span className={`status-pill ${sceneProgress?.transitionUnlocked ? "success" : ""}`}>
        {sceneProgress?.transitionUnlocked ? "Exit open" : "Exit locked"}
      </span>
    </div>
  );
}
