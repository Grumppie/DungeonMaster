import {
  buildEnemyFormation,
  buildEnemyRoster,
  buildPlayerFormation,
  healCombatant,
  normalizeEncounterCoordinates,
} from "./formations";
import {
  clone,
  getActiveArmorClass,
  getAliveCombatants,
  getLivingBySide,
  getSaveBonus,
  sortCombatants,
} from "./helpers";
import { rollDie } from "./dice";
import { getOrCreateAppUser } from "../../lib/auth";
import { buildEncounterTurnDeadline } from "./timers";

export {
  clone,
  getActiveArmorClass,
  getAliveCombatants,
  getLivingBySide,
  getSaveBonus,
  sortCombatants,
};

export async function writeEvent(ctx, encounterId, round, eventType, summary, payload, combatantId) {
  await ctx.db.insert("combatEvents", {
    encounterId,
    combatantId,
    round,
    eventType,
    summary,
    payload: payload ? clone(payload) : undefined,
    createdAt: Date.now(),
  });
}

export async function loadCombatSnapshot(ctx, encounter) {
  const combatants = normalizeEncounterCoordinates(
    await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect(),
  );
  const events = await ctx.db
    .query("combatEvents")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
    .collect();
  const orderedCombatants = sortCombatants(combatants);
  const activeCombatant = encounter.currentCombatantId
    ? orderedCombatants.find((combatant) => combatant._id === encounter.currentCombatantId) || null
    : null;

  return {
    encounter,
    combatants: orderedCombatants,
    events: events.sort((left, right) => right.createdAt - left.createdAt),
    currentCombatant: activeCombatant,
  };
}

export async function createEncounterForScene(
  ctx,
  { sessionId, runId, scene, participants, activate },
) {
  const partySize = participants.filter((participant) => participant.status !== "left").length;
  const now = Date.now();
  const turnTimerEndsAt = activate ? await buildEncounterTurnDeadline(ctx, sessionId, now) : undefined;
  const encounterId = await ctx.db.insert("combatEncounters", {
    sessionId,
    runId,
    sceneId: scene._id,
    status: activate ? "active" : "setup",
    round: 1,
    activeTurnIndex: 0,
    currentCombatantId: undefined,
    turnOrder: [],
    turnRevision: 1,
    turnTimerEndsAt,
    partyDistanceFeet: 30,
    startedAt: now,
    endedAt: undefined,
    winnerSide: undefined,
    createdAt: now,
    updatedAt: now,
  });

  const activeParticipants = participants.filter((participant) => participant.status !== "left");
  const playerCombatants = buildPlayerFormation(activeParticipants, partySize);
  const enemyRoster = buildEnemyRoster(partySize, scene.encounterScale);
  const enemyCombatants = buildEnemyFormation(enemyRoster);
  const combatants = [...playerCombatants, ...enemyCombatants];
  const insertedIds = [];

  for (const combatant of combatants) {
    const initiativeTotal = combatant.initiativeRoll + combatant.initiativeBonus;
    const combatantId = await ctx.db.insert("combatants", {
      encounterId,
      sessionId,
      runId,
      sceneId: scene._id,
      participantId: combatant.participantId,
      kind: combatant.kind,
      side: combatant.side,
      sheetKey: combatant.sheetKey,
      name: combatant.name,
      displayName: combatant.displayName,
      level: combatant.level,
      armorClass: combatant.armorClass,
      maxHp: combatant.maxHp,
      currentHp: combatant.currentHp,
      tempHp: combatant.tempHp,
      initiativeBonus: combatant.initiativeBonus,
      initiativeRoll: combatant.initiativeRoll,
      initiativeTotal,
      speed: combatant.speed,
      positionFeet: combatant.positionFeet,
      positionXFeet: combatant.positionXFeet,
      positionYFeet: combatant.positionYFeet,
      attackProfiles: combatant.attackProfiles,
      spellProfiles: combatant.spellProfiles,
      resources: combatant.resources,
      conditions: combatant.conditions,
      deathSaves: combatant.deathSaves,
      concentration: combatant.concentration,
      resistances: combatant.resistances,
      isDowned: combatant.isDowned,
      isDead: combatant.isDead,
      createdAt: now,
      updatedAt: now,
    });
    insertedIds.push({
      _id: combatantId,
      initiativeTotal,
      initiativeRoll: combatant.initiativeRoll,
      name: combatant.name,
    });
  }

  const turnOrder = sortCombatants(insertedIds).map((combatant) => combatant._id);
  const firstCombatantId = activate ? turnOrder[0] : undefined;

  await ctx.db.patch(encounterId, {
    turnOrder,
    currentCombatantId: firstCombatantId,
    status: activate ? "active" : "setup",
    activeTurnIndex: 0,
    turnRevision: 1,
    turnTimerEndsAt,
    updatedAt: now,
  });

  await writeEvent(
    ctx,
    encounterId,
    1,
    "encounter-created",
    `Combat encounter seeded for ${scene.title}.`,
    {
      partySize,
      enemyCount: enemyCombatants.length,
      encounterScale: scene.encounterScale,
      activate,
    },
  );

  return encounterId;
}

export async function completeEncounter(ctx, encounterId, winnerSide, reason) {
  const now = Date.now();
  const encounter = await ctx.db.get(encounterId);
  if (!encounter || encounter.status === "completed") {
    return;
  }
  await ctx.db.patch(encounterId, {
    status: "completed",
    currentCombatantId: undefined,
    turnTimerEndsAt: undefined,
    endedAt: now,
    winnerSide,
    updatedAt: now,
  });
  await writeEvent(
    ctx,
    encounterId,
    encounter.round,
    "encounter-completed",
    `Combat ended in favor of ${winnerSide}.`,
    { reason, winnerSide },
  );
}

