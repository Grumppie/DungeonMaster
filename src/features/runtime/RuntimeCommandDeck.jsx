import React from "react";

import { SceneObjectiveCard } from "../scene/SceneObjectiveCard";
import { SceneEventFeed } from "../scene/SceneEventFeed";
import { SceneProgressChips } from "../scene/SceneProgressChips";

export function RuntimeCommandDeck({
  sessionTitle,
  activeScene,
  sceneProgress,
  dmStatus,
  speakerName,
  combat,
  activeTranscript,
  latestDmMessage,
  sceneFacts,
}) {
  const progressHint = sceneProgress?.transitionUnlocked
    ? "The exit is unlocked. Move the party through the open anchor when you are ready."
    : !sceneProgress?.discoveryCompleted
      ? "Survey marked clues, landmarks, or NPCs until the party uncovers what matters here."
      : !sceneProgress?.commitmentCompleted
        ? "The key fact is known. Now commit to the route, object, or choice that changes the scene."
        : "Press the scene forward through the active route or anchor.";
  const nextStepText =
    dmStatus === "retrieving"
      ? "The DM is pulling the right rules and scene context."
      : dmStatus === "responding"
        ? "The DM is shaping the next reply from the current scene state."
        : dmStatus === "speaking"
          ? "The latest reply is being spoken now."
          : progressHint;

  return (
    <section className="panel runtime-command-deck">
      <SceneObjectiveCard activeScene={activeScene || { title: sessionTitle }} />
      <SceneProgressChips
        activeScene={activeScene}
        sceneProgress={sceneProgress}
        dmStatus={dmStatus}
        speakerName={speakerName}
        combat={combat}
      />

      <div className="runtime-command-grid">
        <div className="runtime-next-step">
          <p className="eyebrow">What To Do</p>
          <h3>{activeTranscript?.speakerName === "DM" ? "Follow the latest cue" : "Pick a clear action"}</h3>
          <p className="beta-copy">{nextStepText}</p>
        </div>
      </div>

      <SceneEventFeed sceneFacts={sceneFacts} />
    </section>
  );
}
