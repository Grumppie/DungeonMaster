import { buildNpcCombatDecision, buildNpcSceneDecision } from "../decisions";
import { getSceneNpcState } from "../state";

export async function runNpcDecisionGraph(ctx, { npc, sceneId, mode = "scene" }) {
  if (mode === "combat") {
    return {
      npcId: npc?.name || "npc",
      ...buildNpcCombatDecision({ npc }),
    };
  }

  const npcState = sceneId ? await getSceneNpcState(ctx, { sceneId, npcId: npc?.name }) : null;
  return {
    npcId: npc?.name || "npc",
    ...buildNpcSceneDecision({ npc, npcState }),
  };
}
