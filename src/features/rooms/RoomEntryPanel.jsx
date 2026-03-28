import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RoomEntryPanel({
  busy,
  createCharacterName,
  sessionTitle,
  roomPrivacy,
  joinCharacterName,
  joinCodeInput,
  publicSessions,
  sessionPreview,
  onCreateCharacterNameChange,
  onSessionTitleChange,
  onRoomPrivacyChange,
  onJoinCharacterNameChange,
  onJoinCodeInputChange,
  onCreateSession,
  onJoinSession,
}) {
  return (
    <section className="grid gap-6">
      {sessionPreview ? (
        <Card className="border-primary/20 bg-primary/[0.04] shadow-sm">
          <CardHeader className="space-y-2">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Invite detected</Badge>
            <CardTitle className="font-heading text-2xl tracking-tight">{sessionPreview.title}</CardTitle>
            <CardDescription className="text-sm leading-6">
              This link opened room <strong>{sessionPreview.joinCode}</strong>. Choose a character name below and join before you can pick an archetype or enter the session.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">Create room</Badge>
              <CardTitle className="font-heading text-3xl tracking-tight">Host a live session</CardTitle>
              <CardDescription className="max-w-xl text-sm leading-6">
                Start a private party for friends or open a public table for drop-in players. Only character names are exposed in the room.
              </CardDescription>
            </div>
            <CardAction>
              <Tabs value={roomPrivacy} onValueChange={onRoomPrivacyChange} className="w-full md:w-[220px]">
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/50 p-1">
                  <TabsTrigger value="private" className="rounded-xl">Private</TabsTrigger>
                  <TabsTrigger value="public" className="rounded-xl">Public</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Character name</label>
              <Input
                value={createCharacterName}
                onChange={(event) => onCreateCharacterNameChange(event.target.value)}
                placeholder="Nagin"
                className="h-12 rounded-2xl bg-background/70"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Session title</label>
              <Input
                value={sessionTitle}
                onChange={(event) => onSessionTitleChange(event.target.value)}
                placeholder="The Snakes And Their Princess"
                className="h-12 rounded-2xl bg-background/70"
              />
            </div>
            <Button
              type="button"
              size="lg"
              className="mt-2 h-12 rounded-2xl"
              onClick={onCreateSession}
              disabled={busy === "create"}
            >
              {busy === "create" ? "Creating room..." : "Create room"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="space-y-2">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Join room</Badge>
            <CardTitle className="font-heading text-3xl tracking-tight">Enter with a code</CardTitle>
            <CardDescription className="text-sm leading-6">
              Jump straight into an existing room or browse the public queue below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Character name</label>
              <Input
                value={joinCharacterName}
                onChange={(event) => onJoinCharacterNameChange(event.target.value)}
                placeholder="Bulma"
                className="h-12 rounded-2xl bg-background/70"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Join code</label>
              <Input
                value={joinCodeInput}
                onChange={(event) => onJoinCodeInputChange(event.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="h-12 rounded-2xl bg-background/70 uppercase"
              />
            </div>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="mt-2 h-12 rounded-2xl"
              onClick={() => onJoinSession(joinCodeInput)}
              disabled={busy === "join" || sessionPreview?.status === "active" || sessionPreview?.status === "completed"}
            >
              {busy === "join"
                ? "Joining room..."
                : sessionPreview?.status === "active"
                  ? "Session already started"
                  : sessionPreview?.status === "completed"
                    ? "Session completed"
                    : "Join by code"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Public lobby</Badge>
          <CardTitle className="font-heading text-2xl tracking-tight">Open rooms</CardTitle>
          <CardDescription className="text-sm leading-6">
            Pick a live room with space available and enter under your character identity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {publicSessions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {publicSessions.map((room) => (
                <button
                  key={room._id}
                  type="button"
                  className="group flex flex-col gap-3 rounded-3xl border border-border/60 bg-background/70 p-5 text-left transition hover:border-primary/40 hover:bg-accent/10"
                  onClick={() => onJoinSession(room.joinCode)}
                  disabled={busy === "join"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-heading text-xl leading-tight">{room.title}</h3>
                      <p className="text-sm text-muted-foreground">{room.hostCharacterName}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {room.participantCount}/{room.maxPlayers}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Join code {room.joinCode}</span>
                    <span>{room.seatsOpen} seats open</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/25 px-6 py-10 text-center text-sm text-muted-foreground">
              No public rooms are open right now.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
