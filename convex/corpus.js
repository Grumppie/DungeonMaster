import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { api } from "./_generated/api";

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQueryVariants(queryText) {
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

function scoreChunk(chunk, queryText) {
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

export const listSources = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("corpusSources").collect();
    return sources.sort((left, right) => left.sourceLabel.localeCompare(right.sourceLabel));
  },
});

export const listChunks = query({
  args: {
    sourceKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 500, 1000));
    const chunks = args.sourceKey
      ? await ctx.db
          .query("corpusChunks")
          .withIndex("by_source", (q) => q.eq("sourceKey", args.sourceKey))
          .take(limit)
      : await ctx.db.query("corpusChunks").take(limit);

    return chunks.sort((left, right) => {
      if (left.sourceKey === right.sourceKey) {
        return left.chunkIndex - right.chunkIndex;
      }
      return left.sourceLabel.localeCompare(right.sourceLabel);
    });
  },
});

export const getChunksByIds = query({
  args: {
    ids: v.array(v.id("corpusChunks")),
  },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.filter(Boolean);
  },
});

export const beginImport = mutation({
  args: {
    sourceKey: v.string(),
    sourceLabel: v.string(),
    sourceType: v.string(),
    sourcePath: v.optional(v.string()),
    authorityLevel: v.string(),
    rulesDomain: v.string(),
    visibility: v.string(),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("corpusSources")
      .withIndex("by_key", (q) => q.eq("sourceKey", args.sourceKey))
      .unique();

    const payload = {
      sourceLabel: args.sourceLabel,
      sourceType: args.sourceType,
      sourcePath: args.sourcePath,
      authorityLevel: args.authorityLevel,
      rulesDomain: args.rulesDomain,
      visibility: args.visibility,
      chunkCount: 0,
      contentHash: args.contentHash,
      importStatus: "indexing",
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return ctx.db.insert("corpusSources", {
      sourceKey: args.sourceKey,
      ...payload,
      createdAt: now,
    });
  },
});

export const clearSourceChunkBatch = mutation({
  args: {
    sourceKey: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 128, 256));
    const chunks = await ctx.db
      .query("corpusChunks")
      .withIndex("by_source", (q) => q.eq("sourceKey", args.sourceKey))
      .take(batchSize);

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    return {
      deletedCount: chunks.length,
      done: chunks.length < batchSize,
    };
  },
});

export const ingestChunkBatch = mutation({
  args: {
    sourceKey: v.string(),
    sourceLabel: v.string(),
    sourceType: v.string(),
    authorityLevel: v.string(),
    rulesDomain: v.string(),
    visibility: v.string(),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        chunkText: v.string(),
        metadata: v.optional(v.any()),
        embedding: v.optional(v.array(v.number())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const insertedIds = [];

    for (const chunk of args.chunks) {
      const id = await ctx.db.insert("corpusChunks", {
        sourceKey: args.sourceKey,
        sourceLabel: args.sourceLabel,
        sourceType: args.sourceType,
        authorityLevel: args.authorityLevel,
        rulesDomain: args.rulesDomain,
        visibility: args.visibility,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
        createdAt: now,
        updatedAt: now,
      });
      insertedIds.push(id);
    }

    return insertedIds;
  },
});

export const finalizeImport = mutation({
  args: {
    sourceKey: v.string(),
    chunkCount: v.number(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("corpusSources")
      .withIndex("by_key", (q) => q.eq("sourceKey", args.sourceKey))
      .unique();

    if (!source) {
      throw new Error(`Unknown source: ${args.sourceKey}`);
    }

    const now = Date.now();
    await ctx.db.patch(source._id, {
      chunkCount: args.chunkCount,
      importStatus: "ready",
      indexedAt: now,
      updatedAt: now,
    });

    return ctx.db.get(source._id);
  },
});

export const lexicalSearch = action({
  args: {
    queryText: v.string(),
    limit: v.optional(v.number()),
    sourceKey: v.optional(v.string()),
    rulesDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 5, 12));
    const chunks = await ctx.runQuery(api.corpus.listChunks, {
      sourceKey: args.sourceKey,
    });
    const sources = await ctx.runQuery(api.corpus.listSources, {});
    const sourceMap = new Map(sources.map((source) => [source.sourceKey, source]));

    return chunks
      .filter((chunk) => !args.rulesDomain || chunk.rulesDomain === args.rulesDomain)
      .map((chunk) => ({
        chunk,
        score: scoreChunk(chunk, args.queryText),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ chunk, score }) => {
        const source = sourceMap.get(chunk.sourceKey);
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
      });
  },
});
