import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { activateCombatEncounter, seedCombatForScene } from "./combat";
import { ensureOpeningMessageForScene } from "./sceneRuntime";
import { roomPrivacyValidator } from "./domain/session/validators";
import {
  interactableBlueprintValidator,
  investigationRuleValidator,
  sceneNpcBriefValidator,
} from "./domain/world/validators";

const sceneBlueprintValidator = v.object({
  order: v.number(),
  type: v.string(),
  title: v.string(),
  objective: v.string(),
  summary: v.string(),
  pressure: v.string(),
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

function randomJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function hashSeed(input) {
  return [...input].reduce((total, character, index) => {
    return total + character.charCodeAt(0) * (index + 17);
  }, 0);
}

function pickBySeed(options, seed, offset = 0) {
  return options[(seed + offset) % options.length];
}

function buildAdventureBlueprint(sessionTitle, partySize) {
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
      stakes: "If the rival warband claims it first, the nearby settlements lose their last defensible route.",
      patronTone: "clipped, battle-ready, and distrustful of delays",
    },
    {
      title: "The Floodglass Crown",
      macguffin: "a floodglass crown that reveals drowned roads and hidden vault channels",
      patron: "Sister Elira",
      patronRole: "Tide Archivist",
      rival: "The Mire Choir",
      enemyTheme: "fanatics, skirmishers, and choking terrain pressure",
      stakes: "If the cult secures it, the estuary towns vanish from safe passage before the next moon.",
      patronTone: "calm, exact, and grave under pressure",
    },
    {
      title: "The Star-Mapped Key",
      macguffin: "a star-mapped key that can open sealed waygates beneath the frontier",
      patron: "Quartermaster Dain",
      patronRole: "Expedition Broker",
      rival: "The Gilt Knives",
      enemyTheme: "cutthroats, feints, and burst damage from odd angles",
      stakes: "If the mercenaries sell it, every faction on the frontier starts a race for the same gate network.",
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
      sceneOpener: `${front.patron} throws the brief onto the table fast: the window is closing, the rival move is already underway, and the party must push now or lose the lane.`,
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
          motive: "Trade scraps of route knowledge for protection and proof the party can actually win.",
          voiceTone: "breathless, evasive, and easily rattled",
        },
      ],
    },
    {
      order: 2,
      type: "combat",
      title: "Lane Clash",
      objective: `Break the first screen from ${front.rival} and seize tempo.`,
      summary: `The first collision hits at ${biome.arena}. This fight should feel like a fast lane contest: claim space, punish overreach, and keep momentum.`,
      pressure: partySize <= 2 ? "tight" : "high",
      encounterScale: partySize <= 2 ? "light" : "standard",
      enemyTheme: front.enemyTheme,
      rewardPreview: "Win the lane and open the route to the inner objective.",
      sceneOpener: `The board turns live at ${biome.arena}. Enemies flood the approach, the route narrows, and every square suddenly matters.`,
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
      summary: `After the clash, the party pushes into ${biome.midScene}. The site rewards sharp questions, quick inspection, and decisive reads rather than slow wandering.`,
      pressure: "mounting",
      encounterScale: "none",
      enemyTheme: front.enemyTheme,
      rewardPreview: "Discover the safest push and what the rival faction is planning next.",
      sceneOpener: `The immediate fighting falls off, but the room is not safe. Evidence, rumors, and broken machinery all point in different directions, and the party has to choose what matters.`,
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
            summary: `The rival elite makes its stand at ${biome.finale}. The second fight should feel like a bigger arena shove with stronger punishment for slow turns.`,
            pressure: "critical",
            encounterScale: "standard_plus",
            enemyTheme: front.enemyTheme,
            rewardPreview: `Claim ${front.macguffin} before the rival captain breaks contact.`,
            sceneOpener: `The final chamber is already awake. Steel rings, voices echo off old stone, and whoever owns the center for the next few exchanges will own the objective.`,
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
            summary: `With the arena cleared, the party controls the outcome. The DM should press them on consequence, ownership, and what new enemy they just made.`,
            pressure: "falling",
            encounterScale: "none",
            enemyTheme: front.enemyTheme,
            rewardPreview: "Lock the reward, choose an ally, and seed the next run.",
            sceneOpener: `The dust settles, but the choice does not. Everyone left standing wants a claim on what the party just bled for.`,
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
            summary: `The last chamber belongs to the party if they can hold their nerve. Push the closing choice hard enough that the ending feels earned, not automatic.`,
            pressure: "steady",
            encounterScale: "none",
            enemyTheme: front.enemyTheme,
            rewardPreview: "Walk away with the objective and a clean next hook.",
            sceneOpener: `The final room opens in tense quiet. The prize is here, but so are witnesses, debts, and the cost of taking it.`,
            npcBriefs: [
              {
                name: front.patron,
                role: front.patronRole,
                motive: `Close the job fast and keep the frontier from learning how close the party came to losing it.`,
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
    questHook: `${front.patron} hires the party to seize ${front.macguffin} before ${front.rival} locks down the route first.`,
    objective: `Win the lane battles, break the rival push, and leave with ${front.macguffin}.`,
    summary:
      partySize >= 3
        ? "A fast multi-scene raid with two tactical battle spikes, reactive NPCs, and a pressure-first DM lane."
        : "A compact raid run with one major battle spike, scene-driven DM play, and a consequence-heavy ending.",
    scenes,
  };
}

async function getOrCreateAppUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const now = Date.now();
  const user = await ctx.db
    .query("appUsers")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  const payload = {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
    email: identity.email ?? undefined,
    displayName: identity.name ?? identity.nickname ?? identity.givenName ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (user) {
    await ctx.db.patch(user._id, payload);
    return { ...user, ...payload };
  }

  const userId = await ctx.db.insert("appUsers", {
    ...payload,
    createdAt: now,
  });
  return ctx.db.get(userId);
}

async function generateUniqueJoinCode(ctx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = randomJoinCode();
    const existing = await ctx.db
      .query("gameSessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode))
      .unique();
    if (!existing) {
      return joinCode;
    }
  }
  throw new Error("Failed to generate a unique join code.");
}

function getNextSeatIndex(participants) {
  return participants.reduce((highest, participant) => Math.max(highest, participant.seatIndex ?? -1), -1) + 1;
}

function projectParticipant(participant) {
  return {
    ...participant,
    visibleName: participant.characterName || participant.displayName,
  };
}

function getDefaultScenePosition(seatIndex = 0) {
  return {
    sceneX: 1 + (seatIndex % 4),
    sceneY: 6 + Math.floor(seatIndex / 4),
  };
}

async function getNextEligibleHostUserId(ctx, sessionId, excludeUserId) {
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  return participants
    .filter((participant) => participant.userId && participant.status !== "left" && participant.userId !== excludeUserId)
    .sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))[0]?.userId;
}

