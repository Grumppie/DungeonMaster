import { inferWorldPreferences } from "./worldPrompt";

const THEME_PACKAGES = {
  pirate: {
    titlePrefix: "Red Tide Over",
    openingTitle: "The Smuggler's Wharf",
    openingCombatTitle: "Boarding Clash",
    openingObjective: "Read the wharf, shake the dockside lies loose, and identify the real outbound route.",
    openingCombatObjective: "Hold the pier through the opening rush and keep the target ship from slipping free.",
    introMapTemplateKey: "twilight_city_alley",
    combatMapTemplateKey: "arena_bridge",
    relic: "a tide-marked crown that shows drowned channels at low moon",
    patron: "Harbormaster Selka",
    rival: "The Red Wake",
    enemyTheme: "boarding raiders, rope-swinging cutthroats, and tidal pressure",
    location: "a storm-battered wharf stacked with wet cargo and signal braziers",
    interactables: [
      { key: "cargo-ledger", label: "Salt-Stained Cargo Ledger", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "dock-runner", label: "Cornered Dock Runner", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "signal-winch", label: "Harbor Signal Winch", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "cargo-ledger", requiredMode: "inspect", unlocks: ["ship-manifest", "hidden-channel"], progressDelta: 1 },
      { sourceKey: "dock-runner", requiredMode: "speak", unlocks: ["safe-boarding-angle"], progressDelta: 1 },
      { sourceKey: "signal-winch", requiredMode: "use", unlocks: ["pier-route"], progressDelta: 1 },
    ],
  },
  gothic: {
    titlePrefix: "Ashes Under",
    openingTitle: "The Black Nave",
    openingCombatTitle: "Crypt Ambush",
    openingObjective: "Read the chapel floor, question the shaken keeper, and learn which crypt path is still honest.",
    openingCombatObjective: "Survive the first crypt rush and stop the warded door from being sealed behind you.",
    introMapTemplateKey: "investigation_hall",
    combatMapTemplateKey: "arena_sanctum",
    relic: "a coffin-key that can wake sealed saints beneath the abbey",
    patron: "Sister Veyra",
    rival: "The Pale Choir",
    enemyTheme: "grave knights, candle cultists, and oppressive close-quarters pressure",
    location: "a candlelit nave lined with cracked reliquaries and dead incense",
    interactables: [
      { key: "reliquary-ledger", label: "Bone-Inlaid Reliquary", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "grave-keeper", label: "Terrified Grave Keeper", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "iron-censer", label: "Swinging Iron Censer", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "reliquary-ledger", requiredMode: "inspect", unlocks: ["burial-route", "false-crypt"], progressDelta: 1 },
      { sourceKey: "grave-keeper", requiredMode: "speak", unlocks: ["keeper-warning"], progressDelta: 1 },
      { sourceKey: "iron-censer", requiredMode: "use", unlocks: ["smoke-screen"], progressDelta: 1 },
    ],
  },
  jungle: {
    titlePrefix: "Fangs Around",
    openingTitle: "The Vine Gate",
    openingCombatTitle: "Ruin Mouth Clash",
    openingObjective: "Test the ruin mouth, read the serpent markings, and figure out which overgrown lane is still traversable.",
    openingCombatObjective: "Break the guardian rush at the ruin mouth before the temple swallows the trail behind you.",
    introMapTemplateKey: "fallback_exploration",
    combatMapTemplateKey: "arena_bridge",
    relic: "a serpent diadem that can wake the old ward engines beneath the jungle floor",
    patron: "Guide Tarek",
    rival: "The Coilbound",
    enemyTheme: "serpent zealots, beast handlers, and collapsing footing",
    location: "a humid ruin gate split by roots, moss, and broken idol plinths",
    interactables: [
      { key: "serpent-mural", label: "Rain-Worn Serpent Mural", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "wounded-scout", label: "Wounded Trail Scout", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "root-lift", label: "Counterweight Root Lift", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "serpent-mural", requiredMode: "inspect", unlocks: ["hidden-stair", "guardian-mark"], progressDelta: 1 },
      { sourceKey: "wounded-scout", requiredMode: "speak", unlocks: ["dry-route"], progressDelta: 1 },
      { sourceKey: "root-lift", requiredMode: "use", unlocks: ["stone-bridge"], progressDelta: 1 },
    ],
  },
  desert: {
    titlePrefix: "Glass Winds Above",
    openingTitle: "The Sand Gate",
    openingCombatTitle: "Dune Killbox",
    openingObjective: "Read the windblown gate, question the outrider, and identify the one route the storm has not erased.",
    openingCombatObjective: "Punch through the opening killbox before the dunes bury your line of retreat.",
    introMapTemplateKey: "intro_causeway",
    combatMapTemplateKey: "arena_bridge",
    relic: "a mirrored diadem that maps buried roads beneath the dunes",
    patron: "Outrider Nima",
    rival: "The Glass Jackals",
    enemyTheme: "dune hunters, spearmen, and punishing open sightlines",
    location: "a half-buried gate cut by wind, grit, and snapped banners",
    interactables: [
      { key: "sun-tablet", label: "Sun-Cracked Route Tablet", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "dust-runner", label: "Pinned Desert Runner", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "chain-lift", label: "Buried Chain Lift", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "sun-tablet", requiredMode: "inspect", unlocks: ["shaded-route", "false-dune"], progressDelta: 1 },
      { sourceKey: "dust-runner", requiredMode: "speak", unlocks: ["storm-gap"], progressDelta: 1 },
      { sourceKey: "chain-lift", requiredMode: "use", unlocks: ["buried-gate"], progressDelta: 1 },
    ],
  },
  sky: {
    titlePrefix: "Stormglass Over",
    openingTitle: "The Broken Dock",
    openingCombatTitle: "Skybridge Break",
    openingObjective: "Read the fractured dock, question the deck oracle, and find which chainway still reaches the target.",
    openingCombatObjective: "Hold the skybridge through the first breakneck clash and stop the enemy from cutting the chainway.",
    introMapTemplateKey: "intro_causeway",
    combatMapTemplateKey: "arena_bridge",
    relic: "a stormglass helm that can chart the hidden lanes between floating keeps",
    patron: "Quartermaster Rielle",
    rival: "The Gilded Gale",
    enemyTheme: "airship marines, chain snipers, and falling-pressure skirmishers",
    location: "a wind-lashed dock ringed by chains, torn sails, and alarm braziers",
    interactables: [
      { key: "wind-chart", label: "Pinned Wind Chart", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "deck-oracle", label: "Shaken Deck Oracle", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "chain-capstan", label: "Chain Capstan", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "wind-chart", requiredMode: "inspect", unlocks: ["safe-chainway", "downdraft-warning"], progressDelta: 1 },
      { sourceKey: "deck-oracle", requiredMode: "speak", unlocks: ["captain-route"], progressDelta: 1 },
      { sourceKey: "chain-capstan", requiredMode: "use", unlocks: ["dock-rotation"], progressDelta: 1 },
    ],
  },
  arcane: {
    titlePrefix: "Stars Beneath",
    openingTitle: "The Splintered Observatory",
    openingCombatTitle: "Wardline Breach",
    openingObjective: "Read the shattered observatory, question the surviving apprentice, and learn which wardline is still truthful.",
    openingCombatObjective: "Force a breach through the opening wardline before the chamber seals itself.",
    introMapTemplateKey: "investigation_archive",
    combatMapTemplateKey: "arena_sanctum",
    relic: "a stellar index that can wake the dead gates under the old academy",
    patron: "Archivist Mora",
    rival: "The Glass Cabal",
    enemyTheme: "spell duellists, ward sentries, and unstable arcane pressure",
    location: "a cracked observatory floor lit by dead star mirrors and flickering wards",
    interactables: [
      { key: "star-ledger", label: "Fractured Star Ledger", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "apprentice-echo", label: "Apprentice Echo", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "ward-switch", label: "Resonance Switch", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "star-ledger", requiredMode: "inspect", unlocks: ["ward-sequence", "false-vault"], progressDelta: 1 },
      { sourceKey: "apprentice-echo", requiredMode: "speak", unlocks: ["safe-rune"], progressDelta: 1 },
      { sourceKey: "ward-switch", requiredMode: "use", unlocks: ["vault-channel"], progressDelta: 1 },
    ],
  },
  infernal: {
    titlePrefix: "Brass Hunger In",
    openingTitle: "The Furnace Gate",
    openingCombatTitle: "Chain Devil Rush",
    openingObjective: "Read the furnace gate, press the shackled witness, and find the one route not already owned by hell's machines.",
    openingCombatObjective: "Break the furnace-line assault before the brass gates grind fully shut.",
    introMapTemplateKey: "investigation_hall",
    combatMapTemplateKey: "arena_sanctum",
    relic: "a brass seal that can wake bound engines in the underforge",
    patron: "Factor Ilya",
    rival: "The Cinder Compact",
    enemyTheme: "chain devils, ash zealots, and oppressive forge pressure",
    location: "a brass gatehouse roaring with heat, soot, and chained prayer wheels",
    interactables: [
      { key: "contract-slate", label: "Brass Contract Slate", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "shackled-witness", label: "Shackled Witness", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "furnace-lever", label: "Furnace Spill Lever", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "contract-slate", requiredMode: "inspect", unlocks: ["binding-clause", "forge-route"], progressDelta: 1 },
      { sourceKey: "shackled-witness", requiredMode: "speak", unlocks: ["coolant-gap"], progressDelta: 1 },
      { sourceKey: "furnace-lever", requiredMode: "use", unlocks: ["slag-bridge"], progressDelta: 1 },
    ],
  },
  urban: {
    titlePrefix: "Knives In",
    openingTitle: "The Lantern Alleys",
    openingCombatTitle: "Street Ambush",
    openingObjective: "Read the alleys, shake the informer loose, and determine which district route the target is actually taking.",
    openingCombatObjective: "Break the opening street ambush before the courier team vanishes into the district.",
    introMapTemplateKey: "twilight_city_alley",
    combatMapTemplateKey: "arena_bridge",
    relic: "a route ledger that unlocks every sealed gate under the city",
    patron: "Fixer Sanja",
    rival: "The Velvet Knives",
    enemyTheme: "cutthroats, rooftop shooters, and hard flanking pressure",
    location: "a lantern-strung alley knot full of shutters, signs, and bad exits",
    interactables: [
      { key: "smuggler-ledger", label: "Smuggler Ledger", kind: "clue", position: { x: 4, y: 2 }, interactionModes: ["inspect"] },
      { key: "street-informant", label: "Street Informant", kind: "npc_anchor", position: { x: 7, y: 3 }, interactionModes: ["speak", "inspect"] },
      { key: "signal-crank", label: "Roofline Signal Crank", kind: "object", position: { x: 9, y: 4 }, interactionModes: ["use", "inspect"] },
    ],
    rules: [
      { sourceKey: "smuggler-ledger", requiredMode: "inspect", unlocks: ["courier-route", "false-drop"], progressDelta: 1 },
      { sourceKey: "street-informant", requiredMode: "speak", unlocks: ["quiet-approach"], progressDelta: 1 },
      { sourceKey: "signal-crank", requiredMode: "use", unlocks: ["shutter-gap"], progressDelta: 1 },
    ],
  },
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildThemePackage(preferences) {
  return THEME_PACKAGES[preferences.flavorKey] || THEME_PACKAGES.arcane;
}

function buildPromptClause(worldPrompt) {
  return worldPrompt ? ` The party explicitly asked for a world with ${worldPrompt}.` : "";
}

function applyTopLevelFlavor(baseBlueprint, theme, preferences, sessionTitle) {
  return {
    ...baseBlueprint,
    title:
      baseBlueprint.title && baseBlueprint.title !== sessionTitle
        ? baseBlueprint.title
        : `${theme.titlePrefix} ${sessionTitle || theme.openingTitle}`.trim(),
    questHook:
      baseBlueprint.questHook ||
      `${theme.patron} needs the party to seize ${theme.relic} before ${theme.rival} turns the whole route against them.`,
    objective:
      baseBlueprint.objective ||
      `Break the pressure line, secure ${theme.relic}, and decide how the party wants this world to remember them.`,
    summary:
      `${baseBlueprint.summary || `A ${preferences.flavorLabel} built around sharp choices, visible hooks, and a meaningful opening.`}${buildPromptClause(preferences.worldPrompt)}`,
  };
}

function buildOpeningInteractables(theme, order) {
  return theme.interactables.map((entry) => ({
    id: `${order}-${entry.key}`,
    label: entry.label,
    kind: entry.kind,
    position: entry.position,
    interactionModes: entry.interactionModes,
  }));
}

function buildOpeningRules(theme, order) {
  return theme.rules.map((rule) => ({
    sourceId: `${order}-${rule.sourceKey}`,
    requiredMode: rule.requiredMode,
    unlocks: rule.unlocks,
    progressDelta: rule.progressDelta,
  }));
}

function buildFlavoredOpeningScene(firstScene, theme, preferences) {
  const sceneType = preferences.combatHeavy ? "combat" : preferences.investigationHeavy ? "exploration" : "intro";
  const interactables = sceneType === "combat" ? [] : buildOpeningInteractables(theme, firstScene.order || 1);
  const investigationRules = sceneType === "combat" ? [] : buildOpeningRules(theme, firstScene.order || 1);

  return {
    ...firstScene,
    type: sceneType,
    title: preferences.combatHeavy ? theme.openingCombatTitle : theme.openingTitle,
    objective: preferences.combatHeavy ? theme.openingCombatObjective : theme.openingObjective,
    summary:
      `${theme.patron} throws the party into ${theme.location}, with ${theme.rival} already pushing for ${theme.relic}.${buildPromptClause(preferences.worldPrompt)}`,
    pressure: preferences.combatHeavy ? "high" : "rising",
    encounterScale: preferences.combatHeavy ? "standard" : "none",
    enemyTheme: theme.enemyTheme,
    rewardPreview: preferences.combatHeavy
      ? "Survive the opening clash and seize initiative."
      : "Get a read on the room before the world closes its fist.",
    sceneOpener: preferences.combatHeavy
      ? `${theme.patron} was too late for a quiet entry. ${theme.rival} hits fast, the opening space goes live, and the party has to win its footing before it can ask questions.${buildPromptClause(preferences.worldPrompt)}`
      : `${theme.patron} meets the party in ${theme.location} and points at three problems at once: a clue worth reading, a witness worth pressing, and one environmental lever that could change the route.${buildPromptClause(preferences.worldPrompt)}`,
    mapTemplateKey: preferences.combatHeavy ? theme.combatMapTemplateKey : theme.introMapTemplateKey,
    npcBriefs: firstScene.npcBriefs?.length
      ? firstScene.npcBriefs
      : [
          {
            name: theme.patron,
            role: "Patron",
            motive: `Push the party toward ${theme.relic} before ${theme.rival} can lock the route.`,
            voiceTone: "urgent, specific, and unwilling to waste momentum",
          },
          {
            name: preferences.combatHeavy ? "Pinned Survivor" : "Shaken Witness",
            role: "Witness",
            motive: "Trade a dangerous fragment of truth for immediate protection.",
            voiceTone: "rattled, observant, and not fully trustworthy",
          },
        ],
    interactables,
    investigationRules,
  };
}

function ensureEarlyExplorationHooks(scenes, theme) {
  const firstNonCombatIndex = scenes.findIndex((scene) => scene.type !== "combat");
  const targetIndex =
    scenes[0]?.type === "combat" && scenes[1]?.type === "combat"
      ? 1
      : firstNonCombatIndex;
  if (targetIndex === -1) {
    return scenes;
  }

  const scene = scenes[targetIndex];
  if (scene.interactables?.length) {
    return scenes;
  }

  const nextScenes = [...scenes];
  nextScenes[targetIndex] = {
    ...scene,
    type: scene.type === "resolution" ? scene.type : "exploration",
    title: scene.title || theme.openingTitle,
    objective: scene.objective || theme.openingObjective,
    summary: scene.summary || `The room has multiple live leads tied to ${theme.relic}.`,
    mapTemplateKey: scene.mapTemplateKey || theme.introMapTemplateKey,
    interactables: buildOpeningInteractables(theme, scene.order || targetIndex + 1),
    investigationRules: buildOpeningRules(theme, scene.order || targetIndex + 1),
  };
  return nextScenes;
}

export function applyWorldSeedToBlueprint(baseBlueprint, input) {
  const preferences = inferWorldPreferences(input);
  const theme = buildThemePackage(preferences);
  const flavored = applyTopLevelFlavor(baseBlueprint, theme, preferences, input.sessionTitle);
  const scenes = cloneJson(flavored.scenes || []);

  if (scenes.length) {
    scenes[0] = buildFlavoredOpeningScene(scenes[0], theme, preferences);
  }

  return {
    ...flavored,
    scenes: ensureEarlyExplorationHooks(scenes, theme),
  };
}
