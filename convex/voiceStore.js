import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getVoiceCache = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("voiceCaches")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
  },
});

export const persistVoiceCache = internalMutation({
  args: {
    cacheKey: v.string(),
    provider: v.union(v.literal("deepgram"), v.literal("elevenlabs")),
    voiceId: v.string(),
    transcript: v.string(),
    stylePrompt: v.optional(v.string()),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("voiceCaches")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("voiceCaches", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getRecentVoiceEvents = internalQuery({
  args: {
    roomId: v.id("gameSessions"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("voiceEvents")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(8);
    return recent.filter((entry) => entry.createdAt >= args.since);
  },
});
