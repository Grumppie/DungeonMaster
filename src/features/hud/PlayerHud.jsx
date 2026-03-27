import React from "react";

export function PlayerHud({ currentParticipant, controlledCombatant, combat }) {
  if (!currentParticipant) {
    return null;
  }

  const isActiveTurn = combat?.currentCombatant?._id && controlledCombatant?._id === combat.currentCombatant._id;
  const archetypeLabel = currentParticipant.archetypeKey || "No archetype";
  const hasArchetype = Boolean(currentParticipant.archetypeKey);

  return (
    <section className="panel runtime-player-hud">
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
      {controlledCombatant ? (
        <div className="player-hud-stats">
          <article><span>HP</span><strong>{controlledCombatant.currentHp}/{controlledCombatant.maxHp}</strong></article>
          <article><span>AC</span><strong>{controlledCombatant.armorClass}</strong></article>
          <article><span>Move</span><strong>{controlledCombatant.speed} ft</strong></article>
          <article><span>Turn</span><strong>{combat?.encounter?.turnTimerEndsAt ? "Live" : "Idle"}</strong></article>
        </div>
      ) : (
        <p className="beta-copy">
          {hasArchetype
            ? "Your archetype is set. Combat stats will appear here when this scene enters an encounter."
            : "Choose an archetype in the lobby to bind your combat sheet."}
        </p>
      )}
    </section>
  );
}