async function cleanupSessionIfInactive(ctx, session) {
  if (!session || session.status === "archived") {
    return session;
  }
  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();
  const activeParticipants = participants.filter((participant) => participant.status !== "left");
  const anyConnected = activeParticipants.some(
    (participant) => participant.presenceState === "online" || participant.presenceState === "reconnecting",
  );
  if (activeParticipants.length || anyConnected) {
    if (activeParticipants.length && !anyConnected) {
      await ctx.db.patch(session._id, {
        status: "archived",
        lockedAt: Date.now(),
        currentPlayerCount: 0,
        hostUserId: undefined,
        updatedAt: Date.now(),
      });
      return { ...session, status: "archived" };
    }
    return session;
  }
  await ctx.db.patch(session._id, {
    status: "archived",
    lockedAt: Date.now(),
    currentPlayerCount: 0,
    hostUserId: undefined,
    updatedAt: Date.now(),
  });
  return { ...session, status: "archived" };
}

async function persistAdventureRunFromBlueprint(ctx, { session, activeParticipants, blueprint }) {
  const now = Date.now();
  let firstSceneRecord = null;
  const runId = await ctx.db.insert("adventureRuns", {
    sessionId: session._id,
    title: blueprint.title,
    status: "active",
    partySize: activeParticipants.length,
    questHook: blueprint.questHook,
    objective: blueprint.objective,
    summary: blueprint.summary,
    activeSceneOrder: 1,
    totalScenes: blueprint.scenes.length,
    createdAt: now,
    startedAt: now,
    updatedAt: now,
  });

  for (const scene of blueprint.scenes) {
    const sceneId = await ctx.db.insert("adventureScenes", {
      runId,
      sessionId: session._id,
      order: scene.order,
      type: scene.type,
      status: scene.order === 1 ? "active" : "pending",
      title: scene.title,
      objective: scene.objective,
      summary: scene.summary,
      pressure: scene.pressure,
      encounterScale: scene.encounterScale,
      mapTemplateKey: scene.mapTemplateKey,
      enemyTheme: scene.enemyTheme,
      rewardPreview: scene.rewardPreview,
      sceneOpener: scene.sceneOpener,
      npcBriefs: scene.npcBriefs,
      interactables: scene.interactables,
      investigationRules: scene.investigationRules,
      createdAt: now,
      updatedAt: now,
    });

    if (scene.order === 1) {
      firstSceneRecord = {
        _id: sceneId,
        ...scene,
      };
    }

    if (scene.type === "combat") {
      const encounterId = await seedCombatForScene(ctx, {
        sessionId: session._id,
        runId,
        scene: {
          _id: sceneId,
          encounterScale: scene.encounterScale,
          title: scene.title,
        },
        participants: activeParticipants,
        activate: scene.order === 1,
      });
      await ctx.db.patch(sceneId, {
        combatEncounterId: encounterId,
        updatedAt: now,
      });

      if (scene.order === 1) {
        await ctx.db.patch(runId, {
          currentCombatEncounterId: encounterId,
          updatedAt: now,
        });
      }
    }
  }

  await ctx.db.patch(session._id, {
    currentRunId: runId,
    status: "active",
    startedAt: now,
    updatedAt: now,
  });

  if (firstSceneRecord) {
    await ensureOpeningMessageForScene(ctx, {
      sessionId: session._id,
      runId,
      scene: firstSceneRecord,
    });
  }

  return {
    runId,
    sceneCount: blueprint.scenes.length,
    partySize: activeParticipants.length,
  };
}

