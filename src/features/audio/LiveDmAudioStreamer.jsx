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

    const softBreakIndex = remaining.search(/[,;:]\s/);
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
  const audioRef = useRef(null);
  const socketRef = useRef(null);
  const objectUrlsRef = useRef([]);
  const playbackQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioChunksRef = useRef([]);
  const processedContentRef = useRef("");
  const pendingTextRef = useRef("");
  const activeMessageIdRef = useRef(null);
  const tokenPromiseRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);
  const pendingPlaybackRetryRef = useRef(false);

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
    const nextUrl = playbackQueueRef.current.shift();
    if (!nextUrl) {
      return;
    }
    isPlayingRef.current = true;
    audioRef.current.src = nextUrl;
    void audioRef.current.play().catch(() => {
      isPlayingRef.current = false;
      pendingPlaybackRetryRef.current = true;
      playNext();
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

  async function ensureSocket() {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }
    if (!tokenPromiseRef.current) {
      tokenPromiseRef.current = createDeepgramToken();
    }
    const token = await tokenPromiseRef.current;
    const wsUrl = `wss://api.deepgram.com/v1/speak?model=${encodeURIComponent("aura-2-thalia-en")}&encoding=linear16&sample_rate=${SAMPLE_RATE}&token=${encodeURIComponent(token.access_token)}`;
    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.addEventListener("message", async (event) => {
      if (event.data instanceof ArrayBuffer) {
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
          if (payload.type === "Flushed") {
            window.clearTimeout(finalizeTimeoutRef.current);
            finalizeTimeoutRef.current = window.setTimeout(() => {
              finalizeCurrentAudio();
            }, 80);
          }
          return;
        }
        currentAudioChunksRef.current.push(base64ToBytes(text));
        return;
      }

      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        currentAudioChunksRef.current.push(new Uint8Array(arrayBuffer));
      }
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

  async function sendChunks(chunks) {
    if (!chunks.length) {
      return;
    }
    const socket = await ensureSocket();
    for (const chunk of chunks) {
      socket.send(JSON.stringify({ type: "Speak", text: chunk }));
      socket.send(JSON.stringify({ type: "Flush" }));
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
    }

    const newContent = normalizedContent.slice(processedContentRef.current.length);
    if (!newContent) {
      return undefined;
    }

    processedContentRef.current = normalizedContent;
    pendingTextRef.current += newContent;
    const force = dmStatus === "speaking" || dmStatus === "idle";
    const { chunks, remaining } = extractSpeakableChunks(pendingTextRef.current, force);
    pendingTextRef.current = remaining;
    void sendChunks(chunks);

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
