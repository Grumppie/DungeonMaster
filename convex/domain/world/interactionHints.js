import { buildSceneMapLayout } from "../../../shared/mapTemplates";

function formatUnlock(unlock) {
  return String(unlock || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCompassDirection(fromX, fromY, toX, toY) {
  const horizontal = toX > fromX ? "east" : toX < fromX ? "west" : "";
  const vertical = toY > fromY ? "south" : toY < fromY ? "north" : "";

  if (horizontal && vertical) {
    return `${vertical}-${horizontal}`;
  }

  return horizontal || vertical || "here";
}

function getSceneLandmarks(scene) {
  if (scene?.landmarks?.length) {
    return scene.landmarks;
  }
  return buildSceneMapLayout(scene).landmarks || [];
}

function getNearestLandmark(scene, position) {
  const landmarks = getSceneLandmarks(scene);
  if (!position || !landmarks.length) {
    return null;
  }

  let best = null;
  for (const landmark of landmarks) {
    for (const [x, y] of landmark.cells || []) {
      const distance = Math.abs(position.x - x) + Math.abs(position.y - y);
      if (!best || distance < best.distance) {
        best = {
          name: landmark.name,
          distance,
          direction: getCompassDirection(position.x, position.y, x, y),
        };
      }
    }
  }

  return best;
}

function pickLeadInteractable(scene, sourceId, preferredKinds = []) {
  const candidates = (scene?.interactables || []).filter((entry) => entry.id !== sourceId);
  if (!candidates.length) {
    return null;
  }

  for (const kind of preferredKinds) {
    const match = candidates.find((entry) => entry.kind === kind);
    if (match) {
      return match;
    }
  }

  return candidates[0];
}

function pickDirectionalLead(scene, interactable, unlocks) {
  const normalizedUnlocks = unlocks.map((entry) => formatUnlock(entry).toLowerCase());
  const wantsRoute = normalizedUnlocks.some((entry) =>
    ["route", "door", "gate", "exit", "push"].some((token) => entry.includes(token)),
  );
  const wantsNpc = normalizedUnlocks.some((entry) =>
    ["plan", "witness", "survivor", "rival"].some((token) => entry.includes(token)),
  );

  const lead = pickLeadInteractable(
    scene,
    interactable.id,
    wantsRoute ? ["door", "npc_anchor", "clue"] : wantsNpc ? ["npc_anchor", "clue", "door"] : ["clue", "npc_anchor", "door"],
  );

  if (!lead?.position || !interactable?.position) {
    return null;
  }

  return {
    label: lead.label,
    kind: lead.kind,
    direction: getCompassDirection(
      interactable.position.x,
      interactable.position.y,
      lead.position.x,
      lead.position.y,
    ),
    distance:
      Math.abs(interactable.position.x - lead.position.x) +
      Math.abs(interactable.position.y - lead.position.y),
  };
}

function buildAtmosphereLine(interactable, nearestLandmark) {
  if (interactable.kind === "clue") {
    return nearestLandmark
      ? `${interactable.label} feels tied to ${nearestLandmark.name}, as if someone expected the clue to be read from that side of the room.`
      : `${interactable.label} bears just enough wear to suggest it matters, but not enough to explain itself outright.`;
  }

  if (interactable.kind === "npc_anchor") {
    return nearestLandmark
      ? `${interactable.label} keeps glancing toward ${nearestLandmark.name}, measuring whether the party has noticed the same thing.`
      : `${interactable.label} clearly knows more than they want to give away in a single breath.`;
  }

  if (interactable.kind === "door") {
    return `${interactable.label} is part of the scene's way forward, but it still reads as premature rather than ready.`;
  }

  return nearestLandmark
    ? `${interactable.label} sits in the shadow of ${nearestLandmark.name}, which makes it feel deliberately placed.`
    : `${interactable.label} gives back a useful detail, but not the whole answer.`;
}

function buildLeadLine(lead, unlocks) {
  if (!lead) {
    return null;
  }

  const unlockText = unlocks.length
    ? `The find suggests ${unlocks.map(formatUnlock).join(", ")}`
    : "What you find does not solve the scene, but it does narrow the next check";

  return `${unlockText}, and the pressure of it pulls attention ${lead.direction} toward ${lead.label}.`;
}

function buildTensionLine(interactable, unlocks) {
  if (unlocks.length) {
    return "It is enough to sharpen the party's read, but not enough to remove the need for a choice.";
  }

  if (interactable.kind === "npc_anchor") {
    return "You have the shape of a conversation now, not the full truth, so the next question still matters.";
  }

  return "It gives you a stronger angle on the room without flattening the mystery into an answer key.";
}

export function buildInteractionHintSummary(scene, interactable, unlocks = []) {
  const nearestLandmark = getNearestLandmark(scene, interactable.position);
  const lead = pickDirectionalLead(scene, interactable, unlocks);
  const parts = [
    buildAtmosphereLine(interactable, nearestLandmark),
    buildLeadLine(lead, unlocks),
    buildTensionLine(interactable, unlocks),
  ].filter(Boolean);

  return parts.join(" ");
}

export function buildStallRecoveryHint(scene) {
  const firstInteractable = (scene?.interactables || [])[0] || null;
  const lastInteractable = (scene?.interactables || []).slice(-1)[0] || null;
  const firstLandmark = getSceneLandmarks(scene)[0] || null;

  if (firstInteractable && lastInteractable && firstInteractable.id !== lastInteractable.id) {
    const direction = getCompassDirection(
      firstInteractable.position.x,
      firstInteractable.position.y,
      lastInteractable.position.x,
      lastInteractable.position.y,
    );
    return `The room's pressure starts to align between ${firstInteractable.label} and ${lastInteractable.label}, hinting that the meaningful push runs ${direction}.`;
  }

  if (firstInteractable && firstLandmark) {
    return `${firstInteractable.label} stands out more sharply against ${firstLandmark.name}, as if the room is quietly daring the party to test that angle next.`;
  }

  if (firstInteractable) {
    return `${firstInteractable.label} now feels like the kind of detail the room expects the party to press on.`;
  }

  return "A small shift in the room makes one route feel more promising, without settling the question for the party.";
}
