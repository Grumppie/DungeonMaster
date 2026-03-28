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
      isPublic: visibility === "party",
    };
  }

  return {
    discovery: true,
    commitment: false,
    factType: interactable.kind === "clue" ? "clue_reveal" : "investigation",
    factSummary: investigationRule?.unlocks?.length
      ? `${interactable.label} reveals ${investigationRule.unlocks.join(", ")}.`
      : `${interactable.label} yields a closer reading.`,
    revealInteractableIds: [interactable.id],
    unlocks: investigationRule?.unlocks || [],
    isPublic: visibility === "party",
  };
}
