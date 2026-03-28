import { getCombatantPosition, getGridDistanceFeet, isOccupiedPosition } from "./grid";
import { rollDie, rollDice } from "./dice";
import { consumeResource, consumeSpellSlot } from "./resources";
import { applyDamageToCombatant, healCombatant } from "./formations";
import { clone, getActiveArmorClass, getLivingBySide, getSaveBonus } from "./helpers";
import { completeEncounter, writeEvent } from "./state";

export async function finalizeEncounterIfResolved(ctx, encounterId) {
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
    return true;
  }

  if (!remainingEnemies.length) {
    await completeEncounter(ctx, encounterId, "party", "All enemies were defeated.");
    return true;
  }

  return false;
}

export async function applyPlayerAction(ctx, encounter, actor, combatants, action) {
  const combatantMap = new Map(combatants.map((combatant) => [combatant._id, combatant]));
  const profile =
    action.type === "attack"
      ? actor.attackProfiles.find((entry) => entry.key === action.profileKey)
      : actor.spellProfiles.find((entry) => entry.key === action.profileKey);

  if (action.type === "move") {
    const destinationXFeet = Number(action.destinationXFeet);
    const destinationYFeet = Number(action.destinationYFeet);
    if (
      !Number.isFinite(destinationXFeet) ||
      !Number.isFinite(destinationYFeet) ||
      destinationXFeet < 0 ||
      destinationYFeet < 0
    ) {
      throw new Error("A valid destination coordinate is required for movement.");
    }
    const actorPosition = getCombatantPosition(actor);
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
    await ctx.db.patch(actor._id, {
      positionFeet: destinationXFeet,
      positionXFeet: destinationXFeet,
      positionYFeet: destinationYFeet,
      updatedAt: Date.now(),
    });
    await writeEvent(
      ctx,
      encounter._id,
      encounter.round,
      "move",
      `${actor.displayName || actor.name} moves to (${destinationXFeet / 5}, ${destinationYFeet / 5}).`,
      {
        from: actorPosition,
        to: { xFeet: destinationXFeet, yFeet: destinationYFeet },
      },
      actor._id,
    );
    return true;
  }

  if (action.type === "endTurn") {
    await writeEvent(
      ctx,
      encounter._id,
      encounter.round,
      "end-turn",
      `${actor.displayName || actor.name} ends the turn.`,
      {},
      actor._id,
    );
    return true;
  }

  if (!profile) {
    throw new Error("The selected action is not available to this combatant.");
  }

  const target = action.targetCombatantId ? combatantMap.get(action.targetCombatantId) : null;
  if (profile.targetSide === "enemy" && !target) {
    throw new Error("An enemy target is required.");
  }
  if (profile.targetSide === "ally" && !target) {
    throw new Error("An ally target is required.");
  }
  if (profile.targetSide === "self") {
    if (action.targetCombatantId && action.targetCombatantId !== actor._id) {
      throw new Error("Self-targeting actions cannot select a different target.");
    }
  }

  const resolvedTarget = profile.targetSide === "self" ? actor : target;
  if (!resolvedTarget) {
    throw new Error("Target resolution failed.");
  }

  const distance = getGridDistanceFeet(resolvedTarget, actor);
  if (profile.rangeFeet && distance > profile.rangeFeet) {
    throw new Error("The target is out of range.");
  }

  if (action.type === "attack" || profile.resolutionMode === "attack") {
    const attackRoll = rollDie(20);
    const totalAttack = attackRoll + profile.attackBonus;
    const targetAc = getActiveArmorClass(resolvedTarget);
    const hit = attackRoll === 20 || totalAttack >= targetAc;
    let summary = `${actor.displayName || actor.name} attacks ${resolvedTarget.displayName || resolvedTarget.name}.`;
    const payload = {
      attackRoll,
      attackBonus: profile.attackBonus,
      totalAttack,
      targetAc,
      hit,
    };

    if (hit) {
      const damage = rollDice(profile.damageFormula, { critical: attackRoll === 20 });
      const damagedTarget = applyDamageToCombatant(resolvedTarget, damage.total);
      await ctx.db.patch(resolvedTarget._id, {
        currentHp: damagedTarget.currentHp,
        tempHp: damagedTarget.tempHp,
        isDowned: damagedTarget.isDowned,
        isDead: damagedTarget.isDead,
        deathSaves: damagedTarget.deathSaves,
        updatedAt: Date.now(),
      });
      if (resolvedTarget.concentration?.active && damage.total > 0) {
        const concentrationDc = Math.max(10, Math.ceil(damage.total / 2));
        const conRoll = rollDie(20) + getSaveBonus(resolvedTarget, "con");
        if (conRoll < concentrationDc) {
          await ctx.db.patch(resolvedTarget._id, {
            concentration: { active: false },
            conditions: resolvedTarget.conditions.filter(
              (condition) => condition !== "shield-of-faith",
            ),
            updatedAt: Date.now(),
          });
        }
      }
      summary = `${actor.displayName || actor.name} hits ${resolvedTarget.displayName || resolvedTarget.name} for ${damage.total} ${profile.damageType} damage.`;
      payload.damage = damage;
      payload.targetId = resolvedTarget._id;
      payload.targetHp = damagedTarget.currentHp;
    } else {
      summary = `${actor.displayName || actor.name} misses ${resolvedTarget.displayName || resolvedTarget.name}.`;
      payload.targetId = resolvedTarget._id;
    }

    await writeEvent(ctx, encounter._id, encounter.round, "attack", summary, payload, actor._id);
    await finalizeEncounterIfResolved(ctx, encounter._id);
    return true;
  }

  if (profile.resolutionMode === "healSelf" || profile.resolutionMode === "heal") {
    let nextResources = clone(actor.resources);
    if (profile.resourceKey) {
      nextResources = consumeResource(nextResources, profile.resourceKey);
    }
    if (profile.slotLevel) {
      nextResources = consumeSpellSlot(nextResources, profile.slotLevel);
    }

    const healing = rollDice(profile.healFormula);
    const healedTarget = healCombatant(resolvedTarget, healing.total);
    await ctx.db.patch(resolvedTarget._id, {
      currentHp: healedTarget.currentHp,
      isDowned: healedTarget.isDowned,
      isDead: healedTarget.isDead,
      deathSaves: healedTarget.deathSaves,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(actor._id, {
      resources: nextResources,
      updatedAt: Date.now(),
    });
    await writeEvent(
      ctx,
      encounter._id,
      encounter.round,
      "heal",
      `${actor.displayName || actor.name} restores ${healing.total} hit points to ${
        resolvedTarget.displayName || resolvedTarget.name
      }.`,
      { healing, targetId: resolvedTarget._id, targetHp: healedTarget.currentHp },
      actor._id,
    );
    await finalizeEncounterIfResolved(ctx, encounter._id);
    return true;
  }

  if (profile.resolutionMode === "saveDamage") {
    const targetSave = rollDie(20) + getSaveBonus(resolvedTarget, profile.saveAbility || "dex");
    const success = targetSave >= (profile.saveDc || 10);
    const damage = rollDice(profile.damageFormula, { critical: false });
    const appliedDamage =
      success && profile.halfOnSave ? Math.floor(damage.total / 2) : success ? 0 : damage.total;
    const damagedTarget = applyDamageToCombatant(resolvedTarget, appliedDamage);

    let nextResources = clone(actor.resources);
    if (profile.resourceKey) {
      nextResources = consumeResource(nextResources, profile.resourceKey);
    }
    if (profile.slotLevel) {
      nextResources = consumeSpellSlot(nextResources, profile.slotLevel);
    }

    await ctx.db.patch(resolvedTarget._id, {
      currentHp: damagedTarget.currentHp,
      tempHp: damagedTarget.tempHp,
      isDowned: damagedTarget.isDowned,
      isDead: damagedTarget.isDead,
      deathSaves: damagedTarget.deathSaves,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(actor._id, {
      resources: nextResources,
      updatedAt: Date.now(),
    });
    await writeEvent(
      ctx,
      encounter._id,
      encounter.round,
      "spell",
      success
        ? `${resolvedTarget.displayName || resolvedTarget.name} resists ${profile.name}.`
        : `${profile.name} burns ${resolvedTarget.displayName || resolvedTarget.name} for ${appliedDamage} damage.`,
      {
        targetId: resolvedTarget._id,
        saveRoll: targetSave,
        saveDc: profile.saveDc,
        success,
        damage,
        appliedDamage,
      },
      actor._id,
    );
    await finalizeEncounterIfResolved(ctx, encounter._id);
    return true;
  }

  if (profile.resolutionMode === "buff" && profile.buffCondition === "shield-of-faith") {
    let nextResources = clone(actor.resources);
    if (profile.resourceKey) {
      nextResources = consumeResource(nextResources, profile.resourceKey);
    }
    if (profile.slotLevel) {
      nextResources = consumeSpellSlot(nextResources, profile.slotLevel);
    }
    const nextConcentration = {
      active: true,
      spellKey: profile.key,
      targetId: resolvedTarget._id,
      sourceId: actor._id,
      effectCondition: "shield-of-faith",
    };
    const nextTargetConditions = Array.from(new Set([...resolvedTarget.conditions, "shield-of-faith"]));

    await ctx.db.patch(actor._id, {
      resources: nextResources,
      concentration: nextConcentration,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(resolvedTarget._id, {
      conditions: nextTargetConditions,
      updatedAt: Date.now(),
    });
    await writeEvent(
      ctx,
      encounter._id,
      encounter.round,
      "buff",
      `${actor.displayName || actor.name} grants Shield of Faith to ${
        resolvedTarget.displayName || resolvedTarget.name
      }.`,
      { targetId: resolvedTarget._id, concentration: nextConcentration },
      actor._id,
    );
    await finalizeEncounterIfResolved(ctx, encounter._id);
    return true;
  }

  throw new Error("The selected spell cannot be resolved yet.");
}
