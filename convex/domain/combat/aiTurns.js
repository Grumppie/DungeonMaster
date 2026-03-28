import { getCombatantPosition, getGridDistanceFeet, isOccupiedPosition } from "./grid";
import { applyDamageToCombatant } from "./formations";
import { getActiveArmorClass, getLivingBySide, getSaveBonus } from "./helpers";
import { rollDie, rollDice } from "./dice";
import { advanceToNextCombatant, completeEncounter, writeEvent } from "./state";

export function getNearestEnemy(actor, combatants, side) {
  const candidates = combatants.filter(
    (combatant) => combatant.side === side && !combatant.isDead && combatant.currentHp > 0,
  );
  if (!candidates.length) {
    return null;
  }
  return candidates.reduce((closest, candidate) => {
    const closestDistance = getGridDistanceFeet(closest, actor);
    const candidateDistance = getGridDistanceFeet(candidate, actor);
    if (candidateDistance < closestDistance) {
      return candidate;
    }
    if (candidateDistance === closestDistance && candidate.currentHp < closest.currentHp) {
      return candidate;
    }
    return closest;
  }, candidates[0]);
}

function stepToward(current, target, stepFeet) {
  if (current === target || stepFeet <= 0) {
    return current;
  }
  return current < target ? current + stepFeet : current - stepFeet;
}

export function approachTargetPosition(actor, target, combatants, desiredRange = 5) {
  const actorPosition = getCombatantPosition(actor);
  const targetPosition = getCombatantPosition(target);
  const currentDistance = getGridDistanceFeet(actor, target);
  if (currentDistance <= desiredRange) {
    return actorPosition;
  }

  let remainingFeet = Math.min(actor.speed, currentDistance - desiredRange);
  let nextXFeet = actorPosition.xFeet;
  let nextYFeet = actorPosition.yFeet;

  while (remainingFeet > 0) {
    const proposedXFeet = stepToward(nextXFeet, targetPosition.xFeet, 5);
    const proposedYFeet = stepToward(nextYFeet, targetPosition.yFeet, 5);
    const candidateMoves = [];

    if (proposedXFeet !== nextXFeet && proposedYFeet !== nextYFeet) {
      candidateMoves.push({ xFeet: proposedXFeet, yFeet: proposedYFeet });
    }
    if (proposedXFeet !== nextXFeet) {
      candidateMoves.push({ xFeet: proposedXFeet, yFeet: nextYFeet });
    }
    if (proposedYFeet !== nextYFeet) {
      candidateMoves.push({ xFeet: nextXFeet, yFeet: proposedYFeet });
    }

    const nextMove = candidateMoves.find(
      (candidate) => !isOccupiedPosition(combatants, candidate.xFeet, candidate.yFeet, actor._id),
    );
    if (!nextMove) {
      break;
    }

    nextXFeet = nextMove.xFeet;
    nextYFeet = nextMove.yFeet;
    remainingFeet -= 5;

    const trialActor = {
      ...actor,
      positionFeet: nextXFeet,
      positionXFeet: nextXFeet,
      positionYFeet: nextYFeet,
    };
    if (getGridDistanceFeet(trialActor, target) <= desiredRange) {
      break;
    }
  }

  return { xFeet: nextXFeet, yFeet: nextYFeet };
}

