import { mutation, query } from "./_generated/server";

const DEFAULT_ARCHETYPES = [
  {
    key: "human-fighter",
    name: "Human Fighter",
    race: "Human",
    className: "Fighter",
    level: 3,
    role: "frontline",
    shortSummary: "Straightforward martial bruiser with reliable weapon actions.",
    coreFeatures: ["Second Wind", "Action Surge", "melee weapon mastery"],
  },
  {
    key: "dwarf-cleric",
    name: "Dwarf Cleric",
    race: "Dwarf",
    className: "Cleric",
    level: 3,
    role: "support",
    shortSummary: "Durable support caster with healing and control tools.",
    coreFeatures: ["healing magic", "support buffs", "turn undead"],
  },
  {
    key: "elf-rogue",
    name: "Elf Rogue",
    race: "Elf",
    className: "Rogue",
    level: 3,
    role: "skirmisher",
    shortSummary: "High-agency skill and precision damage archetype.",
    coreFeatures: ["Sneak Attack", "Cunning Action", "high dexterity utility"],
  },
  {
    key: "tiefling-sorcerer",
    name: "Tiefling Sorcerer",
    race: "Tiefling",
    className: "Sorcerer",
    level: 3,
    role: "arcane",
    shortSummary: "Arcane blaster with strong spell identity for the beta.",
    coreFeatures: ["spellcasting", "sorcery points", "ranged damage options"],
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const archetypes = await ctx.db.query("characterTemplates").collect();
    return archetypes.sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db.query("characterTemplates").collect();
    const existingKeys = new Set(existing.map((item) => item.key));

    for (const archetype of DEFAULT_ARCHETYPES) {
      if (existingKeys.has(archetype.key)) {
        continue;
      }

      await ctx.db.insert("characterTemplates", {
        ...archetype,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return ctx.db.query("characterTemplates").collect();
  },
});
