import React from "react";

function buildCellLabel(selectedCell) {
  if (!selectedCell) {
    return "Nothing selected";
  }
  return `Cell ${selectedCell.x},${selectedCell.y}`;
}

export function SceneFocusPanel({
  selectedCell,
  selectedCombatTarget,
  activeScene,
  combat,
  onSelectTarget,
  onClearSelection,
  onQuickPrompt,
}) {
  const combatant = selectedCell?.combatant || null;
  const interactable = selectedCell?.interactable || null;
  const target = combat?.combatants?.find((entry) => entry._id === selectedCombatTarget) || null;
  const objective = activeScene?.objective || "Explore the current scene.";

  function renderActions() {
    if (combatant) {
      const name = combatant.displayName || combatant.name;
      const enemy = combatant.side === "enemy";
      return (
        <div className="focus-actions">
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
            Read The Scene
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
        <div className="focus-actions">
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
      <div className="focus-actions">
        <button
          type="button"
          onClick={() =>
            onQuickPrompt({
              promptMode: "inspect",
              content: "I scan the area for the clearest lead.",
            })
          }
        >
          Find A Lead
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onQuickPrompt({
              promptMode: "ask",
              content: "What are my best options right now?",
            })
          }
        >
          What Next?
        </button>
      </div>
    );
  }

  return (
    <section className="panel runtime-focus-panel">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Focus</p>
          <h3>
            {combatant
              ? combatant.displayName || combatant.name
              : interactable
                ? interactable.label
                : buildCellLabel(selectedCell)}
          </h3>
        </div>
        {selectedCell ? (
          <button type="button" className="secondary" onClick={onClearSelection}>
            Clear
          </button>
        ) : null}
      </div>

      <p className="beta-copy">
        {combatant
          ? `${combatant.side === "enemy" ? "Enemy" : "Party member"} on the field. ${combatant.currentHp}/${combatant.maxHp} HP.`
          : interactable
            ? `This scene object can be ${interactable.interactionModes?.join(", ") || "inspected"}.`
            : `Tap a token or a marked object on the grid. Current objective: ${objective}`}
      </p>

      {target ? (
        <p className="focus-target-line">
          Current target: <strong>{target.displayName || target.name}</strong>
        </p>
      ) : null}

      {renderActions()}
    </section>
  );
}
