export function buildNpcSceneDecision({ npc, npcState }) {
  if ((npcState?.hostilityByParty || 0) >= 3) {
    return {
      decisionType: "scene_reaction",
      summary: `${npc.name} shifts into a blocking posture and treats the party like an active threat.`,
    };
  }

  if ((npcState?.trustByParty || 0) >= 2) {
    return {
      decisionType: "scene_reaction",
      summary: `${npc.name} is willing to guide the party toward the next safe move.`,
    };
  }

  return {
    decisionType: "scene_reaction",
    summary: `${npc.name} watches the party carefully and reacts within the current scene bounds.`,
  };
}

export function buildNpcCombatDecision({ npc }) {
  return {
    decisionType: "combat_candidate",
    summary: `${npc.name} proposes a legal combat action candidate.`,
  };
}
