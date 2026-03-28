import React from "react";

import { PlayerBar } from "./PlayerBar";
import { PartyStatusStrip } from "./PartyStatusStrip";

export function PlayerHud({ currentParticipant, controlledCombatant, combat }) {
  if (!currentParticipant) {
    return null;
  }

  const isActiveTurn = combat?.currentCombatant?._id && controlledCombatant?._id === combat.currentCombatant._id;
  const archetypeLabel = currentParticipant.archetypeKey || "No archetype";
  const hasArchetype = Boolean(currentParticipant.archetypeKey);

  return (
    <section className="panel runtime-player-hud">
      <PlayerBar
        currentParticipant={currentParticipant}
        archetypeLabel={archetypeLabel}
        isActiveTurn={isActiveTurn}
      />
      <PartyStatusStrip
        controlledCombatant={controlledCombatant}
        combat={combat}
        hasArchetype={hasArchetype}
      />
    </section>
  );
}
