export async function runNpcConversationGraph({ npc, scene, trust = 0 }) {
  const tone = trust > 0 ? "more open" : "guarded";
  return {
    npcId: npc?.name || "npc",
    summary: `${npc?.name || "The NPC"} stays ${tone} while talking in ${scene?.title || "the scene"}.`,
  };
}
