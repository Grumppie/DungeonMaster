import React from "react";
import { getSceneFactLabel } from "../../lib/runtimeMappers";

export function SceneEventFeed({ sceneFacts = [] }) {
  if (!sceneFacts.length) {
    return null;
  }

  return (
    <section className="runtime-scene-events">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Scene Feed</p>
          <h3>Recent reveals and shifts</h3>
        </div>
      </div>
      <div className="runtime-scene-event-list">
        {sceneFacts.map((entry) => (
          <article
            key={entry._id || `${entry.factType}-${entry.createdAt}`}
            className={`runtime-scene-event ${entry.isPublic ? "public" : "private"}`}
          >
            <strong>{getSceneFactLabel(entry)}</strong>
            <p>{entry.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
