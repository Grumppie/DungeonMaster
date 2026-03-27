import { judgeNpcMemoryEvent } from "./memoryJudge";

export function buildNpcMemoryRecord({ npcId, npc, scene, event }) {
  const judged = judgeNpcMemoryEvent({ npc, scene, event });
  return {
    npcId,
    memoryType: judged.memoryType,
    summary: event.summary,
    weight: judged.weight,
    confidence: judged.confidence,
    sourceEventId: event.sourceEventId,
  };
}

export function compactNpcMemories(memories) {
  const keyMemories = memories.filter((memory) => memory.memoryType === "key");
  const compactMemories = memories
    .filter((memory) => memory.memoryType === "compact")
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 8);
  return {
    keyMemories,
    compactSummary: compactMemories.map((memory) => memory.summary).join(" "),
  };
}
