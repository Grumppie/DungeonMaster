import { PLAYER_SHEETS } from "../../combat/sheets";

const EXPLICIT_ABILITY_PATTERNS = [
  /(?:^|\b)cast\s+([a-z][a-z' -]{2,40})/i,
  /(?:^|\b)use\s+([a-z][a-z' -]{2,40})/i,
  /(?:^|\b)activate\s+([a-z][a-z' -]{2,40})/i,
  /\b(misty step|fireball|magic missile|counterspell|dimension door|teleport|invisibility|shield of faith|healing word|sacred flame|burning hands|fire bolt|second wind|action surge|cunning action)\b/i,
];

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function listSheetProfiles(actorSheet) {
  return [...(actorSheet?.attackProfiles || []), ...(actorSheet?.spellProfiles || [])];
}

function resolveActorSheet(participant, combat) {
  const combatActor = combat?.combatants?.find((entry) => entry.participantId === participant?._id);
  if (combatActor) {
    return combatActor;
  }
  return participant?.archetypeKey ? PLAYER_SHEETS[participant.archetypeKey] || null : null;
}

function findSheetProfile(actorSheet, utteranceOrAbility) {
  const requested = normalizeName(utteranceOrAbility);
  if (!requested) {
    return null;
  }

  return listSheetProfiles(actorSheet).find((profile) => {
    const haystack = normalizeName(`${profile.key} ${profile.name}`);
    return haystack.includes(requested) || requested.includes(haystack);
  }) || null;
}

function extractExplicitAbility(utterance) {
  const text = String(utterance || "").trim();
  for (const pattern of EXPLICIT_ABILITY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function looksLikeAbilityUse(utterance) {
  const normalized = normalizeName(utterance);
  return (
    /\bcast\b/.test(normalized) ||
    /\bteleport\b/.test(normalized) ||
    /\bmisty step\b/.test(normalized) ||
    /\bfireball\b/.test(normalized) ||
    /\bmagic missile\b/.test(normalized)
  );
}

function buildOffSheetReply(actorSheet, requestedAbility) {
  const available = listSheetProfiles(actorSheet).map((profile) => profile.name);
  return [
    `${actorSheet.name} does not currently have ${requestedAbility || "that ability"} on the sheet.`,
    available.length ? `Available actions right now: ${available.join(", ")}.` : "No sheet actions were found for this character.",
    "Stay within the current sheet and describe a legal move, attack, or feature instead.",
  ].join(" ");
}

function buildCombatRedirectReply(actorSheet, matchedProfile) {
  return [
    `${matchedProfile?.name || "That action"} is on ${actorSheet.name}'s sheet, but combat abilities must go through the tactical controls.`,
    "Use the action tray to preview and confirm it so range, target, resources, and turn order stay authoritative.",
  ].join(" ");
}

export function evaluatePromptGuardrail({ participant, combat, utterance }) {
  const actorSheet = resolveActorSheet(participant, combat);
  if (!actorSheet) {
    return null;
  }

  const explicitAbility = extractExplicitAbility(utterance);
  const matchedProfile = findSheetProfile(actorSheet, explicitAbility || utterance);
  const isCombatActive = combat?.encounter?.status === "active";

  if (isCombatActive && matchedProfile) {
    return {
      blocked: true,
      reply: buildCombatRedirectReply(actorSheet, matchedProfile),
    };
  }

  if (!matchedProfile && (explicitAbility || looksLikeAbilityUse(utterance))) {
    return {
      blocked: true,
      reply: buildOffSheetReply(actorSheet, explicitAbility || "that ability"),
    };
  }

  return null;
}
