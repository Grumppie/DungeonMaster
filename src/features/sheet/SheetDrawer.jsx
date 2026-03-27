import React from "react";

export function SheetDrawer({ combatant, open, onClose }) {
  if (!open || !combatant) {
    return null;
  }

  return (
    <section className="panel runtime-sheet-drawer">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Sheet</p>
          <h3>{combatant.displayName || combatant.name}</h3>
        </div>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <div className="sheet-grid">
        <article><span>Level</span><strong>{combatant.level}</strong></article>
        <article><span>HP</span><strong>{combatant.currentHp}/{combatant.maxHp}</strong></article>
        <article><span>AC</span><strong>{combatant.armorClass}</strong></article>
        <article><span>Speed</span><strong>{combatant.speed} ft</strong></article>
      </div>
      <div className="sheet-list">
        <div>
          <p className="eyebrow">Attacks</p>
          {(combatant.attackProfiles || []).map((profile) => (
            <p key={profile.key} className="beta-copy">{profile.name} · {profile.damageFormula} · {profile.rangeFeet} ft</p>
          ))}
        </div>
        <div>
          <p className="eyebrow">Spells / Abilities</p>
          {(combatant.spellProfiles || []).map((profile) => (
            <p key={profile.key} className="beta-copy">{profile.name}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
