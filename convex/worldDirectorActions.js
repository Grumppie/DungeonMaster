"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { previewPlayerIntentWithGraph } from "./lib/gameDirectorGraph";
import { runCreateRunGraph } from "./domain/world/graph/createRunGraph";
import { buildFallbackAdventureBlueprint } from "./domain/world/fallbackBlueprint";

const START_ADVENTURE_GRAPH_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs, timeoutLabel) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms.`)), timeoutMs);
    }),
  ]);
}

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
    let blueprint;
    try {
      blueprint = await withTimeout(
        runCreateRunGraph({
          sessionTitle: bootstrap.session.title,
          partySize: activeParticipants.length,
        }),
        START_ADVENTURE_GRAPH_TIMEOUT_MS,
        "Adventure graph generation",
      );
    } catch (error) {
      console.warn("[WorldDirector] Falling back to deterministic adventure blueprint.", {
        sessionId: String(args.sessionId),
        error: String(error),
      });
      blueprint = buildFallbackAdventureBlueprint(bootstrap.session.title, activeParticipants.length);
    }

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
