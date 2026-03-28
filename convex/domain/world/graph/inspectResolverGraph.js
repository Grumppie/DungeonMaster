function formatUnlock(unlock) {
  return String(unlock || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runInspectResolverGraph({ scene, sourceId, sourceLabel, visibility = "private" }) {
  const interactable = (scene.interactables || []).find((entry) => entry.id === sourceId);
  const investigationRule = (scene.investigationRules || []).find((rule) => rule.sourceId === sourceId);

  if (!interactable) {
    return {
      discovery: true,
      commitment: false,
      factType: "investigation",
      factSummary: `${sourceLabel || "The player"} studies the current scene more closely.`,
      revealInteractableIds: [],
      changedCells: [],
      activateTransitionAnchors: false,
      isPublic: visibility === "party",
    };
  }

  const unlocks = investigationRule?.unlocks || [];
  const summary = unlocks.length
    ? `${interactable.label} reveals ${unlocks.map(formatUnlock).join(", ")}.`
    : `${interactable.label} yields a closer reading.`;

  return {
    discovery: true,
    commitment: Boolean(investigationRule?.progressDelta && investigationRule.progressDelta > 1),
    factType: interactable.kind === "clue" ? "clue_reveal" : "investigation",
    factSummary: summary,
    revealInteractableIds: [interactable.id],
    changedCells: [`${interactable.position.x}:${interactable.position.y}`],
    unlocks,
    activateTransitionAnchors: unlocks.some((entry) =>
      ["route", "door", "gate", "exit", "safe push"].some((token) =>
        formatUnlock(entry).toLowerCase().includes(token),
      )),
    isPublic: visibility === "party",
  };
}
