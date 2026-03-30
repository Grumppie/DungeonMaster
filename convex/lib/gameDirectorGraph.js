"use node";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { applyWorldSeedToBlueprint } from "../domain/world/promptDrivenBlueprint";
import { enrichNpcVoiceProfiles } from "./voiceProfiles";

const sceneNpcSchema = z.object({
  name: z.string(),
  role: z.string(),
  motive: z.string(),
  voiceTone: z.string().nullable().default(null),
});

const storyFrameSchema = z.object({
  title: z.string(),
  questHook: z.string(),
  objective: z.string(),
  summary: z.string(),
  visualTheme: z.string(),
  enemyTheme: z.string(),
});

const sceneSchema = z.object({
  order: z.number(),
  type: z.enum(["intro", "exploration", "combat", "resolution"]),
  title: z.string(),
  objective: z.string(),
  summary: z.string(),
  pressure: z.string(),
  encounterScale: z.string(),
  mapTemplateKey: z.string().nullable().default(null),
  rewardPreview: z.string().nullable().default(null),
  sceneOpener: z.string().nullable().default(null),
  npcBriefs: z.array(sceneNpcSchema).default([]),
  interactables: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(["object", "door", "clue", "npc_anchor", "hazard"]),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
        interactionModes: z.array(z.enum(["inspect", "use", "speak", "loot"])),
      }),
    )
    .default([]),
  investigationRules: z
    .array(
      z.object({
        sourceId: z.string(),
        requiredMode: z.enum(["inspect", "use", "speak", "loot"]),
        unlocks: z.array(z.string()),
        progressDelta: z.number().nullable().default(null),
      }),
    )
    .default([]),
});

const actionIntentSchema = z.object({
  intentType: z.enum(["combat_action", "scene_action", "question", "table_talk"]),
  requestedAbility: z.string().nullable().default(null),
  requestedTarget: z.string().nullable().default(null),
  requestedPoint: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
});

const AdventureGraphState = Annotation.Root({
  sessionTitle: Annotation(),
  worldPrompt: Annotation(),
  partySize: Annotation(),
  storyFrame: Annotation(),
  scenes: Annotation(),
  blueprint: Annotation(),
});

function getOpenAIModel(modelName = process.env.OPENAI_WORLD_MODEL || process.env.OPENAI_DM_MODEL || "gpt-4.1-mini") {
  return new ChatOpenAI({
    model: modelName,
    temperature: 0.9,
  });
}

