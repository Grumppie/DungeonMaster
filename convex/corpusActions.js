"use node";

import { GoogleGenAI } from "@google/genai";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { api } from "./_generated/api";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 1536);

function normalizeEmbedding(values) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return values;
  }
  return values.map((value) => value / magnitude);
}

async function createEmbedding(input) {
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

export const search = action({
  args: {
    queryText: v.string(),
    limit: v.optional(v.number()),
    sourceKey: v.optional(v.string()),
    rulesDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 5, 12));

    try {
      const queryEmbedding = await createEmbedding(args.queryText);
      if (!queryEmbedding) {
        throw new Error("No query embedding returned.");
      }

      const vectorMatches = await ctx.vectorSearch("corpusChunks", "by_embedding", {
        vector: queryEmbedding,
        limit: limit * 3,
        filter:
          args.sourceKey || args.rulesDomain
            ? (q) => {
                if (args.sourceKey) {
                  return q.eq("sourceKey", args.sourceKey);
                }
                return q.eq("rulesDomain", args.rulesDomain);
              }
            : undefined,
      });

      const chunks = await ctx.runQuery(api.corpus.getChunksByIds, {
        ids: vectorMatches.map((match) => match._id),
      });
      const chunkMap = new Map(chunks.map((chunk) => [chunk._id, chunk]));
      const sources = await ctx.runQuery(api.corpus.listSources, {});
      const sourceMap = new Map(sources.map((source) => [source.sourceKey, source]));

      const semanticResults = vectorMatches
        .map((match) => {
          const chunk = chunkMap.get(match._id);
          if (!chunk) {
            return null;
          }
          if (args.rulesDomain && chunk.rulesDomain !== args.rulesDomain) {
            return null;
          }

          const source = sourceMap.get(chunk.sourceKey);
          return {
            score: match._score,
            sourceKey: chunk.sourceKey,
            sourceLabel: chunk.sourceLabel,
            sourceType: chunk.sourceType,
            authorityLevel: source?.authorityLevel ?? chunk.authorityLevel,
            rulesDomain: source?.rulesDomain ?? chunk.rulesDomain,
            metadata: chunk.metadata,
            excerpt: chunk.chunkText.slice(0, 700),
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      if (semanticResults.length > 0) {
        return semanticResults;
      }
    } catch (error) {
      console.error("Semantic corpus search failed, falling back to lexical search.", error);
    }

    return ctx.runAction(api.corpus.lexicalSearch, {
      queryText: args.queryText,
      limit,
      sourceKey: args.sourceKey,
      rulesDomain: args.rulesDomain,
    });
  },
});
