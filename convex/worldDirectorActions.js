"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { previewPlayerIntentWithGraph } from "./lib/gameDirectorGraph";
import { runCreateRunGraph } from "./domain/world/graph/createRunGraph";

export const startAdventureFromGraph = action({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const bootstrap = await ctx.runQuery(internal.sessions.getBootstrap, {
      sessionId: args.sessionId,
    });
    if (!bootstrap) {
      throw new Error("Session not found.");
    }

    const activeParticipants = bootstrap.participants.filter((participant) => participant.status !== "left");
    const blueprint = await runCreateRunGraph({
      sessionTitle: bootstrap.session.title,
      partySize: activeParticipants.length,
    });

    return ctx.runMutation(internal.sessions.startAdventureWithBlueprint, {
      sessionId: args.sessionId,
      blueprint,
    });
  },
});

export const previewIntent = action({
  args: {
    utterance: v.string(),
    actorSheet: v.any(),
  },
  handler: async (_ctx, args) => {
    return previewPlayerIntentWithGraph(args);
  },
});
