import React, { useRef, useState } from "react";

import { PlayerHud } from "../hud/PlayerHud";
import { ActionTray } from "../combat/ActionTray";
import { SheetDrawer } from "../sheet/SheetDrawer";
import { AudioBroadcastPlayer } from "../audio/AudioBroadcastPlayer";
import { SelectionPopover } from "../map/SelectionPopover";
import { RuntimeHistoryModals } from "./RuntimeHistoryModals";
import { RuntimeCommandDeck } from "./RuntimeCommandDeck";
import { RuntimePlayfield } from "./RuntimePlayfield";
import { RuntimeRulesPanel } from "./RuntimeRulesPanel";
import { useRuntimeController } from "./useRuntimeController";

export function RuntimeShell({
  session,
  adventure,
  combat,
  sceneRuntime,
  currentParticipant,
  controlledCombatant,
  busy,
  activePage,
  searchQuery,
  searchResults,
  corpusSources,
  selectedCombatTarget,
  selectedCell,
  onSearchQueryChange,
  onSearch,
  onSelectTarget,
  onSelectCell,
  onPerformCombatAction,
  onIssueCombatPreview,
  onConfirmCombatPreview,
  onSubmitPrompt,
  onMovePlayerToken,
  onShareSceneMessage,
}) {
  const [promptDraft, setPromptDraft] = useState("");
  const [promptMode, setPromptMode] = useState("ask");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDmHistory, setShowDmHistory] = useState(false);
  const [showPartyHistory, setShowPartyHistory] = useState(false);
  const promptInputRef = useRef(null);

  const {
    activeScene,
    latestDmMessage,
    recentDmMessages,
    dmHistoryItems,
    partyHistory,
    sceneFacts,
    transcriptAudioHistory,
    speakerName,
  } = useRuntimeController({ session, adventure, sceneRuntime });
  const dmStatus = session?.dmStatus || "idle";

  async function handlePromptSubmit(event) {
    event.preventDefault();
    if (!promptDraft.trim()) {
      return;
    }
    await onSubmitPrompt({
      content: promptDraft,
      promptMode,
      visibility: "private",
    });
    setPromptDraft("");
  }

  async function handleQuickPrompt({ content, promptMode: nextPromptMode, sourceKind, sourceId, sourceLabel }) {
    if (!content?.trim()) {
      return;
    }
    setPromptMode(nextPromptMode || "ask");
    onSelectCell(null);
    await onSubmitPrompt({
      content,
      promptMode: nextPromptMode || "ask",
      visibility: "private",
      sourceKind,
      sourceId,
      sourceLabel,
    });
  }

  const activeTranscript = sceneRuntime?.liveTranscript?.slice(-1)?.[0] || null;

  if (activePage === "rules") {
    return (
      <RuntimeRulesPanel
        searchQuery={searchQuery}
        searchResults={searchResults}
        corpusSources={corpusSources}
        busy={busy}
        onSearchQueryChange={onSearchQueryChange}
        onSearch={onSearch}
      />
    );
  }

  return (
    <div className="runtime-shell" data-testid="runtime-shell-root">
      <RuntimeCommandDeck
        sessionTitle={session.title}
        activeScene={activeScene}
        sceneProgress={sceneRuntime?.sceneProgress}
        dmStatus={dmStatus}
        speakerName={speakerName}
        combat={combat}
        activeTranscript={activeTranscript}
        latestDmMessage={latestDmMessage}
        sceneFacts={sceneFacts}
      />

      <RuntimePlayfield
        session={session}
        currentParticipant={currentParticipant}
        combat={combat}
        activeScene={activeScene}
        mapInstance={sceneRuntime?.mapInstance}
        sceneProgress={sceneRuntime?.sceneProgress}
        selectedCell={selectedCell}
        onSelectCell={onSelectCell}
        onMovePlayerToken={onMovePlayerToken}
        selectedCombatTarget={selectedCombatTarget}
        onSelectTarget={onSelectTarget}
        speakerName={speakerName}
        promptDraft={promptDraft}
        promptInputRef={promptInputRef}
        busy={busy}
        dmStatus={dmStatus}
        latestDmMessage={latestDmMessage}
        recentDmMessages={recentDmMessages}
        onPromptChange={setPromptDraft}
        onPromptSubmit={handlePromptSubmit}
        onOpenDmHistory={() => setShowDmHistory(true)}
        onOpenPartyHistory={() => setShowPartyHistory(true)}
        onShareSceneMessage={onShareSceneMessage}
      />

      <AudioBroadcastPlayer history={transcriptAudioHistory} />

      <SelectionPopover
        selectedCell={selectedCell}
        selectedCombatTarget={selectedCombatTarget}
        activeScene={activeScene}
        combat={combat}
        onSelectTarget={onSelectTarget}
        onClose={() => onSelectCell(null)}
        onQuickPrompt={handleQuickPrompt}
      />

      <RuntimeHistoryModals
        showDmHistory={showDmHistory}
        showPartyHistory={showPartyHistory}
        dmHistoryItems={dmHistoryItems}
        partyHistory={partyHistory}
        onCloseDmHistory={() => setShowDmHistory(false)}
        onClosePartyHistory={() => setShowPartyHistory(false)}
      />

      <PlayerHud currentParticipant={currentParticipant} controlledCombatant={controlledCombatant} combat={combat} />

      <ActionTray
        combat={combat}
        controlledCombatant={controlledCombatant}
        selectedCombatTarget={selectedCombatTarget}
        selectedCell={selectedCell}
        onSelectTarget={onSelectTarget}
        onPerformCombatAction={onPerformCombatAction}
        onIssueCombatPreview={onIssueCombatPreview}
        onConfirmCombatPreview={onConfirmCombatPreview}
        busy={busy}
        onOpenSheet={() => setSheetOpen(true)}
      />

      <SheetDrawer combatant={controlledCombatant} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