async function advanceSceneState(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    throw new Error("No active adventure run found for this session.");
  }

  const run = await ctx.db.get(session.currentRunId);
  if (!run || run.status !== "active") {
    throw new Error("Adventure is not in an active state.");
  }

  const scenes = (
    await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect()
  ).sort((left, right) => left.order - right.order);

  const currentScene = scenes.find((scene) => scene.order === run.activeSceneOrder);
  if (!currentScene) {
    throw new Error("Current scene not found.");
  }

  if (currentScene.type === "combat") {
    if (!currentScene.combatEncounterId) {
      throw new Error("Current combat scene is missing its encounter.");
    }
    const currentEncounter = await ctx.db.get(currentScene.combatEncounterId);
    if (!currentEncounter) {
      throw new Error("Combat encounter not found.");
    }
    if (currentEncounter.status !== "completed") {
      throw new Error("Finish the current combat encounter before advancing.");
    }
  }

  const now = Date.now();
  await ctx.db.patch(currentScene._id, {
    status: "completed",
    updatedAt: now,
  });

  const nextScene = scenes.find((scene) => scene.order === run.activeSceneOrder + 1);
  if (!nextScene) {
    await ctx.db.patch(run._id, {
      status: "completed",
      currentCombatEncounterId: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(session._id, {
      status: "completed",
      updatedAt: now,
    });
    return {
      done: true,
      nextSceneOrder: null,
    };
  }

  await ctx.db.patch(nextScene._id, {
    status: "active",
    updatedAt: now,
  });
  await ctx.db.patch(run._id, {
    activeSceneOrder: nextScene.order,
    currentCombatEncounterId: nextScene.type === "combat" ? nextScene.combatEncounterId : undefined,
    updatedAt: now,
  });

  const participants = await ctx.db
    .query("sessionParticipants")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();

  await Promise.all(
    participants
      .filter((participant) => participant.status !== "left")
      .map((participant) =>
        ctx.db.patch(participant._id, {
          ...getDefaultScenePosition(participant.seatIndex ?? 0),
          updatedAt: now,
        }),
      ),
  );

  await ensureOpeningMessageForScene(ctx, {
    sessionId: session._id,
    runId: run._id,
    scene: nextScene,
  });

  if (nextScene.type === "combat" && nextScene.combatEncounterId) {
    await activateCombatEncounter(ctx, nextScene.combatEncounterId);
  }

  return {
    done: false,
    nextSceneOrder: nextScene.order,
  };
}

export const create = mutation({
  args: {
    title: v.string(),
    displayName: v.string(),
    characterName: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    roomPrivacy: v.optional(roomPrivacyValidator),
    turnTimerSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const now = Date.now();
    const joinCode = await generateUniqueJoinCode(ctx);

    const sessionId = await ctx.db.insert("gameSessions", {
      joinCode,
      hostUserId: user._id,
      currentRunId: undefined,
      title: args.title.trim() || "Untitled quest",
      roomPrivacy: args.roomPrivacy || "private",
      allowOpenJoin: (args.roomPrivacy || "private") === "public",
      turnTimerSeconds: args.turnTimerSeconds || 20,
      lockedAt: undefined,
      dmStatus: "idle",
      status: "lobby",
      minPlayers: 1,
      maxPlayers: 4,
      currentPlayerCount: 1,
      storylineMode: "adaptive_party_size",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("sessionParticipants", {
      sessionId,
      userId: user._id,
      displayName: args.displayName.trim() || user.displayName || "Host",
      characterName: args.characterName?.trim() || args.displayName.trim() || user.displayName || "Host",
      status: "joined",
      presenceState: "online",
      lastSeenAt: now,
      seatIndex: 0,
      ...getDefaultScenePosition(0),
      isAnonymous: args.isAnonymous ?? true,
      joinedAt: now,
      updatedAt: now,
    });

    return {
      sessionId,
      joinCode,
    };
  },
});

export const join = mutation({
  args: {
    joinCode: v.string(),
    displayName: v.string(),
    characterName: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const now = Date.now();
    const session = await ctx.db
      .query("gameSessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", args.joinCode.trim().toUpperCase()))
      .unique();

    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.status !== "lobby") {
      throw new Error("Session is no longer accepting joins.");
    }
    if (session.lockedAt) {
      throw new Error("Session is currently locked.");
    }

    const existingParticipant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
      .unique();

    if (existingParticipant) {
      await ctx.db.patch(existingParticipant._id, {
        displayName: args.displayName.trim() || existingParticipant.displayName,
        characterName: args.characterName?.trim() || existingParticipant.characterName || existingParticipant.displayName,
        status: "joined",
        presenceState: "online",
        lastSeenAt: now,
        isAnonymous: args.isAnonymous ?? existingParticipant.isAnonymous,
        updatedAt: now,
      });
      return { sessionId: session._id, joinCode: session.joinCode };
    }

    if (session.currentPlayerCount >= session.maxPlayers) {
      throw new Error("Session is full.");
    }

    const sessionParticipants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const seatIndex = getNextSeatIndex(sessionParticipants);
    await ctx.db.insert("sessionParticipants", {
      sessionId: session._id,
      userId: user._id,
      displayName: args.displayName.trim() || user.displayName || "Adventurer",
      characterName: args.characterName?.trim() || args.displayName.trim() || user.displayName || "Adventurer",
      status: "joined",
      presenceState: "online",
      lastSeenAt: now,
      seatIndex,
      ...getDefaultScenePosition(seatIndex),
      isAnonymous: args.isAnonymous ?? true,
      joinedAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(session._id, {
      currentPlayerCount: session.currentPlayerCount + 1,
      updatedAt: now,
    });

    return { sessionId: session._id, joinCode: session.joinCode };
  },
});

export const chooseArchetype = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    archetypeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
      .unique();

    if (!participant) {
      throw new Error("Participant not found in this session.");
    }

    await ctx.db.patch(participant._id, {
      archetypeKey: args.archetypeKey,
      status: "ready",
      presenceState: "online",
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });

    return ctx.db.get(participant._id);
  },
});

