import { shapeRetrievalResult, sortByScoreDescending } from "./resultRanking";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getQueryVariants(queryText) {
  const normalizedQuery = normalizeText(queryText);
  if (!normalizedQuery) {
    return [];
  }

  const terms = new Set(normalizedQuery.split(" "));
  const variants = [normalizedQuery];

  if (terms.has("concentration")) {
    variants.push("maintain concentration constitution saving throw taking damage");
  }
  if (terms.has("cover")) {
    variants.push("half cover three quarters cover total cover dexterity saving throws");
  }
  if (terms.has("opportunity") || (terms.has("attack") && terms.has("reaction"))) {
    variants.push("opportunity attack leaves your reach reaction");
  }
  if (terms.has("death") || terms.has("dying")) {
    variants.push("death saving throw 0 hit points");
  }
  if (terms.has("grapple")) {
    variants.push("grappled creature athletics acrobatics escape");
  }
  if (terms.has("stealth") || terms.has("hide")) {
    variants.push("hiding unseen unheard stealth");
  }

  return variants;
}

export function scoreChunkLexically(chunk, queryText) {
  const normalizedChunk = normalizeText(chunk.chunkText);
  const variants = getQueryVariants(queryText);
  if (!variants.length) {
    return 0;
  }
  const primaryTerms = new Set(variants[0].split(" "));

  let score = 0;
  for (const [index, variant] of variants.entries()) {
    const variantWeight = index === 0 ? 3 : 1;
    const terms = [...new Set(variant.split(" ").filter((term) => term.length >= 3))];

    for (const term of terms) {
      if (normalizedChunk.includes(term)) {
        score += 2 * variantWeight;
      }
    }

    if (normalizedChunk.includes(variant)) {
      score += 8 * variantWeight;
    }
  }

  const pageTitle = normalizeText(String(chunk.metadata?.pageTitle ?? ""));
  const queryTitleTerms = variants[0].split(" ").filter((term) => term.length >= 5);
  for (const term of queryTitleTerms) {
    if (pageTitle.includes(term)) {
      score += 2;
    }
  }

  const pageNumber = Number(chunk.metadata?.pageNumber ?? 0);
  if (primaryTerms.has("concentration")) {
    if (normalizedChunk.includes("maintain your concentration")) {
      score += 12;
    }
    if (normalizedChunk.includes("concentrating on a spell")) {
      score += 10;
    }
    if (normalizedChunk.includes("break concentration")) {
      score += 8;
    }
    if (pageNumber >= 170 && pageNumber <= 210) {
      score += 6;
    }
  }
  if (primaryTerms.has("cover")) {
    if (normalizedChunk.includes("half cover")) {
      score += 10;
    }
    if (normalizedChunk.includes("three quarters cover") || normalizedChunk.includes("three quarter cover")) {
      score += 8;
    }
    if (normalizedChunk.includes("total cover")) {
      score += 8;
    }
  }
  if (primaryTerms.has("opportunity") && normalizedChunk.includes("opportunity attack")) {
    score += 10;
  }
  if ((primaryTerms.has("death") || primaryTerms.has("dying")) && normalizedChunk.includes("death saving throw")) {
    score += 10;
  }
  if (
    (primaryTerms.has("concentration") || primaryTerms.has("cover") || primaryTerms.has("death")) &&
    normalizedChunk.includes("armor class") &&
    normalizedChunk.includes("hit points")
  ) {
    score -= 10;
  }

  return score;
}

export function buildLexicalResults({ chunks, sources, queryText, rulesDomain, limit }) {
  const sourceMap = new Map((sources || []).map((source) => [source.sourceKey, source]));
  const scored = (chunks || [])
    .filter((chunk) => !rulesDomain || chunk.rulesDomain === rulesDomain)
    .map((chunk) => ({
      chunk,
      score: scoreChunkLexically(chunk, queryText),
    }))
    .filter((entry) => entry.score > 0);

  return sortByScoreDescending(scored)
    .slice(0, limit)
    .map(({ chunk, score }) =>
      shapeRetrievalResult({
        chunk,
        source: sourceMap.get(chunk.sourceKey),
        score,
      }),
    );
}
