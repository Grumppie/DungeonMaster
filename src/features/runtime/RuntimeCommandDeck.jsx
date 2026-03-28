import React from "react";

import { SceneObjectiveCard } from "../scene/SceneObjectiveCard";
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
}) {
  const nextStepText =
    dmStatus === "retrieving"
      ? "The DM is pulling the right rules and scene context."
      : dmStatus === "responding"
        ? latestDmMessage?.content || "The DM is forming the response now."
        : dmStatus === "speaking"
          ? "The reply is ready and voice playback is being published."
          : latestDmMessage?.content ||
            "Tap the map, inspect a marked object, or choose a combat action from the tray.";

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
    </section>
  );
}