export async function resolveEnemyTurn(ctx, encounterId, combatant) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter || encounter.status !== "active") {
    return null;
  }
  const combatants = await ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
    .collect();
  const target = getNearestEnemy(combatant, combatants, "party");
  if (!target) {
    const partyCombatants = combatants.filter((entry) => entry.side === "party" && !entry.isDead);
    if (!partyCombatants.length) {
      await completeEncounter(ctx, encounterId, "enemy", "The party has been routed.");
      return null;
    }
    return advanceToNextCombatant(ctx, encounterId);
  }

  const attackProfile = combatant.attackProfiles[0];
  const distance = getGridDistanceFeet(target, combatant);
  let nextCombatant = combatant;
  if (attackProfile.rangeFeet <= 5 && distance > 5) {
    const movedPosition = approachTargetPosition(combatant, target, combatants, 5);
    await ctx.db.patch(combatant._id, {
      positionFeet: movedPosition.xFeet,
      positionXFeet: movedPosition.xFeet,
      positionYFeet: movedPosition.yFeet,
      updatedAt: Date.now(),
    });
    nextCombatant = {
      ...combatant,
      positionFeet: movedPosition.xFeet,
      positionXFeet: movedPosition.xFeet,
      positionYFeet: movedPosition.yFeet,
    };
    await writeEvent(
      ctx,
      encounterId,
      encounter.round,
      "move",
      `${combatant.displayName || combatant.name} closes to melee.`,
      {
        from: getCombatantPosition(combatant),
        to: movedPosition,
      },
      combatant._id,
    );
  }

  const currentTargetDistance = getGridDistanceFeet(target, nextCombatant);
  if (currentTargetDistance > attackProfile.rangeFeet) {
    await writeEvent(
      ctx,
      encounterId,
      encounter.round,
      "npc-turn",
      `${combatant.displayName || combatant.name} cannot reach ${target.displayName || target.name}.`,
      { targetId: target._id, distance: currentTargetDistance },
      combatant._id,
    );
    return advanceToNextCombatant(ctx, encounterId);
  }

  const attackRoll = rollDie(20);
  const totalAttack = attackRoll + attackProfile.attackBonus;
  const targetAc = getActiveArmorClass(target);
  const hit = attackRoll === 20 || totalAttack >= targetAc;
  let result = `${combatant.displayName || combatant.name} attacks ${target.displayName || target.name}.`;
  const payload = {
    attackRoll,
    attackBonus: attackProfile.attackBonus,
    totalAttack,
    targetAc,
    hit,
  };

  if (hit) {
    const damage = rollDice(attackProfile.damageFormula, { critical: attackRoll === 20 });
    const damagedTarget = applyDamageToCombatant(target, damage.total);
    await ctx.db.patch(target._id, {
      currentHp: damagedTarget.currentHp,
      tempHp: damagedTarget.tempHp,
      isDowned: damagedTarget.isDowned,
      isDead: damagedTarget.isDead,
      deathSaves: damagedTarget.deathSaves,
      updatedAt: Date.now(),
    });
    if (target.concentration?.active && damage.total > 0) {
      const concentrationDc = Math.max(10, Math.ceil(damage.total / 2));
      const conRoll = rollDie(20) + getSaveBonus(target, "con");
      if (conRoll < concentrationDc) {
        await ctx.db.patch(target._id, {
          concentration: { active: false },
          conditions: target.conditions.filter((condition) => condition !== "shield-of-faith"),
          updatedAt: Date.now(),
        });
      }
    }
    result = `${combatant.displayName || combatant.name} hits ${target.displayName || target.name} for ${damage.total} ${attackProfile.damageType} damage.`;
    payload.damage = damage;
    payload.targetId = target._id;
    payload.targetHp = damagedTarget.currentHp;
  }

  await writeEvent(ctx, encounterId, encounter.round, "npc-attack", result, payload, combatant._id);
  const refreshedCombatants = await ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
    .collect();
  const remainingPlayers = getLivingBySide(refreshedCombatants, "party").filter(
    (entry) => !entry.isDead,
  );
  const remainingEnemies = getLivingBySide(refreshedCombatants, "enemy").filter(
    (entry) => !entry.isDead,
  );

  if (!remainingPlayers.length) {
    await completeEncounter(ctx, encounterId, "enemy", "All party members were defeated.");
    return null;
  }
  if (!remainingEnemies.length) {
    await completeEncounter(ctx, encounterId, "party", "All enemies were defeated.");
    return null;
  }

  return advanceToNextCombatant(ctx, encounterId);
}

export async function resolvePendingTurns(ctx, encounterId) {
  let nextCombatant = await advanceToNextCombatant(ctx, encounterId);
  let safety = 0;
  while (nextCombatant && safety < 20) {
    safety += 1;
    const encounter = await ctx.db.get(encounterId);
    if (!encounter || encounter.status !== "active") {
      return null;
    }
    if (nextCombatant.kind === "player") {
      return nextCombatant;
    }
    nextCombatant = await resolveEnemyTurn(ctx, encounterId, nextCombatant);
  }
  return nextCombatant;
}

export async function primeCombatEncounter(ctx, encounterId) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter || encounter.status !== "active") {
    return null;
  }

  return resolvePendingTurns(ctx, encounterId);
}
