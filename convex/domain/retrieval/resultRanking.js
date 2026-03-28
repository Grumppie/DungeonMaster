export function shapeRetrievalResult({ chunk, source, score }) {
  return {
    score,
    sourceKey: chunk.sourceKey,
    sourceLabel: chunk.sourceLabel,
    sourceType: chunk.sourceType,
    authorityLevel: source?.authorityLevel ?? chunk.authorityLevel,
    rulesDomain: source?.rulesDomain ?? chunk.rulesDomain,
    metadata: chunk.metadata,
    excerpt: chunk.chunkText.slice(0, 700),
  };
}

export function sortByScoreDescending(results) {
  return [...results].sort((left, right) => right.score - left.score);
}
