export function getCombatantPosition(combatant) {
  return {
    xFeet: combatant.positionXFeet ?? combatant.positionFeet ?? 0,
    yFeet: combatant.positionYFeet ?? 0,
  };
}

export function getGridDistanceFeet(left, right) {
  const leftPosition = getCombatantPosition(left);
  const rightPosition = getCombatantPosition(right);
  return Math.max(
    Math.abs(leftPosition.xFeet - rightPosition.xFeet),
    Math.abs(leftPosition.yFeet - rightPosition.yFeet),
  );
}

export function isOccupiedPosition(combatants, xFeet, yFeet, ignoreCombatantId) {
  return combatants.some((combatant) => {
    if (ignoreCombatantId && combatant._id === ignoreCombatantId) {
      return false;
    }
    if (combatant.isDead) {
      return false;
    }
    const position = getCombatantPosition(combatant);
    return position.xFeet === xFeet && position.yFeet === yFeet;
  });
}
