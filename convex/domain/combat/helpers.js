import { ENEMY_TEMPLATES, PLAYER_SHEETS } from "./sheets";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sortCombatants(combatants) {
  return [...combatants].sort((left, right) => {
    const leftTotal = left.initiativeTotal ?? 0;
    const rightTotal = right.initiativeTotal ?? 0;
    if (rightTotal !== leftTotal) {
      return rightTotal - leftTotal;
    }
    if ((right.initiativeRoll ?? 0) !== (left.initiativeRoll ?? 0)) {
      return (right.initiativeRoll ?? 0) - (left.initiativeRoll ?? 0);
    }
    return left.name.localeCompare(right.name);
  });
}

export function getSheet(sheetKey) {
  return PLAYER_SHEETS[sheetKey] || ENEMY_TEMPLATES[sheetKey];
}

export function getSaveBonus(combatant, ability) {
  const sheet = getSheet(combatant.sheetKey);
  if (!sheet?.savingThrows) {
    return 0;
  }
  return sheet.savingThrows[ability] ?? 0;
}

export function getActiveArmorClass(combatant) {
  let armorClass = combatant.armorClass;
  if (combatant.conditions.includes("shield-of-faith")) {
    armorClass += 2;
  }
  return armorClass;
}

export function getAliveCombatants(combatants) {
  return combatants.filter((combatant) => !combatant.isDead);
}

export function getLivingBySide(combatants, side) {
  return combatants.filter((combatant) => combatant.side === side && !combatant.isDead);
}
