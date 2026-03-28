import React from "react";

export function SceneObjectiveCard({ activeScene }) {
  return (
    <div className="runtime-scene-brief">
      <div>
        <p className="eyebrow">Current Scene</p>
        <h1>{activeScene?.title || "Awaiting Scene"}</h1>
        <p className="beta-copy">{activeScene?.summary || "The run has not started yet."}</p>
      </div>
      <div className="overview-chips">
        <span className="status-pill">{activeScene?.objectiveText || activeScene?.objective || "No objective yet"}</span>
      </div>
    </div>
  );
}
