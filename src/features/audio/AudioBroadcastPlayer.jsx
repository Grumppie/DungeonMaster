import React, { useEffect, useRef } from "react";

export function AudioBroadcastPlayer({ history = [] }) {
  const audioRef = useRef(null);
  const lastPlayedIdRef = useRef(null);
  const latest = [...history].reverse().find((entry) => entry?.audioUrl) || null;

  useEffect(() => {
    if (!latest?.audioUrl || !audioRef.current) {
      return;
    }
    const latestKey = latest._id || `${latest.createdAt}-${latest.speakerName}`;
    if (lastPlayedIdRef.current === latestKey) {
      return;
    }
    lastPlayedIdRef.current = latestKey;
    audioRef.current.src = latest.audioUrl;
    void audioRef.current.play().catch(() => {});
  }, [latest]);

  return <audio ref={audioRef} preload="auto" className="runtime-audio-player" />;
}
