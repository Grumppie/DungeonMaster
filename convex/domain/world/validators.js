import { v } from "convex/values";

export const scenePurposeValidator = v.union(
  v.literal("introduce"),
  v.literal("complicate"),
  v.literal("reveal"),
  v.literal("threaten"),
  v.literal("resolve"),
  v.literal("climax"),
);

export const actStateValidator = v.union(
  v.literal("approach"),
  v.literal("contact"),
  v.literal("complication"),
  v.literal("reveal"),
  v.literal("climax"),
  v.literal("aftermath"),
);

export const pressureTierValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

export const interactableBlueprintValidator = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(
    v.literal("object"),
    v.literal("door"),
    v.literal("clue"),
    v.literal("npc_anchor"),
    v.literal("hazard"),
  ),
  position: v.object({
    x: v.number(),
    y: v.number(),
  }),
  interactionModes: v.array(
    v.union(v.literal("inspect"), v.literal("use"), v.literal("speak"), v.literal("loot")),
  ),
  hidden: v.optional(v.boolean()),
});

export const investigationRuleValidator = v.object({
  sourceId: v.string(),
  requiredMode: v.union(v.literal("inspect"), v.literal("use"), v.literal("speak"), v.literal("loot")),
  unlocks: v.array(v.string()),
  progressDelta: v.optional(v.number()),
});

export const sceneNpcBriefValidator = v.object({
  name: v.string(),
  role: v.string(),
  motive: v.string(),
  voiceTone: v.optional(v.string()),
  voiceProvider: v.optional(v.string()),
  voiceId: v.optional(v.string()),
  stylePrompt: v.optional(v.string()),
});

export const stallRecoveryPlanValidator = v.object({
  mode: v.string(),
  triggerAfterInteractions: v.number(),
});

export const transitionRuleValidator = v.object({
  type: v.string(),
  anchorLabel: v.optional(v.string()),
});

export const landmarkValidator = v.object({
  name: v.string(),
  cells: v.array(v.array(v.number())),
});

export const mapCellValidator = v.object({
  x: v.number(),
  y: v.number(),
  terrainKind: v.string(),
  walkable: v.boolean(),
  blocked: v.boolean(),
  losBlocker: v.boolean(),
  interactableId: v.optional(v.string()),
  landmarkId: v.optional(v.string()),
  hazardState: v.optional(v.string()),
  doorState: v.optional(v.string()),
  variantState: v.optional(v.string()),
  visibilityState: v.string(),
});

export const transitionAnchorValidator = v.object({
  anchorId: v.string(),
  label: v.string(),
  x: v.number(),
  y: v.number(),
  type: v.string(),
  destinationSceneOrder: v.union(v.number(), v.null()),
  requiresTransitionUnlock: v.boolean(),
  blockerReason: v.optional(v.string()),
  isActive: v.boolean(),
});

export const sceneFactValidator = v.object({
  factType: v.string(),
  summary: v.string(),
  isPublic: v.boolean(),
  relatedIds: v.optional(v.array(v.string())),
});
