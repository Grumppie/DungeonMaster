import { GoogleGenAI } from "@google/genai";

import { shapeRetrievalResult } from "./resultRanking";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 1536);

function normalizeEmbedding(values) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return values;
  }
  return values.map((value) => value / magnitude);
}

export async function createRetrievalEmbedding(input) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY is required for semantic corpus search.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: input,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embedding = response.embeddings?.[0]?.values ?? null;
  return embedding ? normalizeEmbedding(embedding) : null;
}

export async function runSemanticRetrieval(ctx, { queryText, sourceKey, rulesDomain, limit, getChunksByIds, listSources }) {
  const queryEmbedding = await createRetrievalEmbedding(queryText);
  if (!queryEmbedding) {
    throw new Error("No query embedding returned.");
  }

  const vectorMatches = await ctx.vectorSearch("corpusChunks", "by_embedding", {
    vector: queryEmbedding,
    limit: limit * 3,
    filter:
      sourceKey || rulesDomain
        ? (q) => {
            if (sourceKey) {
              return q.eq("sourceKey", sourceKey);
            }
            return q.eq("rulesDomain", rulesDomain);
          }
        : undefined,
  });

  const chunks = await getChunksByIds(vectorMatches.map((match) => match._id));
  const chunkMap = new Map(chunks.map((chunk) => [chunk._id, chunk]));
  const sources = await listSources();
  const sourceMap = new Map(sources.map((source) => [source.sourceKey, source]));

  return vectorMatches
    .map((match) => {
      const chunk = chunkMap.get(match._id);
      if (!chunk) {
        return null;
      }
      if (rulesDomain && chunk.rulesDomain !== rulesDomain) {
        return null;
      }
      return shapeRetrievalResult({
        chunk,
        source: sourceMap.get(chunk.sourceKey),
        score: match._score,
      });
    })
    .filter(Boolean)
    .slice(0, limit);
}
