function hashSeed(input) {
  return [...input].reduce((total, character, index) => {
    return total + character.charCodeAt(0) * (index + 17);
  }, 0);
}

function pickBySeed(options, seed, offset = 0) {
  return options[(seed + offset) % options.length];
}

export function buildFallbackAdventureBlueprint(sessionTitle, partySize) {
  const title = sessionTitle?.trim() || "Arena Quest";
  const seed = hashSeed(`${title}:${partySize}`);
  const fronts = [
    {
      title: "The Ember Sigil",
      macguffin: "an ember sigil that can wake sleeping war engines",
      patron: "Marshal Vey",
      patronRole: "Frontier Warden",
      rival: "The Ashen Banner",
      enemyTheme: "raiders with shield walls and rush pressure",
      stakes:
        "If the rival warband claims it first, the nearby settlements lose their last defensible route.",
      patronTone: "clipped, battle-ready, and distrustful of delays",
    },
    {
      title: "The Floodglass Crown",
      macguffin: "a floodglass crown that reveals drowned roads and hidden vault channels",
      patron: "Sister Elira",
      patronRole: "Tide Archivist",
      rival: "The Mire Choir",
      enemyTheme: "fanatics, skirmishers, and choking terrain pressure",
      stakes:
        "If the cult secures it, the estuary towns vanish from safe passage before the next moon.",
      patronTone: "calm, exact, and grave under pressure",
    },
    {
      title: "The Star-Mapped Key",
      macguffin: "a star-mapped key that can open sealed waygates beneath the frontier",
      patron: "Quartermaster Dain",
      patronRole: "Expedition Broker",
      rival: "The Gilt Knives",
      enemyTheme: "cutthroats, feints, and burst damage from odd angles",
      stakes:
        "If the mercenaries sell it, every faction on the frontier starts a race for the same gate network.",
      patronTone: "fast-talking, practical, and always hiding nerves",
    },
  ];
  const biomes = [
    {
      approach: "the rain-slick causeway above a black marsh",
      arena: "a collapsed toll bridge lined with broken braziers",
      midScene: "a half-drowned relay archive full of scorched ledgers and trapped doors",
      finale: "the vault dais at the heart of a ruined observatory",
    },
    {
      approach: "the switchback road under a shattered cliff monastery",
      arena: "a narrow gate court split by prayer walls and arrow slits",
      midScene: "a reliquary corridor where old saints were catalogued like weapons",
      finale: "the chapel forge beneath the monastery's bell tower",
    },
    {
      approach: "the lantern market below a sleeping fortress",
      arena: "a market lane packed with toppled carts and banner poles",
      midScene: "a customs archive where smugglers mapped the old tunnels",
      finale: "the command rotunda above the sealed war gate",
    },
  ];
  const twists = [
    "The rival force is already on site and treats the party like late challengers to the same prize.",
    "An unreliable local witness keeps changing their story, but they know one route nobody else does.",
    "The objective is intact, but the site around it is unstable and rewards fast decisions over careful clearing.",
  ];

  const front = pickBySeed(fronts, seed);
  const biome = pickBySeed(biomes, seed, 1);
  const twist = pickBySeed(twists, seed, 2);

  const baseScenes = [
    {
      order: 1,
      type: "intro",
      title: `Drop At ${front.title}`,
      objective: `Learn where ${front.macguffin} is being moved and choose the party's first push.`,
      summary: `${front.patron}, the ${front.patronRole}, meets the party at ${biome.approach}. ${front.stakes} ${twist}`,
      pressure: "rising",
      encounterScale: "none",
      enemyTheme: front.enemyTheme,
      rewardPreview: `Secure the trail to ${front.macguffin}.`,
      sceneOpener:
        `${front.patron} throws the brief onto the table fast: the window is closing, the rival move is already underway, and the party must push now or lose the lane.`,
      npcBriefs: [
        {
          name: front.patron,
          role: front.patronRole,
          motive: `Get the party moving before ${front.rival} reaches ${front.macguffin}.`,
          voiceTone: front.patronTone,
        },
        {
          name: "Runner Iven",
          role: "Shaken Witness",
          motive:
            "Trade scraps of route knowledge for protection and proof the party can actually win.",
          voiceTone: "breathless, evasive, and easily rattled",
        },
      ],
    },
    {
      order: 2,
      type: "combat",
      title: "Lane Clash",
      objective: `Break the first screen from ${front.rival} and seize tempo.`,
      summary:
        `The first collision hits at ${biome.arena}. This fight should feel like a fast lane contest: claim space, punish overreach, and keep momentum.`,
      pressure: partySize <= 2 ? "tight" : "high",
      encounterScale: partySize <= 2 ? "light" : "standard",
      enemyTheme: front.enemyTheme,
      rewardPreview: "Win the lane and open the route to the inner objective.",
      sceneOpener:
        `The board turns live at ${biome.arena}. Enemies flood the approach, the route narrows, and every square suddenly matters.`,
      npcBriefs: [
        {
          name: "Banner Lieutenant",
          role: "Enemy Captain",
          motive: "Pin the party in place and buy enough time for the prize team to escape deeper in.",
          voiceTone: "mocking, disciplined, and eager to tilt the table",
        },
      ],
    },
    {
      order: 3,
      type: "exploration",
      title: "Pressure Room",
      objective: `Read the field, question the survivors, and identify the best route to ${front.macguffin}.`,
      summary:
        `After the clash, the party pushes into ${biome.midScene}. The site rewards sharp questions, quick inspection, and decisive reads rather than slow wandering.`,
      pressure: "mounting",
      encounterScale: "none",
      enemyTheme: front.enemyTheme,
      rewardPreview: "Discover the safest push and what the rival faction is planning next.",
      sceneOpener:
        `The immediate fighting falls off, but the room is not safe. Evidence, rumors, and broken machinery all point in different directions, and the party has to choose what matters.`,
      npcBriefs: [
        {
          name: "Captured Scout",
          role: "Cornered Rival",
          motive: `Stay alive by selling partial truths about ${front.rival}'s route.`,
          voiceTone: "defiant at first, then calculating",
        },
        {
          name: "Caretaker Echo",
          role: "Residual Presence",
          motive: "Repeat fragments of the site's old purpose and hint at what the vault still protects.",
          voiceTone: "hollow, formal, and fragmented",
        },
      ],
    },
  ];

  const finaleScenes =
    partySize >= 3
      ? [
          {
            order: 4,
            type: "combat",
            title: "Crown Push",
            objective: `Crack the final defense at ${biome.finale} and secure ${front.macguffin}.`,
            summary:
              `The rival elite makes its stand at ${biome.finale}. The second fight should feel like a bigger arena shove with stronger punishment for slow turns.`,
            pressure: "critical",
            encounterScale: "standard_plus",
            enemyTheme: front.enemyTheme,
            rewardPreview: `Claim ${front.macguffin} before the rival captain breaks contact.`,
            sceneOpener:
              `The final chamber is already awake. Steel rings, voices echo off old stone, and whoever owns the center for the next few exchanges will own the objective.`,
            npcBriefs: [
              {
                name: "Rival Captain Serak",
                role: "Final Opponent",
                motive: `Drive the party off long enough to escape with ${front.macguffin}.`,
                voiceTone: "hard, taunting, and certain the party is too late",
              },
            ],
          },
          {
            order: 5,
            type: "resolution",
            title: "After The Grab",
            objective: `Decide who receives ${front.macguffin} and what debt or danger follows.`,
            summary:
              `With the arena cleared, the party controls the outcome. The DM should press them on consequence, ownership, and what new enemy they just made.`,
            pressure: "falling",
            encounterScale: "none",
            enemyTheme: front.enemyTheme,
            rewardPreview: "Lock the reward, choose an ally, and seed the next run.",
            sceneOpener:
              `The dust settles, but the choice does not. Everyone left standing wants a claim on what the party just bled for.`,
            npcBriefs: [
              {
                name: front.patron,
                role: front.patronRole,
                motive: `Leave with ${front.macguffin} and bind the party to the next operation.`,
                voiceTone: front.patronTone,
              },
            ],
          },
        ]
      : [
          {
            order: 4,
            type: "resolution",
            title: "Claim The Prize",
            objective: `Secure ${front.macguffin} and choose how the party cashes in its win.`,
            summary:
              `The last chamber belongs to the party if they can hold their nerve. Push the closing choice hard enough that the ending feels earned, not automatic.`,
            pressure: "steady",
            encounterScale: "none",
            enemyTheme: front.enemyTheme,
            rewardPreview: "Walk away with the objective and a clean next hook.",
            sceneOpener:
              `The final room opens in tense quiet. The prize is here, but so are witnesses, debts, and the cost of taking it.`,
            npcBriefs: [
              {
                name: front.patron,
                role: front.patronRole,
                motive:
                  `Close the job fast and keep the frontier from learning how close the party came to losing it.`,
                voiceTone: front.patronTone,
              },
            ],
          },
        ];

  const scenes = [...baseScenes, ...finaleScenes].map((scene) => ({
    ...scene,
    mapTemplateKey: scene.type === "combat" ? "arena_bridge" : "investigation_hall",
    interactables:
      scene.type === "exploration"
        ? [
            {
              id: `${scene.order}-ledger`,
              label: "Scorched Ledger",
              kind: "clue",
              position: { x: 4, y: 2 },
              interactionModes: ["inspect"],
            },
            {
              id: `${scene.order}-survivor`,
              label: "Cornered Survivor",
              kind: "npc_anchor",
              position: { x: 7, y: 3 },
              interactionModes: ["speak", "inspect"],
            },
          ]
        : [],
    investigationRules:
      scene.type === "exploration"
        ? [
            {
              sourceId: `${scene.order}-ledger`,
              requiredMode: "inspect",
              unlocks: ["route-clue", "rival-plan"],
              progressDelta: 1,
            },
            {
              sourceId: `${scene.order}-survivor`,
              requiredMode: "speak",
              unlocks: ["safe-push"],
              progressDelta: 1,
            },
          ]
        : [],
  }));

  return {
    title,
    questHook:
      `${front.patron} hires the party to seize ${front.macguffin} before ${front.rival} locks down the route first.`,
    objective: `Win the lane battles, break the rival push, and leave with ${front.macguffin}.`,
    summary:
      partySize >= 3
        ? "A fast multi-scene raid with two tactical battle spikes, reactive NPCs, and a pressure-first DM lane."
        : "A compact raid run with one major battle spike, scene-driven DM play, and a consequence-heavy ending.",
    scenes,
  };
}
