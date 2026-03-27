import React from "react";

export function RoomEntryPanel({
  busy,
  createCharacterName,
  sessionTitle,
  roomPrivacy,
  joinCharacterName,
  joinCodeInput,
  publicSessions,
  onCreateCharacterNameChange,
  onSessionTitleChange,
  onRoomPrivacyChange,
  onJoinCharacterNameChange,
  onJoinCodeInputChange,
  onCreateSession,
  onJoinSession,
}) {
  return (
    <section className="panel room-entry-shell">
      <div className="room-entry-grid">
        <article className="beta-panel room-entry-card">
          <p className="eyebrow">Create Room</p>
          <h2>Host A Session</h2>
          <label className="memory-field">
            <span>Character Name</span>
            <input value={createCharacterName} onChange={(event) => onCreateCharacterNameChange(event.target.value)} />
          </label>
          <label className="memory-field">
            <span>Session Title</span>
            <input value={sessionTitle} onChange={(event) => onSessionTitleChange(event.target.value)} />
          </label>
          <div className="privacy-toggle">
            <button
              type="button"
              className={roomPrivacy === "private" ? "active" : ""}
              onClick={() => onRoomPrivacyChange("private")}
            >
              Private
            </button>
            <button
              type="button"
              className={roomPrivacy === "public" ? "active" : ""}
              onClick={() => onRoomPrivacyChange("public")}
            >
              Public
            </button>
          </div>
          <button type="button" onClick={onCreateSession} disabled={busy === "create"}>
            {busy === "create" ? "Creating..." : "Create Room"}
          </button>
        </article>

        <article className="beta-panel room-entry-card">
          <p className="eyebrow">Join Room</p>
          <h2>Use Code Or Public Lobby</h2>
          <label className="memory-field">
            <span>Character Name</span>
            <input value={joinCharacterName} onChange={(event) => onJoinCharacterNameChange(event.target.value)} />
          </label>
          <label className="memory-field">
            <span>Join Code</span>
            <input value={joinCodeInput} onChange={(event) => onJoinCodeInputChange(event.target.value.toUpperCase())} />
          </label>
          <button type="button" onClick={() => onJoinSession(joinCodeInput)} disabled={busy === "join"}>
            {busy === "join" ? "Joining..." : "Join By Code"}
          </button>
        </article>
      </div>

      <article className="beta-panel public-room-card">
        <p className="eyebrow">Public Rooms</p>
        <h2>Open Sessions</h2>
        <div className="public-room-list">
          {publicSessions.length ? (
            publicSessions.map((room) => (
              <button
                key={room._id}
                type="button"
                className="public-room-item"
                onClick={() => onJoinSession(room.joinCode)}
                disabled={busy === "join"}
              >
                <strong>{room.title}</strong>
                <span>{room.hostCharacterName}</span>
                <span>{room.participantCount}/{room.maxPlayers} players</span>
              </button>
            ))
          ) : (
            <p className="beta-copy">No public rooms are open right now.</p>
          )}
        </div>
      </article>
    </section>
  );
}
