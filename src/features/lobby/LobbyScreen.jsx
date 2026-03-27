import React from "react";

export function LobbyScreen({
  session,
  archetypes,
  currentUser,
  busy,
  onChooseArchetype,
  onStartAdventure,
}) {
  const isHost = currentUser?._id && session.hostUserId === currentUser._id;
  const activeParticipants = session.participants.filter((participant) => participant.status !== "left");
  const everyoneReady = activeParticipants.every((participant) => participant.archetypeKey);
  const shareUrl = `${window.location.origin}${window.location.pathname}?join=${session.joinCode}`;

  return (
    <div className="lobby-screen">
      <section className="panel lobby-session-card">
        <div>
          <p className="eyebrow">Lobby</p>
          <h2>{session.title}</h2>
        </div>
        <div className="overview-chips">
          <span className="status-pill">{session.roomPrivacy}</span>
          <span className="status-pill">Code {session.joinCode}</span>
          <span className="status-pill">{session.currentPlayerCount}/{session.maxPlayers}</span>
        </div>
        <label className="memory-field">
          <span>Invite Link</span>
          <input readOnly value={shareUrl} />
        </label>
        <div className="host-controls">
          <p className="beta-copy">Only character names are visible to other players.</p>
          {isHost ? (
            <button type="button" onClick={onStartAdventure} disabled={!everyoneReady || busy === "start"}>
              {busy === "start" ? "Building Run..." : "Start DM-Generated Run"}
            </button>
          ) : (
            <span className="status-pill">Waiting For Host</span>
          )}
        </div>
      </section>

      <section className="panel lobby-party-card">
        <p className="eyebrow">Party</p>
        <h2>Adventurers</h2>
        <div className="participant-list">
          {session.participants.map((participant) => (
            <article key={participant._id} className="participant-card">
              <strong>{participant.visibleName}</strong>
              <span>{participant.archetypeKey || "Choose an archetype"}</span>
              <span>{participant.presenceState}</span>
              <span>Status: {participant.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel beta-panel beta-wide">
        <p className="eyebrow">Archetypes</p>
        <h2>Choose Your Character</h2>
        <div className="archetype-grid">
          {archetypes.map((archetype) => (
            <article key={archetype._id} className="archetype-card">
              <p className="eyebrow">{archetype.role}</p>
              <h3>{archetype.name}</h3>
              <p className="beta-copy">
                {archetype.race} {archetype.className}, level {archetype.level}
              </p>
              <p className="beta-copy">{archetype.shortSummary}</p>
              <ul>
                {archetype.coreFeatures.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <button type="button" onClick={() => onChooseArchetype(archetype.key)} disabled={busy.startsWith("pick:")}>
                Pick {archetype.name}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
