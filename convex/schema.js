import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  participantStatusValidator,
  presenceStateValidator,
  roomPrivacyValidator,
  sessionStatusValidator,
} from "./domain/session/validators";
import {
  interactableBlueprintValidator,
  investigationRuleValidator,
  sceneNpcBriefValidator,
} from "./domain/world/validators";

const sessionStatus = v.union(
  v.literal("lobby"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("archived"),
);

const adventureStatus = v.union(
  v.literal("setup"),
  v.literal("active"),
  v.literal("completed"),
);

const sceneStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("completed"),
);

const sceneType = v.union(
  v.literal("intro"),
  v.literal("exploration"),
  v.literal("combat"),
  v.literal("resolution"),
);

const dmStatus = v.union(
  v.literal("idle"),
  v.literal("retrieving"),
  v.literal("responding"),
  v.literal("speaking"),
);

const sceneMessageSpeakerType = v.union(
  v.literal("dm"),
  v.literal("player"),
  v.literal("npc"),
  v.literal("system"),
);

const sceneMessageType = v.union(
  v.literal("narration"),
  v.literal("prompt"),
  v.literal("reply"),
  v.literal("system"),
);

const combatEncounterStatus = v.union(
  v.literal("setup"),
  v.literal("active"),
  v.literal("completed"),
);

const combatantSide = v.union(
  v.literal("party"),
  v.literal("enemy"),
);

const combatantKind = v.union(
  v.literal("player"),
  v.literal("enemy"),
);

