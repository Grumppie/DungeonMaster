import React, { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

function shouldCollapseMessage(content) {
  const normalized = String(content || "").trim();
  return normalized.length > 220 || normalized.includes("\n");
}

export function LatestDmPanel({ recentDmMessages = [], latestDmMessage, dmStatus, onShare }) {
  const [expandedMessageIds, setExpandedMessageIds] = useState({});

  const messages = useMemo(() => {
    if (recentDmMessages?.length) {
      return recentDmMessages;
    }
    return latestDmMessage?.content?.trim() ? [latestDmMessage] : [];
  }, [latestDmMessage, recentDmMessages]);

  if (!messages.length) {
    return null;
  }

  function toggleExpanded(messageId) {
    setExpandedMessageIds((current) => ({
      ...current,
      [messageId]: !current[messageId],
    }));
  }

  return (
    <section className="panel runtime-latest-dm-panel">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">DM Replies</p>
          <h3>{dmStatus !== "idle" ? `DM ${dmStatus}` : "Recent replies"}</h3>
        </div>
      </div>
      <div className="runtime-transcript-list">
        {messages.map((message) => {
          const messageId = message._id || `${message.createdAt}-${message.content.slice(0, 24)}`;
          const isExpanded = Boolean(expandedMessageIds[messageId]);
          const canCollapse = shouldCollapseMessage(message.content);

          return (
            <article key={messageId} className="runtime-transcript-item latest">
              <div className="runtime-transcript-card-head">
                <strong>{message.speakerLabel || "DM"}</strong>
                {message.visibility === "private" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onShare?.(message._id)}
                  >
                    Share with party
                  </Button>
                ) : null}
              </div>
              <p className={`runtime-transcript-copy ${canCollapse && !isExpanded ? "clamped" : ""}`}>
                {message.content}
              </p>
              {canCollapse ? (
                <button
                  type="button"
                  className="runtime-transcript-toggle secondary"
                  onClick={() => toggleExpanded(messageId)}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
