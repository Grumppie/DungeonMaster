import React from "react";

export function PlayerBar({ currentParticipant, archetypeLabel, isActiveTurn }) {
  return (
    <div className="player-hud-card">
      <div>
        <p className="eyebrow">You</p>
        <h3>{currentParticipant.visibleName || currentParticipant.characterName}</h3>
      </div>
      <div className="overview-chips">
        <span className="status-pill">{archetypeLabel}</span>
        {isActiveTurn ? <span className="status-pill active-turn">Your Turn</span> : null}
      </div>
    </div>
  );
}
