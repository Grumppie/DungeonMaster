import React, { useEffect, useMemo, useRef } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";

const SAMPLE_RATE = 24000;

function pcmWavHeader(dataLength, sampleRate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  return new Uint8Array(buffer);
}

function base64ToBytes(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function createWavUrlFromPcmChunks(chunks) {
  if (!chunks.length) {
    return null;
  }
  const pcm = concatBytes(chunks);
  const header = pcmWavHeader(pcm.length, SAMPLE_RATE);
  const wav = new Uint8Array(header.length + pcm.length);
  wav.set(header, 0);
  wav.set(pcm, header.length);
  return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
}

function extractSpeakableChunks(buffer, force = false) {
  const chunks = [];
  let remaining = buffer;

  while (remaining.length) {
    const sentenceMatch = remaining.match(/^([\s\S]*?[.!?])(\s+|$)/);
    if (sentenceMatch && sentenceMatch[1].trim().length >= 12) {
      chunks.push(sentenceMatch[1].trim());
      remaining = remaining.slice(sentenceMatch[0].length);
      continue;
    }

    const softBreakIndex = remaining.search(/[;:]\s/);
    if (softBreakIndex >= 48) {
      const chunk = remaining.slice(0, softBreakIndex + 1).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      remaining = remaining.slice(softBreakIndex + 1).trimStart();
      continue;
    }

    if (remaining.length >= 90) {
      const window = remaining.slice(0, 90);
      const splitAt = Math.max(window.lastIndexOf(" "), window.lastIndexOf("-"));
      const chunk = remaining.slice(0, splitAt > 48 ? splitAt : 90).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      remaining = remaining.slice(chunk.length).trimStart();
      continue;
    }

    if (force && remaining.trim()) {
      chunks.push(remaining.trim());
      remaining = "";
    }
    break;
  }

  return { chunks, remaining };
}

export function LiveDmAudioStreamer({ messageId, content, dmStatus, enabled = true }) {
  const createDeepgramToken = useAction(api.voice.createDeepgramToken);
  const synthesizeBrowserFallback = useAction(api.voice.synthesizeBrowserFallback);
  const audioRef = useRef(null);
  const socketRef = useRef(null);
  const objectUrlsRef = useRef([]);
  const playbackQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const blockedUrlRef = useRef(null);
  const currentAudioChunksRef = useRef([]);
  const processedContentRef = useRef("");
  const pendingTextRef = useRef("");
  const activeMessageIdRef = useRef(null);
  const tokenPromiseRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const sendQueueRef = useRef(Promise.resolve());
  const flushedMessageRef = useRef(false);
  const pendingPlaybackRetryRef = useRef(false);
  const hasReceivedAudioForMessageRef = useRef(false);
  const fallbackTriggeredForMessageRef = useRef(false);

  const shouldBeActive = enabled && !!messageId && !!content?.trim();
  const normalizedContent = useMemo(() => String(content || ""), [content]);

  function revokeObjectUrls() {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }

  function finalizeCurrentAudio() {
    if (!currentAudioChunksRef.current.length) {
      return;
    }
    const url = createWavUrlFromPcmChunks(currentAudioChunksRef.current);
    currentAudioChunksRef.current = [];
    enqueueAudioUrl(url);
  }

  function playNext() {
    if (isPlayingRef.current || !audioRef.current) {
      return;
    }
    const nextUrl = blockedUrlRef.current || playbackQueueRef.current.shift();
    if (!nextUrl) {
      return;
    }
    blockedUrlRef.current = nextUrl;
    if (audioRef.current.src !== nextUrl) {
      audioRef.current.src = nextUrl;
    }
    void audioRef.current
      .play()
      .then(() => {
        isPlayingRef.current = true;
        blockedUrlRef.current = null;
        pendingPlaybackRetryRef.current = false;
      })
      .catch(() => {
        isPlayingRef.current = false;
        pendingPlaybackRetryRef.current = true;
        console.warn("[voice] Browser blocked audio playback; waiting for the next user gesture.");
      });
  }

  function enqueueAudioUrl(url) {
    if (!url) {
      return;
    }
    objectUrlsRef.current.push(url);
    playbackQueueRef.current.push(url);
    playNext();
  }

  async function playFallbackSpeech(transcript) {
    if (!transcript?.trim() || fallbackTriggeredForMessageRef.current) {
      return;
    }
    fallbackTriggeredForMessageRef.current = true;
    try {
      const result = await synthesizeBrowserFallback({
        transcript,
        provider: "deepgram",
      });
      if (result?.audioUrl) {
        enqueueAudioUrl(result.audioUrl);
      }
    } catch (error) {
      console.error("[voice] Fallback DM synthesis failed.", error);
    }
  }

  function scheduleSilentFallback(forceTranscript) {
    window.clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = window.setTimeout(() => {
      if (hasReceivedAudioForMessageRef.current) {
        return;
      }
      void playFallbackSpeech(forceTranscript);
    }, 1500);
  }

  function scheduleChunkFinalize() {
    window.clearTimeout(finalizeTimeoutRef.current);
    finalizeTimeoutRef.current = window.setTimeout(() => {
      finalizeCurrentAudio();
    }, 180);
  }

  async function ensureSocket() {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }
    if (!tokenPromiseRef.current) {
      tokenPromiseRef.current = createDeepgramToken();
    }
    const token = await tokenPromiseRef.current;
    const wsUrl = `wss://api.deepgram.com/v1/speak?model=${encodeURIComponent("aura-2-thalia-en")}&encoding=linear16&sample_rate=${SAMPLE_RATE}&container=none`;
    const socket = new WebSocket(wsUrl, ["token", token.access_token]);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.addEventListener("message", async (event) => {
      if (event.data instanceof ArrayBuffer) {
        hasReceivedAudioForMessageRef.current = true;
        window.clearTimeout(fallbackTimeoutRef.current);
        currentAudioChunksRef.current.push(new Uint8Array(event.data));
        return;
      }

      if (typeof event.data === "string") {
        const text = event.data.trim();
        if (!text) {
          return;
        }
        if (text.startsWith("{")) {
          let payload;
          try {
            payload = JSON.parse(text);
          } catch {
            return;
          }
          if (payload.type === "Error" || payload.type === "Warning") {
            console.warn("[voice] Deepgram websocket event:", payload);
          }
          if (payload.type === "Flushed") {
            scheduleChunkFinalize();
          }
          return;
        }
        hasReceivedAudioForMessageRef.current = true;
        window.clearTimeout(fallbackTimeoutRef.current);
        currentAudioChunksRef.current.push(base64ToBytes(text));
        scheduleChunkFinalize();
        return;
      }

      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        hasReceivedAudioForMessageRef.current = true;
        window.clearTimeout(fallbackTimeoutRef.current);
        currentAudioChunksRef.current.push(new Uint8Array(arrayBuffer));
        scheduleChunkFinalize();
      }
    });

    socket.addEventListener("error", (error) => {
      console.error("[voice] Deepgram websocket error.", error);
    });

    socket.addEventListener("close", () => {
      socketRef.current = null;
      tokenPromiseRef.current = null;
    });

    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    return socket;
  }

  async function sendChunk(chunk) {
    const socket = await ensureSocket();
    socket.send(JSON.stringify({ type: "Speak", text: chunk }));
  }

  async function flushMessage() {
    if (flushedMessageRef.current) {
      return;
    }
    flushedMessageRef.current = true;
    const socket = await ensureSocket();
    socket.send(JSON.stringify({ type: "Flush" }));
    scheduleChunkFinalize();
  }

  async function sendChunks(chunks) {
    if (!chunks.length) {
      return;
    }
    try {
      for (const chunk of chunks) {
        sendQueueRef.current = sendQueueRef.current.then(() => sendChunk(chunk));
        await sendQueueRef.current;
      }
    } catch (error) {
      console.error("[voice] Failed to stream DM speech to Deepgram.", error);
      await playFallbackSpeech(chunks.join(" "));
    }
  }

  useEffect(() => {
    if (!shouldBeActive) {
      return undefined;
    }

    const isNewMessage = activeMessageIdRef.current !== messageId;
    if (isNewMessage) {
      processedContentRef.current = "";
      pendingTextRef.current = "";
      activeMessageIdRef.current = messageId;
      hasReceivedAudioForMessageRef.current = false;
      fallbackTriggeredForMessageRef.current = false;
      blockedUrlRef.current = null;
      flushedMessageRef.current = false;
      sendQueueRef.current = Promise.resolve();
      window.clearTimeout(fallbackTimeoutRef.current);
      window.clearTimeout(finalizeTimeoutRef.current);
      currentAudioChunksRef.current = [];
    }

    const force = dmStatus === "speaking" || dmStatus === "idle";
    const newContent = normalizedContent.slice(processedContentRef.current.length);
    if (newContent) {
      processedContentRef.current = normalizedContent;
      pendingTextRef.current += newContent;
    } else if (!force || !pendingTextRef.current.trim()) {
      return undefined;
    }

    const { chunks, remaining } = extractSpeakableChunks(pendingTextRef.current, force);
    pendingTextRef.current = remaining;
    void sendChunks(chunks);
    if (dmStatus === "idle" && normalizedContent.trim() && !pendingTextRef.current.trim()) {
      void flushMessage();
    }
    if (force && normalizedContent.trim()) {
      scheduleSilentFallback(normalizedContent);
    }

    return undefined;
  }, [dmStatus, messageId, normalizedContent, shouldBeActive]);

  useEffect(() => {
    function retryPlayback() {
      if (!pendingPlaybackRetryRef.current) {
        return;
      }
      pendingPlaybackRetryRef.current = false;
      playNext();
    }

    window.addEventListener("pointerdown", retryPlayback);
    window.addEventListener("keydown", retryPlayback);

    return () => {
      window.removeEventListener("pointerdown", retryPlayback);
      window.removeEventListener("keydown", retryPlayback);
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(finalizeTimeoutRef.current);
    window.clearTimeout(fallbackTimeoutRef.current);
    revokeObjectUrls();
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "Close" }));
      socketRef.current.close();
    }
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      className="runtime-audio-player"
      onEnded={() => {
        isPlayingRef.current = false;
        playNext();
      }}
    />
  );
}
