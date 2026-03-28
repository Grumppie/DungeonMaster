function buildCellLabel(selectedCell) {
  if (!selectedCell) {
    return "this spot";
  }
  return "this spot";
}

export function buildSuggestedPrompt({ selectedCell, nextMode }) {
  const combatant = selectedCell?.combatant || null;
  const interactable = selectedCell?.interactable || null;

  if (nextMode === "ask") {
    if (interactable) {
      return `What should I understand about the ${interactable.label}?`;
    }
    if (combatant) {
      return `What matters most about ${combatant.displayName || combatant.name} right now?`;
    }
    return "What are my best options right now?";
  }

  if (nextMode === "inspect") {
    if (interactable) {
      return `I inspect the ${interactable.label}.`;
    }
    return `I inspect ${buildCellLabel(selectedCell)} carefully.`;
  }

  if (nextMode === "speak") {
    if (combatant) {
      return `I speak to ${combatant.displayName || combatant.name}.`;
    }
    return "I speak in character and address the scene directly.";
  }

  if (combatant) {
    return `I want to act on ${combatant.displayName || combatant.name}. What happens if I commit?`;
  }
  return "I declare my intent and commit to a clear action.";
}
