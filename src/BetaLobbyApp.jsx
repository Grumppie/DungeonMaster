import React from "react";
import { SignInButton, UserButton } from "@clerk/react";

import { RoomEntryPanel } from "./features/rooms/RoomEntryPanel";
import { LobbyScreen } from "./features/lobby/LobbyScreen";
import { RuntimeShell } from "./features/runtime/RuntimeShell";
import { useSessionRuntime } from "./features/runtime/useSessionRuntime";

function AuthGate() {
  return (
    <div className="panel benchmark-notes">
      <p className="eyebrow">Authentication</p>
      <h2>Sign In To Create Or Join A Session</h2>
      <p>The multiplayer runtime uses Clerk + Convex. Sign in first, then create a room or join one from a code or public list.</p>
      <SignInButton mode="modal">
        <button type="button">Sign In</button>
      </SignInButton>
    </div>
  );
}

function ConvexAuthGate({ authDebug }) {
  return (
    <div className="panel benchmark-notes">
      <p className="eyebrow">Backend Auth</p>
      <h2>Connecting To Convex</h2>
      <p>Your Clerk session is ready, but the Convex token handshake is still loading.</p>
      {authDebug ? <p className="beta-copy">Token source: {authDebug.tokenSource || "unknown"}</p> : null}
    </div>
  );
}

export default function BetaLobbyApp() {
  const runtime = useSessionRuntime();
  const { auth, data, state, actions } = runtime;
  const { session } = data;

  return (
    <div className="react-demo-shell benchmark-home">
      {!session ? (
        <section className="overview-band">
          <div>
            <p className="eyebrow">Mobile-First Multiplayer Beta</p>
            <h1>Clash-Royale Style D&amp;D Runtime</h1>
            <p className="overview-copy">
              Create public or private rooms, keep player identity hidden behind character names, and drop into a DM-generated tactical run with a shared map, live transcript, and fixed combat controls.
            </p>
          </div>
          <div className="overview-chips">
            <span className="status-pill">React</span>
            <span className="status-pill">Convex</span>
            <span className="status-pill">LangGraph</span>
            <span className="status-pill">Deepgram</span>
            <span className="status-pill">ElevenLabs</span>
            {auth.isSignedIn ? <UserButton /> : null}
          </div>
        </section>
      ) : (
        <section className="runtime-topbar">
          <div className="panel session-runtime-header">
            <div>
              <p className="eyebrow">Room</p>
              <h2>{session.title}</h2>
            </div>
            <div className="overview-chips">
              <span className="status-pill">{session.roomPrivacy}</span>
              <span className="status-pill">Code {session.joinCode}</span>
              <button type="button" className={state.activePage === "runtime" ? "active" : ""} onClick={() => actions.setActivePage("runtime")}>Runtime</button>
              <button type="button" className={state.activePage === "rules" ? "active" : ""} onClick={() => actions.setActivePage("rules")}>Rules</button>
            </div>
          </div>
          <div className="runtime-user-slot">{auth.isSignedIn ? <UserButton /> : null}</div>
        </section>
      )}

      {!auth.isSignedIn ? <AuthGate /> : null}
      {auth.isSignedIn && !auth.isConvexAuthenticated ? <ConvexAuthGate authDebug={auth.authDebug} /> : null}

      {auth.isSignedIn && auth.isConvexAuthenticated ? (
        <div className="app-shell">
          {!session ? (
            <RoomEntryPanel
              busy={state.busy}
              createCharacterName={state.createCharacterName}
              sessionTitle={state.sessionTitle}
              roomPrivacy={state.roomPrivacy}
              joinCharacterName={state.joinCharacterName}
              joinCodeInput={state.joinCodeInput}
              publicSessions={data.publicSessions}
              onCreateCharacterNameChange={actions.setCreateCharacterName}
              onSessionTitleChange={actions.setSessionTitle}
              onRoomPrivacyChange={actions.setRoomPrivacy}
              onJoinCharacterNameChange={actions.setJoinCharacterName}
              onJoinCodeInputChange={actions.setJoinCodeInput}
              onCreateSession={actions.handleCreateSession}
              onJoinSession={actions.handleJoinSession}
            />
          ) : session.status === "lobby" ? (
            <LobbyScreen
              session={session}
              archetypes={data.archetypes}
              currentUser={data.currentUser}
              busy={state.busy}
              onChooseArchetype={actions.handleChooseArchetype}
              onStartAdventure={actions.handleStartAdventure}
            />
          ) : (
            <RuntimeShell
              session={session}
              adventure={data.adventure}
              combat={data.combat}
              sceneRuntime={data.sceneRuntime}
              currentParticipant={data.currentParticipant}
              controlledCombatant={data.controlledCombatant}
              busy={state.busy}
              activePage={state.activePage}
              searchQuery={state.searchQuery}
              searchResults={state.searchResults}
              corpusSources={data.corpusSources}
              selectedCombatTarget={state.selectedCombatTarget}
              selectedCell={state.selectedCell}
              onSearchQueryChange={actions.setSearchQuery}
              onSearch={actions.handleSearchCorpus}
              onSelectTarget={actions.setSelectedCombatTarget}
              onSelectCell={actions.setSelectedCell}
              onPerformCombatAction={actions.handlePerformCombatAction}
              onIssueCombatPreview={actions.handleIssueCombatPreview}
              onConfirmCombatPreview={actions.handleConfirmCombatPreview}
              onSubmitPrompt={actions.handleSubmitScenePrompt}
              onMovePlayerToken={actions.handleMovePlayerToken}
            />
          )}

          {state.error ? (
            <section className="panel beta-panel">
              <p className="beta-error">{state.error}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