export const getByJoinCode = query({
  args: {
    joinCode: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("gameSessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", args.joinCode.trim().toUpperCase()))
      .unique();
    if (!session) {
      return null;
    }
    const cleanedSession = await cleanupSessionIfInactive(ctx, session);
    if (cleanedSession?.status === "archived") {
      return null;
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", cleanedSession._id))
      .collect();

    return {
      ...cleanedSession,
      participants: participants
        .sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))
        .map(projectParticipant),
    };
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("gameSessions")
      .collect();
    const cleanedSessions = [];
    for (const session of sessions) {
      const cleaned = await cleanupSessionIfInactive(ctx, session);
      if (cleaned) {
        cleanedSessions.push(cleaned);
      }
    }
    const publicSessions = cleanedSessions
      .filter((session) => session.roomPrivacy === "public" && session.status === "lobby")
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20);

    const projections = [];
    for (const session of publicSessions) {
      const participants = await ctx.db
        .query("sessionParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      projections.push({
        ...session,
        seatsOpen: Math.max(0, session.maxPlayers - session.currentPlayerCount),
        participantCount: session.currentPlayerCount,
        hostCharacterName:
          participants.find((participant) => participant.userId === session.hostUserId)?.characterName || "Host",
      });
    }

    return projections;
  },
});