export async function advanceToNextCombatant(ctx, encounterId) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter || encounter.status !== "active") {
    return null;
  }
  const combatants = await ctx.db
    .query("combatants")
    .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
    .collect();
  const turnOrder = encounter.turnOrder;
  if (!turnOrder.length) {
    return null;
  }

  let currentIndex = turnOrder.indexOf(encounter.currentCombatantId);
  if (currentIndex < 0) {
    currentIndex = -1;
  }

  for (let hops = 0; hops < turnOrder.length * 3; hops += 1) {
    currentIndex = (currentIndex + 1) % turnOrder.length;
    if (currentIndex === 0) {
      await ctx.db.patch(encounterId, {
        round: encounter.round + 1,
        updatedAt: Date.now(),
      });
      encounter.round += 1;
    }

    const nextId = turnOrder[currentIndex];
    const nextCombatant = combatants.find((combatant) => combatant._id === nextId);
    if (!nextCombatant || nextCombatant.isDead) {
      continue;
    }

    if (nextCombatant.kind === "player" && nextCombatant.currentHp <= 0) {
      const priorDeathSaves = clone(nextCombatant.deathSaves || { successes: 0, failures: 0 });
      if (priorDeathSaves.successes >= 3 || priorDeathSaves.failures >= 3) {
        continue;
      }
      const deathRoll = rollDie(20);
      const nextDeathSaves = clone(priorDeathSaves);
      if (deathRoll === 20) {
        const revived = healCombatant(nextCombatant, 1);
        await ctx.db.patch(nextId, {
          currentHp: revived.currentHp,
          isDowned: false,
          isDead: false,
          deathSaves: { successes: 0, failures: 0 },
          updatedAt: Date.now(),
        });
        await writeEvent(
          ctx,
          encounterId,
          encounter.round,
          "death-save",
          `${nextCombatant.displayName || nextCombatant.name} rallies back to 1 hit point.`,
          { roll: deathRoll, outcome: "revived" },
          nextId,
        );
        continue;
      }

      if (deathRoll === 1) {
        nextDeathSaves.failures += 2;
      } else if (deathRoll >= 10) {
        nextDeathSaves.successes += 1;
      } else {
        nextDeathSaves.failures += 1;
      }

      const isStable = nextDeathSaves.successes >= 3;
      const isDead = nextDeathSaves.failures >= 3;
      await ctx.db.patch(nextId, {
        deathSaves: nextDeathSaves,
        isDowned: !isDead,
        isDead,
        updatedAt: Date.now(),
      });
      await writeEvent(
        ctx,
        encounterId,
        encounter.round,
        "death-save",
        `${nextCombatant.displayName || nextCombatant.name} makes a death save (${deathRoll}).`,
        {
          roll: deathRoll,
          deathSaves: nextDeathSaves,
          outcome: isDead ? "dead" : isStable ? "stable" : "downed",
        },
        nextId,
      );
      if (isStable) {
        continue;
      }
      const refreshedPlayers = (
        await ctx.db
          .query("combatants")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
          .collect()
      ).filter((combatant) => combatant.side === "party" && !combatant.isDead);
      if (!refreshedPlayers.length) {
        await completeEncounter(ctx, encounterId, "enemy", "All party members were defeated.");
        return null;
      }
      continue;
    }

    const turnRevision = (encounter.turnRevision ?? 0) + 1;
    await ctx.db.patch(encounterId, {
      currentCombatantId: nextId,
      activeTurnIndex: currentIndex,
      turnRevision,
      turnTimerEndsAt: await buildEncounterTurnDeadline(ctx, encounter.sessionId),
      updatedAt: Date.now(),
    });
    return nextCombatant;
  }

  return null;
}

export async function getActiveEncounterForSession(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  if (!session?.currentRunId) {
    return null;
  }
  const run = await ctx.db.get(session.currentRunId);
  if (!run) {
    return null;
  }

  let encounter = null;
  if (run.currentCombatEncounterId) {
    encounter = await ctx.db.get(run.currentCombatEncounterId);
  }

  if (!encounter) {
    const scenes = await ctx.db
      .query("adventureScenes")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const activeScene = scenes.find((scene) => scene.order === run.activeSceneOrder);
    if (activeScene?.combatEncounterId) {
      encounter = await ctx.db.get(activeScene.combatEncounterId);
    }
  }

  if (!encounter) {
    return null;
  }

  return loadCombatSnapshot(ctx, encounter);
}

export async function activateCombatEncounter(ctx, encounterId) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter) {
    throw new Error("Combat encounter not found.");
  }
  const combatants = normalizeEncounterCoordinates(
    await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
      .collect(),
  );
  const ordered = sortCombatants(combatants);
  const firstLiving = ordered.find((combatant) => !combatant.isDead) || null;
  await ctx.db.patch(encounterId, {
    status: "active",
    currentCombatantId: firstLiving ? firstLiving._id : undefined,
    activeTurnIndex: firstLiving
      ? ordered.findIndex((combatant) => combatant._id === firstLiving._id)
      : 0,
    turnRevision: (encounter.turnRevision ?? 0) + 1,
    turnTimerEndsAt: firstLiving ? await buildEncounterTurnDeadline(ctx, encounter.sessionId) : undefined,
    updatedAt: Date.now(),
  });
  await writeEvent(
    ctx,
    encounterId,
    encounter.round,
    "encounter-activated",
    "Combat encounter becomes active.",
    {
      firstCombatantId: firstLiving ? firstLiving._id : null,
    },
  );
}
