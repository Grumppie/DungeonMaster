import React from "react";
import { LIVE_TRANSCRIPT_LIMIT } from "../../contracts/ui";
import { getTranscriptStatusLabel } from "../../lib/runtimeMappers";

function splitTranscriptLines(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function TranscriptLane({ content = "", speakerName = "DM", dmStatus = "idle" }) {
  const liveLines = splitTranscriptLines(content).slice(-LIVE_TRANSCRIPT_LIMIT);

  if (!liveLines.length) {
    return null;
  }

  const statusLabel = getTranscriptStatusLabel(dmStatus);

  return (
    <section className="runtime-transcript-overlay">
      <div className="runtime-transcript-overlay-head">
        <span className="eyebrow">Latest DM</span>
        <strong>{speakerName} {statusLabel}</strong>
      </div>
      <div className="runtime-transcript-list">
        {liveLines.map((line, index) => (
          <article
            key={`${speakerName}-${index}-${line.slice(0, 24)}`}
            className={`runtime-transcript-item ${index === liveLines.length - 1 ? "latest" : "compact"}`}
          >
            <strong>{speakerName}</strong>
            <p>{line}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
