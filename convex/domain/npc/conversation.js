import { compactNpcMemories } from "./memory";

function formatReveal(canReveal = []) {
  const primary = canReveal[0];
  return primary ? String(primary).replace(/[_-]+/g, " ") : "local context";
}

function determineConversationTone(npcState, npc) {
  if ((npcState?.hostilityByParty || 0) >= 3) {
    return "hostile";
  }
  if ((npcState?.trustByParty || 0) >= 2) {
    return "open";
  }
  if (String(npc?.role || "").toLowerCase().includes("captain")) {
    return "pressured";
  }
  return "guarded";
}

export function buildNpcConversationResult({ npc, npcState, memories, visibility = "private" }) {
  const tone = determineConversationTone(npcState, npc);
  const memorySummary = compactNpcMemories(memories || []);
  const primaryReveal = formatReveal(npcState?.canReveal);

  const summaryByTone = {
    hostile: `${npc.name} refuses to give ground and treats the approach like a threat, but still betrays hints about ${primaryReveal}.`,
    open: `${npc.name} opens up and shares useful context about ${primaryReveal} without much resistance.`,
    pressured: `${npc.name} answers in clipped, pressured fragments that still expose ${primaryReveal}.`,
    guarded: `${npc.name} stays guarded, revealing only a narrow thread about ${primaryReveal}.`,
  };

  return {
    npcId: npc.name,
    summary: summaryByTone[tone] || summaryByTone.guarded,
    discovery: true,
    commitment: false,
    factType: "npc_conversation",
    factSummary: summaryByTone[tone] || summaryByTone.guarded,
    unlocks: npcState?.canReveal?.slice(0, 1) || [],
    revealInteractableIds: [],
    changedCells: [],
    isPublic: visibility === "party",
    trustDelta: tone === "open" ? 1 : 0,
    hostilityDelta: tone === "hostile" ? 0 : -1,
    mood: tone === "open" ? "cooperative" : tone === "hostile" ? "tense" : "guarded",
    alertState: tone === "hostile" ? "alarmed" : "watchful",
    memorySummary: memorySummary.compactSummary,
  };
}
