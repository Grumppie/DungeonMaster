import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ENEMY_TEMPLATES, PLAYER_SHEETS } from "./domain/combat/sheets";
import { getCombatantPosition, getGridDistanceFeet, isOccupiedPosition } from "./domain/combat/grid";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function inferAreaTemplate(profile) {
  const normalized = String(profile?.name || profile?.key || "").toLowerCase();
  if (normalized.includes("burning hands")) {
    return { shape: "cone", sizeFeet: 15 };
  }
  if (normalized.includes("fireball")) {
    return { shape: "radius", sizeFeet: 20 };
  }
  return { shape: "single", sizeFeet: profile?.rangeFeet || 5 };
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDice(formula, { critical = false } = {}) {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(formula.trim());
  if (!match) {
    throw new Error(`Unsupported dice formula: ${formula}`);
  }
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  const actualCount = critical ? count * 2 : count;
  let total = modifier;
  const rolls = [];
  for (let index = 0; index < actualCount; index += 1) {
    const roll = rollDie(sides);
    rolls.push(roll);
    total += roll;
  }
  return { total, rolls, modifier, count: actualCount, sides };
}

function sortCombatants(combatants) {
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

function getSheet(sheetKey) {
  return PLAYER_SHEETS[sheetKey] || ENEMY_TEMPLATES[sheetKey];
}

function getSaveBonus(combatant, ability) {
  const sheet = getSheet(combatant.sheetKey);
  if (!sheet?.savingThrows) {
    return 0;
  }
  return sheet.savingThrows[ability] ?? 0;
}

function getActiveArmorClass(combatant) {
  let armorClass = combatant.armorClass;
  if (combatant.conditions.includes("shield-of-faith")) {
    armorClass += 2;
  }
  return armorClass;
}

async function getEncounterTurnTimerSeconds(ctx, sessionId) {
  const session = await ctx.db.get(sessionId);
  return session?.turnTimerSeconds || 20;
}

async function getOrCreateAppUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("appUsers")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  const payload = {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
    email: identity.email ?? undefined,
    displayName: identity.name ?? identity.nickname ?? identity.givenName ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const userId = await ctx.db.insert("appUsers", {
    ...payload,
    createdAt: now,
  });
  return ctx.db.get(userId);
}

function getAliveCombatants(combatants) {
  return combatants.filter((combatant) => !combatant.isDead);
}

function getLivingBySide(combatants, side) {
  return combatants.filter((combatant) => combatant.side === side && !combatant.isDead);
}

function getNearestEnemy(actor, combatants, side) {
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

function approachTargetPosition(actor, target, combatants, desiredRange = 5) {
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

function consumeSpellSlot(resources, level) {
  const spellSlots = clone(resources.spellSlots || {});
  const remaining = Number(spellSlots[level] || 0);
  if (remaining <= 0) {
    throw new Error(`No spell slots remaining for level ${level}.`);
  }
  spellSlots[level] = remaining - 1;
  return { ...resources, spellSlots };
}

function consumeResource(resources, resourceKey) {
  if (!resourceKey) {
    return resources;
  }
  const next = clone(resources);
  const resource = next[resourceKey];
  if (!resource || typeof resource !== "object") {
    throw new Error(`Missing resource: ${resourceKey}`);
  }
  if (typeof resource.usesRemaining !== "number" || resource.usesRemaining <= 0) {
    throw new Error(`No uses remaining for ${resourceKey}.`);
  }
  resource.usesRemaining -= 1;
  return next;
}

function buildPlayerCombatant({ participant, sheetKey, positionXFeet, positionYFeet, partySize }) {
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

function buildEnemyRoster(partySize, encounterScale) {
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

function buildEnemyCombatant({ templateKey, index, baseXFeet, baseYFeet }) {
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

function buildFormationYFeet(count) {
  if (count <= 1) {
    return [10];
  }
  const spacingFeet = 10;
  const totalSpanFeet = (count - 1) * spacingFeet;
  const startFeet = Math.max(0, Math.round((20 - totalSpanFeet / 2) / 5) * 5);
  return Array.from({ length: count }, (_, index) => startFeet + index * spacingFeet);
}

function buildPlayerFormation(participants, partySize) {
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

function buildEnemyFormation(enemyRoster) {
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

async function backfillEncounterCoordinates(ctx, encounterId) {
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
      if (typeof combatant.positionXFeet === "number" && typeof combatant.positionYFeet === "number") {
        continue;
      }
      const xFeet = typeof combatant.positionFeet === "number" ? combatant.positionFeet : side === "party" ? 10 : 45;
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

function normalizeEncounterCoordinates(combatants) {
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
    if (typeof combatant.positionXFeet === "number" && typeof combatant.positionYFeet === "number") {
      return combatant;
    }
    const positionMeta = indexById.get(combatant._id);
    const xFeet =
      typeof combatant.positionFeet === "number"
        ? combatant.positionFeet
        : positionMeta?.side === "party"
          ? 10
          : 45;
    const yFeet = positionMeta ? yByGroup[positionMeta.side][positionMeta.index] ?? positionMeta.index * 10 : 0;
    return {
      ...combatant,
      positionFeet: xFeet,
      positionXFeet: xFeet,
      positionYFeet: yFeet,
    };
  });
}

function applyDamageToCombatant(combatant, damage) {
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

function healCombatant(combatant, healing) {
  const currentHp = Math.min(combatant.maxHp, combatant.currentHp + healing);
  return {
    ...combatant,
    currentHp,
    isDowned: currentHp <= 0 ? combatant.isDowned : false,
    isDead: false,
    deathSaves: currentHp > 0 ? { successes: 0, failures: 0 } : combatant.deathSaves,
  };
}

async function writeEvent(ctx, encounterId, round, eventType, summary, payload, combatantId) {
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

async function loadCombatSnapshot(ctx, encounter) {
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

async function createEncounterForScene(ctx, { sessionId, runId, scene, participants, activate }) {
  const partySize = participants.filter((participant) => participant.status !== "left").length;
  const now = Date.now();
  const turnTimerSeconds = await getEncounterTurnTimerSeconds(ctx, sessionId);
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
    turnTimerEndsAt: activate ? now + turnTimerSeconds * 1000 : undefined,
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
    turnTimerEndsAt: activate ? now + turnTimerSeconds * 1000 : undefined,
    updatedAt: now,
  });

  await writeEvent(ctx, encounterId, 1, "encounter-created", `Combat encounter seeded for ${scene.title}.`, {
    partySize,
    enemyCount: enemyCombatants.length,
    encounterScale: scene.encounterScale,
    activate,
  });

  if (activate) {
    await primeCombatEncounter(ctx, encounterId);
  }

  return encounterId;
}

async function primeCombatEncounter(ctx, encounterId) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter || encounter.status !== "active") {
    return null;
  }

  return resolvePendingTurns(ctx, encounterId);
}

async function completeEncounter(ctx, encounterId, winnerSide, reason) {
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

async function advanceToNextCombatant(ctx, encounterId) {
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

    const turnTimerSeconds = await getEncounterTurnTimerSeconds(ctx, encounter.sessionId);
    const turnRevision = (encounter.turnRevision ?? 0) + 1;
    await ctx.db.patch(encounterId, {
      currentCombatantId: nextId,
      activeTurnIndex: currentIndex,
      turnRevision,
      turnTimerEndsAt: Date.now() + turnTimerSeconds * 1000,
      updatedAt: Date.now(),
    });
    return nextCombatant;
  }

  return null;
}

async function resolveEnemyTurn(ctx, encounterId, combatant) {
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

async function finalizeEncounterIfResolved(ctx, encounterId) {
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

async function applyPlayerAction(ctx, encounter, actor, combatants, action) {
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
    const appliedDamage = success && profile.halfOnSave ? Math.floor(damage.total / 2) : success ? 0 : damage.total;
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

function buildPreviewPayload(encounter, actor, combatants, action) {
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
    profile.targetSide === "self" ? actor : action.targetCombatantId ? combatantMap.get(action.targetCombatantId) : null;
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

async function resolvePendingTurns(ctx, encounterId) {
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

async function getActiveEncounterForSession(ctx, sessionId) {
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

export const getForSession = query({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => getActiveEncounterForSession(ctx, args.sessionId),
});

export const performAction = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    action: v.object({
      type: v.union(
        v.literal("attack"),
        v.literal("castSpell"),
        v.literal("move"),
        v.literal("endTurn"),
        v.literal("secondWind"),
        v.literal("shieldOfFaith"),
      ),
      profileKey: v.optional(v.string()),
      targetCombatantId: v.optional(v.id("combatants")),
      destinationXFeet: v.optional(v.number()),
      destinationYFeet: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      throw new Error("No active adventure run found.");
    }

    const run = await ctx.db.get(session.currentRunId);
    if (!run?.currentCombatEncounterId) {
      throw new Error("There is no active combat encounter.");
    }

    const encounter = await ctx.db.get(run.currentCombatEncounterId);
    if (!encounter || encounter.status !== "active") {
      throw new Error("The current combat encounter is not active.");
    }

    await backfillEncounterCoordinates(ctx, encounter._id);

    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("You are not part of this session.");
    }

    const combatants = await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect();
    const actor = combatants.find((combatant) => combatant.participantId === participant._id);
    if (!actor) {
      throw new Error("No player combatant was found for this participant.");
    }
    if (encounter.currentCombatantId !== actor._id) {
      throw new Error("It is not your turn.");
    }
    if (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt) {
      await writeEvent(
        ctx,
        encounter._id,
        encounter.round,
        "turn-expired",
        `${actor.displayName || actor.name} ran out of time.`,
        { actorId: actor._id },
        actor._id,
      );
      await resolvePendingTurns(ctx, encounter._id);
      throw new Error("Your turn expired before the action was confirmed.");
    }

    const normalizedAction =
      args.action.type === "secondWind"
        ? { ...args.action, type: "castSpell", profileKey: "second-wind" }
        : args.action.type === "shieldOfFaith"
          ? { ...args.action, type: "castSpell", profileKey: "shield-of-faith" }
          : args.action;

    await applyPlayerAction(ctx, encounter, actor, combatants, normalizedAction);
    await resolvePendingTurns(ctx, encounter._id);

    const refreshedEncounter = await ctx.db.get(encounter._id);
    if (!refreshedEncounter) {
      throw new Error("Combat encounter could not be refreshed.");
    }
    return loadCombatSnapshot(ctx, refreshedEncounter);
  },
});

export const issuePreview = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    action: v.object({
      type: v.union(v.literal("attack"), v.literal("castSpell"), v.literal("move")),
      profileKey: v.optional(v.string()),
      targetCombatantId: v.optional(v.id("combatants")),
      destinationXFeet: v.optional(v.number()),
      destinationYFeet: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      throw new Error("No active adventure run found.");
    }
    const run = await ctx.db.get(session.currentRunId);
    if (!run?.currentCombatEncounterId) {
      throw new Error("There is no active combat encounter.");
    }
    const encounter = await ctx.db.get(run.currentCombatEncounterId);
    if (!encounter || encounter.status !== "active") {
      throw new Error("The current combat encounter is not active.");
    }
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("You are not part of this session.");
    }
    const combatants = await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect();
    const actor = combatants.find((combatant) => combatant.participantId === participant._id);
    if (!actor) {
      throw new Error("No player combatant was found for this participant.");
    }
    if (encounter.currentCombatantId !== actor._id) {
      throw new Error("It is not your turn.");
    }
    if (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt) {
      throw new Error("Your turn has already expired.");
    }

    const payload = buildPreviewPayload(encounter, actor, combatants, args.action);
    const previewId = await ctx.db.insert("actionPreviews", {
      actorId: actor._id,
      encounterId: encounter._id,
      turnRevision: encounter.turnRevision ?? 0,
      payload,
      expiresAt: encounter.turnTimerEndsAt || Date.now() + 10000,
      createdAt: Date.now(),
    });
    return {
      previewId,
      ...payload,
      expiresAt: encounter.turnTimerEndsAt || Date.now() + 10000,
      turnRevision: encounter.turnRevision ?? 0,
    };
  },
});

export const confirmPreview = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    previewId: v.id("actionPreviews"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);
    const preview = await ctx.db.get(args.previewId);
    if (!preview) {
      throw new Error("Preview not found.");
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      throw new Error("No active adventure run found.");
    }
    const run = await ctx.db.get(session.currentRunId);
    if (!run?.currentCombatEncounterId || run.currentCombatEncounterId !== preview.encounterId) {
      throw new Error("preview_stale");
    }
    const encounter = await ctx.db.get(run.currentCombatEncounterId);
    if (!encounter || encounter.status !== "active") {
      throw new Error("preview_stale");
    }
    if ((encounter.turnRevision ?? 0) !== preview.turnRevision) {
      throw new Error("preview_stale");
    }
    if (Date.now() > preview.expiresAt || (encounter.turnTimerEndsAt && Date.now() > encounter.turnTimerEndsAt)) {
      throw new Error("turn_expired");
    }

    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("You are not part of this session.");
    }
    const combatants = await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect();
    const actor = combatants.find((combatant) => combatant.participantId === participant._id);
    if (!actor || actor._id !== preview.actorId) {
      throw new Error("actor_no_longer_active");
    }
    if (encounter.currentCombatantId !== actor._id) {
      throw new Error("actor_no_longer_active");
    }

    await applyPlayerAction(ctx, encounter, actor, combatants, preview.payload.action);
    await resolvePendingTurns(ctx, encounter._id);
    return { ok: true };
  },
});

export const primeEncounter = mutation({
  args: {
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAppUser(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session?.currentRunId) {
      throw new Error("No active adventure run found.");
    }

    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_user", (q) => q.eq("sessionId", session._id).eq("userId", user._id))
      .unique();
    if (!participant) {
      throw new Error("You are not part of this session.");
    }

    const run = await ctx.db.get(session.currentRunId);
    if (!run?.currentCombatEncounterId) {
      return null;
    }

    const encounter = await ctx.db.get(run.currentCombatEncounterId);
    if (!encounter || encounter.status !== "active") {
      return null;
    }

    await backfillEncounterCoordinates(ctx, encounter._id);

    const combatants = await ctx.db
      .query("combatants")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect();
    const currentCombatant = combatants.find((combatant) => combatant._id === encounter.currentCombatantId);
    if (!currentCombatant || currentCombatant.kind !== "enemy") {
      return loadCombatSnapshot(ctx, encounter);
    }

    await resolvePendingTurns(ctx, encounter._id);
    const refreshedEncounter = await ctx.db.get(encounter._id);
    if (!refreshedEncounter) {
      return null;
    }
    return loadCombatSnapshot(ctx, refreshedEncounter);
  },
});

export async function seedCombatForScene(ctx, { sessionId, runId, scene, participants, activate }) {
  return createEncounterForScene(ctx, {
    sessionId,
    runId,
    scene,
    participants,
    activate,
  });
}

export async function activateCombatEncounter(ctx, encounterId) {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter) {
    throw new Error("Combat encounter not found.");
  }
  const combatants = await backfillEncounterCoordinates(ctx, encounterId);
  const ordered = sortCombatants(combatants);
  const firstLiving = ordered.find((combatant) => !combatant.isDead) || null;
  const turnTimerSeconds = await getEncounterTurnTimerSeconds(ctx, encounter.sessionId);
  await ctx.db.patch(encounterId, {
    status: "active",
    currentCombatantId: firstLiving ? firstLiving._id : undefined,
    activeTurnIndex: firstLiving ? ordered.findIndex((combatant) => combatant._id === firstLiving._id) : 0,
    turnRevision: (encounter.turnRevision ?? 0) + 1,
    turnTimerEndsAt: firstLiving ? Date.now() + turnTimerSeconds * 1000 : undefined,
    updatedAt: Date.now(),
  });
  await writeEvent(ctx, encounterId, encounter.round, "encounter-activated", "Combat encounter becomes active.", {
    firstCombatantId: firstLiving ? firstLiving._id : null,
  });
  await primeCombatEncounter(ctx, encounterId);
}

export async function completeCombatEncounter(ctx, encounterId, winnerSide, reason) {
  return completeEncounter(ctx, encounterId, winnerSide, reason);
}
