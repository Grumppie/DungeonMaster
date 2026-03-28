import { getCombatantPosition, getGridDistanceFeet, isOccupiedPosition } from "./grid";
import { inferAreaTemplate } from "./dice";

export function buildPreviewPayload(encounter, actor, combatants, action) {
  const combatantMap = new Map(combatants.map((combatant) => [combatant._id, combatant]));
  if (action.type === "move") {
    const actorPosition = getCombatantPosition(actor);
    const destinationXFeet = Number(action.destinationXFeet);
    const destinationYFeet = Number(action.destinationYFeet);
    if (!Number.isFinite(destinationXFeet) || !Number.isFinite(destinationYFeet)) {
      throw new Error("A valid destination coordinate is required.");
    }
    const movementDistance = Math.max(
      Math.abs(destinationXFeet - actorPosition.xFeet),
      Math.abs(destinationYFeet - actorPosition.yFeet),
    );
    if (movementDistance > actor.speed) {
      throw new Error("Movement exceeds available speed.");
    }
    if (isOccupiedPosition(combatants, destinationXFeet, destinationYFeet, actor._id)) {
      throw new Error("That grid space is already occupied.");
    }
    return {
      legal: true,
      reason: "Move preview is valid.",
      action,
      rangeFeet: actor.speed,
      areaTemplate: { shape: "single", sizeFeet: 5 },
      affectedCellKeys: [`${destinationXFeet}:${destinationYFeet}`],
      affectedCombatantIds: [actor._id],
      summary: `${actor.displayName || actor.name} moves to ${destinationXFeet / 5},${destinationYFeet / 5}.`,
    };
  }

  const profile =
    action.type === "attack"
      ? actor.attackProfiles.find((entry) => entry.key === action.profileKey)
      : actor.spellProfiles.find((entry) => entry.key === action.profileKey);
  if (!profile) {
    throw new Error("The selected action is not available to this combatant.");
  }
  const resolvedTarget =
    profile.targetSide === "self"
      ? actor
      : action.targetCombatantId
        ? combatantMap.get(action.targetCombatantId)
        : null;
  if (!resolvedTarget) {
    throw new Error("A valid target is required.");
  }
  const distance = getGridDistanceFeet(resolvedTarget, actor);
  if (profile.rangeFeet && distance > profile.rangeFeet) {
    throw new Error("The target is out of range.");
  }

  return {
    legal: true,
    reason: "Preview validated against current combat state.",
    action,
    profileKey: profile.key,
    actionType: action.type,
    resolutionMode: profile.resolutionMode || profile.actionType,
    rangeFeet: profile.rangeFeet || 5,
    damageFormula: profile.damageFormula || profile.healFormula || null,
    saveAbility: profile.saveAbility || null,
    saveDc: profile.saveDc || null,
    areaTemplate: inferAreaTemplate(profile),
    affectedCellKeys: [],
    affectedCombatantIds: [resolvedTarget._id],
    summary: `${profile.name} targets ${resolvedTarget.displayName || resolvedTarget.name}.`,
  };
}
