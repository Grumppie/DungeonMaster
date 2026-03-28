import { buildNpcConversationResult } from "../conversation";
import { getSceneNpcState } from "../state";

export async function runNpcConversationGraph(ctx, { npc, scene, memories = [], visibility = "private" }) {
  const npcState = await getSceneNpcState(ctx, { sceneId: scene._id, npcId: npc?.name });
  return buildNpcConversationResult({
    npc,
    npcState,
    memories,
    visibility,
  });
}
