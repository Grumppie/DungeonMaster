import React from "react";

import { LatestDmPanel } from "../transcript/LatestDmPanel";
import { TranscriptLane } from "../transcript/TranscriptLane";

export function DmCommandPanel({
  currentParticipant,
  promptRail,
  promptMode,
  promptDraft,
  promptInputRef,
  busy,
  dmStatus,
  latestDmMessage,
  onPromptModeClick,
  onPromptChange,
  onPromptSubmit,
  onOpenDmHistory,
  onOpenPartyHistory,
  onShareSceneMessage,
}) {
  return (
    <section className="panel runtime-dm-lane compact">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">DM Command</p>
          <h3>Ask for help or declare a scene action</h3>
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
      <div className="prompt-rail compact prompt-rail-inline">
        {promptRail.map((item) => (
          <button
            key={item.key}
            type="button"
            className={promptMode === item.key ? "active" : ""}
            onClick={() => onPromptModeClick(item.key)}
          >
            {item.label}
          </button>
        ))}
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
      <TranscriptLane
        content={latestDmMessage?.content || ""}
        speakerName={latestDmMessage?.speakerLabel || "DM"}
        dmStatus={dmStatus}
      />
      <LatestDmPanel
        latestDmMessage={latestDmMessage}
        dmStatus={dmStatus}
        onShare={onShareSceneMessage}
      />
    </section>
  );
}
