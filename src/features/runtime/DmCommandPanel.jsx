import React from "react";

import { LatestDmPanel } from "../transcript/LatestDmPanel";

export function DmCommandPanel({
  currentParticipant,
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
    <section className="panel runtime-dm-lane compact">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">DM Command</p>
          <h3>Ask the DM or describe one clear scene action</h3>
        </div>
      </div>
      <div className="dm-command-tools">
        <button type="button" className="secondary" onClick={onOpenDmHistory}>
          DM History
        </button>
        <button type="button" className="secondary" onClick={onOpenPartyHistory}>
          Party History
        </button>
      </div>
      <form className="runtime-dm-form" onSubmit={onPromptSubmit}>
        <label className="memory-field">
          <span>{currentParticipant?.visibleName || "Player"} to DM</span>
          <textarea
            ref={promptInputRef}
            rows="2"
            value={promptDraft}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ask a direct question or describe one clear scene action."
          />
        </label>
        <button type="submit" disabled={busy === "scene:submit"}>
          {busy === "scene:submit" ? "Sending..." : dmStatus !== "idle" ? "Streaming..." : "Send"}
        </button>
      </form>
      <LatestDmPanel
        recentDmMessages={recentDmMessages}
        latestDmMessage={latestDmMessage}
        dmStatus={dmStatus}
        onPlay={onPlaySceneMessage}
        onShare={onShareSceneMessage}
      />
    </section>
  );
}