export default defineSchema({
  appUsers: defineTable({
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_subject", ["subject"]),

  characterTemplates: defineTable({
    key: v.string(),
    name: v.string(),
    race: v.string(),
    className: v.string(),
    level: v.number(),
    role: v.string(),
    shortSummary: v.string(),
    coreFeatures: v.array(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  gameSessions: defineTable({
    joinCode: v.string(),
    hostUserId: v.optional(v.id("appUsers")),
    currentRunId: v.optional(v.id("adventureRuns")),
    title: v.string(),
    roomPrivacy: roomPrivacyValidator,
    allowOpenJoin: v.boolean(),
    turnTimerSeconds: v.number(),
    lockedAt: v.optional(v.number()),
    dmStatus: v.optional(dmStatus),
    status: sessionStatusValidator,
    minPlayers: v.number(),
    maxPlayers: v.number(),
    currentPlayerCount: v.number(),
    storylineMode: v.literal("adaptive_party_size"),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_join_code", ["joinCode"])
    .index("by_host", ["hostUserId"]),

  sessionParticipants: defineTable({
    sessionId: v.id("gameSessions"),
    userId: v.optional(v.id("appUsers")),
    displayName: v.string(),
    characterName: v.string(),
    archetypeKey: v.optional(v.string()),
    status: participantStatusValidator,
    presenceState: presenceStateValidator,
    lastSeenAt: v.number(),
    seatIndex: v.optional(v.number()),
    sceneX: v.optional(v.number()),
    sceneY: v.optional(v.number()),
    isAnonymous: v.boolean(),
    joinedAt: v.number(),
    updatedAt: v.number(),
    })
    .index("by_session", ["sessionId"])
    .index("by_session_user", ["sessionId", "userId"]),

  adventureRuns: defineTable({
    sessionId: v.id("gameSessions"),
    title: v.string(),
    status: adventureStatus,
    partySize: v.number(),
    questHook: v.string(),
    objective: v.string(),
    summary: v.string(),
    activeSceneOrder: v.number(),
    totalScenes: v.number(),
    currentCombatEncounterId: v.optional(v.id("combatEncounters")),
    createdAt: v.number(),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  adventureScenes: defineTable({
    runId: v.id("adventureRuns"),
    sessionId: v.id("gameSessions"),
    combatEncounterId: v.optional(v.id("combatEncounters")),
    order: v.number(),
    type: sceneType,
    status: sceneStatus,
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run", ["runId"])
    .index("by_session_order", ["sessionId", "order"]),

  sceneMessages: defineTable({
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    participantId: v.optional(v.id("sessionParticipants")),
    speakerType: sceneMessageSpeakerType,
    speakerLabel: v.string(),
    messageType: sceneMessageType,
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId", "createdAt"])
    .index("by_session", ["sessionId", "createdAt"]),

  combatEncounters: defineTable({
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    status: combatEncounterStatus,
    round: v.number(),
    activeTurnIndex: v.number(),
    currentCombatantId: v.optional(v.id("combatants")),
    turnOrder: v.array(v.id("combatants")),
    turnRevision: v.optional(v.number()),
    turnTimerEndsAt: v.optional(v.number()),
    partyDistanceFeet: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    winnerSide: v.optional(combatantSide),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_run", ["runId"])
    .index("by_scene", ["sceneId"]),

  combatants: defineTable({
    encounterId: v.id("combatEncounters"),
    sessionId: v.id("gameSessions"),
    runId: v.id("adventureRuns"),
    sceneId: v.id("adventureScenes"),
    participantId: v.optional(v.id("sessionParticipants")),
    kind: combatantKind,
    side: combatantSide,
    sheetKey: v.string(),
    name: v.string(),
    displayName: v.optional(v.string()),
    level: v.number(),
    armorClass: v.number(),
    maxHp: v.number(),
    currentHp: v.number(),
    tempHp: v.number(),
    initiativeBonus: v.number(),
    initiativeRoll: v.optional(v.number()),
    initiativeTotal: v.optional(v.number()),
    speed: v.number(),
    positionFeet: v.number(),
    positionXFeet: v.optional(v.number()),
    positionYFeet: v.optional(v.number()),
    attackProfiles: v.array(v.any()),
    spellProfiles: v.array(v.any()),
    resources: v.any(),
    conditions: v.array(v.string()),
    deathSaves: v.any(),
    concentration: v.any(),
    resistances: v.array(v.string()),
    isDowned: v.boolean(),
    isDead: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_encounter", ["encounterId"])
    .index("by_session", ["sessionId"])
    .index("by_participant", ["participantId"]),

  combatEvents: defineTable({
    encounterId: v.id("combatEncounters"),
    combatantId: v.optional(v.id("combatants")),
    round: v.number(),
    eventType: v.string(),
    summary: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_encounter", ["encounterId"]),

  corpusSources: defineTable({
    sourceKey: v.string(),
    sourceLabel: v.string(),
    sourceType: v.string(),
    sourcePath: v.optional(v.string()),
    authorityLevel: v.string(),
    rulesDomain: v.string(),
    visibility: v.string(),
    chunkCount: v.number(),
    contentHash: v.optional(v.string()),
    importStatus: v.string(),
    indexedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["sourceKey"]),

  corpusChunks: defineTable({
    sourceKey: v.string(),
    sourceLabel: v.string(),
    sourceType: v.string(),
    authorityLevel: v.string(),
    rulesDomain: v.string(),
    visibility: v.string(),
    chunkIndex: v.number(),
    chunkText: v.string(),
    metadata: v.optional(v.any()),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source", ["sourceKey"])
    .index("by_source_chunk", ["sourceKey", "chunkIndex"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["sourceKey", "rulesDomain", "visibility"],
    }),

  sceneMaps: defineTable({
    sceneId: v.id("adventureScenes"),
    width: v.number(),
    height: v.number(),
    cells: v.array(
      v.object({
        x: v.number(),
        y: v.number(),
        blocked: v.boolean(),
        occupiedById: v.optional(v.string()),
        terrainType: v.optional(
          v.union(v.literal("open"), v.literal("cover"), v.literal("hazard"), v.literal("difficult")),
        ),
        interactableId: v.optional(v.string()),
      }),
    ),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_scene", ["sceneId"]),

  npcMemories: defineTable({
    npcId: v.string(),
    memoryType: v.union(v.literal("key"), v.literal("compact")),
    summary: v.string(),
    weight: v.number(),
    confidence: v.number(),
    sourceEventId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_npc", ["npcId"]),

  voiceEvents: defineTable({
    roomId: v.id("gameSessions"),
    speakerType: v.union(v.literal("dm"), v.literal("npc")),
    speakerId: v.optional(v.string()),
    speakerName: v.string(),
    transcript: v.string(),
    provider: v.union(v.literal("deepgram"), v.literal("elevenlabs")),
    voiceProfileKey: v.string(),
    audioCacheKey: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_room", ["roomId", "createdAt"]),

  voiceCaches: defineTable({
    cacheKey: v.string(),
    provider: v.union(v.literal("deepgram"), v.literal("elevenlabs")),
    voiceId: v.string(),
    transcript: v.string(),
    stylePrompt: v.optional(v.string()),
    audioUrl: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_cache_key", ["cacheKey"]),

  actionPreviews: defineTable({
    actorId: v.id("combatants"),
    encounterId: v.id("combatEncounters"),
    turnRevision: v.number(),
    payload: v.any(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_encounter", ["encounterId"])
    .index("by_actor_encounter", ["actorId", "encounterId"]),
});
