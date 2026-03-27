export function judgeNpcMemoryEvent({ npc, scene, event }) {
  const text = `${event?.summary || ""} ${event?.type || ""} ${scene?.title || ""}`.toLowerCase();
  const motive = `${npc?.motive || ""} ${npc?.role || ""}`.toLowerCase();
  let weight = 0.25;

  if (text.includes("killed") || text.includes("died") || text.includes("downed")) {
    weight += 0.45;
  }
  if (text.includes("betray") || text.includes("promise") || text.includes("threat")) {
    weight += 0.25;
  }
  if (text.includes("objective") || text.includes("relic") || text.includes("escaped")) {
    weight += 0.2;
  }
  if (motive && text.includes(motive.split(" ")[0])) {
    weight += 0.1;
  }

  const confidence = Math.min(1, Number(weight.toFixed(2)));
  return {
    memoryType: confidence >= 0.65 ? "key" : "compact",
    confidence,
    weight: confidence >= 0.65 ? Math.max(0.8, confidence) : confidence,
  };
}

