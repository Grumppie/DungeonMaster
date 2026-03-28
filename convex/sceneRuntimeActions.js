"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { respondToPromptAction } from "./domain/world/graph/respondToPrompt";

export const respondToPrompt = action({
  args: {
    sessionId: v.id("gameSessions"),
    playerMessageId: v.id("sceneMessages"),
    promptMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => respondToPromptAction(ctx, args),
});
