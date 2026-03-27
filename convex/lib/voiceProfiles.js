const FALLBACK_DEEPGRAM_VOICE = process.env.DEEPGRAM_VOICE || "aura-2-thalia-en";
const HAS_ELEVENLABS = Boolean(process.env.ELEVENLABS_API_KEY || process.env.ELEVANLABS_API_KEY);

const VOICE_ARCHETYPES = [
  {
    key: "commander",
    match: ["captain", "marshal", "warden", "commander", "lieutenant"],
    elevenlabsEnv: ["ELEVENLABS_VOICE_COMMANDER", "ELEVANLABS_VOICE_COMMANDER"],
    deepgramEnv: ["DEEPGRAM_VOICE_COMMANDER", "DEEPGRAM_VOICE"],
    stylePrompt: "Controlled battlefield authority, clipped commands, pressure without shouting.",
  },
  {
    key: "mystic",
    match: ["archivist", "echo", "priest", "oracle", "mystic", "caretaker"],
    elevenlabsEnv: ["ELEVENLABS_VOICE_MYSTIC", "ELEVANLABS_VOICE_MYSTIC"],
    deepgramEnv: ["DEEPGRAM_VOICE_MYSTIC", "DEEPGRAM_VOICE"],
    stylePrompt: "Measured cadence, uncanny calm, faint ceremonial weight.",
  },
  {
    key: "rogue",
    match: ["broker", "scout", "witness", "smuggler", "cutthroat", "runner"],
    elevenlabsEnv: ["ELEVENLABS_VOICE_ROGUE", "ELEVANLABS_VOICE_ROGUE"],
    deepgramEnv: ["DEEPGRAM_VOICE_ROGUE", "DEEPGRAM_VOICE"],
    stylePrompt: "Fast, wary, opportunistic, with guarded confidence or nerves.",
  },
  {
    key: "brute",
    match: ["brute", "enforcer", "guard", "raider", "champion"],
    elevenlabsEnv: ["ELEVENLABS_VOICE_BRUTE", "ELEVANLABS_VOICE_BRUTE"],
    deepgramEnv: ["DEEPGRAM_VOICE_BRUTE", "DEEPGRAM_VOICE"],
    stylePrompt: "Heavy, direct, threatening, low patience for speeches.",
  },
  {
    key: "noble",
    match: ["sister", "lord", "lady", "magistrate", "envoy"],
    elevenlabsEnv: ["ELEVENLABS_VOICE_NOBLE", "ELEVANLABS_VOICE_NOBLE"],
    deepgramEnv: ["DEEPGRAM_VOICE_NOBLE", "DEEPGRAM_VOICE"],
    stylePrompt: "Composed, articulate, elevated diction without sounding modern.",
  },
];

function readFirstEnvValue(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function chooseArchetype(npc) {
  const haystack = `${npc.role || ""} ${npc.motive || ""} ${npc.voiceTone || ""}`.toLowerCase();
  return VOICE_ARCHETYPES.find((profile) => profile.match.some((token) => haystack.includes(token))) || VOICE_ARCHETYPES[0];
}

export function buildNarratorVoiceProfile() {
  return {
    voiceProvider: "deepgram",
    voiceId: readFirstEnvValue(["DEEPGRAM_DM_VOICE", "DEEPGRAM_VOICE"]) || FALLBACK_DEEPGRAM_VOICE,
    stylePrompt: "Dramatic dungeon master narration. Crisp, controlled, immersive, and never cartoonish.",
  };
}

export function buildNpcVoiceProfile(npc) {
  const archetype = chooseArchetype(npc);
  const elevenlabsVoiceId = readFirstEnvValue(archetype.elevenlabsEnv);
  const deepgramVoiceId = readFirstEnvValue(archetype.deepgramEnv) || FALLBACK_DEEPGRAM_VOICE;
  const provider = HAS_ELEVENLABS && elevenlabsVoiceId ? "elevenlabs" : "deepgram";

  return {
    voiceProvider: provider,
    voiceId: provider === "elevenlabs" ? elevenlabsVoiceId : deepgramVoiceId,
    stylePrompt: [archetype.stylePrompt, npc.voiceTone, npc.motive].filter(Boolean).join(" "),
  };
}

export function enrichNpcVoiceProfiles(npcs) {
  return (npcs || []).map((npc) => ({
    ...npc,
    ...buildNpcVoiceProfile(npc),
  }));
}

