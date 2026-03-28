import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { api } from "./_generated/api";
import { buildLexicalResults } from "./domain/retrieval/lexicalSearch";

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
    return buildLexicalResults({
      chunks,
      sources,
      queryText: args.queryText,
      rulesDomain: args.rulesDomain,
      limit,
    });
  },
});
