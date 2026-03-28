export async function runNpcDecisionGraph({ npc, mode = "scene" }) {
  if (mode === "combat") {
    return {
      npcId: npc?.name || "npc",
      decisionType: "combat_candidate",
      summary: `${npc?.name || "The NPC"} proposes a legal combat action candidate.`,
    };
  }

  return {
    npcId: npc?.name || "npc",
    decisionType: "scene_reaction",
    summary: `${npc?.name || "The NPC"} reacts to the party inside the current scene bounds.`,
  };
}
