import React, { useEffect, useRef } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { useVoiceUnlock } from "./useVoiceUnlock";

function getEntryKey(entry) {
  return entry?._id || `${entry?.createdAt}-${entry?.speakerName}-${entry?.transcript}`;
}

function getMessageKey(message) {
  return message?._id || `${message?.createdAt}-${message?.speakerLabel || "DM"}-${message?.content || ""}`;
}

export function AudioBroadcastPlayer({
  history = [],
  activeSceneId = null,
  sceneOpeningMessage = null,
  playRequest = null,
}) {
  const synthesizeBrowserFallback = useAction(api.voice.synthesizeBrowserFallback);
  const audioRef = useRef(null);
  const initializedRef = useRef(false);
  const queuedKeysRef = useRef(new Set());
  const pendingEntriesRef = useRef([]);
  const currentEntryRef = useRef(null);
  const awaitingGestureRef = useRef(false);
  const generatedAudioCacheRef = useRef(new Map());
  const pendingSynthesisRef = useRef(new Map());
  const handledPlayRequestIdsRef = useRef(new Set());
  const autoplayedSceneIdsRef = useRef(new Set());
  const playTokenRef = useRef(0);
  const { isVoiceUnlocked } = useVoiceUnlock();

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

  function interruptAndPlay(entry) {
    if (!audioRef.current || !entry?.audioUrl) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    currentEntryRef.current = entry;
    awaitingGestureRef.current = false;
    audioRef.current.src = entry.audioUrl;
    void audioRef.current.play().catch(() => {
      awaitingGestureRef.current = true;
    });
  }

  async function resolveGeneratedAudioUrl(message) {
    const messageKey = getMessageKey(message);
    if (generatedAudioCacheRef.current.has(messageKey)) {
      return generatedAudioCacheRef.current.get(messageKey);
    }
    if (pendingSynthesisRef.current.has(messageKey)) {
      return pendingSynthesisRef.current.get(messageKey);
    }

    const synthesisPromise = synthesizeBrowserFallback({
      transcript: message.content,
      provider: "deepgram",
    })
      .then((result) => {
        const audioUrl = result?.audioUrl || null;
        if (audioUrl) {
          generatedAudioCacheRef.current.set(messageKey, audioUrl);
        }
        return audioUrl;
      })
      .finally(() => {
        pendingSynthesisRef.current.delete(messageKey);
      });

    pendingSynthesisRef.current.set(messageKey, synthesisPromise);
    return synthesisPromise;
  }

  async function playGeneratedMessage(message) {
    if (!message?.content?.trim()) {
      return;
    }

    const playToken = ++playTokenRef.current;
    const audioUrl = await resolveGeneratedAudioUrl(message);
    if (!audioUrl || playToken !== playTokenRef.current) {
      return;
    }

    interruptAndPlay({
      _id: `generated-${getMessageKey(message)}`,
      audioUrl,
      speakerName: message.speakerLabel || "DM",
      transcript: message.content,
    });
  }

  useEffect(() => {
    if (!isVoiceUnlocked) {
      return;
    }
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
  }, [history, isVoiceUnlocked]);

  useEffect(() => {
    if (!playRequest?.id || !playRequest?.message) {
      return;
    }
    if (handledPlayRequestIdsRef.current.has(playRequest.id)) {
      return;
    }

    handledPlayRequestIdsRef.current.add(playRequest.id);
    void playGeneratedMessage(playRequest.message);
  }, [playRequest]);

  useEffect(() => {
    if (!activeSceneId || !sceneOpeningMessage?.content?.trim()) {
      return;
    }
    if (autoplayedSceneIdsRef.current.has(activeSceneId)) {
      return;
    }

    autoplayedSceneIdsRef.current.add(activeSceneId);
    const matchingOpeningAudio = (history || []).find(
      (entry) => entry.sceneMessageId === sceneOpeningMessage._id && entry.audioUrl,
    );

    if (matchingOpeningAudio?.audioUrl) {
      interruptAndPlay(matchingOpeningAudio);
      return;
    }

    void playGeneratedMessage(sceneOpeningMessage);
  }, [activeSceneId, history, sceneOpeningMessage]);

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
