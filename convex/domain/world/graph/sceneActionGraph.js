export async function runSceneActionGraph({ scene, promptMode, sourceKind, sourceLabel, visibility = "private" }) {
  const commitment = promptMode === "declare" || promptMode === "speak" || sourceKind === "transition_anchor";
  const discovery = promptMode === "ask" && sourceKind !== "transition_anchor";
  const lowerLabel = String(sourceLabel || scene.title || "the scene").toLowerCase();
  const activateTransitionAnchors =
    sourceKind === "transition_anchor" ||
    ["gate", "door", "exit", "route", "lever", "bridge"].some((token) => lowerLabel.includes(token));

  return {
    discovery,
    commitment,
    factType: commitment ? "commitment" : "conversation",
    factSummary: commitment
      ? `${sourceLabel || scene.title} draws a committed response from the player.`
      : `The player probes ${sourceLabel || scene.title} for more understanding.`,
    changedCells: [],
    revealInteractableIds: [],
    activateTransitionAnchors,
    pressureDelta: commitment ? 0 : 0,
    isPublic: visibility === "party",
  };
}
