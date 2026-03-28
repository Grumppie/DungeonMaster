import React, { useEffect, useRef } from "react";

function getEntryKey(entry) {
  return entry?._id || `${entry?.createdAt}-${entry?.speakerName}-${entry?.transcript}`;
}

export function AudioBroadcastPlayer({ history = [] }) {
  const audioRef = useRef(null);
  const initializedRef = useRef(false);
  const queuedKeysRef = useRef(new Set());
  const pendingEntriesRef = useRef([]);
  const currentEntryRef = useRef(null);
  const awaitingGestureRef = useRef(false);

  function playNext() {
    if (!audioRef.current || currentEntryRef.current || !pendingEntriesRef.current.length) {
      return;
    }

    const nextEntry = pendingEntriesRef.current.shift();
    if (!nextEntry?.audioUrl) {
      playNext();
      return;
    }

    currentEntryRef.current = nextEntry;
    audioRef.current.src = nextEntry.audioUrl;
    void audioRef.current.play().catch(() => {
      awaitingGestureRef.current = true;
    });
  }

  useEffect(() => {
    const entries = (history || []).filter((entry) => entry?.audioUrl);
    if (!initializedRef.current) {
      for (const entry of entries) {
        queuedKeysRef.current.add(getEntryKey(entry));
      }
      initializedRef.current = true;
      return;
    }

    const unseenEntries = entries.filter((entry) => !queuedKeysRef.current.has(getEntryKey(entry)));
    for (const entry of unseenEntries) {
      queuedKeysRef.current.add(getEntryKey(entry));
      pendingEntriesRef.current.push(entry);
    }

    playNext();
  }, [history]);

  useEffect(() => {
    function retryPlayback() {
      if (!awaitingGestureRef.current || !audioRef.current || !currentEntryRef.current) {
        return;
      }
      awaitingGestureRef.current = false;
      void audioRef.current.play().catch(() => {
        awaitingGestureRef.current = true;
      });
    }

    window.addEventListener("pointerdown", retryPlayback);
    window.addEventListener("keydown", retryPlayback);

    return () => {
      window.removeEventListener("pointerdown", retryPlayback);
      window.removeEventListener("keydown", retryPlayback);
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      className="runtime-audio-player"
      onEnded={() => {
        currentEntryRef.current = null;
        awaitingGestureRef.current = false;
        playNext();
      }}
      onError={() => {
        currentEntryRef.current = null;
        awaitingGestureRef.current = false;
        playNext();
      }}
    />
  );
}
