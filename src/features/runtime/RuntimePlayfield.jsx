import React from "react";

import { SceneGrid } from "../map/SceneGrid";
import { DmCommandPanel } from "./DmCommandPanel";

export function RuntimePlayfield({
  session,
  currentParticipant,
  combat,
  activeScene,
  mapInstance,
  sceneProgress,
  selectedCell,
  onSelectCell,
  onMovePlayerToken,
  selectedCombatTarget,
  onSelectTarget,
  speakerName,
  promptDraft,
  promptInputRef,
  busy,
  dmStatus,
  latestDmMessage,
  recentDmMessages,
  onPromptChange,
  onPromptSubmit,
  onOpenDmHistory,
  onOpenPartyHistory,
  onPlaySceneMessage,
  onShareSceneMessage,
}) {
  return (
    <section className="runtime-playfield">
      <SceneGrid
        key={activeScene?._id || "runtime-scene-grid"}
        participants={session?.participants || []}
        currentParticipantId={currentParticipant?._id}
        combat={combat}
        activeScene={activeScene}
        mapInstance={mapInstance}
        sceneProgress={sceneProgress}
        selectedCell={selectedCell}
        onSelectCell={onSelectCell}
        onMovePlayerToken={onMovePlayerToken}
        selectedCombatTarget={selectedCombatTarget}
        onSelectTarget={onSelectTarget}
        speakerName={speakerName}
      />

      <div className="runtime-sidecar">
        <DmCommandPanel
          currentParticipant={currentParticipant}
          promptDraft={promptDraft}
          promptInputRef={promptInputRef}
          busy={busy}
          dmStatus={dmStatus}
          latestDmMessage={latestDmMessage}
          recentDmMessages={recentDmMessages}
          onPromptChange={onPromptChange}
          onPromptSubmit={onPromptSubmit}
          onOpenDmHistory={onOpenDmHistory}
          onOpenPartyHistory={onOpenPartyHistory}
          onPlaySceneMessage={onPlaySceneMessage}
          onShareSceneMessage={onShareSceneMessage}
        />
      </div>
    </section>
  );
}
