"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { api } from "./_generated/api";
import { runSemanticRetrieval } from "./domain/retrieval/semanticSearch";

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
      const semanticResults = await runSemanticRetrieval(ctx, {
        queryText: args.queryText,
        sourceKey: args.sourceKey,
        rulesDomain: args.rulesDomain,
        limit,
        getChunksByIds: (ids) =>
          ctx.runQuery(api.corpus.getChunksByIds, {
            ids,
          }),
        listSources: () => ctx.runQuery(api.corpus.listSources, {}),
      });

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
