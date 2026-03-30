function normalizeText(value) {
  return String(value || "").trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const WORLD_FLAVORS = [
  {
    key: "pirate",
    keywords: ["pirate", "sea", "ocean", "ship", "harbor", "estuary", "tide", "storm"],
    label: "salt-slick pirate raid",
  },
  {
    key: "gothic",
    keywords: ["gothic", "vampire", "grave", "haunt", "cathedral", "crypt", "undead"],
    label: "gothic ruin crawl",
  },
  {
    key: "jungle",
    keywords: ["jungle", "serpent", "ruin", "temple", "dinosaur", "vine", "swamp"],
    label: "jungle ruin expedition",
  },
  {
    key: "desert",
    keywords: ["desert", "sand", "dune", "sun", "mirage", "tomb"],
    label: "sun-scorched desert push",
  },
  {
    key: "sky",
    keywords: ["sky", "floating", "airship", "cloud", "storm", "aerial"],
    label: "sky-island strike",
  },
  {
    key: "arcane",
    keywords: ["arcane", "mage", "wizard", "spell", "library", "clockwork", "portal"],
    label: "arcane vault breach",
  },
  {
    key: "infernal",
    keywords: ["hell", "infernal", "demon", "devil", "brass", "ash", "lava"],
    label: "infernal fortress assault",
  },
  {
    key: "urban",
    keywords: ["city", "street", "market", "alley", "gang", "heist", "district"],
    label: "city heist run",
  },
];

const COMBAT_HEAVY_KEYWORDS = [
  "combat",
  "battle",
  "fight",
  "war",
  "siege",
  "boss",
  "arena",
  "blood",
  "brutal",
  "slaughter",
  "raid",
  "action",
];

const INVESTIGATION_HEAVY_KEYWORDS = [
  "mystery",
  "investigation",
  "detective",
  "clue",
  "puzzle",
  "stealth",
  "intrigue",
  "explore",
  "discovery",
];

export function inferWorldPreferences({ sessionTitle, worldPrompt }) {
  const prompt = normalizeText(worldPrompt);
  const combined = `${normalizeText(sessionTitle)} ${prompt}`.trim();
  const tokens = tokenize(combined);

  const flavor = WORLD_FLAVORS
    .map((entry) => ({
      ...entry,
      score: entry.keywords.reduce((total, keyword) => total + (tokens.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score)[0];

  const combatScore = COMBAT_HEAVY_KEYWORDS.reduce(
    (total, keyword) => total + (tokens.includes(keyword) ? 1 : 0),
    0,
  );
  const investigationScore = INVESTIGATION_HEAVY_KEYWORDS.reduce(
    (total, keyword) => total + (tokens.includes(keyword) ? 1 : 0),
    0,
  );

  return {
    worldPrompt: prompt,
    combinedPrompt: combined,
    flavorKey: flavor?.score ? flavor.key : "arcane",
    flavorLabel: flavor?.score ? flavor.label : "frontier fantasy raid",
    combatHeavy: combatScore > investigationScore,
    investigationHeavy: investigationScore > combatScore,
    openingSceneType: combatScore > investigationScore ? "combat" : "intro",
  };
}
