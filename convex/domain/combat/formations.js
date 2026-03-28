import { ENEMY_TEMPLATES, PLAYER_SHEETS } from "./sheets";
import { rollDie } from "./dice";
import { clone } from "./helpers";

export function buildPlayerCombatant({
  participant,
  sheetKey,
  positionXFeet,
  positionYFeet,
  partySize,
}) {
  const sheet = PLAYER_SHEETS[sheetKey];
  if (!sheet) {
    throw new Error(`Unknown archetype sheet: ${sheetKey}`);
  }
  return {
    participantId: participant._id,
    kind: "player",
    side: "party",
    sheetKey,
    name: participant.displayName || sheet.name,
    displayName: participant.displayName || sheet.name,
    level: 3,
    armorClass: sheet.armorClass,
    maxHp: sheet.maxHp,
    currentHp: sheet.maxHp,
    tempHp: 0,
    initiativeBonus: sheet.initiativeBonus,
    initiativeRoll: rollDie(20),
    initiativeTotal: 0,
    speed: sheet.speed,
    positionFeet: positionXFeet,
    positionXFeet,
    positionYFeet,
    attackProfiles: clone(sheet.attackProfiles),
    spellProfiles: clone(sheet.spellProfiles),
    resources: clone(sheet.resources),
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    concentration: { active: false },
    resistances: clone(sheet.resistances || []),
    isDowned: false,
    isDead: false,
    partySize,
  };
}

export function buildEnemyRoster(partySize, encounterScale) {
  const countByScale = {
    light: Math.max(1, partySize - 1),
    standard: partySize,
    standard_plus: partySize + 1,
  };
  const count = countByScale[encounterScale] || partySize;
  const roster = [];
  for (let index = 0; index < count; index += 1) {
    let templateKey = "scavenger";
    if (encounterScale === "standard_plus" && index === 0) {
      templateKey = "brute";
    } else if (index === 0 && count >= 3) {
      templateKey = "brute";
    } else if (index === count - 1 && count >= 4) {
      templateKey = "archer";
    }
    roster.push(templateKey);
  }
  return roster;
}

