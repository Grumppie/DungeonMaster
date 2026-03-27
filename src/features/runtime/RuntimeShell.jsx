import React, { useEffect, useMemo, useRef, useState } from "react";

import { SceneGrid } from "../map/SceneGrid";
import { TranscriptLane } from "../transcript/TranscriptLane";
import { PlayerHud } from "../hud/PlayerHud";
import { ActionTray } from "../combat/ActionTray";
import { SheetDrawer } from "../sheet/SheetDrawer";
import { AudioBroadcastPlayer } from "../audio/AudioBroadcastPlayer";
import { LiveDmAudioStreamer } from "../audio/LiveDmAudioStreamer";
import { SelectionModal } from "./SelectionModal";
import { HistoryModal } from "./HistoryModal";

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
}) {
  const [promptDraft, setPromptDraft] = useState("");
  const [promptMode, setPromptMode] = useState("ask");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDmHistory, setShowDmHistory] = useState(false);
  const [showPartyHistory, setShowPartyHistory] = useState(false);
  const promptInputRef = useRef(null);

  const activeScene = sceneRuntime?.activeScene || adventure?.scenes?.find((scene) => scene.status === "active") || null;
  const dmStatus = session?.dmStatus || "idle";
  const partyHistory = useMemo(
    () => (adventure?.scenes || []).filter((scene) => scene.status === "completed"),
    [adventure?.scenes],
  );
  const latestDmMessage = useMemo(
    () =>
      [...(sceneRuntime?.messages || [])]
        .reverse()
        .find((message) => message.speakerType === "dm" && message.content?.trim()),
    [sceneRuntime?.messages],
  );
  const dmHistoryItems = useMemo(
    () => (sceneRuntime?.messages || []).filter((message) => message.speakerType === "dm" && message.content?.trim()),
    [sceneRuntime?.messages],
  );
  const nonDmTranscriptHistory = useMemo(
    () => (sceneRuntime?.transcriptHistory || []).filter((entry) => entry.speakerType !== "dm"),
    [sceneRuntime?.transcriptHistory],
  );
  const speakerName =
    ["retrieving", "responding", "speaking"].includes(dmStatus)
      ? latestDmMessage?.speakerLabel || "DM"
      : sceneRuntime?.liveTranscript?.slice(-1)?.[0]?.speakerName || latestDmMessage?.speakerLabel || "DM";

  function buildSuggestedPrompt(nextMode) {
    const combatant = selectedCell?.combatant || null;
    const interactable = selectedCell?.interactable || null;

    if (nextMode === "ask") {
      if (interactable) {
        return `What should I understand about the ${interactable.label}?`;
      }
      if (combatant) {
        return `What matters most about ${combatant.displayName || combatant.name} right now?`;
      }
      return "What are my best options right now?";
    }

    if (nextMode === "inspect") {
      if (interactable) {
        return `I inspect the ${interactable.label}.`;
      }
      if (selectedCell) {
        return `I inspect cell ${selectedCell.x},${selectedCell.y} carefully.`;
      }
      return "I survey the scene for the clearest lead.";
    }

    if (nextMode === "speak") {
      if (combatant) {
        return `I speak to ${combatant.displayName || combatant.name}.`;
      }
      return "I speak in character and address the scene directly.";
    }

    if (combatant) {
      return `I want to act on ${combatant.displayName || combatant.name}. What happens if I commit?`;
    }
    return "I declare my intent and commit to a clear action.";
  }

  function handlePromptModeClick(nextMode) {
    setPromptMode(nextMode);
    setPromptDraft(buildSuggestedPrompt(nextMode));
    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.setSelectionRange?.(
        promptInputRef.current.value.length,
        promptInputRef.current.value.length,
      );
    });
  }

  async function handlePromptSubmit(event) {
    event.preventDefault();
    if (!promptDraft.trim()) {
      return;
    }
    await onSubmitPrompt({
      content: promptDraft,
      promptMode,
    });
    setPromptDraft("");
  }

  async function handleQuickPrompt({ content, promptMode: nextPromptMode }) {
    if (!content?.trim()) {
      return;
    }
    setPromptMode(nextPromptMode || "ask");
    onSelectCell(null);
    await onSubmitPrompt({
      content,
      promptMode: nextPromptMode || "ask",
    });
  }

  const activeTranscript = sceneRuntime?.liveTranscript?.slice(-1)?.[0] || null;
  const nextStepText =
    dmStatus === "retrieving"
      ? "The DM is pulling the right rules and scene context."
      : dmStatus === "responding"
        ? latestDmMessage?.content || "The DM is forming the response now."
        : dmStatus === "speaking"
          ? "The reply is ready and voice playback is being published."
          : latestDmMessage?.content || "Tap the map, inspect a marked object, or choose a combat action from the tray.";

  if (activePage === "rules") {
    return (
      <section className="panel runtime-rules-panel">
        <div className="runtime-transcript-head">
          <div>
            <p className="eyebrow">Rules</p>
            <h2>Corpus Lookup</h2>
          </div>
        </div>
        <div className="corpus-search-panel">
          <label className="memory-field">
            <span>Lookup</span>
            <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} />
          </label>
          <button type="button" onClick={onSearch} disabled={busy === "search"}>{busy === "search" ? "Searching..." : "Search Corpus"}</button>
        </div>
        <div className="corpus-source-list">
          {corpusSources.map((source) => (
            <article key={source._id} className="corpus-source-card">
              <strong>{source.sourceLabel}</strong>
              <span>{source.rulesDomain}</span>
              <span>{source.chunkCount} chunks</span>
            </article>
          ))}
        </div>
        <div className="search-result-list">
          {searchResults.map((result, index) => (
            <article key={`${result.sourceKey}-${index}`} className="search-result-card">
              <strong>{result.sourceLabel}</strong>
              <p className="beta-copy">{result.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="runtime-shell">
      <section className="panel runtime-command-deck">
        <div className="runtime-scene-brief">
          <div>
            <p className="eyebrow">Current Scene</p>
            <h1>{activeScene?.title || session.title}</h1>
            <p className="beta-copy">{activeScene?.summary || "The run has not started yet."}</p>
          </div>
          <div className="overview-chips">
            <span className="status-pill">{activeScene?.objective || "No objective yet"}</span>
            <span className="status-pill">Speaker: {speakerName}</span>
            {dmStatus !== "idle" ? <span className="status-pill active-turn">DM {dmStatus}</span> : null}
            {combat?.encounter?.turnTimerEndsAt ? <span className="status-pill active-turn">Turn live</span> : null}
          </div>
        </div>

        <div className="runtime-command-grid">
          <div className="runtime-next-step">
            <p className="eyebrow">What To Do</p>
            <h3>{activeTranscript?.speakerName === "DM" ? "Follow the latest cue" : "Pick a clear action"}</h3>
            <p className="beta-copy">{nextStepText}</p>
          </div>
        </div>
      </section>

      <section className="runtime-playfield">
        <SceneGrid
          participants={session?.participants || []}
          currentParticipantId={currentParticipant?._id}
          combat={combat}
          activeScene={activeScene}
          selectedCell={selectedCell}
          onSelectCell={onSelectCell}
          onMovePlayerToken={onMovePlayerToken}
          selectedCombatTarget={selectedCombatTarget}
          onSelectTarget={onSelectTarget}
          speakerName={speakerName}
        />

        <div className="runtime-sidecar">
          <section className="panel runtime-dm-lane compact">
            <div className="runtime-transcript-head">
              <div>
                <p className="eyebrow">DM Command</p>
                <h3>Ask for help or declare a scene action</h3>
              </div>
            </div>
            <div className="dm-command-tools">
              <button type="button" className="secondary" onClick={() => setShowDmHistory(true)}>DM History</button>
              <button type="button" className="secondary" onClick={() => setShowPartyHistory(true)}>Party History</button>
            </div>
            <div className="prompt-rail compact prompt-rail-inline">
              {(sceneRuntime?.promptRail || []).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={promptMode === item.key ? "active" : ""}
                  onClick={() => handlePromptModeClick(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form className="runtime-dm-form" onSubmit={handlePromptSubmit}>
              <label className="memory-field">
                <span>{currentParticipant?.visibleName || "Player"} to DM</span>
                <textarea
                  ref={promptInputRef}
                  rows="2"
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  placeholder="Ask a direct question or describe one clear scene action."
                />
              </label>
              <button type="submit" disabled={busy === "scene:submit"}>
                {busy === "scene:submit" ? "Sending..." : dmStatus !== "idle" ? "Streaming..." : "Send"}
              </button>
            </form>
            <TranscriptLane
              content={latestDmMessage?.content || ""}
              speakerName={latestDmMessage?.speakerLabel || "DM"}
              dmStatus={dmStatus}
            />
          </section>
        </div>
      </section>

      <LiveDmAudioStreamer
        messageId={latestDmMessage?._id}
        content={latestDmMessage?.content || ""}
        dmStatus={dmStatus}
        enabled={Boolean(latestDmMessage?.content?.trim())}
      />

      <AudioBroadcastPlayer history={nonDmTranscriptHistory} />

      <SelectionModal
        selectedCell={selectedCell}
        selectedCombatTarget={selectedCombatTarget}
        activeScene={activeScene}
        combat={combat}
        onSelectTarget={onSelectTarget}
        onClose={() => onSelectCell(null)}
        onQuickPrompt={handleQuickPrompt}
      />

      <HistoryModal
        title="DM History"
        open={showDmHistory}
        onClose={() => setShowDmHistory(false)}
        items={dmHistoryItems}
        emptyText="The DM history will appear here after narration or replies."
        renderItem={(entry) => (
          <article key={entry._id || `${entry.speakerLabel}-${entry.createdAt}`} className="runtime-transcript-item">
            <strong>{entry.speakerLabel}</strong>
            <p>{entry.content}</p>
          </article>
        )}
      />

      <HistoryModal
        title="Party History"
        open={showPartyHistory}
        onClose={() => setShowPartyHistory(false)}
        items={partyHistory}
        emptyText="Completed scenes and encounter milestones appear here."
        renderItem={(scene) => (
          <article key={scene._id} className="runtime-history-item">
            <strong>{scene.title}</strong>
            <p>{scene.rewardPreview || scene.summary}</p>
          </article>
        )}
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
