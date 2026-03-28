"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

import { synthesizeAndPersistVoiceEvent, synthesizeAudioClip } from "./domain/voice/broadcast";
import { normalizeVoiceText } from "./domain/voice/cache";

export { synthesizeAndPersistVoiceEvent };

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

export const synthesizeBrowserFallback = action({
  args: {
    transcript: v.string(),
    provider: v.optional(v.union(v.literal("deepgram"), v.literal("elevenlabs"))),
    voiceId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const transcript = normalizeVoiceText(args.transcript);
    if (!transcript) {
      return { audioUrl: null };
    }

    const audioUrl = await synthesizeAudioClip({
      provider: args.provider || "deepgram",
      transcript,
      voiceId: args.voiceId || process.env.DEEPGRAM_DM_VOICE || process.env.DEEPGRAM_VOICE || "aura-2-thalia-en",
    });

    return {
      audioUrl: audioUrl || null,
    };
  },
});