export const transferHost = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    targetParticipantId: v.id("sessionParticipants"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.hostUserId !== user._id) {
      throw new Error("Only the current host can transfer control.");
    }

    const participant = await ctx.db.get(args.targetParticipantId);
    if (!participant || participant.sessionId !== session._id || !participant.userId) {
      throw new Error("Target participant is not eligible to host.");
    }

    await ctx.db.patch(session._id, {
      hostUserId: participant.userId,
      updatedAt: Date.now(),
    });

    return { hostUserId: participant.userId };
  },
});

export const updatePresence = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    presenceState: v.union(v.literal("online"), v.literal("offline"), v.literal("reconnecting")),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("Participant not found.");
    }

    const now = Date.now();
    await ctx.db.patch(participant._id, {
      presenceState: args.presenceState,
      lastSeenAt: now,
      updatedAt: now,
    });

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { ok: true };
    }

    if (args.presenceState === "offline" && session.hostUserId === user._id) {
      const nextHostUserId = await getNextEligibleHostUserId(ctx, session._id, user._id);
      await ctx.db.patch(session._id, {
        hostUserId: nextHostUserId,
        updatedAt: now,
      });
    }
    await cleanupSessionIfInactive(ctx, session);

    return { ok: true };
  },
});

export const leaveSession = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", args.sessionId).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("Participant not found.");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    const now = Date.now();
    await ctx.db.patch(participant._id, {
      status: "left",
      presenceState: "offline",
      lastSeenAt: now,
      updatedAt: now,
    });

    const remainingParticipants = (
      await ctx.db
        .query("sessionParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()
    ).filter((entry) => entry._id !== participant._id && entry.status !== "left");

    if (!remainingParticipants.length) {
      await ctx.db.patch(session._id, {
        currentPlayerCount: 0,
        hostUserId: undefined,
        status: "archived",
        lockedAt: now,
        updatedAt: now,
      });
      return { removed: true };
    }

    const nextHostUserId =
      session.hostUserId === user._id
        ? remainingParticipants.sort((left, right) => (left.seatIndex ?? 0) - (right.seatIndex ?? 0))[0]?.userId
        : session.hostUserId;

    await ctx.db.patch(session._id, {
      currentPlayerCount: remainingParticipants.length,
      hostUserId: nextHostUserId,
      updatedAt: now,
    });

    return { removed: false };
  },
});

export const getBootstrap = internalQuery({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    return {
      session,
      participants,
    };
  },
});

export const startAdventureWithBlueprint = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
    blueprint: adventureBlueprintValidator,
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.status !== "lobby") {
      throw new Error("This session has already started.");
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const activeParticipants = participants.filter((participant) => participant.status !== "left");
    if (activeParticipants.length < 1) {
      throw new Error("At least one participant must be present to start.");
    }
    const unreadyParticipants = activeParticipants.filter((participant) => !participant.archetypeKey);
    if (unreadyParticipants.length > 0) {
      throw new Error("Every active participant must choose an archetype before the quest begins.");
    }

    return persistAdventureRunFromBlueprint(ctx, {
      session,
      activeParticipants,
      blueprint: args.blueprint,
    });
  },
});

export const startAdventure = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (!session.hostUserId || session.hostUserId !== user._id) {
      throw new Error("Only the host can start the adventure.");
    }
    if (session.status !== "lobby") {
      throw new Error("This session has already started.");
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const activeParticipants = participants.filter((participant) => participant.status !== "left");
    if (activeParticipants.length < 1) {
      throw new Error("At least one participant must be present to start.");
    }
    const unreadyParticipants = activeParticipants.filter((participant) => !participant.archetypeKey);
    if (unreadyParticipants.length > 0) {
      throw new Error("Every active participant must choose an archetype before the quest begins.");
    }

    const blueprint = buildAdventureBlueprint(session.title, activeParticipants.length);
    return persistAdventureRunFromBlueprint(ctx, {
      session,
      activeParticipants,
      blueprint,
    });
  },
});

export const getAdventure = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      return null;
    }

    const run = await ctx.db.get(session.currentRunId);
    if (!run) {
      return null;
    }

    const scenes = await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();

    return {
      ...run,
      scenes: scenes.sort((left, right) => left.order - right.order),
    };
  },
});

export const advanceScene = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      throw new Error("No active adventure run found for this session.");
    }
    if (!session.hostUserId || session.hostUserId !== user._id) {
      throw new Error("Only the host can advance the adventure.");
    }
    return advanceSceneState(ctx, args.sessionId);
  },
});

export const advanceSceneFromMapTransition = internalMutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    return advanceSceneState(ctx, args.sessionId);
  },
});