export function buildEnemyCombatant({ templateKey, index, baseXFeet, baseYFeet }) {
  const template = ENEMY_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown enemy template: ${templateKey}`);
  }
  return {
    participantId: undefined,
    kind: "enemy",
    side: "enemy",
    sheetKey: templateKey,
    name: template.name,
    displayName: `${template.name} ${index + 1}`.trim(),
    level: 3,
    armorClass: template.armorClass,
    maxHp: template.maxHp,
    currentHp: template.maxHp,
    tempHp: 0,
    initiativeBonus: template.initiativeBonus,
    initiativeRoll: rollDie(20),
    initiativeTotal: 0,
    speed: template.speed,
    positionFeet: baseXFeet,
    positionXFeet: baseXFeet,
    positionYFeet: baseYFeet,
    attackProfiles: clone(template.attackProfiles),
    spellProfiles: clone(template.spellProfiles),
    resources: clone(template.resources),
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    concentration: { active: false },
    resistances: clone(template.resistances || []),
    isDowned: false,
    isDead: false,
  };
}

export function buildFormationYFeet(count) {
  if (count <= 1) {
    return [10];
  }
  const spacingFeet = 10;
  const totalSpanFeet = (count - 1) * spacingFeet;
  const startFeet = Math.max(0, Math.round((20 - totalSpanFeet / 2) / 5) * 5);
  return Array.from({ length: count }, (_, index) => startFeet + index * spacingFeet);
}

export function buildPlayerFormation(participants, partySize) {
  const yPositionsFeet = buildFormationYFeet(participants.length);
  return participants.map((participant, index) =>
    buildPlayerCombatant({
      participant,
      sheetKey: participant.archetypeKey,
      positionXFeet: 10,
      positionYFeet: yPositionsFeet[index] ?? index * 10,
      partySize,
    }),
  );
}

export function buildEnemyFormation(enemyRoster) {
  const yPositionsFeet = buildFormationYFeet(enemyRoster.length);
  return enemyRoster.map((templateKey, index) => {
    const baseXFeet = templateKey === "archer" ? 55 : templateKey === "brute" ? 45 : 50;
    return buildEnemyCombatant({
      templateKey,
      index,
      baseXFeet,
      baseYFeet: yPositionsFeet[index] ?? index * 10,
    });
  });
}

export async function backfillEncounterCoordinates(ctx, encounterId) {
  const combatants = await ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
    .collect();

  const missingCoordinates = combatants.filter(
    (combatant) =>
      typeof combatant.positionXFeet !== "number" || typeof combatant.positionYFeet !== "number",
  );
  if (!missingCoordinates.length) {
    return combatants;
  }

  const groupedCombatants = {
    party: combatants.filter((combatant) => combatant.side === "party"),
    enemy: combatants.filter((combatant) => combatant.side === "enemy"),
  };

  const yByGroup = {
    party: buildFormationYFeet(groupedCombatants.party.length),
    enemy: buildFormationYFeet(groupedCombatants.enemy.length),
  };

  for (const [side, sideCombatants] of Object.entries(groupedCombatants)) {
    const orderedSideCombatants = [...sideCombatants].sort((left, right) =>
      (left.displayName || left.name).localeCompare(right.displayName || right.name),
    );

    for (const [index, combatant] of orderedSideCombatants.entries()) {
      if (
        typeof combatant.positionXFeet === "number" &&
        typeof combatant.positionYFeet === "number"
      ) {
        continue;
      }
      const xFeet =
        typeof combatant.positionFeet === "number"
          ? combatant.positionFeet
          : side === "party"
            ? 10
            : 45;
      const yFeet = yByGroup[side][index] ?? index * 10;
      await ctx.db.patch(combatant._id, {
        positionFeet: xFeet,
        positionXFeet: xFeet,
        positionYFeet: yFeet,
        updatedAt: Date.now(),
      });
    }
  }

  return ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
    .collect();
}

export function normalizeEncounterCoordinates(combatants) {
  const groupedCombatants = {
    party: combatants.filter((combatant) => combatant.side === "party"),
    enemy: combatants.filter((combatant) => combatant.side === "enemy"),
  };

  const yByGroup = {
    party: buildFormationYFeet(groupedCombatants.party.length),
    enemy: buildFormationYFeet(groupedCombatants.enemy.length),
  };

  const indexById = new Map();
  for (const [side, sideCombatants] of Object.entries(groupedCombatants)) {
    const orderedSideCombatants = [...sideCombatants].sort((left, right) =>
      (left.displayName || left.name).localeCompare(right.displayName || right.name),
    );
    orderedSideCombatants.forEach((combatant, index) => {
      indexById.set(combatant._id, { side, index });
    });
  }

  return combatants.map((combatant) => {
    if (
      typeof combatant.positionXFeet === "number" &&
      typeof combatant.positionYFeet === "number"
    ) {
      return combatant;
    }
    const positionMeta = indexById.get(combatant._id);
    const xFeet =
      typeof combatant.positionFeet === "number"
        ? combatant.positionFeet
        : positionMeta?.side === "party"
          ? 10
          : 45;
    const yFeet = positionMeta
      ? yByGroup[positionMeta.side][positionMeta.index] ?? positionMeta.index * 10
      : 0;
    return {
      ...combatant,
      positionFeet: xFeet,
      positionXFeet: xFeet,
      positionYFeet: yFeet,
    };
  });
}

export function applyDamageToCombatant(combatant, damage) {
  let remaining = damage;
  let tempHp = combatant.tempHp;
  if (tempHp > 0) {
    const absorbed = Math.min(tempHp, remaining);
    tempHp -= absorbed;
    remaining -= absorbed;
  }

  const currentHp = Math.max(0, combatant.currentHp - remaining);
  const isDead = combatant.kind === "enemy" ? currentHp <= 0 : combatant.isDead;
  const isDowned = combatant.kind === "player" && currentHp <= 0;
  const next = {
    ...combatant,
    tempHp,
    currentHp,
    isDead,
    isDowned,
  };

  if (currentHp > 0) {
    next.deathSaves = { successes: 0, failures: 0 };
    next.isDowned = false;
    next.isDead = false;
  }

  return next;
}

export function healCombatant(combatant, healing) {
  const currentHp = Math.min(combatant.maxHp, combatant.currentHp + healing);
  return {
    ...combatant,
    currentHp,
    isDowned: currentHp <= 0 ? combatant.isDowned : false,
    isDead: false,
    deathSaves: currentHp > 0 ? { successes: 0, failures: 0 } : combatant.deathSaves,
  };
}