function toOptionalString(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function toOptionalNumber(value) {
  return value === null || value === undefined ? undefined : value;
}

function normalizeNpcBrief(npc) {
  return {
    name: npc.name,
    role: npc.role,
    motive: npc.motive,
    voiceTone: toOptionalString(npc.voiceTone),
    voiceProvider: toOptionalString(npc.voiceProvider),
    voiceId: toOptionalString(npc.voiceId),
    stylePrompt: toOptionalString(npc.stylePrompt),
  };
}

function normalizeInteractable(interactable) {
  return {
    id: interactable.id,
    label: interactable.label,
    kind: interactable.kind,
    position: interactable.position,
    interactionModes: interactable.interactionModes || [],
  };
}

function normalizeInvestigationRule(rule) {
  return {
    sourceId: rule.sourceId,
    requiredMode: rule.requiredMode,
    unlocks: rule.unlocks || [],
    progressDelta: toOptionalNumber(rule.progressDelta),
  };
}

function normalizeScene(scene) {
  return {
    order: scene.order,
    type: scene.type,
    title: scene.title,
    objective: scene.objective,
    summary: scene.summary,
    pressure: scene.pressure,
    encounterScale: scene.encounterScale,
    mapTemplateKey: toOptionalString(scene.mapTemplateKey) || (scene.type === "combat" ? "arena_bridge" : "investigation_hall"),
    rewardPreview: toOptionalString(scene.rewardPreview),
    sceneOpener: toOptionalString(scene.sceneOpener),
    npcBriefs: enrichNpcVoiceProfiles((scene.npcBriefs || []).map(normalizeNpcBrief)),
    interactables: (scene.interactables || []).map(normalizeInteractable),
    investigationRules: (scene.investigationRules || []).map(normalizeInvestigationRule),
  };
}

function buildFallbackBlueprint(sessionTitle, partySize, worldPrompt) {
  const title = sessionTitle?.trim() || "Frontier Rush";
  const scenes = [
      {
        order: 1,
        type: "intro",
        title: "Hot Drop",
        objective: "Absorb the brief, read the threat, and choose the first push.",
        summary: "The DM opens on urgency and a route already contested by a rival faction.",
        pressure: "rising",
        encounterScale: "none",
        mapTemplateKey: "intro_causeway",
        rewardPreview: "Learn the route and the rival's lead.",
        sceneOpener: "The table opens in motion. Someone else is already ahead of you, and standing still now is the same as losing.",
        npcBriefs: enrichNpcVoiceProfiles([
          { name: "Field Marshal", role: "Commander", motive: "Get the party moving now.", voiceTone: "hard, tactical" },
          { name: "Shaken Runner", role: "Witness", motive: "Trade route details for protection.", voiceTone: "frantic, uncertain" },
        ]),
        interactables: [],
        investigationRules: [],
      },
      {
        order: 2,
        type: "combat",
        title: "Lane Clash",
        objective: "Break the rival screen and seize the map.",
        summary: "The first engagement is a fast control fight with immediate pressure on positioning.",
        pressure: "high",
        encounterScale: partySize <= 2 ? "light" : "standard",
        mapTemplateKey: "arena_bridge",
        rewardPreview: "Take ground and open the route forward.",
        sceneOpener: "The lane goes live at once. Steel, spell-light, and shouted orders crash together as control of the route becomes the only thing that matters.",
        npcBriefs: enrichNpcVoiceProfiles([
          { name: "Rival Lieutenant", role: "Captain", motive: "Lock the party in place and waste their resources.", voiceTone: "mocking, disciplined" },
        ]),
        interactables: [],
        investigationRules: [],
      },
      {
        order: 3,
        type: "exploration",
        title: "Pressure Room",
        objective: "Inspect the scene, interrogate survivors, and find the true route.",
        summary: "The room is dense with clues, lies, and dangerous partial truths.",
        pressure: "mounting",
        encounterScale: "none",
        mapTemplateKey: "investigation_archive",
        rewardPreview: "Find the safest push and the final objective room.",
        sceneOpener: "The fighting falls off, but the room still fights you in quieter ways: bad information, broken machinery, and one choice that matters more than the rest.",
        npcBriefs: enrichNpcVoiceProfiles([
          { name: "Captured Scout", role: "Rogue", motive: "Stay alive by selling selective truths.", voiceTone: "wary, quick" },
        ]),
        interactables: [
          {
            id: "pressure-ledger",
            label: "Scorched Ledger",
            kind: "clue",
            position: { x: 4, y: 2 },
            interactionModes: ["inspect"],
          },
          {
            id: "pressure-scout",
            label: "Captured Scout",
            kind: "npc_anchor",
            position: { x: 7, y: 4 },
            interactionModes: ["speak", "inspect"],
          },
        ],
        investigationRules: [
          {
            sourceId: "pressure-ledger",
            requiredMode: "inspect",
            unlocks: ["rival-route", "vault-warning"],
            progressDelta: 1,
          },
          {
            sourceId: "pressure-scout",
            requiredMode: "speak",
            unlocks: ["safe-push"],
            progressDelta: 1,
          },
        ],
      },
      {
        order: 4,
        type: partySize >= 3 ? "combat" : "resolution",
        title: partySize >= 3 ? "Final Push" : "Claim The Prize",
        objective: partySize >= 3 ? "Win the last fight and secure the relic." : "Secure the relic and decide who pays the price.",
        summary:
          partySize >= 3
            ? "The rival elite makes a final stand in a tighter, deadlier arena."
            : "The prize is within reach, but the closing decision should still feel expensive.",
        pressure: partySize >= 3 ? "critical" : "steady",
        encounterScale: partySize >= 3 ? "standard_plus" : "none",
        mapTemplateKey: partySize >= 3 ? "arena_sanctum" : "resolution_chamber",
        rewardPreview: "Close the run and seed the next consequence.",
        sceneOpener:
          partySize >= 3
            ? "The final chamber is already awake, and whoever controls the center in the next exchanges owns the outcome."
            : "The chamber quiets just enough for the real question to arrive: what will this victory cost and who gets to define it?",
        npcBriefs: enrichNpcVoiceProfiles([
          { name: "Rival Captain", role: "Commander", motive: "Leave with the relic or deny it to the party.", voiceTone: "cold, certain" },
        ]),
        interactables: [],
        investigationRules: [],
      },
    ];
  return applyWorldSeedToBlueprint({
    title,
    questHook: "A rival band is already moving on a powerful frontier relic and the party has one shot to seize tempo first.",
    objective: "Push through the route, take the prize, and survive the rival retaliation.",
    summary:
      partySize >= 3
        ? "A fast raid run with two tactical spikes and a consequence-heavy finish."
        : "A compact raid with one tactical spike, one pressure room, and a hard closing choice.",
    scenes,
  }, {
    sessionTitle,
    partySize,
    worldPrompt,
  });
}

async function generateStoryFrame(state) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      storyFrame: buildFallbackBlueprint(state.sessionTitle, state.partySize, state.worldPrompt),
    };
  }

  const model = getOpenAIModel().withStructuredOutput(storyFrameSchema);
  const storyFrame = await model.invoke([
    [
      "system",
      "Design a mobile-first, tactical D&D raid premise. Make it visual, specific, and shaped by the player's requested world. The world prompt must materially change the aesthetic, enemy pressure, and first scene.",
    ],
    [
      "user",
      `Session title seed: ${state.sessionTitle}. World prompt: ${state.worldPrompt || "none supplied"}. Party size: ${state.partySize}. Output only the raid frame.`,
    ],
  ]);

  return { storyFrame };
}

