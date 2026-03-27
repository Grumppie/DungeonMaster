import { v } from "convex/values";

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

