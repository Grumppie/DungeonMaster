import React from "react";

function buildCellLabel(selectedCell) {
  if (!selectedCell) {
    return "Nothing selected";
  }
  return `Cell ${selectedCell.x},${selectedCell.y}`;
}

export function SelectionModal({
  selectedCell,
  selectedCombatTarget,
  activeScene,
  combat,
  onSelectTarget,
  onClose,
  onQuickPrompt,
}) {
  if (!selectedCell) {
    return null;
  }

  const combatant = selectedCell.combatant || null;
  const interactable = selectedCell.interactable || null;
  const target = combat?.combatants?.find((entry) => entry._id === selectedCombatTarget) || null;
  const objective = activeScene?.objective || "Explore the current scene.";

  function renderActions() {
    if (combatant) {
      const name = combatant.displayName || combatant.name;
      const enemy = combatant.side === "enemy";
      return (
        <div className="selection-modal-actions">
          {enemy ? (
            <button type="button" onClick={() => onSelectTarget(combatant._id)}>
              Set Target
            </button>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              onQuickPrompt({
                promptMode: "inspect",
                content: `I study ${name} and the immediate battlefield around them. What stands out?`,
              })
            }
          >
            Read
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              onQuickPrompt({
                promptMode: "speak",
                content: `I address ${name} directly.`,
              })
            }
          >
            Speak
          </button>
        </div>
      );
    }

    if (interactable) {
      const mode = interactable.interactionModes?.[0] || "inspect";
      const verb = mode === "speak" ? "Speak" : mode === "use" ? "Use" : mode === "loot" ? "Loot" : "Inspect";
      return (
        <div className="selection-modal-actions">
          <button
            type="button"
            onClick={() =>
              onQuickPrompt({
                promptMode: mode === "speak" ? "speak" : "inspect",
                content: `I ${mode} the ${interactable.label}.`,
              })
            }
          >
            {verb}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              onQuickPrompt({
                promptMode: "ask",
                content: `What exactly can I do with the ${interactable.label}?`,
              })
            }
          >
            Ask DM
          </button>
        </div>
      );
    }

    return (
      <div className="selection-modal-actions">
        <button
          type="button"
          onClick={() =>
            onQuickPrompt({
              promptMode: "inspect",
              content: `I inspect ${buildCellLabel(selectedCell)} carefully for anything unusual.`,
            })
          }
        >
          Inspect Here
        </button>
      </div>
    );
  }

  return (
    <div className="selection-modal-backdrop" onClick={onClose}>
      <section className="panel selection-modal" onClick={(event) => event.stopPropagation()}>
        <div className="runtime-transcript-head">
          <div>
            <p className="eyebrow">Selection</p>
            <h3>
              {combatant
                ? combatant.displayName || combatant.name
                : interactable
                  ? interactable.label
                  : buildCellLabel(selectedCell)}
            </h3>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="beta-copy">
          {combatant
            ? `${combatant.side === "enemy" ? "Enemy" : "Party member"} on the field. ${combatant.currentHp}/${combatant.maxHp} HP.`
            : interactable
              ? `This ${interactable.kind} can be ${interactable.interactionModes?.join(", ") || "inspected"}.`
              : `Use this space to investigate the terrain. Current objective: ${objective}`}
        </p>

        {target ? (
          <p className="focus-target-line">
            Current target: <strong>{target.displayName || target.name}</strong>
          </p>
        ) : null}

        {renderActions()}
      </section>
    </div>
  );
}
