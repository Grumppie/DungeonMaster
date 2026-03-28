export function getSceneFactLabel(entry) {
  switch (entry?.factType) {
    case "clue_reveal":
      return "Clue";
    case "unlock":
      return "Reveal";
    case "micro_scenario":
      return "Shift";
    case "stall_recovery":
      return "Nudge";
    case "commitment":
      return "Commitment";
    default:
      return "Scene";
  }
}

export function getSelectionTitle({ combatant, interactable }) {
  if (combatant) {
    return combatant.displayName || combatant.name;
  }
  if (interactable) {
    return interactable.label;
  }
  return "This spot";
}

export function getTranscriptStatusLabel(dmStatus) {
  if (dmStatus === "retrieving") {
    return "retrieving";
  }
  if (dmStatus === "responding") {
    return "speaking live";
  }
  if (dmStatus === "speaking") {
    return "voice syncing";
  }
  return "latest reply";
}
