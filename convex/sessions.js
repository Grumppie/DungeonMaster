import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { roomPrivacyValidator } from "./domain/session/validators";
import {
  getAdventureForSession,
  getSessionBootstrap,
  getSessionProjectionByJoinCode,
  listPublicSessions,
} from "./domain/session/queries";
import {
  chooseParticipantArchetype,
  createSession,
  joinSession,
  leaveSessionByUser,
  startAdventureWithBlueprint as startAdventureWithBlueprintMutation,
  startAdventureWithFallbackBlueprint,
  transferSessionHost,
  updateParticipantPresence,
} from "./domain/session/mutations";
import { advanceSceneAsHost, advanceSceneFromMap } from "./domain/session/transitionPolicy";
import {
  actStateValidator,
  interactableBlueprintValidator,
  investigationRuleValidator,
  landmarkValidator,
  pressureTierValidator,
  sceneNpcBriefValidator,
  scenePurposeValidator,
  stallRecoveryPlanValidator,
  transitionRuleValidator,
} from "./domain/world/validators";

const sceneBlueprintValidator = v.object({
  order: v.number(),
  type: v.string(),
  title: v.string(),
  objective: v.string(),
  objectiveText: v.optional(v.string()),
  summary: v.string(),
  pressure: v.string(),
  pressureTier: v.optional(pressureTierValidator),
  scenePurpose: v.optional(scenePurposeValidator),
  actState: v.optional(actStateValidator),
  requiredDiscovery: v.optional(v.string()),
  requiredCommitment: v.optional(v.string()),
  stallRecoveryPlan: v.optional(stallRecoveryPlanValidator),
  allowedMicroScenarios: v.optional(v.array(v.string())),
  transitionRule: v.optional(transitionRuleValidator),
  landmarks: v.optional(v.array(landmarkValidator)),
  themeTags: v.optional(v.array(v.string())),
  encounterScale: v.string(),
  mapTemplateKey: v.optional(v.string()),
  enemyTheme: v.optional(v.string()),
  rewardPreview: v.optional(v.string()),
  sceneOpener: v.optional(v.string()),
  npcBriefs: v.optional(v.array(sceneNpcBriefValidator)),
  interactables: v.optional(v.array(interactableBlueprintValidator)),
  investigationRules: v.optional(v.array(investigationRuleValidator)),
});

const adventureBlueprintValidator = v.object({
  title: v.string(),
  questHook: v.string(),
  objective: v.string(),
  summary: v.string(),
  scenes: v.array(sceneBlueprintValidator),
});

export const create = mutation({
  args: {
    title: v.string(),
    worldPrompt: v.optional(v.string()),
    displayName: v.string(),
    characterName: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    roomPrivacy: v.optional(roomPrivacyValidator),
    turnTimerSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => createSession(ctx, args),
});

export const join = mutation({
  args: {
    joinCode: v.string(),
    displayName: v.string(),
    characterName: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => joinSession(ctx, args),
});

export const chooseArchetype = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    archetypeKey: v.string(),
  },
  handler: async (ctx, args) => chooseParticipantArchetype(ctx, args),
});

export const getByJoinCode = query({
  args: {
    joinCode: v.string(),
  },
  handler: async (ctx, args) => getSessionProjectionByJoinCode(ctx, args.joinCode),
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => listPublicSessions(ctx),
});

export const transferHost = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    targetParticipantId: v.id("sessionParticipants"),
  },
  handler: async (ctx, args) => transferSessionHost(ctx, args),
});

export const updatePresence = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    presenceState: v.union(v.literal("online"), v.literal("offline"), v.literal("reconnecting")),
  },
  handler: async (ctx, args) => updateParticipantPresence(ctx, args),
});

export const leaveSession = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => leaveSessionByUser(ctx, args),
});

export const getBootstrap = internalQuery({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => getSessionBootstrap(ctx, args.sessionId),
});

export const startAdventureWithBlueprint = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    blueprint: adventureBlueprintValidator,
  },
  handler: async (ctx, args) => startAdventureWithBlueprintMutation(ctx, args),
});

export const startAdventure = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => startAdventureWithFallbackBlueprint(ctx, args),
});

export const getAdventure = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => getAdventureForSession(ctx, args.sessionId),
});

export const advanceScene = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => advanceSceneAsHost(ctx, args.sessionId),
});

export const advanceSceneFromMapTransition = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => advanceSceneFromMap(ctx, args.sessionId),
});
