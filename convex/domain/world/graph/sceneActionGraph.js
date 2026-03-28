export async function runSceneActionGraph({ scene, promptMode, sourceKind, sourceLabel, visibility = "private" }) {
  const commitment = promptMode === "declare" || promptMode === "speak" || sourceKind === "transition_anchor";
  const discovery = promptMode === "ask" && sourceKind !== "transition_anchor";

  return {
    discovery,
    commitment,
    factType: commitment ? "commitment" : "conversation",
    factSummary: commitment
      ? `${sourceLabel || scene.title} draws a committed response from the player.`
      : `The player probes ${sourceLabel || scene.title} for more understanding.`,
    isPublic: visibility === "party",
  };
}
