import React from "react";
import { SignInButton, UserButton } from "@clerk/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { RoomEntryPanel } from "./features/rooms/RoomEntryPanel";
import { LobbyScreen } from "./features/lobby/LobbyScreen";
import { RuntimeShell } from "./features/runtime/RuntimeShell";
import { useSessionRuntime } from "./features/runtime/useSessionRuntime";

function AuthGate() {
  return (
    <Card className="border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Authentication</Badge>
        <CardTitle className="font-heading text-2xl tracking-tight">Sign in to create or join a session</CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6">
          The multiplayer runtime uses Clerk and Convex. Sign in first, then create a room or jump in through a public table.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInButton mode="modal">
          <Button type="button" size="lg" className="rounded-2xl">Sign in</Button>
        </SignInButton>
      </CardContent>
    </Card>
  );
}

function ConvexAuthGate({ authDebug }) {
  return (
    <Card className="border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Backend auth</Badge>
        <CardTitle className="font-heading text-2xl tracking-tight">Connecting to Convex</CardTitle>
        <CardDescription className="text-sm leading-6">
          Your Clerk session is ready, but the Convex token handshake is still loading.
        </CardDescription>
      </CardHeader>
      {authDebug ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">Token source: {authDebug.tokenSource || "unknown"}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function BetaLobbyApp() {
  const runtime = useSessionRuntime();
  const { auth, data, state, actions } = runtime;
  const { session, currentParticipant } = data;
  const hasJoinedSession = Boolean(session && currentParticipant);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-6 md:px-6 xl:px-8">
      {!hasJoinedSession ? (
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,249,238,0.94))] p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <Badge variant="secondary" className="rounded-full px-3 py-1">Mobile-first multiplayer beta</Badge>
              <div className="space-y-3">
                <h1 className="font-heading text-4xl tracking-tight md:text-5xl">
                  Clash-Royale style D&amp;D runtime
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                  Create public or private rooms, keep real identity hidden behind character names, and drop into a DM-generated tactical run with a shared map, live DM speech, and fixed combat controls.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <Badge variant="outline" className="rounded-full px-3 py-1">React</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Convex</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">LangGraph</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Deepgram</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">ElevenLabs</Badge>
              {auth.isSignedIn ? <UserButton /> : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <Card className="border-border/60 bg-card/95 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Room</p>
                <h2 className="font-heading text-2xl tracking-tight">{session.title}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">{session.roomPrivacy}</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">Code {session.joinCode}</Badge>
                <Button
                  type="button"
                  variant={state.activePage === "runtime" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => actions.setActivePage("runtime")}
                >
                  Runtime
                </Button>
                <Button
                  type="button"
                  variant={state.activePage === "rules" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => actions.setActivePage("rules")}
                >
                  Rules
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">{auth.isSignedIn ? <UserButton /> : null}</div>
        </section>
      )}

      {!auth.isSignedIn ? <AuthGate /> : null}
      {auth.isSignedIn && !auth.isConvexAuthenticated ? <ConvexAuthGate authDebug={auth.authDebug} /> : null}

      {auth.isSignedIn && auth.isConvexAuthenticated ? (
        <div className="grid gap-4">
          {!hasJoinedSession ? (
            <RoomEntryPanel
              busy={state.busy}
              createCharacterName={state.createCharacterName}
              sessionTitle={state.sessionTitle}
              worldPrompt={state.worldPrompt}
              roomPrivacy={state.roomPrivacy}
              joinCharacterName={state.joinCharacterName}
              joinCodeInput={state.joinCodeInput}
              publicSessions={data.publicSessions}
              sessionPreview={session}
              onCreateCharacterNameChange={actions.setCreateCharacterName}
              onSessionTitleChange={actions.setSessionTitle}
              onWorldPromptChange={actions.setWorldPrompt}
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
              onShareSceneMessage={actions.handleShareSceneMessage}
            />
          )}

          {state.error ? (
            <Card className="border-destructive/25 bg-destructive/5 shadow-sm">
              <CardContent className="p-4" data-testid="app-error-banner">
                <p className="text-sm text-destructive">{state.error}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
