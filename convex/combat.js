import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { backfillEncounterCoordinates } from "./domain/combat/formations";
import { buildPreviewPayload } from "./domain/combat/previews";
import { applyPlayerAction } from "./domain/combat/resolver";
import { getOrCreateAppUser } from "./lib/auth";
import {
  activateCombatEncounter as activateCombatEncounterState,
  createEncounterForScene,
  getActiveEncounterForSession,
  loadCombatSnapshot,
  writeEvent,
} from "./domain/combat/state";
import { primeCombatEncounter, resolvePendingTurns } from "./domain/combat/aiTurns";

async function loadEncounterActor(ctx, sessionId) {
  const user = await getOrCreateAppUser(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    throw new Error("No active adventure run found.");
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run?.currentCombatEncounterId) {
    throw new Error("There is no active combat encounter.");
  }

  const encounter = await ctx.db.get(run.currentCombatEncounterId);
  if (!encounter || encounter.status !== "active") {
    throw new Error("The current combat encounter is not active.");
  }

  const participant = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
    .unique();
  if (!participant) {
    throw new Error("You are not part of this session.");
  }

  const combatants = await ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
    .collect();
  const actor = combatants.find((combatant) => combatant.participantId === participant._id);
  if (!actor) {
    throw new Error("No player combatant was found for this participant.");
  }

  return {
    user,
    session,
    run,
    encounter,
    participant,
    combatants,
    actor,
  };
}

export const getForSession = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => getActiveEncounterForSession(ctx, args.sessionId),
});

export const performAction = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    action: v.object({
      type: v.union(
        v.literal("attack"),
        v.literal("castSpell"),
        v.literal("move"),
        v.literal("endTurn"),
        v.literal("secondWind"),
        v.literal("shieldOfFaith"),
      ),
      profileKey: v.optional(v.string()),
      targetCombatantId: v.optional(v.id("combatants")),
      destinationXFeet: v.optional(v.number()),
      destinationYFeet: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { encounter, combatants, actor } = await loadEncounterActor(ctx, args.sessionId);

    await backfillEncounterCoordinates(ctx, encounter._id);

    if (encounter.currentCombatantId !== actor._id) {
      throw new Error("It is not your turn.");
    }
    if (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt) {
      await writeEvent(
        ctx,
        encounter._id,
        encounter.round,
        "turn-expired",
        `${actor.displayName || actor.name} ran out of time.`,
        { actorId: actor._id },
        actor._id,
      );
      await resolvePendingTurns(ctx, encounter._id);
      throw new Error("Your turn expired before the action was confirmed.");
    }

    const normalizedAction =
      args.action.type === "secondWind"
        ? { ...args.action, type: "castSpell", profileKey: "second-wind" }
        : args.action.type === "shieldOfFaith"
          ? { ...args.action, type: "castSpell", profileKey: "shield-of-faith" }
          : args.action;

    await applyPlayerAction(ctx, encounter, actor, combatants, normalizedAction);
    await resolvePendingTurns(ctx, encounter._id);

    const refreshedEncounter = await ctx.db.get(encounter._id);
    if (!refreshedEncounter) {
      throw new Error("Combat encounter could not be refreshed.");
    }
    return loadCombatSnapshot(ctx, refreshedEncounter);
  },
});

export const issuePreview = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    action: v.object({
      type: v.union(v.literal("attack"), v.literal("castSpell"), v.literal("move")),
      profileKey: v.optional(v.string()),
      targetCombatantId: v.optional(v.id("combatants")),
      destinationXFeet: v.optional(v.number()),
      destinationYFeet: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { encounter, combatants, actor } = await loadEncounterActor(ctx, args.sessionId);

    if (encounter.currentCombatantId !== actor._id) {
      throw new Error("It is not your turn.");
    }
    if (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt) {
      throw new Error("Your turn has already expired.");
    }

    const payload = buildPreviewPayload(encounter, actor, combatants, args.action);
    const previewId = await ctx.db.insert("actionPreviews", {
      actorId: actor._id,
      encounterId: encounter._id,
      turnRevision: encounter.turnRevision ?? 0,
      payload,
      expiresAt: encounter.turnTimerEndsAt || Date.now() + 10000,
      createdAt: Date.now(),
    });
    return {
      previewId,
      ...payload,
      expiresAt: encounter.turnTimerEndsAt || Date.now() + 10000,
      turnRevision: encounter.turnRevision ?? 0,
    };
  },
});

export const confirmPreview = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    previewId: v.id("actionPreviews"),
  },
  handler: async (ctx, args) => {
    const { session, run, encounter, actor, combatants } = await loadEncounterActor(ctx, args.sessionId);
    const preview = await ctx.db.get(args.previewId);
    if (!preview) {
      throw new Error("Preview not found.");
    }
    if (!run?.currentCombatEncounterId || run.currentCombatEncounterId !== preview.encounterId) {
      throw new Error("preview_stale");
    }
    if (encounter._id !== preview.encounterId || encounter.status !== "active") {
      throw new Error("preview_stale");
    }
    if ((encounter.turnRevision ?? 0) !== preview.turnRevision) {
      throw new Error("preview_stale");
    }
    if (
      Date.now() > preview.expiresAt ||
      (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt)
    ) {
      throw new Error("turn_expired");
    }
    if (encounter.currentCombatantId !== actor._id || actor._id !== preview.actorId) {
      throw new Error("actor_no_longer_active");
    }

    await applyPlayerAction(ctx, encounter, actor, combatants, preview.payload.action);
    await resolvePendingTurns(ctx, encounter._id);
    return { ok: true, sessionId: session._id };
  },
});

export const primeEncounter = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const { encounter } = await loadEncounterActor(ctx, args.sessionId);

    await backfillEncounterCoordinates(ctx, encounter._id);

    const combatants = await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect();
    const currentCombatant = combatants.find(
      (combatant) => combatant._id === encounter.currentCombatantId,
    );
    if (!currentCombatant || currentCombatant.kind !== "enemy") {
      return loadCombatSnapshot(ctx, encounter);
    }

    await resolvePendingTurns(ctx, encounter._id);
    const refreshedEncounter = await ctx.db.get(encounter._id);
    if (!refreshedEncounter) {
      return null;
    }
    return loadCombatSnapshot(ctx, refreshedEncounter);
  },
});

export async function seedCombatForScene(ctx, { sessionId, runId, scene, participants, activate }) {
  const encounterId = await createEncounterForScene(ctx, {
    sessionId,
    runId,
    scene,
    participants,
    activate,
  });
  if (activate) {
    await primeCombatEncounter(ctx, encounterId);
  }
  return encounterId;
}

export async function activateCombatEncounter(ctx, encounterId) {
  await activateCombatEncounterState(ctx, encounterId);
  await primeCombatEncounter(ctx, encounterId);
}
