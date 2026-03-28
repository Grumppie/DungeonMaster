import React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function initialsFor(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">Lobby</Badge>
                <CardTitle className="font-heading text-3xl tracking-tight">{session.title}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Finalize archetypes, check party readiness, then let the host launch the generated run.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">{session.roomPrivacy}</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">Code {session.joinCode}</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {session.currentPlayerCount}/{session.maxPlayers}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Invite link</label>
              <Input readOnly value={shareUrl} className="h-11 rounded-2xl bg-background/70" />
            </div>
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Only character names are visible to other players.
            </div>
            {isHost ? (
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-2xl"
                onClick={onStartAdventure}
                disabled={!everyoneReady || busy === "start"}
              >
                {busy === "start" ? "Building run..." : "Start DM-generated run"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-3 py-1">Waiting for host</Badge>
                <span>The host controls when the run begins.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardHeader>
            <Badge variant="secondary" className="mb-2 w-fit rounded-full px-3 py-1">Party</Badge>
            <CardTitle className="font-heading text-2xl tracking-tight">Adventurers in room</CardTitle>
            <CardDescription className="text-sm leading-6">
              Anonymous players are represented only by character identity and archetype readiness.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {session.participants.map((participant) => (
              <article
                key={participant._id}
                className="flex items-center justify-between gap-4 rounded-3xl border border-border/60 bg-background/70 p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 border border-border/60">
                    <AvatarFallback>{initialsFor(participant.visibleName)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{participant.visibleName}</p>
                    <p className="text-sm text-muted-foreground">{participant.archetypeKey || "Choose an archetype"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <Badge variant={participant.archetypeKey ? "default" : "outline"} className="rounded-full px-3 py-1">
                    {participant.archetypeKey ? "Ready" : "Pending"}
                  </Badge>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {participant.presenceState}
                  </span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader>
          <Badge variant="secondary" className="mb-2 w-fit rounded-full px-3 py-1">Archetypes</Badge>
          <CardTitle className="font-heading text-2xl tracking-tight">Choose your character</CardTitle>
          <CardDescription className="text-sm leading-6">
            Pick the combat sheet you want bound to your player identity before the host launches the session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archetypes.map((archetype) => (
              <article
                key={archetype._id}
                className="flex h-full flex-col gap-4 rounded-3xl border border-border/60 bg-background/80 p-5"
              >
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">{archetype.role}</Badge>
                  <h3 className="font-heading text-xl tracking-tight">{archetype.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {archetype.race} {archetype.className}, level {archetype.level}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{archetype.shortSummary}</p>
                <ul className="grid gap-2 text-sm text-foreground/85">
                  {archetype.coreFeatures.map((feature) => (
                    <li key={feature} className="rounded-2xl bg-muted/25 px-3 py-2">
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  className="mt-auto rounded-2xl"
                  onClick={() => onChooseArchetype(archetype.key)}
                  disabled={busy.startsWith("pick:")}
                >
                  Pick {archetype.name}
                </Button>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
