export function buildConservativeRetrievalFallback({ runtime, playerName, combat, promptMode }) {
  if (combat?.encounter?.status === "active" && promptMode === "declare") {
    return "Steel is already in motion. Commit that choice on the battle controls, then I will carry the scene forward from the result.";
  }
  return `The pressure in ${runtime.activeScene.title} tightens around ${playerName}. ${runtime.activeScene.summary} State what you test, ask, or attempt next and the table will answer from there.`;
}
