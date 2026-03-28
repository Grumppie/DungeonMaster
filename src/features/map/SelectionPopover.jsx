import React from "react";
import { getSelectionTitle } from "../../lib/runtimeMappers";

export function SelectionPopover({
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
  const investigationRule = interactable
    ? (activeScene?.investigationRules || []).find((rule) => rule.sourceId === interactable.id)
    : null;

  function renderActions() {
    if (combatant) {
      const name = combatant.displayName || combatant.name;
      const enemy = combatant.side === "enemy";
      return (
        <div className="selection-popover-actions">
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
                sourceKind: "combatant",
                sourceId: combatant._id,
                sourceLabel: name,
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
                sourceKind: "npc",
                sourceId: combatant._id,
                sourceLabel: name,
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
        <div className="selection-popover-actions">
          <button
            type="button"
            onClick={() =>
              onQuickPrompt({
                promptMode: mode === "speak" ? "speak" : "inspect",
                content: `I ${mode} the ${interactable.label}.`,
                sourceKind: "interactable",
                sourceId: interactable.id,
                sourceLabel: interactable.label,
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
                sourceKind: "interactable",
                sourceId: interactable.id,
                sourceLabel: interactable.label,
              })
            }
          >
            Ask DM
          </button>
        </div>
      );
    }

    return (
      <div className="selection-popover-actions">
        <button
          type="button"
          onClick={() =>
            onQuickPrompt({
              promptMode: "inspect",
              content: "I inspect this spot carefully for anything unusual.",
              sourceKind: "tile",
              sourceId: `${selectedCell.x}:${selectedCell.y}`,
              sourceLabel: "this spot",
            })
          }
        >
          Inspect Here
        </button>
      </div>
    );
  }

  return (
    <section className="panel selection-popover">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Selection</p>
          <h3>
            {getSelectionTitle({ combatant, interactable })}
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

      {interactable ? (
        <p className="focus-target-line">
          {investigationRule
            ? `This interaction can advance discovery${investigationRule.progressDelta ? ` (+${investigationRule.progressDelta})` : ""}.`
            : "This is a local interaction point on the current board."}
        </p>
      ) : null}

      {target ? (
        <p className="focus-target-line">
          Current target: <strong>{target.displayName || target.name}</strong>
        </p>
      ) : null}

      {renderActions()}
    </section>
  );
}
