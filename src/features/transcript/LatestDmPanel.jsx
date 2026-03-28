import React from "react";

import { Button } from "@/components/ui/button";

export function LatestDmPanel({ latestDmMessage, dmStatus, onShare }) {
  if (!latestDmMessage?.content?.trim()) {
    return null;
  }

  return (
    <section className="panel runtime-latest-dm-panel">
      <div className="runtime-transcript-head">
        <div>
          <p className="eyebrow">Latest DM</p>
          <h3>{dmStatus !== "idle" ? `DM ${dmStatus}` : "DM latest reply"}</h3>
        </div>
        {latestDmMessage.visibility === "private" ? (
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onShare?.(latestDmMessage._id)}>
            Share with party
          </Button>
        ) : null}
      </div>
      <article className="runtime-transcript-item">
        <strong>{latestDmMessage.speakerLabel || "DM"}</strong>
        <p>{latestDmMessage.content}</p>
      </article>
    </section>
  );
}
