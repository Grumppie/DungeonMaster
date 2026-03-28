import React from "react";

import { HistoryDrawer } from "../transcript/HistoryDrawer";

export function RuntimeHistoryModals({
  showDmHistory,
  showPartyHistory,
  dmHistoryItems,
  partyHistory,
  onCloseDmHistory,
  onClosePartyHistory,
}) {
  return (
    <>
      <HistoryDrawer
        title="DM History"
        open={showDmHistory}
        onClose={onCloseDmHistory}
        items={dmHistoryItems}
        emptyText="The DM history will appear here after narration or replies."
        renderItem={(entry) => (
          <article key={entry._id || `${entry.speakerLabel}-${entry.createdAt}`} className="runtime-transcript-item">
            <strong>{entry.speakerLabel}</strong>
            <p>{entry.content}</p>
          </article>
        )}
      />

      <HistoryDrawer
        title="Party History"
        open={showPartyHistory}
        onClose={onClosePartyHistory}
        items={partyHistory}
        emptyText="Completed scenes and encounter milestones appear here."
        renderItem={(scene) => (
          <article key={scene._id} className="runtime-history-item">
            <strong>{scene.title}</strong>
            <p>{scene.rewardPreview || scene.summary}</p>
          </article>
        )}
      />
    </>
  );
}
