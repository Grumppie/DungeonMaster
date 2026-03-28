import React from "react";

export function PartyStatusStrip({ controlledCombatant, combat, hasArchetype }) {
  if (controlledCombatant) {
    return (
      <div className="player-hud-stats">
        <article><span>HP</span><strong>{controlledCombatant.currentHp}/{controlledCombatant.maxHp}</strong></article>
        <article><span>AC</span><strong>{controlledCombatant.armorClass}</strong></article>
        <article><span>Move</span><strong>{controlledCombatant.speed} ft</strong></article>
        <article><span>Turn</span><strong>{combat?.encounter?.turnTimerEndsAt ? "Live" : "Idle"}</strong></article>
      </div>
    );
  }

  return (
    <p className="beta-copy">
      {hasArchetype
        ? "Your archetype is set. Combat stats will appear here when this scene enters an encounter."
        : "Choose an archetype in the lobby to bind your combat sheet."}
    </p>
  );
}
