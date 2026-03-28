import { buildSceneRetrievalQuery } from "./queryBuilders";

export function getRetrievalDomainForPromptMode(promptMode) {
  if (promptMode === "ask") {
    return "player_rules";
  }
  if (promptMode === "inspect") {
    return "project_docs";
  }
  return undefined;
}

export function buildRetrievalRequest({ playerPrompt, runtime, promptMode }) {
  return {
    queryText: buildSceneRetrievalQuery({ playerPrompt, runtime, promptMode }),
    limit: 3,
    rulesDomain: getRetrievalDomainForPromptMode(promptMode),
  };
}
