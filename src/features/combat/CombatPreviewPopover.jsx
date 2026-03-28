import React from "react";

export function CombatPreviewPopover({
  pendingAction,
  controlledCombatant,
  selectedCell,
  movementOptions,
  preview,
  serverPreview,
  busy,
  isMyTurn,
  onCancel,
  onConfirm,
}) {
  if (!pendingAction) {
    return null;
  }

  return (
    <article className="runtime-preview-card combat-preview-popover">
      <p className="eyebrow">Preview</p>
      {pendingAction.type === "move" ? (
        <>
          <h4>Move</h4>
          <p className="beta-copy">
            Choose a destination on the grid. Your speed is {controlledCombatant.speed} ft.
          </p>
          <p className="beta-copy">Selected destination: {selectedCell ? `${selectedCell.x},${selectedCell.y}` : "tap a grid cell"}</p>
          <p className="beta-copy">{movementOptions.length} reachable cells this turn.</p>
          {serverPreview?.summary ? <p className="beta-copy">{serverPreview.summary}</p> : null}
        </>
      ) : serverPreview ? (
        <>
          <h4>{serverPreview.profileKey || preview?.name}</h4>
          <p className="beta-copy">{serverPreview.reason}</p>
          <p className="beta-copy">Range: {serverPreview.rangeFeet || preview?.range} ft</p>
          <p className="beta-copy">
            Area: {serverPreview.areaTemplate?.shape || preview?.areaTemplate} {serverPreview.areaTemplate?.sizeFeet || ""}
          </p>
          <p className="beta-copy">Formula: {serverPreview.damageFormula || preview?.formula || "special"}</p>
        </>
      ) : null}
      <div className="runtime-preview-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={!isMyTurn || busy.startsWith("combat:")}>
          {busy.startsWith("combat:") ? "Resolving..." : "Confirm"}
        </button>
      </div>
    </article>
  );
}
