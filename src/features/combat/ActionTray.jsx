import React, { useMemo, useState } from "react";
import { GRID_FEET_PER_CELL } from "../../contracts/ui";
import { CombatPreviewPopover } from "./CombatPreviewPopover";
import { TurnTimer } from "./TurnTimer";

function getCombatantCoordinates(combatant) {
  return {
    xFeet: combatant.positionXFeet ?? combatant.positionFeet ?? 0,
    yFeet: combatant.positionYFeet ?? 0,
  };
}

function buildMovementOptions(controlledCombatant, combatants) {
  if (!controlledCombatant) {
    return [];
  }
  const occupiedPositions = new Set(
    combatants
      .filter((combatant) => combatant._id !== controlledCombatant._id && !combatant.isDead)
      .map((combatant) => {
        const position = getCombatantCoordinates(combatant);
        return `${position.xFeet}:${position.yFeet}`;
      }),
  );
  const actorPosition = getCombatantCoordinates(controlledCombatant);
  const options = [];
  for (let xFeet = 0; xFeet <= 55; xFeet += GRID_FEET_PER_CELL) {
    for (let yFeet = 0; yFeet <= 35; yFeet += GRID_FEET_PER_CELL) {
      const distanceFeet = Math.max(Math.abs(xFeet - actorPosition.xFeet), Math.abs(yFeet - actorPosition.yFeet));
      if (distanceFeet > controlledCombatant.speed) {
        continue;
      }
      const key = `${xFeet}:${yFeet}`;
      if ((xFeet !== actorPosition.xFeet || yFeet !== actorPosition.yFeet) && occupiedPositions.has(key)) {
        continue;
      }
      options.push({ xFeet, yFeet, key });
    }
  }
  return options;
}

function buildPreview(profile, actor, target) {
  if (!profile) {
    return null;
  }
  const areaTemplate = profile.name?.toLowerCase().includes("burning hands")
    ? "15 ft cone"
    : profile.name?.toLowerCase().includes("fireball")
      ? "20 ft radius"
      : "single target";
  return {
    name: profile.name,
    range: profile.rangeFeet || 5,
    areaTemplate,
    targetName: target ? target.displayName || target.name : actor.displayName || actor.name,
    formula: profile.damageFormula || profile.healFormula || "special",
  };
}

export function ActionTray({
  combat,
  controlledCombatant,
  selectedCombatTarget,
  selectedCell,
  onSelectTarget,
  onPerformCombatAction,
  onIssueCombatPreview,
  onConfirmCombatPreview,
  busy,
  onOpenSheet,
}) {
  const [pendingAction, setPendingAction] = useState(null);
  const [serverPreview, setServerPreview] = useState(null);
  const isMyTurn = combat?.currentCombatant?._id && controlledCombatant?._id === combat.currentCombatant._id;
  const target = useMemo(
    () => combat?.combatants?.find((combatant) => combatant._id === selectedCombatTarget) || null,
    [combat?.combatants, selectedCombatTarget],
  );
  const movementOptions = useMemo(
    () => buildMovementOptions(controlledCombatant, combat?.combatants || []),
    [combat?.combatants, controlledCombatant],
  );
  const preview = pendingAction?.profile ? buildPreview(pendingAction.profile, controlledCombatant, target) : null;
  if (!controlledCombatant) {
    return null;
  }

  async function confirmPendingAction() {
    if (!pendingAction && !serverPreview) {
      return;
    }
    if (serverPreview?.previewId) {
      await onConfirmCombatPreview(serverPreview.previewId);
      setPendingAction(null);
      setServerPreview(null);
      return;
    }

    if (pendingAction.type === "move") {
      const destinationXFeet = (selectedCell?.x ?? 0) * GRID_FEET_PER_CELL;
      const destinationYFeet = (selectedCell?.y ?? 0) * GRID_FEET_PER_CELL;
      const preview = await onIssueCombatPreview({
        type: "move",
        destinationXFeet,
        destinationYFeet,
      });
      setServerPreview(preview);
      return;
    }
  }

  async function requestActionPreview(actionDraft) {
    setPendingAction(actionDraft);
    const preview = await onIssueCombatPreview({
      type: actionDraft.type,
      profileKey: actionDraft.profile.key,
      targetCombatantId:
        actionDraft.profile.targetSide === "self" ? controlledCombatant._id : selectedCombatTarget,
    });
    setServerPreview(preview);
  }

  return (
    <section className="panel runtime-action-tray">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Actions</p>
          <h3>{isMyTurn ? "Choose, preview, confirm" : "Waiting for turn"}</h3>
        </div>
        <button type="button" className="secondary" onClick={onOpenSheet}>Sheet</button>
      </div>

      <div className="action-tray-status">
        <span className="status-pill">Target: {target ? target.displayName || target.name : "none"}</span>
        <span className="status-pill">Cell: {selectedCell ? `${selectedCell.x},${selectedCell.y}` : "none"}</span>
        <TurnTimer turnTimerEndsAt={combat?.encounter?.turnTimerEndsAt} />
      </div>

      <div className="runtime-action-groups">
        <div className="runtime-action-list">
          {(controlledCombatant.attackProfiles || []).map((profile) => (
            <button
              key={profile.key}
              type="button"
              disabled={!isMyTurn}
              onClick={() => requestActionPreview({ type: "attack", profile })}
            >
              {profile.name}
            </button>
          ))}
        </div>
        <div className="runtime-action-list">
          {(controlledCombatant.spellProfiles || []).map((profile) => (
            <button
              key={profile.key}
              type="button"
              disabled={!isMyTurn}
              onClick={() => requestActionPreview({ type: "castSpell", profile })}
            >
              {profile.name}
            </button>
          ))}
        </div>
        <div className="runtime-action-list">
          <button type="button" disabled={!isMyTurn} onClick={() => setPendingAction({ type: "move" })}>
            Move
          </button>
          <button type="button" disabled={!isMyTurn || busy === "combat:endTurn"} onClick={() => onPerformCombatAction({ type: "endTurn" })}>
            End Turn
          </button>
        </div>
      </div>

      <CombatPreviewPopover
        pendingAction={pendingAction}
        controlledCombatant={controlledCombatant}
        selectedCell={selectedCell}
        movementOptions={movementOptions}
        preview={preview}
        serverPreview={serverPreview}
        busy={busy}
        isMyTurn={isMyTurn}
        onCancel={() => {
          setPendingAction(null);
          setServerPreview(null);
        }}
        onConfirm={confirmPendingAction}
      />
    </section>
  );
}