async function generateSceneStack(state) {
  if (state.storyFrame?.scenes) {
    return {
      scenes: state.storyFrame.scenes,
      blueprint: state.storyFrame,
    };
  }

  const model = getOpenAIModel().withStructuredOutput(z.object({ scenes: z.array(sceneSchema).min(4).max(5) }));
  const result = await model.invoke([
    [
      "system",
      "Create a 4-5 scene raid run for a tactical multiplayer D&D game. Use scene types intro, exploration, combat, and resolution only. At least one combat scene is required, two for parties of 3 or more. If the player's world prompt sounds combat-heavy, open with combat. Otherwise make scene one immediately playable with visible clues, witnesses, or scene objects instead of empty atmosphere.",
    ],
    [
      "user",
      JSON.stringify({
        sessionTitle: state.sessionTitle,
        worldPrompt: state.worldPrompt,
        partySize: state.partySize,
        storyFrame: state.storyFrame,
      }),
    ],
  ]);

  const scenes = result.scenes.map((scene) => ({
    ...normalizeScene(scene),
  }));

  return {
    scenes,
    blueprint: {
      title: state.storyFrame.title,
      questHook: state.storyFrame.questHook,
      objective: state.storyFrame.objective,
      summary: state.storyFrame.summary,
      scenes,
    },
  };
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function resolveProfileMatch(requestedAbility, actorSheet) {
  const requested = normalizeName(requestedAbility);
  if (!requested) {
    return null;
  }

  const allProfiles = [...(actorSheet.attackProfiles || []), ...(actorSheet.spellProfiles || [])];
  return allProfiles.find((profile) => {
    const haystack = normalizeName(`${profile.key} ${profile.name}`);
    return haystack.includes(requested) || requested.includes(haystack);
  }) || null;
}

function inferAreaTemplate(profile) {
  const normalizedName = normalizeName(profile?.name || profile?.key);
  if (normalizedName.includes("burning hands")) {
    return { shape: "cone", sizeFeet: 15 };
  }
  if (normalizedName.includes("fireball")) {
    return { shape: "radius", sizeFeet: 20 };
  }
  return null;
}

export async function generateAdventureBlueprintGraph(input) {
  const graph = new StateGraph(AdventureGraphState)
    .addNode("generate_story_frame", generateStoryFrame)
    .addNode("generate_scene_stack", generateSceneStack)
    .addEdge(START, "generate_story_frame")
    .addEdge("generate_story_frame", "generate_scene_stack")
    .addEdge("generate_scene_stack", END)
    .compile();

  const result = await graph.invoke({
    sessionTitle: input.sessionTitle,
    worldPrompt: input.worldPrompt,
    partySize: input.partySize,
  });

  return result.blueprint || buildFallbackBlueprint(input.sessionTitle, input.partySize, input.worldPrompt);
}

export async function previewPlayerIntentWithGraph({ utterance, actorSheet }) {
  if (!process.env.OPENAI_API_KEY) {
    const fallbackProfile = resolveProfileMatch(utterance, actorSheet);
    return {
      intentType: fallbackProfile ? "combat_action" : "question",
      isLegal: Boolean(fallbackProfile),
      reason: fallbackProfile ? "Resolved with deterministic fallback matching." : "No matching action found on the actor sheet.",
      profile: fallbackProfile,
      preview: fallbackProfile
        ? {
            name: fallbackProfile.name,
            rangeFeet: fallbackProfile.rangeFeet || 5,
            areaTemplate: inferAreaTemplate(fallbackProfile),
            damageFormula: fallbackProfile.damageFormula || fallbackProfile.healFormula || null,
          }
        : null,
    };
  }

  const model = getOpenAIModel(process.env.OPENAI_INTENT_MODEL || process.env.OPENAI_DM_MODEL || "gpt-4.1-mini")
    .withStructuredOutput(actionIntentSchema);
  const intent = await model.invoke([
    [
      "system",
      "Classify messy tabletop speech into one high-level intent. Prefer combat_action only when the player appears to be committing an attack, spell, or movement.",
    ],
    [
      "user",
      JSON.stringify({
        utterance,
        actorName: actorSheet.name,
        attacks: (actorSheet.attackProfiles || []).map((profile) => profile.name),
        spells: (actorSheet.spellProfiles || []).map((profile) => profile.name),
      }),
    ],
  ]);

  const matchedProfile = resolveProfileMatch(intent.requestedAbility || utterance, actorSheet);
  if (intent.intentType === "combat_action" && !matchedProfile) {
    return {
      ...intent,
      isLegal: false,
      reason: `${actorSheet.name} does not currently have that weapon, spell, or ability available.`,
      profile: null,
      preview: null,
    };
  }

  return {
    ...intent,
    isLegal: intent.intentType !== "combat_action" || Boolean(matchedProfile),
    reason:
      intent.intentType === "combat_action"
        ? "Action matched against the actor sheet."
        : "This input should stay in the scene/question lane, not the combat resolver.",
    profile: matchedProfile,
    preview: matchedProfile
      ? {
          name: matchedProfile.name,
          profileKey: matchedProfile.key,
          actionType: matchedProfile.actionType,
          resolutionMode: matchedProfile.resolutionMode || matchedProfile.actionType,
          rangeFeet: matchedProfile.rangeFeet || 5,
          damageFormula: matchedProfile.damageFormula || matchedProfile.healFormula || null,
          saveAbility: matchedProfile.saveAbility || null,
          saveDc: matchedProfile.saveDc || null,
          areaTemplate: inferAreaTemplate(matchedProfile),
        }
      : null,
  };
}
