"use node";

import { action } from "./_generated/server";

import { internal } from "./_generated/api";

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildCacheKey({ provider, voiceId, stylePrompt, transcript }) {
  return [provider, voiceId, normalizeText(stylePrompt || ""), normalizeText(transcript).toLowerCase()].join("::");
}

function bufferToDataUrl(buffer, mimeType = "audio/mpeg") {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
}

async function synthesizeDeepgram({ transcript, voiceId }) {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: transcript }),
  });
  if (!response.ok) {
    return null;
  }
  return bufferToDataUrl(await response.arrayBuffer());
}

async function synthesizeElevenLabs({ transcript, voiceId }) {
  const apiKey = (process.env.ELEVENLABS_API_KEY || process.env.ELEVANLABS_API_KEY || "").trim();
  if (!apiKey || !voiceId) {
    return null;
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: transcript,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.7,
      },
    }),
  });
  if (!response.ok) {
    return null;
  }
  return bufferToDataUrl(await response.arrayBuffer());
}

async function synthesizeAudio({ provider, transcript, voiceId }) {
  if (provider === "elevenlabs") {
    const clip = await synthesizeElevenLabs({ transcript, voiceId });
    if (clip) {
      return clip;
    }
  }
  return synthesizeDeepgram({
    transcript,
    voiceId: provider === "deepgram" ? voiceId : process.env.DEEPGRAM_VOICE || "aura-2-thalia-en",
  });
}

export async function synthesizeAndPersistVoiceEvent(ctx, args) {
  const transcript = normalizeText(args.transcript);
  const recentEvents = await ctx.runQuery(internal.voiceStore.getRecentVoiceEvents, {
    roomId: args.sessionId,
    since: Date.now() - 10000,
  });
  const duplicateRecent = recentEvents.find(
    (entry) =>
      entry.transcript === transcript &&
      entry.provider === args.provider &&
      entry.speakerName === args.speakerName,
  );
  const shouldThrottleAudio = recentEvents.length >= 4;
  const cacheKey = buildCacheKey({
    provider: args.provider,
    voiceId: args.voiceId,
    stylePrompt: args.stylePrompt,
    transcript,
  });
  const cached = await ctx.runQuery(internal.voiceStore.getVoiceCache, { cacheKey });
  let audioUrl = cached?.audioUrl;

  if (!audioUrl && !duplicateRecent && !shouldThrottleAudio) {
    audioUrl = await synthesizeAudio({
      provider: args.provider,
      transcript,
      voiceId: args.voiceId,
    });
    if (audioUrl) {
      await ctx.runMutation(internal.voiceStore.persistVoiceCache, {
        cacheKey,
        provider: args.provider,
        voiceId: args.voiceId,
        transcript,
        stylePrompt: args.stylePrompt,
        audioUrl,
      });
    }
  }

  await ctx.runMutation(internal.sceneRuntime.persistVoiceEvent, {
    sessionId: args.sessionId,
    speakerType: args.speakerType,
    speakerId: args.speakerId,
    speakerName: args.speakerName,
    transcript,
    provider: args.provider,
    voiceProfileKey: args.voiceProfileKey,
    audioCacheKey: audioUrl ? cacheKey : undefined,
    audioUrl: audioUrl || undefined,
  });

  return {
    cacheKey,
    audioUrl: audioUrl || null,
  };
}

export const createDeepgramToken = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not configured.");
    }

    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl_seconds: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram temporary token grant failed: ${response.status} ${errorText}`);
    }

    return response.json();
  },
});
