let initialized = false;

(function () {
  "use strict";

  const STORAGE_KEYS = {
    config: "dnd-demo-config",
    session: "dnd-demo-session",
    logs: "dnd-demo-logs"
  };

  const refs = {};
  const state = {
    rulesPrompt: "",
    stylePrompt: "",
    initial: null,
    session: null,
    logs: [],
    config: {
      openaiKey: "",
      openaiModel: "gpt-4o-mini",
      deepgramKey: "",
      deepgramModel: "nova-3",
      deepgramVoice: "aura-2-thalia-en"
    },
    audio: {
      context: null,
      stream: null,
      source: null,
      processor: null,
      ws: null,
      started: false,
      interim: "",
      finals: []
    },
    assistant: {
      requestId: 0,
      controller: null
    },
    tts: {
      speaking: false,
      objectUrl: null,
      socket: null,
      context: null,
      gainNode: null,
      sourceNodes: [],
      nextStartTime: 0,
      pendingText: "",
      streamedText: "",
      firstAudioAt: 0,
      sampleRate: 24000
    }
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountDndDemo, { once: true });
    } else if (document.querySelector(".demo-shell")) {
      mountDndDemo();
    }
  }

  function mountDndDemo() {
    if (initialized || !document.querySelector(".demo-shell")) {
      return;
    }
    initialized = true;
    init();
  }

  async function init() {
    try {
      cacheRefs();
      bindEvents();
      await loadAssets();
      restoreSession();
      renderAll();
    } catch (error) {
      console.error(error);
      if (refs.statusBox) {
        setStatus("Demo bootstrap failed. Check the console.");
      }
    }
  }

  function unmountDndDemo() {
    if (!initialized) {
      return;
    }
    stopVoice();
    abortAssistant("unmount");
    cleanupAudioUrl();
    initialized = false;
  }

  function cacheRefs() {
    refs.stageLabel = document.getElementById("stage-label");
    refs.engagementLabel = document.getElementById("engagement-label");
    refs.turnBanner = document.getElementById("turn-banner");
    refs.initiativeOrder = document.getElementById("initiative-order");
    refs.statusBox = document.getElementById("status-box");
    refs.liveTranscript = document.getElementById("live-transcript");
    refs.finalTranscript = document.getElementById("final-transcript");
    refs.hintText = document.getElementById("hint-text");
    refs.encounterTitle = document.getElementById("encounter-title");
    refs.encounterSummary = document.getElementById("encounter-summary");
    refs.distanceMetric = document.getElementById("distance-metric");
    refs.roundMetric = document.getElementById("round-metric");
    refs.effectMetric = document.getElementById("effect-metric");
    refs.logFeed = document.getElementById("log-feed");
    refs.logCount = document.getElementById("log-count");
    refs.aldenCard = document.getElementById("player-card-alden");
    refs.nyraCard = document.getElementById("player-card-nyra");
    refs.manualCommand = document.getElementById("manual-command");
    refs.sheetModal = document.getElementById("sheet-modal");
    refs.sheetTitle = document.getElementById("sheet-title");
    refs.sheetBody = document.getElementById("sheet-body");
    refs.spellModal = document.getElementById("spell-modal");
    refs.spellTitle = document.getElementById("spell-title");
    refs.spellBody = document.getElementById("spell-body");
    refs.ttsAudio = document.getElementById("tts-audio");
  }

  function bindEvents() {
    document.getElementById("begin-demo").addEventListener("click", beginDemo);
    document.getElementById("start-voice").addEventListener("click", startVoice);
    document.getElementById("stop-voice").addEventListener("click", stopVoice);
    document.getElementById("reset-session").addEventListener("click", resetSession);
    document.getElementById("export-state").addEventListener("click", function () {
      downloadJson("dnd-duel-session.json", state.session);
    });
    document.getElementById("export-log").addEventListener("click", function () {
      downloadJson("dnd-duel-log.json", state.logs);
    });
    document.getElementById("send-command").addEventListener("click", function () {
      const text = refs.manualCommand.value.trim();
      if (!text) {
        setHint("Type a full command with Alden or Nyra first.");
        return;
      }
      refs.manualCommand.value = "";
      processTranscript(text, "text");
    });
    document.getElementById("close-sheet").addEventListener("click", function () {
      refs.sheetModal.close();
    });
    document.getElementById("close-spell").addEventListener("click", function () {
      refs.spellModal.close();
    });
    refs.ttsAudio.addEventListener("ended", function () {
      state.tts.speaking = false;
      cleanupAudioUrl();
    });
  }

  async function loadAssets() {
    const loaded = await Promise.all([
      fetchText("/prompts/dm-agent-system.md"),
      fetchText("/sole.md"),
      fetchJson("/data/initial-state.json"),
      fetchJson("/api/bootstrap")
    ]);
    state.rulesPrompt = loaded[0];
    state.stylePrompt = loaded[1];
    state.initial = loaded[2];
    state.config = Object.assign({}, state.config, loaded[3]);
    setStatus("Prompts, initial state, and API bootstrap loaded.");
  }

  function restoreSession() {
    const rawSession = localStorage.getItem(STORAGE_KEYS.session);
    const rawLogs = localStorage.getItem(STORAGE_KEYS.logs);
    if (rawLogs) {
      try {
        state.logs = JSON.parse(rawLogs);
      } catch (error) {
        console.warn(error);
      }
    }
    if (rawSession) {
      try {
        state.session = JSON.parse(rawSession);
      } catch (error) {
        console.warn(error);
      }
    }
    if (!state.session) {
      state.session = deepClone(state.initial);
      persistSession();
      logEvent("system", "Session initialized from seed.");
    }
  }

  function resetSession() {
    state.session = deepClone(state.initial);
    persistSession();
    logEvent("system", "Session reset from initial seed.");
    renderAll();
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function persistSession() {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
  }

  function setStatus(text) {
    refs.statusBox.textContent = text;
  }

  function setHint(text) {
    refs.hintText.textContent = text;
  }

  function logEvent(kind, message, detail) {
    state.logs.unshift({
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString(),
      kind: kind,
      message: message,
      detail: detail || null
    });
    state.logs = state.logs.slice(0, 300);
    persistSession();
    renderLogs();
  }

  async function beginDemo() {
    const intro = [
      "The duel table is set.",
      "Player one may claim Alden Voss, the human barbarian with a greataxe.",
      "Player two may claim Nyra Vale, the tiefling sorcerer with a dagger and spellcraft.",
      "Speak the character name first, then your command."
    ].join(" ");
    logEvent("dm", intro);
    renderAll();
    await narrateText(intro, true);
  }

  async function processTranscript(text, source) {
    const transcript = text.trim();
    logEvent("transcript", transcript, { source: source });
    refs.finalTranscript.textContent = transcript;
    const activation = detectActivation(transcript);
    if (!activation) {
      setHint("Say Alden or Nyra first. Speech without a character name is ignored.");
      return;
    }

    const actor = getCharacter(activation.characterId);
    setHint(actor.name.split(" ")[0] + " recognized.");

    if (!actor.claimed) {
      actor.claimed = true;
      actor.claimTranscript = transcript;
      state.session.combat.claimedCount += 1;
      logEvent("system", actor.name + " is now claimed.");
      if (allCharactersClaimed() && state.session.combat.stage === "awaiting_claims") {
        startCombat();
      }
      persistSession();
      renderAll();
      return;
    }

    if (state.session.combat.stage !== "active") {
      setHint("Combat is not active yet.");
      return;
    }

    if (state.session.combat.activeCharacterId !== actor.id) {
      setHint("It is " + getCharacter(state.session.combat.activeCharacterId).name.split(" ")[0] + "'s turn.");
      logEvent("system", "Out-of-turn command ignored.", { actor: actor.id });
      return;
    }

    await processTurn(actor.id, activation.command || transcript);
  }

  function allCharactersClaimed() {
    return Object.keys(state.session.characters).every(function (id) {
      return state.session.characters[id].claimed;
    });
  }

  function startCombat() {
    const combat = state.session.combat;
    combat.stage = "active";
    combat.round = 1;
    combat.distanceFeet = state.session.meta.startingDistanceFeet;
    const initiative = Object.keys(state.session.characters).map(function (id) {
      const actor = getCharacter(id);
      const roll = rollD20();
      actor.status.initiativeRoll = roll.total + actor.initiativeModifier;
      return { id: id, total: actor.status.initiativeRoll };
    }).sort(function (a, b) {
      return b.total - a.total;
    });
    if (initiative[0].total === initiative[1].total) {
      initiative.sort(function () {
        return Math.random() - 0.5;
      });
    }
    combat.turnOrder = initiative.map(function (entry) {
      return entry.id;
    });
    combat.activeTurnIndex = 0;
    combat.activeCharacterId = combat.turnOrder[0];
    prepareTurn(getCharacter(combat.activeCharacterId));
    logEvent("dm", "Initiative is rolled. " + combat.turnOrder.map(function (id) {
      const actor = getCharacter(id);
      return actor.name.split(" ")[0] + " (" + actor.status.initiativeRoll + ")";
    }).join(", then ") + ".");
    persistSession();
    renderAll();
  }

  async function processTurn(actorId, commandText) {
    const requestId = ++state.assistant.requestId;
    const startedAt = performance.now();
    setStatus("Resolving " + getCharacter(actorId).name.split(" ")[0] + "'s turn.");
    const memoryContext = await queryMemory(commandText);
    const intent = await classifyIntent(actorId, commandText, requestId, memoryContext);
    if (!intent || requestId !== state.assistant.requestId) {
      return;
    }
    const resolvedAt = performance.now();
    const resolution = resolveIntent(actorId, intent);
    logEvent("rules", buildRulesAudit(resolution), resolution);
    persistSession();
    renderAll();
    logEvent("perf", "Turn resolution timing.", {
      actorId: actorId,
      commandText: commandText,
      memoryMs: memoryContext.durationMs,
      memorySource: memoryContext.source,
      classifyMs: roundDuration(resolvedAt - startedAt - memoryContext.durationMs),
      totalToRulesMs: roundDuration(resolvedAt - startedAt)
    });
    setStatus("Rules resolved. Preparing DM narration.");
    const narrationStart = performance.now();
    const narration = await streamNarration(resolution, requestId, memoryContext);
    if (!narration || requestId !== state.assistant.requestId) {
      return;
    }
    const narrationReadyAt = performance.now();
    logEvent("dm", narration, resolution);
    renderAll();
    logEvent("perf", "Narration timing.", {
      actorId: actorId,
      narrationMs: roundDuration(narrationReadyAt - narrationStart),
      ttsFirstAudioMs: state.tts.firstAudioAt ? roundDuration(state.tts.firstAudioAt - narrationStart) : null,
      totalTurnMs: roundDuration(narrationReadyAt - startedAt)
    });
    if (state.session.combat.stage === "completed") {
      const winner = getCharacter(state.session.combat.winnerId);
      setStatus((winner ? winner.name : "A character") + " won. Resetting duel state.");
      const preservedLogs = state.logs.slice();
      state.session = deepClone(state.initial);
      state.logs = preservedLogs;
      persistSession();
      renderAll();
    }
  }

  async function classifyIntent(actorId, commandText, requestId, memoryContext) {
    const actor = getCharacter(actorId);
    const opponent = getOpponent(actorId);
    const fallback = heuristicIntent(actor, commandText.toLowerCase());
    if (shouldUseHeuristicIntent(fallback)) {
      return fallback;
    }
    if (!state.config.openaiKey) {
      return fallback;
    }
    const prompt = [
      state.rulesPrompt,
      "",
      memoryContext.text,
      "",
      "Classify this player turn into a strict JSON action object.",
      "Return JSON only. No markdown.",
      "Actor: " + actor.name + ".",
      "Opponent: " + opponent.name + ".",
      "Distance: " + state.session.combat.distanceFeet + " feet.",
      "Allowed actions: attack, reckless_attack, rage, rage_attack, cast_spell, cast_cantrip, dodge, dash, disengage, move_away, move_closer, inspect, unknown.",
      "Allowed spells for Nyra: Fire Bolt, Ray of Frost, Magic Missile, Burning Hands, Scorching Ray, Hold Person.",
      "Allowed weapons: Greataxe, Dagger.",
      "JSON shape: {\"action\":\"...\",\"weapon\":\"...\",\"spell\":\"...\",\"target\":\"opponent|self|none\",\"notes\":\"...\"}",
      "Utterance: " + commandText
    ].join("\n");
    try {
      const response = await callOpenAI(prompt, requestId);
      return Object.assign({}, fallback, parseJsonLoose(response));
    } catch (error) {
      console.warn(error);
      logEvent("error", "OpenAI intent parsing failed; local parser used.", { error: String(error) });
      return fallback;
    }
  }

  function shouldUseHeuristicIntent(intent) {
    return intent.action !== "unknown" && intent.action !== "inspect";
  }

  function heuristicIntent(actor, lower) {
    const intent = { action: "unknown", weapon: "None", spell: "None", target: "opponent", notes: "" };
    if (lower.includes("inspect") || lower.includes("sheet")) {
      intent.action = "inspect";
    } else if (lower.includes("rage") && (lower.includes("attack") || lower.includes("swing") || lower.includes("greataxe") || lower.includes("axe"))) {
      intent.action = "rage_attack";
      intent.weapon = "Greataxe";
    } else if (lower.includes("reckless")) {
      intent.action = "reckless_attack";
      intent.weapon = actor.equipment.primaryWeapon.name;
    } else if (lower.includes("rage")) {
      intent.action = "rage";
      intent.target = "self";
    } else if (lower.includes("magic missile")) {
      intent.action = "cast_spell";
      intent.spell = "Magic Missile";
    } else if (lower.includes("burning hands")) {
      intent.action = "cast_spell";
      intent.spell = "Burning Hands";
    } else if (lower.includes("scorching ray")) {
      intent.action = "cast_spell";
      intent.spell = "Scorching Ray";
    } else if (lower.includes("hold person")) {
      intent.action = "cast_spell";
      intent.spell = "Hold Person";
    } else if (lower.includes("fire bolt")) {
      intent.action = "cast_cantrip";
      intent.spell = "Fire Bolt";
    } else if (lower.includes("ray of frost")) {
      intent.action = "cast_cantrip";
      intent.spell = "Ray of Frost";
    } else if (lower.includes("dodge")) {
      intent.action = "dodge";
    } else if (lower.includes("disengage")) {
      intent.action = "disengage";
    } else if (lower.includes("dash")) {
      intent.action = "dash";
    } else if (lower.includes("move away") || lower.includes("back away") || lower.includes("retreat")) {
      intent.action = "move_away";
    } else if (lower.includes("move closer") || lower.includes("close in")) {
      intent.action = "move_closer";
    } else if (lower.includes("dagger")) {
      intent.action = "attack";
      intent.weapon = "Dagger";
    } else if (lower.includes("greataxe") || lower.includes("axe") || lower.includes("swing") || lower.includes("attack")) {
      intent.action = "attack";
      intent.weapon = actor.equipment.primaryWeapon.name;
    }
    return intent;
  }

  function resolveIntent(actorId, intent) {
    const actor = getCharacter(actorId);
    const target = getOpponent(actorId);
    const summary = {
      actor: actor.name,
      target: target.name,
      action: intent.action,
      messages: [],
      dice: [],
      damage: []
    };

    if (actor.status.dead) {
      summary.messages.push(actor.name + " is dead and cannot act.");
      return summary;
    }
    if (actor.status.downed) {
      summary.messages.push(actor.name + " is down and cannot choose actions.");
      return summary;
    }

    switch (intent.action) {
      case "inspect":
        summary.messages.push(actor.name + " studies the field.");
        break;
      case "rage":
        resolveRage(actor, summary);
        endTurn(actor.id, summary);
        break;
      case "rage_attack":
        resolveRage(actor, summary);
        resolveWeaponAttack(actor, target, actor.equipment.primaryWeapon, summary, { reckless: false });
        endTurn(actor.id, summary);
        break;
      case "reckless_attack":
        resolveWeaponAttack(actor, target, actor.equipment.primaryWeapon, summary, { reckless: true });
        endTurn(actor.id, summary);
        break;
      case "attack":
        resolveWeaponAttack(actor, target, pickWeapon(actor, intent.weapon), summary, { reckless: false });
        endTurn(actor.id, summary);
        break;
      case "cast_spell":
      case "cast_cantrip":
        resolveSpell(actor, target, intent.spell, summary);
        endTurn(actor.id, summary);
        break;
      case "dodge":
        if (consumeAction(actor, summary, "Dodge")) {
          upsertCondition(actor, {
            name: "Dodging",
            short: "Attacks against " + actor.name.split(" ")[0] + " have disadvantage until next turn.",
            expiresOnTurnStartOf: actor.id
          });
          summary.messages.push(actor.name + " takes the Dodge action.");
          endTurn(actor.id, summary);
        }
        break;
      case "dash":
        if (consumeAction(actor, summary, "Dash")) {
          state.session.combat.distanceFeet = Math.min(60, state.session.combat.distanceFeet + actor.speed);
          summary.messages.push(actor.name + " dashes and opens the distance.");
          endTurn(actor.id, summary);
        }
        break;
      case "disengage":
        if (consumeAction(actor, summary, "Disengage")) {
          state.session.combat.distanceFeet = Math.min(30, Math.max(10, state.session.combat.distanceFeet + 15));
          summary.messages.push(actor.name + " disengages and slips back.");
          endTurn(actor.id, summary);
        }
        break;
      case "move_away":
        moveAway(actor, target, summary);
        endTurn(actor.id, summary);
        break;
      case "move_closer":
        moveCloser(actor, summary);
        endTurn(actor.id, summary);
        break;
      default:
        summary.messages.push("The command was too unclear to resolve.");
        break;
    }

    const winner = detectWinner();
    if (winner) {
      state.session.combat.stage = "completed";
      state.session.combat.winnerId = winner.id;
      summary.messages.push(winner.name + " wins the duel.");
    }
    return summary;
  }

  function resolveRage(actor, summary) {
    if (!actor.resources.rage) {
      summary.messages.push(actor.name + " has no rage feature.");
      return false;
    }
    if (actor.resources.rage.active) {
      summary.messages.push(actor.name + " is already raging.");
      return false;
    }
    if (actor.resources.rage.remaining <= 0) {
      summary.messages.push(actor.name + " has no rages left.");
      return false;
    }
    if (!actor.resources.bonusActionAvailable) {
      summary.messages.push(actor.name + " has already spent the bonus action.");
      return false;
    }
    actor.resources.bonusActionAvailable = false;
    actor.resources.rage.active = true;
    actor.resources.rage.remaining -= 1;
    summary.messages.push(actor.name + " enters a rage.");
    return true;
  }

  function moveCloser(actor, summary) {
    if (!consumeAction(actor, summary, "move closer")) {
      return;
    }
    state.session.combat.distanceFeet = Math.max(5, state.session.combat.distanceFeet - actor.speed);
    summary.messages.push(actor.name + " closes the gap.");
  }

  function moveAway(actor, target, summary) {
    if (!consumeAction(actor, summary, "move away")) {
      return;
    }
    const wasAdjacent = state.session.combat.distanceFeet <= 5;
    state.session.combat.distanceFeet = Math.min(30, state.session.combat.distanceFeet + 15);
    summary.messages.push(actor.name + " falls back.");
    if (wasAdjacent) {
      resolveOpportunityAttack(target, actor, summary);
    }
  }

  function resolveOpportunityAttack(attacker, target, summary) {
    if (!attacker.resources.reactionAvailable || attacker.status.dead || attacker.status.downed) {
      return;
    }
    attacker.resources.reactionAvailable = false;
    summary.messages.push(attacker.name + " takes an opportunity attack.");
    resolveWeaponAttack(attacker, target, attacker.equipment.primaryWeapon, summary, { opportunity: true, reckless: false });
  }

  function resolveWeaponAttack(attacker, target, weapon, summary, options) {
    if (!consumeAction(attacker, summary, weapon.name + " attack", options && options.opportunity)) {
      return;
    }
    if (!moveIntoRangeIfPossible(attacker, weapon, summary)) {
      return;
    }
    const attack = rollToHit(weapon.attackBonus, buildAttackOptions(attacker, target, options));
    summary.dice.push({ label: weapon.name + " attack", total: attack.total, rolls: attack.rolls, bonus: weapon.attackBonus });
    if (!attack.isCritical && attack.total < target.armorClass) {
      summary.messages.push(attacker.name + " misses with the " + weapon.name.toLowerCase() + ".");
      return;
    }
    const autoCritical = shouldAutoCritOnHit(target);
    const damageRoll = rollFormula((attack.isCritical || autoCritical) ? weapon.criticalDamage : weapon.damage);
    let finalDamage = damageRoll.total;
    if (attacker.resources.rage && attacker.resources.rage.active && weapon.melee) {
      finalDamage += attacker.resources.rage.damageBonus;
    }
    summary.dice.push({ label: weapon.name + " damage", total: finalDamage, rolls: damageRoll.rolls, formula: (attack.isCritical || autoCritical) ? weapon.criticalDamage : weapon.damage });
    applyDamage(target, finalDamage, weapon.damageType, summary, {
      critical: attack.isCritical || autoCritical,
      melee: weapon.melee,
      sourceId: attacker.id
    });
    attacker.status.madeHostileAttackThisTurn = true;
    if (options && options.reckless) {
      attacker.status.recklessAgainst = true;
      attacker.status.recklessExpiresOnTurnStart = true;
    }
    summary.messages.push(attacker.name + " hits " + target.name + " with the " + weapon.name.toLowerCase() + ".");
  }

  function moveIntoRangeIfPossible(attacker, weapon, summary) {
    const distance = state.session.combat.distanceFeet;
    if (distance <= weapon.reachFeet) {
      return true;
    }
    if (weapon.canThrow && distance <= weapon.throwRange.normal) {
      summary.messages.push(attacker.name + " hurls the " + weapon.name.toLowerCase() + ".");
      return true;
    }
    const needed = distance - weapon.reachFeet;
    if (attacker.resources.movementRemaining >= needed) {
      attacker.resources.movementRemaining -= needed;
      state.session.combat.distanceFeet = weapon.reachFeet;
      summary.messages.push(attacker.name + " surges into range.");
      return true;
    }
    summary.messages.push(weapon.name + " is out of range.");
    return false;
  }

  function buildAttackOptions(attacker, target, options) {
    const result = { advantage: false, disadvantage: false };
    if (options && options.reckless) {
      result.advantage = true;
    }
    if (hasCondition(target, "Dodging")) {
      result.disadvantage = true;
    }
    if (target.status.recklessAgainst) {
      result.advantage = true;
    }
    if (target.status.downed || hasCondition(target, "Paralyzed")) {
      result.advantage = true;
    }
    return result;
  }

  function shouldAutoCritOnHit(target) {
    return state.session.combat.distanceFeet <= 5 && (target.status.downed || hasCondition(target, "Paralyzed"));
  }

  function resolveSpell(caster, target, spellName, summary) {
    const spell = findSpell(caster, spellName);
    if (!spell) {
      summary.messages.push("That spell is not available.");
      return;
    }
    if (spell.level > 0) {
      if (!consumeSpellSlot(caster, spell.level, summary, spell.name)) {
        return;
      }
    } else if (!consumeAction(caster, summary, spell.name)) {
      return;
    }

    if (spell.name === "Magic Missile") {
      for (let i = 0; i < 3; i += 1) {
        const dart = rollFormula("1d4+1");
        summary.dice.push({ label: "Magic Missile dart " + (i + 1), total: dart.total, rolls: dart.rolls, formula: "1d4+1" });
        applyDamage(target, dart.total, "force", summary, { sourceId: caster.id });
        if (target.status.dead) {
          break;
        }
      }
      caster.status.madeHostileAttackThisTurn = true;
      summary.messages.push(caster.name + " releases unerring force bolts.");
      return;
    }

    if (spell.name === "Scorching Ray") {
      let totalDamage = 0;
      for (let i = 0; i < 3; i += 1) {
        const ray = rollToHit(caster.spellcasting.attackBonus, buildAttackOptions(caster, target));
        summary.dice.push({ label: "Scorching Ray attack " + (i + 1), total: ray.total, rolls: ray.rolls, bonus: caster.spellcasting.attackBonus });
        if (ray.isCritical || ray.total >= target.armorClass) {
          const autoCritical = shouldAutoCritOnHit(target);
          const damage = rollFormula((ray.isCritical || autoCritical) ? "4d6" : "2d6");
          totalDamage += damage.total;
          summary.dice.push({ label: "Scorching Ray damage " + (i + 1), total: damage.total, rolls: damage.rolls, formula: (ray.isCritical || autoCritical) ? "4d6" : "2d6" });
        }
      }
      if (totalDamage > 0) {
        applyDamage(target, totalDamage, "fire", summary, { sourceId: caster.id });
        caster.status.madeHostileAttackThisTurn = true;
        summary.messages.push(caster.name + " lashes the arena with scorching rays.");
      } else {
        summary.messages.push(caster.name + " sends the rays wide.");
      }
      return;
    }

    if (spell.name === "Hold Person") {
      const save = rollSavingThrow(target, "wis");
      summary.dice.push({ label: "Hold Person Wisdom save", total: save.total, rolls: save.rolls, bonus: target.savingThrows.wis });
      if (save.total >= caster.spellcasting.saveDc) {
        summary.messages.push(target.name + " resists Hold Person.");
      } else {
        clearConcentration(caster.id);
        caster.status.concentrating = { spellName: "Hold Person", targetId: target.id };
        upsertCondition(target, { name: "Paralyzed", short: target.name.split(" ")[0] + " is paralyzed.", sourceId: caster.id });
        summary.messages.push(target.name + " is paralyzed.");
      }
      caster.status.madeHostileAttackThisTurn = true;
      return;
    }

    if (spell.name === "Burning Hands") {
      if (state.session.combat.distanceFeet > 15) {
        const needed = state.session.combat.distanceFeet - 15;
        if (caster.resources.movementRemaining < needed) {
          summary.messages.push("The target is too far away for Burning Hands.");
          restoreSpellSlot(caster, spell.level);
          return;
        }
        caster.resources.movementRemaining -= needed;
        state.session.combat.distanceFeet = 15;
      }
      const save = rollSavingThrow(target, "dex", { dangerSense: true });
      const damage = rollFormula("3d6");
      summary.dice.push({ label: "Burning Hands Dex save", total: save.total, rolls: save.rolls, bonus: save.bonus });
      summary.dice.push({ label: "Burning Hands damage", total: damage.total, rolls: damage.rolls, formula: "3d6" });
      applyDamage(target, save.total >= caster.spellcasting.saveDc ? Math.floor(damage.total / 2) : damage.total, "fire", summary, { sourceId: caster.id });
      caster.status.madeHostileAttackThisTurn = true;
      summary.messages.push(caster.name + " fans out a sheet of fire.");
      return;
    }

    if (spell.name === "Fire Bolt" || spell.name === "Ray of Frost") {
      const attack = rollToHit(caster.spellcasting.attackBonus, buildAttackOptions(caster, target));
      const autoCritical = shouldAutoCritOnHit(target);
      const formula = spell.name === "Fire Bolt"
        ? ((attack.isCritical || autoCritical) ? "2d10" : "1d10")
        : ((attack.isCritical || autoCritical) ? "2d8" : "1d8");
      summary.dice.push({ label: spell.name + " attack", total: attack.total, rolls: attack.rolls, bonus: caster.spellcasting.attackBonus });
      if (!attack.isCritical && attack.total < target.armorClass) {
        summary.messages.push(caster.name + " misses with " + spell.name + ".");
        return;
      }
      const damage = rollFormula(formula);
      summary.dice.push({ label: spell.name + " damage", total: damage.total, rolls: damage.rolls, formula: formula });
      applyDamage(target, damage.total, spell.name === "Fire Bolt" ? "fire" : "cold", summary, { sourceId: caster.id });
      if (spell.name === "Ray of Frost") {
        upsertCondition(target, {
          name: "Slowed",
          short: target.name.split(" ")[0] + " loses 10 feet of speed until Nyra's next turn.",
          expiresOnTurnStartOf: caster.id
        });
      }
      caster.status.madeHostileAttackThisTurn = true;
      summary.messages.push(caster.name + " lands " + spell.name + ".");
    }
  }

  function consumeSpellSlot(caster, level, summary, label) {
    const key = String(level);
    if (!caster.resources.spellSlots || caster.resources.spellSlots[key] <= 0) {
      summary.messages.push("No level " + level + " slot remains for " + label + ".");
      return false;
    }
    if (!consumeAction(caster, summary, label)) {
      return false;
    }
    caster.resources.spellSlots[key] -= 1;
    return true;
  }

  function restoreSpellSlot(caster, level) {
    caster.resources.spellSlots[String(level)] += 1;
  }

  function consumeAction(actor, summary, label, skipActionCost) {
    if (skipActionCost) {
      return true;
    }
    if (!actor.resources.actionAvailable) {
      summary.messages.push(actor.name + " has already spent the action and cannot use " + label + ".");
      return false;
    }
    actor.resources.actionAvailable = false;
    return true;
  }

  function applyDamage(target, amount, damageType, summary, options) {
    let finalDamage = amount;
    const resisted = hasResistance(target, damageType);
    if (resisted) {
      finalDamage = Math.floor(finalDamage / 2);
    }
    if (finalDamage <= 0) {
      summary.damage.push({ target: target.name, amount: finalDamage, type: damageType, resisted: resisted });
      return;
    }
    target.status.tookDamageSinceTurnStart = true;
    target.status.stable = false;
    if (target.status.concentrating && finalDamage > 0) {
      resolveConcentration(target, finalDamage, summary);
    }

    if (target.status.downed) {
      const failures = options && options.critical && options.melee ? 2 : 1;
      target.status.deathSaves.failures += failures;
      summary.damage.push({ target: target.name, amount: finalDamage, type: damageType, resisted: resisted });
      if (target.status.deathSaves.failures >= 3) {
        target.status.dead = true;
      }
      return;
    }

    target.currentHp = Math.max(0, target.currentHp - finalDamage);
    summary.damage.push({ target: target.name, amount: finalDamage, type: damageType, resisted: resisted });
    if (target.currentHp === 0) {
      target.status.downed = true;
      target.status.stable = false;
      target.status.deathSaves = { successes: 0, failures: 0 };
      upsertCondition(target, { name: "Downed", short: target.name.split(" ")[0] + " is unconscious at 0 HP." });
      summary.messages.push(target.name + " is down at 0 HP.");
    }
  }

  function resolveConcentration(target, damage, summary) {
    const dc = Math.max(10, Math.floor(damage / 2));
    const save = rollSavingThrow(target, "con");
    summary.dice.push({ label: "Concentration save", total: save.total, rolls: save.rolls, bonus: target.savingThrows.con });
    if (save.total < dc) {
      summary.messages.push(target.name + " loses concentration.");
      clearConcentration(target.id);
    }
  }

  function clearConcentration(casterId) {
    const caster = getCharacter(casterId);
    if (!caster.status.concentrating) {
      return;
    }
    const target = getCharacter(caster.status.concentrating.targetId);
    target.status.conditions = target.status.conditions.filter(function (condition) {
      return !(condition.name === "Paralyzed" && condition.sourceId === casterId);
    });
    caster.status.concentrating = null;
  }

  function endTurn(actorId, summary) {
    advanceTurnFromActor(actorId, summary);
    resolveAutomaticStates(summary);
  }

  function advanceTurnFromActor(actorId, summary) {
    const actor = getCharacter(actorId);
    if (actor.resources.rage && actor.resources.rage.active && !actor.status.madeHostileAttackThisTurn && !actor.status.tookDamageSinceTurnStart) {
      actor.resources.rage.active = false;
      summary.messages.push(actor.name + "'s rage fades.");
    }
    state.session.combat.activeTurnIndex = (state.session.combat.activeTurnIndex + 1) % state.session.combat.turnOrder.length;
    if (state.session.combat.activeTurnIndex === 0) {
      state.session.combat.round += 1;
    }
    state.session.combat.activeCharacterId = state.session.combat.turnOrder[state.session.combat.activeTurnIndex];
    prepareTurn(getCharacter(state.session.combat.activeCharacterId));
  }

  function prepareTurn(actor) {
    actor.resources.actionAvailable = true;
    actor.resources.bonusActionAvailable = true;
    actor.resources.reactionAvailable = true;
    actor.resources.movementRemaining = getEffectiveSpeed(actor);
    actor.status.tookDamageSinceTurnStart = false;
    actor.status.madeHostileAttackThisTurn = false;
    if (actor.status.recklessExpiresOnTurnStart) {
      actor.status.recklessAgainst = false;
      actor.status.recklessExpiresOnTurnStart = false;
    }
    clearExpiringEffects(actor.id);
  }

  function clearExpiringEffects(turnOwnerId) {
    Object.keys(state.session.characters).forEach(function (id) {
      const actor = getCharacter(id);
      actor.status.conditions = actor.status.conditions.filter(function (condition) {
        return condition.expiresOnTurnStartOf !== turnOwnerId;
      });
    });
  }

  function resolveAutomaticStates(summary) {
    let safety = 0;
    while (safety < 4) {
      safety += 1;
      const actor = getCharacter(state.session.combat.activeCharacterId);
      if (actor.status.dead) {
        break;
      }
      if (actor.status.downed) {
        const save = rollD20();
        summary.dice.push({ label: actor.name + " death save", total: save.total, rolls: save.rolls, bonus: 0 });
        if (save.total === 1) {
          actor.status.deathSaves.failures += 2;
        } else if (save.total === 20) {
          actor.status.downed = false;
          actor.status.stable = false;
          actor.currentHp = 1;
          actor.status.deathSaves = { successes: 0, failures: 0 };
          actor.status.conditions = actor.status.conditions.filter(function (condition) {
            return condition.name !== "Downed";
          });
          summary.messages.push(actor.name + " rises on a natural 20 death save.");
          break;
        } else if (save.total >= 10) {
          actor.status.deathSaves.successes += 1;
        } else {
          actor.status.deathSaves.failures += 1;
        }
        if (actor.status.deathSaves.failures >= 3) {
          actor.status.dead = true;
          summary.messages.push(actor.name + " dies.");
          break;
        }
        if (actor.status.deathSaves.successes >= 3) {
          actor.status.stable = true;
          summary.messages.push(actor.name + " stabilizes at 0 HP.");
          break;
        }
        summary.messages.push(actor.name + " makes a death save.");
        advanceTurnFromActor(actor.id, summary);
        continue;
      }
      if (hasCondition(actor, "Paralyzed")) {
        const condition = findCondition(actor, "Paralyzed");
        const source = getCharacter(condition.sourceId);
        summary.messages.push(actor.name + " loses the turn to paralysis.");
        const save = rollSavingThrow(actor, "wis");
        summary.dice.push({ label: actor.name + " Hold Person save", total: save.total, rolls: save.rolls, bonus: actor.savingThrows.wis });
        if (save.total >= source.spellcasting.saveDc) {
          actor.status.conditions = actor.status.conditions.filter(function (entry) {
            return entry.name !== "Paralyzed";
          });
          clearConcentration(source.id);
          summary.messages.push(actor.name + " breaks free of Hold Person.");
        }
        advanceTurnFromActor(actor.id, summary);
        continue;
      }
      break;
    }
  }

  function detectWinner() {
    const active = Object.keys(state.session.characters).map(getCharacter).filter(function (actor) {
      return !actor.status.dead;
    });
    if (active.length === 1) {
      return active[0];
    }
    if (active.length === 2) {
      const one = active[0];
      const two = active[1];
      if (one.status.stable && !two.status.stable && !two.status.downed) {
        return two;
      }
      if (two.status.stable && !one.status.stable && !one.status.downed) {
        return one;
      }
    }
    return null;
  }

  async function streamNarration(resolution, requestId, memoryContext) {
    const fallback = buildFallbackNarration(resolution);
    if (!state.config.openaiKey) {
      setStatus("OpenAI bootstrap missing. Using local DM fallback.");
      await narrateText(fallback, true);
      return fallback;
    }
    const prompt = [
      state.rulesPrompt,
      "",
      memoryContext.text,
      "",
      state.stylePrompt,
      "",
      "Narrate this resolved duel event in 3 to 5 sentences.",
      "Do not invent extra mechanics.",
      JSON.stringify({
        actor: resolution.actor,
        target: resolution.target,
        action: resolution.action,
        messages: resolution.messages,
        dice: resolution.dice,
        damage: resolution.damage,
        nextTurn: state.session.combat.stage === "active" ? getCharacter(state.session.combat.activeCharacterId).name : "combat complete",
        round: state.session.combat.round,
        distanceFeet: state.session.combat.distanceFeet
      })
    ].join("\n");
    try {
      setStatus("DM is composing a response.");
      const ttsReady = await openStreamingTts();
      const narration = await streamOpenAIText(prompt, requestId, function (delta, aggregate) {
        setStatus("DM speaking: " + summarizeForStatus(aggregate));
        if (ttsReady) {
          pushStreamingTtsText(delta, false);
        }
      });
      if (ttsReady) {
        pushStreamingTtsText("", true);
        finalizeStreamingTts();
      }
      return narration || fallback;
    } catch (error) {
      console.warn(error);
      stopSpeaking();
      setStatus("Streaming narration failed. Falling back to buffered speech.");
      await narrateText(fallback, true);
      return fallback;
    }
  }

  function buildFallbackNarration(resolution) {
    const nextTurn = state.session.combat.stage === "active"
      ? getCharacter(state.session.combat.activeCharacterId).name.split(" ")[0] + " is next."
      : "The duel is over.";
    return resolution.messages.join(" ") + " " + nextTurn;
  }

  function buildRulesAudit(resolution) {
    const dice = resolution.dice.length ? resolution.dice.map(function (entry) {
      const detail = entry.formula ? entry.formula : (entry.bonus !== undefined ? ("d20+" + entry.bonus) : "roll");
      return entry.label + ": " + entry.rolls.join("/") + " => " + entry.total + " [" + detail + "]";
    }).join(" | ") : "No dice rolled";
    const damage = resolution.damage.length ? resolution.damage.map(function (entry) {
      return entry.target + " -" + entry.amount + " " + entry.type + (entry.resisted ? " (resisted)" : "");
    }).join(" | ") : "No damage";
    return resolution.actor + " -> " + resolution.action + ". " + dice + ". " + damage + ".";
  }

  async function queryMemory(query) {
    const startedAt = performance.now();
    try {
      const payload = await postJson("/api/memory/query", { query: query, maxResults: 4 });
      if (!payload.results || !payload.results.length) {
        return { text: "", durationMs: roundDuration(performance.now() - startedAt), source: "empty" };
      }
      return {
        text: payload.results.map(function (item, index) {
        return "Memory " + (index + 1) + " [" + item.title + " / " + item.source + "]: " + item.text;
        }).join("\n\n"),
        durationMs: roundDuration(performance.now() - startedAt),
        source: "vector"
      };
    } catch (error) {
      console.warn(error);
      return { text: "", durationMs: roundDuration(performance.now() - startedAt), source: "error" };
    }
  }

  async function callOpenAI(prompt, requestId) {
    const controller = new AbortController();
    state.assistant.controller = controller;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": "Bearer " + state.config.openaiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: state.config.openaiModel || "gpt-4o-mini",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt }
              ]
            }
          ],
          temperature: 0.3,
          max_output_tokens: 450
        })
      });
      if (!response.ok) {
        throw new Error("OpenAI response failed: " + response.status);
      }
      const payload = await response.json();
      if (requestId !== state.assistant.requestId) {
        return null;
      }
      return extractOpenAIText(payload);
    } finally {
      state.assistant.controller = null;
    }
  }

  async function streamOpenAIText(prompt, requestId, onDelta) {
    const controller = new AbortController();
    state.assistant.controller = controller;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + state.config.openaiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: state.config.openaiModel || "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt }
            ]
          }
        ],
        temperature: 0.7,
        max_output_tokens: 450,
        stream: true
      })
    });
    if (!response.ok || !response.body) {
      state.assistant.controller = null;
      throw new Error("OpenAI streaming response failed: " + response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const step = await reader.read();
        if (step.done) {
          break;
        }
        buffer += decoder.decode(step.value, { stream: true });
        const segments = buffer.split("\n\n");
        buffer = segments.pop() || "";
        for (const segment of segments) {
          const event = parseSseEvent(segment);
          if (!event) {
            continue;
          }
          if (event.type === "response.output_text.delta" && event.delta) {
            fullText += event.delta;
            if (typeof onDelta === "function") {
              onDelta(event.delta, fullText);
            }
          }
          if (event.type === "response.output_text.done" && event.text && !fullText) {
            fullText = event.text;
          }
          if (event.type === "response.completed") {
            return fullText.trim();
          }
          if (event.type === "error") {
            throw new Error(event.error && event.error.message ? event.error.message : "OpenAI streaming error");
          }
        }
      }
      return fullText.trim();
    } finally {
      state.assistant.controller = null;
    }
  }

  function parseSseEvent(segment) {
    const lines = segment.split("\n");
    const data = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        data.push(line.slice(5).trim());
      }
    }
    if (!data.length) {
      return null;
    }
    const payload = data.join("\n");
    if (payload === "[DONE]") {
      return { type: "done" };
    }
    return JSON.parse(payload);
  }

  function extractOpenAIText(payload) {
    if (payload.output_text) {
      return payload.output_text.trim();
    }
    if (Array.isArray(payload.output)) {
      const texts = [];
      payload.output.forEach(function (item) {
        if (Array.isArray(item.content)) {
          item.content.forEach(function (content) {
            if (content.type === "output_text" && content.text) {
              texts.push(content.text);
            }
          });
        }
      });
      return texts.join("\n").trim();
    }
    throw new Error("No text output found in OpenAI response.");
  }

  async function narrateText(text, shouldSpeak) {
    if (!shouldSpeak || !state.config.deepgramKey) {
      return;
    }
    stopSpeaking();
    try {
      const response = await fetch("https://api.deepgram.com/v1/speak?model=" + encodeURIComponent(state.config.deepgramVoice), {
        method: "POST",
        headers: {
          "Authorization": "Token " + state.config.deepgramKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: text })
      });
      if (!response.ok) {
        throw new Error("Deepgram TTS failed: " + response.status);
      }
      const blob = await response.blob();
      state.tts.objectUrl = URL.createObjectURL(blob);
      refs.ttsAudio.src = state.tts.objectUrl;
      state.tts.speaking = true;
      await refs.ttsAudio.play();
    } catch (error) {
      console.error(error);
      setStatus("Deepgram TTS failed. Text log still updated.");
      state.tts.speaking = false;
    }
  }

  async function openStreamingTts() {
    if (!state.config.deepgramKey) {
      return false;
    }
    stopSpeaking();
    await ensureTtsContext();
    state.tts.pendingText = "";
    state.tts.streamedText = "";
    state.tts.firstAudioAt = 0;
    state.tts.nextStartTime = state.tts.context.currentTime + 0.05;

    return new Promise(function (resolve, reject) {
      const query = new URLSearchParams({
        model: state.config.deepgramVoice || "aura-2-thalia-en",
        encoding: "linear16",
        sample_rate: String(state.tts.sampleRate)
      });
      const socket = new WebSocket("wss://api.deepgram.com/v1/speak?" + query.toString(), ["token", state.config.deepgramKey]);
      socket.binaryType = "arraybuffer";
      socket.addEventListener("open", function () {
        state.tts.socket = socket;
        resolve(true);
      });
      socket.addEventListener("message", handleStreamingTtsMessage);
      socket.addEventListener("error", function (error) {
        console.error(error);
        if (state.tts.socket === socket) {
          state.tts.socket = null;
        }
        reject(new Error("Deepgram streaming TTS websocket error."));
      });
      socket.addEventListener("close", function () {
        if (state.tts.socket === socket) {
          state.tts.socket = null;
        }
      });
    });
  }

  async function ensureTtsContext() {
    if (!state.tts.context) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.tts.context = new AudioCtx();
      state.tts.gainNode = state.tts.context.createGain();
      state.tts.gainNode.gain.value = 1;
      state.tts.gainNode.connect(state.tts.context.destination);
    }
    if (state.tts.context.state === "suspended") {
      await state.tts.context.resume();
    }
  }

  function handleStreamingTtsMessage(event) {
    if (typeof event.data === "string") {
      return;
    }
    const chunk = event.data instanceof ArrayBuffer ? event.data : null;
    if (!chunk || !chunk.byteLength) {
      return;
    }
    if (!state.tts.firstAudioAt) {
      state.tts.firstAudioAt = performance.now();
    }
    schedulePcmChunk(chunk);
  }

  function schedulePcmChunk(arrayBuffer) {
    const pcm = new Int16Array(arrayBuffer);
    const floatData = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i += 1) {
      floatData[i] = pcm[i] / 0x8000;
    }
    const buffer = state.tts.context.createBuffer(1, floatData.length, state.tts.sampleRate);
    buffer.copyToChannel(floatData, 0);
    const source = state.tts.context.createBufferSource();
    source.buffer = buffer;
    source.connect(state.tts.gainNode);
    const startAt = Math.max(state.tts.context.currentTime + 0.03, state.tts.nextStartTime);
    source.start(startAt);
    state.tts.nextStartTime = startAt + buffer.duration;
    state.tts.speaking = true;
    state.tts.sourceNodes.push(source);
    source.addEventListener("ended", function () {
      state.tts.sourceNodes = state.tts.sourceNodes.filter(function (node) {
        return node !== source;
      });
      if (!state.tts.sourceNodes.length && !state.tts.socket) {
        state.tts.speaking = false;
      }
    });
  }

  function pushStreamingTtsText(delta, force) {
    if (!state.tts.socket || state.tts.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    state.tts.pendingText += delta;
    const chunks = extractSpeakableChunks(state.tts.pendingText, force);
    state.tts.pendingText = chunks.remaining;
    chunks.ready.forEach(function (chunk) {
      state.tts.streamedText += chunk;
      state.tts.socket.send(JSON.stringify({ type: "Speak", text: chunk }));
      state.tts.socket.send(JSON.stringify({ type: "Flush" }));
    });
  }

  function finalizeStreamingTts() {
    if (!state.tts.socket || state.tts.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    state.tts.socket.send(JSON.stringify({ type: "Close" }));
  }

  function extractSpeakableChunks(text, force) {
    const ready = [];
    let remaining = text;
    while (true) {
      const match = /([^.?!]+[.?!]["']?\s*)/.exec(remaining);
      if (!match) {
        break;
      }
      ready.push(match[1]);
      remaining = remaining.slice(match[0].length);
    }
    if (force) {
      const finalText = remaining.trim();
      if (finalText) {
        ready.push(finalText);
        remaining = "";
      }
    } else if (remaining.length > 160) {
      const splitAt = remaining.lastIndexOf(",");
      if (splitAt > 40) {
        ready.push(remaining.slice(0, splitAt + 1));
        remaining = remaining.slice(splitAt + 1);
      }
    }
    return { ready: ready, remaining: remaining };
  }

  async function startVoice() {
    if (!state.config.deepgramKey) {
      setStatus("Deepgram bootstrap is missing.");
      return;
    }
    if (state.audio.started) {
      setStatus("Voice pipeline is already active.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audio.context = new AudioCtx();
      state.audio.stream = stream;
      state.audio.source = state.audio.context.createMediaStreamSource(stream);
      state.audio.processor = state.audio.context.createScriptProcessor(4096, 1, 1);
      state.audio.ws = openDeepgramSocket();
      state.audio.processor.onaudioprocess = handleAudioProcess;
      state.audio.source.connect(state.audio.processor);
      state.audio.processor.connect(state.audio.context.destination);
      state.audio.started = true;
      setStatus("Voice pipeline connected.");
      logEvent("system", "Voice pipeline started.");
    } catch (error) {
      console.error(error);
      setStatus("Unable to start the microphone.");
      logEvent("error", "Failed to start voice pipeline.", { error: String(error) });
    }
  }

  function stopVoice() {
    stopSpeaking();
    abortAssistant("manual-stop");
    if (state.audio.processor) {
      state.audio.processor.disconnect();
      state.audio.processor.onaudioprocess = null;
    }
    if (state.audio.source) {
      state.audio.source.disconnect();
    }
    if (state.audio.stream) {
      state.audio.stream.getTracks().forEach(function (track) {
        track.stop();
      });
    }
    if (state.audio.context) {
      state.audio.context.close();
    }
    if (state.audio.ws) {
      try {
        state.audio.ws.close();
      } catch (error) {
        console.warn(error);
      }
    }
    state.audio.context = null;
    state.audio.stream = null;
    state.audio.source = null;
    state.audio.processor = null;
    state.audio.ws = null;
    state.audio.started = false;
    state.audio.interim = "";
    state.audio.finals = [];
    setStatus("Voice pipeline stopped.");
    logEvent("system", "Voice pipeline stopped.");
  }

  function openDeepgramSocket() {
    const query = new URLSearchParams({
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      punctuate: "true",
      smart_format: "true",
      interim_results: "true",
      vad_events: "true",
      endpointing: "300",
      utterance_end_ms: "1000",
      model: state.config.deepgramModel || "nova-3",
      language: "en-US"
    });
    const socket = new WebSocket("wss://api.deepgram.com/v1/listen?" + query.toString(), ["token", state.config.deepgramKey]);
    socket.addEventListener("message", function (event) {
      try {
        handleDeepgramMessage(JSON.parse(event.data));
      } catch (error) {
        console.warn(error);
      }
    });
    socket.addEventListener("error", function (error) {
      console.error(error);
      setStatus("Deepgram websocket error.");
    });
    return socket;
  }

  function handleAudioProcess(event) {
    if (!state.audio.ws || state.audio.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const input = event.inputBuffer.getChannelData(0);
    const pcm = downsampleToInt16(input, state.audio.context.sampleRate, 16000);
    if (pcm.byteLength > 0) {
      state.audio.ws.send(pcm.buffer);
    }
  }

  function handleDeepgramMessage(payload) {
    if (payload.type === "SpeechStarted") {
      handleBargeIn("speech");
      return;
    }
    if (payload.type === "UtteranceEnd") {
      finalizeTranscript();
      return;
    }
    if (payload.type !== "Results") {
      return;
    }
    const alternative = payload.channel && payload.channel.alternatives ? payload.channel.alternatives[0] : null;
    const transcript = alternative && alternative.transcript ? alternative.transcript.trim() : "";
    if (!transcript) {
      return;
    }
    state.audio.interim = transcript;
    refs.liveTranscript.textContent = transcript;
    if (payload.is_final) {
      state.audio.finals.push(transcript);
      refs.finalTranscript.textContent = state.audio.finals.join(" ");
    }
    if (payload.speech_final) {
      finalizeTranscript();
    }
  }

  function finalizeTranscript() {
    const text = state.audio.finals.join(" ").trim() || state.audio.interim.trim();
    state.audio.finals = [];
    state.audio.interim = "";
    refs.liveTranscript.textContent = "Listening...";
    if (text) {
      refs.finalTranscript.textContent = text;
      processTranscript(text, "voice");
    }
  }

  function handleBargeIn(source) {
    if (!state.tts.speaking && !state.assistant.controller) {
      return;
    }
    stopSpeaking();
    abortAssistant(source);
    setStatus("Barge-in detected. DM audio and pending inference stopped.");
    logEvent("system", "Barge-in interrupted the DM.", { source: source });
  }

  function stopSpeaking() {
    if (state.tts.socket) {
      try {
        state.tts.socket.close();
      } catch (error) {
        console.warn(error);
      }
      state.tts.socket = null;
    }
    state.tts.pendingText = "";
    state.tts.streamedText = "";
    state.tts.nextStartTime = 0;
    state.tts.firstAudioAt = 0;
    state.tts.sourceNodes.forEach(function (source) {
      try {
        source.stop();
      } catch (error) {
        console.warn(error);
      }
    });
    state.tts.sourceNodes = [];
    if (refs.ttsAudio.src) {
      refs.ttsAudio.pause();
      refs.ttsAudio.currentTime = 0;
      cleanupAudioUrl();
    }
    state.tts.speaking = false;
  }

  function cleanupAudioUrl() {
    if (state.tts.objectUrl) {
      URL.revokeObjectURL(state.tts.objectUrl);
      state.tts.objectUrl = null;
    }
    refs.ttsAudio.removeAttribute("src");
  }

  function abortAssistant(source) {
    if (!state.assistant.controller) {
      return;
    }
    try {
      state.assistant.controller.abort();
    } catch (error) {
      console.warn(error);
    }
    state.assistant.controller = null;
    logEvent("system", "Assistant request aborted.", { source: source });
  }

  function detectActivation(transcript) {
    const lower = transcript.toLowerCase().trim();
    const firstChunk = lower.split(/[,.!?:]/)[0];
    const firstWords = firstChunk.split(/\s+/).slice(0, 2).join(" ");
    const candidates = Object.keys(state.session.characters).map(function (id) {
      const actor = getCharacter(id);
      return {
        characterId: id,
        score: Math.max.apply(null, actor.aliases.map(function (alias) {
          return similarity(firstWords, alias.toLowerCase());
        }))
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    });
    if (!candidates.length || candidates[0].score < 0.68) {
      return null;
    }
    const actor = getCharacter(candidates[0].characterId);
    const firstName = actor.name.split(" ")[0].toLowerCase();
    return {
      characterId: actor.id,
      command: lower.replace(new RegExp("^" + escapeRegex(firstName) + "[,\\s]*"), "").trim()
    };
  }

  function renderAll() {
    renderStage();
    renderInitiative();
    renderMetrics();
    renderPlayerCard("alden", refs.aldenCard);
    renderPlayerCard("nyra", refs.nyraCard);
    renderLogs();
  }

  function renderStage() {
    refs.stageLabel.textContent = prettifyStage(state.session.combat.stage);
    refs.engagementLabel.textContent = "Engagement: Duel";
    refs.turnBanner.textContent = state.session.combat.stage === "active"
      ? "Turn: " + getCharacter(state.session.combat.activeCharacterId).name.split(" ")[0]
      : "Turn: Pending";
    refs.encounterTitle.textContent = state.session.meta.title;
    refs.encounterSummary.textContent = state.session.combat.stage === "active"
      ? getCharacter(state.session.combat.activeCharacterId).name + " is active at " + state.session.combat.distanceFeet + " feet."
      : "Claim both fixed heroes to begin initiative.";
  }

  function renderInitiative() {
    refs.initiativeOrder.innerHTML = "";
    if (!state.session.combat.turnOrder.length) {
      refs.initiativeOrder.innerHTML = "<div class=\"initiative-entry\"><span>Pending</span><strong>-</strong></div>";
      return;
    }
    state.session.combat.turnOrder.forEach(function (id) {
      const actor = getCharacter(id);
      const row = document.createElement("div");
      row.className = "initiative-entry" + (state.session.combat.activeCharacterId === id ? " active" : "");
      row.innerHTML = "<span>" + actor.name.split(" ")[0] + "</span><strong>" + actor.status.initiativeRoll + "</strong>";
      refs.initiativeOrder.appendChild(row);
    });
  }

  function renderMetrics() {
    refs.distanceMetric.textContent = state.session.combat.distanceFeet + " ft";
    refs.roundMetric.textContent = String(state.session.combat.round);
    const effects = [];
    Object.keys(state.session.characters).forEach(function (id) {
      const actor = getCharacter(id);
      actor.status.conditions.forEach(function (condition) {
        effects.push(actor.name.split(" ")[0] + ": " + condition.name);
      });
    });
    refs.effectMetric.textContent = effects.length ? effects.join(" | ") : "None";
  }

  function renderPlayerCard(id, container) {
    const actor = getCharacter(id);
    const spells = actor.spells.all.length ? actor.spells.all.map(function (spell) {
      return "<span class=\"tag\"><button data-spell=\"" + spell.name + "\" data-character=\"" + actor.id + "\">" + spell.name + "</button></span>";
    }).join("") : "<span class=\"chip\">No spells</span>";
    const conditions = actor.status.conditions.length ? actor.status.conditions.map(function (condition) {
      return "<span class=\"chip\">" + condition.name + "</span>";
    }).join("") : "<span class=\"chip\">No conditions</span>";
    const quickActions = quickActionMarkup(actor);
    container.innerHTML = [
      "<div class=\"player-card-inner\">",
      "  <div class=\"avatar-frame\"><img src=\"" + actor.avatar + "\" alt=\"" + actor.name + " avatar\"></div>",
      "  <div class=\"player-meta\">",
      "    <div class=\"player-heading\">",
      "      <div><p class=\"eyebrow\">" + actor.race + " " + actor.class + "</p><h2>" + actor.name + "</h2></div>",
      "      <span class=\"status-pill claim-pill" + (actor.claimed ? " claimed" : "") + "\">" + (actor.claimed ? "Claimed" : "Unclaimed") + "</span>",
      "    </div>",
      "    <div class=\"stat-grid\">",
      statBox("HP", actor.currentHp + " / " + actor.maxHp),
      statBox("AC", String(actor.armorClass)),
      statBox("Init", formatModifier(actor.initiativeModifier)),
      statBox("Speed", getEffectiveSpeed(actor) + " ft"),
      "    </div>",
      "    <div class=\"detail-strip\"><span class=\"chip\">Weapon: " + actor.equipment.primaryWeapon.name + "</span><span class=\"chip\">Attack: +" + actor.equipment.primaryWeapon.attackBonus + "</span><span class=\"chip\">Damage: " + actor.equipment.primaryWeapon.damage + "</span></div>",
      "    <div class=\"resource-strip\">" + resourceStrip(actor) + "</div>",
      "    <div class=\"condition-strip\">" + conditions + "</div>",
      "    <div class=\"spell-strip\">" + spells + "</div>",
      "    <div class=\"player-actions\"><button data-sheet=\"" + actor.id + "\">Character Sheet</button>" + (actor.spells.all.length ? "<button class=\"secondary\" data-spellbook=\"" + actor.id + "\">Spell Summary</button>" : "") + "</div>",
      "    <div class=\"player-actions quick-actions\">" + quickActions + "</div>",
      "  </div>",
      "</div>"
    ].join("");

    container.querySelectorAll("[data-sheet]").forEach(function (button) {
      button.addEventListener("click", function () {
        openSheet(button.getAttribute("data-sheet"));
      });
    });
    container.querySelectorAll("[data-spell]").forEach(function (button) {
      button.addEventListener("click", function () {
        openSpell(button.getAttribute("data-character"), button.getAttribute("data-spell"));
      });
    });
    container.querySelectorAll("[data-spellbook]").forEach(function (button) {
      button.addEventListener("click", function () {
        openSpellbook(button.getAttribute("data-spellbook"));
      });
    });
    container.querySelectorAll("[data-quick]").forEach(function (button) {
      button.addEventListener("click", function () {
        processTranscript(button.getAttribute("data-quick"), "quick-action");
      });
    });
  }

  function renderLogs() {
    refs.logFeed.innerHTML = "";
    refs.logCount.textContent = state.logs.length + " entries";
    state.logs.forEach(function (entry) {
      const node = document.createElement("article");
      node.className = "log-entry";
      node.innerHTML = "<div class=\"log-meta\"><span>" + entry.kind.toUpperCase() + "</span><span>" + formatTime(entry.timestamp) + "</span></div><p>" + escapeHtml(entry.message) + "</p>";
      refs.logFeed.appendChild(node);
    });
  }

  function openSheet(characterId) {
    const actor = getCharacter(characterId);
    refs.sheetTitle.textContent = actor.name + " - " + actor.race + " " + actor.class + " " + actor.level;
    refs.sheetBody.innerHTML = [
      "<div class=\"sheet-grid\">",
      sheetBox("Core", [
        "HP: " + actor.currentHp + " / " + actor.maxHp,
        "AC: " + actor.armorClass,
        "Speed: " + getEffectiveSpeed(actor) + " ft",
        "Proficiency Bonus: +" + actor.proficiencyBonus,
        "Passive Perception: " + actor.passivePerception
      ]),
      sheetBox("Abilities", Object.keys(actor.abilityScores).map(function (key) {
        return key.toUpperCase() + ": " + actor.abilityScores[key] + " (" + formatModifier(actor.abilityModifiers[key]) + ")";
      })),
      sheetBox("Saving Throws", Object.keys(actor.savingThrows).map(function (key) {
        return key.toUpperCase() + ": " + formatModifier(actor.savingThrows[key]);
      })),
      "</div>",
      sheetBox("Skills", Object.keys(actor.skills).map(function (key) {
        return prettifyKey(key) + ": " + formatModifier(actor.skills[key]);
      })),
      sheetBox("Features", actor.features),
      actor.spells.all.length ? sheetBox("Spells", actor.spells.all.map(function (spell) {
        return spell.name + " - " + spell.summary;
      })) : "",
      "<div class=\"rules-note\">This demo engine rolls initiative, attack rolls, saves, damage, rage, concentration, conditions, and death saves automatically.</div>"
    ].join("");
    refs.sheetModal.showModal();
  }

  function openSpell(characterId, spellName) {
    const spell = findSpell(getCharacter(characterId), spellName);
    if (!spell) {
      return;
    }
    refs.spellTitle.textContent = spell.name;
    refs.spellBody.innerHTML = [
      sheetBox("Spell Data", [
        "Level: " + spell.levelLabel,
        "Casting Time: " + spell.castingTime,
        "Range: " + spell.range,
        "Duration: " + spell.duration,
        "Attack/Save: " + spell.attackOrSave
      ]),
      sheetBox("Effect Summary", [spell.summary]),
      sheetBox("Components", [spell.components])
    ].join("");
    refs.spellModal.showModal();
  }

  function openSpellbook(characterId) {
    const actor = getCharacter(characterId);
    refs.spellTitle.textContent = actor.name + " Spell Summary";
    refs.spellBody.innerHTML = sheetBox("Known Spells", actor.spells.all.map(function (spell) {
      return spell.name + " - " + spell.summary;
    }));
    refs.spellModal.showModal();
  }

  function statBox(label, value) {
    return "<div class=\"stat-box\"><div class=\"eyebrow\">" + label + "</div><strong>" + value + "</strong></div>";
  }

  function resourceStrip(actor) {
    const parts = [];
    if (actor.resources.rage) {
      parts.push("<span class=\"chip\">Rages: " + actor.resources.rage.remaining + "/" + actor.resources.rage.max + "</span>");
      parts.push("<span class=\"chip\">Rage: " + (actor.resources.rage.active ? "Active" : "Inactive") + "</span>");
    }
    if (actor.resources.spellSlots) {
      parts.push("<span class=\"chip\">Slots 1: " + actor.resources.spellSlots["1"] + "</span>");
      parts.push("<span class=\"chip\">Slots 2: " + actor.resources.spellSlots["2"] + "</span>");
      parts.push("<span class=\"chip\">Sorcery: " + actor.resources.sorceryPoints + "</span>");
    }
    return parts.join("");
  }

  function quickActionMarkup(actor) {
    const actions = [];
    if (!actor.claimed) {
      actions.push(actor.name.split(" ")[0]);
    } else if (actor.id === "alden") {
      actions.push("Alden, I attack with my greataxe.");
      actions.push("Alden, I rage and attack with my greataxe.");
      actions.push("Alden, I make a reckless attack with my greataxe.");
      actions.push("Alden, I dodge.");
    } else {
      actions.push("Nyra, I cast Fire Bolt.");
      actions.push("Nyra, I cast Magic Missile.");
      actions.push("Nyra, I cast Hold Person.");
      actions.push("Nyra, I attack with my dagger.");
    }
    return actions.map(function (command) {
      return "<button class=\"secondary\" data-quick=\"" + escapeHtml(command) + "\">" + escapeHtml(quickActionLabel(command)) + "</button>";
    }).join("");
  }

  function quickActionLabel(command) {
    if (command === "Alden") {
      return "Claim Alden";
    }
    if (command === "Nyra") {
      return "Claim Nyra";
    }
    return command
      .replace(/^Alden,\s*/i, "")
      .replace(/^Nyra,\s*/i, "")
      .replace(/\.$/, "");
  }

  function sheetBox(title, items) {
    return "<section class=\"sheet-box\"><h3>" + title + "</h3><ul class=\"sheet-list\">" + items.map(function (item) {
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("") + "</ul></section>";
  }

  function getCharacter(id) {
    return state.session.characters[id];
  }

  function getOpponent(actorId) {
    return getCharacter(actorId === "alden" ? "nyra" : "alden");
  }

  function pickWeapon(actor, requested) {
    if (!requested) {
      return actor.equipment.primaryWeapon;
    }
    return actor.equipment.weapons.find(function (weapon) {
      return weapon.name.toLowerCase() === requested.toLowerCase();
    }) || actor.equipment.primaryWeapon;
  }

  function findSpell(actor, spellName) {
    return actor.spells.all.find(function (spell) {
      return spell.name.toLowerCase() === String(spellName || "").toLowerCase();
    });
  }

  function hasCondition(actor, name) {
    return actor.status.conditions.some(function (condition) {
      return condition.name === name;
    });
  }

  function findCondition(actor, name) {
    return actor.status.conditions.find(function (condition) {
      return condition.name === name;
    });
  }

  function upsertCondition(actor, condition) {
    actor.status.conditions = actor.status.conditions.filter(function (entry) {
      return entry.name !== condition.name;
    });
    actor.status.conditions.push(condition);
  }

  function hasResistance(actor, damageType) {
    if (actor.id === "alden" && actor.resources.rage && actor.resources.rage.active && ["bludgeoning", "piercing", "slashing"].includes(damageType)) {
      return true;
    }
    return actor.resistances.includes(damageType);
  }

  function getEffectiveSpeed(actor) {
    return hasCondition(actor, "Slowed") ? Math.max(0, actor.speed - 10) : actor.speed;
  }

  function rollSavingThrow(actor, ability, options) {
    const key = ability.toLowerCase();
    const bonus = actor.savingThrows[key];
    const dangerSense = options && options.dangerSense && actor.id === "alden" && key === "dex";
    const result = rollToHit(bonus, { advantage: !!dangerSense, disadvantage: false });
    result.bonus = bonus;
    return result;
  }

  function rollToHit(bonus, options) {
    const first = randomInt(1, 20);
    const second = options && (options.advantage || options.disadvantage) ? randomInt(1, 20) : null;
    const cancel = options && options.advantage && options.disadvantage;
    let chosen = first;
    if (cancel) {
      chosen = first;
    } else if (options && options.advantage) {
      chosen = Math.max(first, second);
    } else if (options && options.disadvantage) {
      chosen = Math.min(first, second);
    }
    return { total: chosen + bonus, rolls: second === null ? [first] : [first, second], isCritical: chosen === 20 };
  }

  function rollD20() {
    const roll = randomInt(1, 20);
    return { total: roll, rolls: [roll] };
  }

  function rollFormula(formula) {
    const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(formula.trim());
    if (!match) {
      throw new Error("Unsupported formula: " + formula);
    }
    const count = Number(match[1]);
    const sides = Number(match[2]);
    const modifier = match[3] ? Number(match[3]) : 0;
    const rolls = [];
    let total = modifier;
    for (let i = 0; i < count; i += 1) {
      const roll = randomInt(1, sides);
      rolls.push(roll);
      total += roll;
    }
    return { total: total, rolls: rolls, modifier: modifier };
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function downsampleToInt16(buffer, inputRate, targetRate) {
    if (inputRate === targetRate) {
      return floatTo16BitPCM(buffer);
    }
    const ratio = inputRate / targetRate;
    const length = Math.round(buffer.length / ratio);
    const result = new Float32Array(length);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
        accum += buffer[i];
        count += 1;
      }
      result[offsetResult] = accum / count;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }
    return floatTo16BitPCM(result);
  }

  function floatTo16BitPCM(floatArray) {
    const output = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, floatArray[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  }

  function similarity(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left || !right) {
      return 0;
    }
    if (left === right) {
      return 1;
    }
    return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  }

  function normalizeText(text) {
    return String(text).toLowerCase().replace(/[^a-z\s]/g, "").trim();
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i += 1) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j += 1) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i += 1) {
      for (let j = 1; j <= a.length; j += 1) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function prettifyStage(stage) {
    return stage.split("_").map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(" ");
  }

  function prettifyKey(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, function (match) {
      return match.toUpperCase();
    });
  }

  function formatModifier(value) {
    return value >= 0 ? "+" + value : String(value);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function roundDuration(value) {
    return Math.round(Number(value) || 0);
  }

  function summarizeForStatus(text) {
    const compact = String(text || "").replace(/\s+/g, " ").trim();
    if (compact.length <= 120) {
      return compact;
    }
    return compact.slice(-120);
  }

  function parseJsonLoose(raw) {
    const cleaned = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("Failed to load " + path);
    }
    return response.json();
  }

  async function fetchText(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("Failed to load " + path);
    }
    return response.text();
  }

  async function postJson(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error("POST failed for " + path + ": " + response.status);
    }
    return response.json();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  if (typeof window !== "undefined") {
    window.mountDndDemo = mountDndDemo;
    window.unmountDndDemo = unmountDndDemo;
  }
})();

export function mountDndDemo() {
  if (typeof window !== "undefined" && typeof window.mountDndDemo === "function") {
    window.mountDndDemo();
  }
}

export function unmountDndDemo() {
  if (typeof window !== "undefined" && typeof window.unmountDndDemo === "function") {
    window.unmountDndDemo();
  }
}
