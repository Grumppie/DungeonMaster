export function buildSceneRetrievalQuery({ playerPrompt, runtime, promptMode }) {
  return [
    playerPrompt,
    runtime?.activeScene?.title,
    runtime?.activeScene?.summary,
    runtime?.activeScene?.objectiveText || runtime?.activeScene?.objective,
    promptMode,
  ]
    .filter(Boolean)
    .join(" | ");
}
