import { internal } from "../../_generated/api";
import { buildVoiceCacheKey, normalizeVoiceText } from "./cache";
import { synthesizeDeepgramAudio } from "./providers/deepgram";
import { synthesizeElevenLabsAudio } from "./providers/elevenlabs";
import { findDuplicateRecentVoiceEvent, shouldThrottleVoiceSynthesis } from "./streamPolicy";

export async function synthesizeAudioClip({ provider, transcript, voiceId }) {
  if (provider === "elevenlabs") {
    const clip = await synthesizeElevenLabsAudio({ transcript, voiceId });
    if (clip) {
      return clip;
    }
  }

  return synthesizeDeepgramAudio({
    transcript,
    voiceId: provider === "deepgram" ? voiceId : process.env.DEEPGRAM_VOICE || "aura-2-thalia-en",
  });
}

export async function synthesizeAndPersistVoiceEvent(ctx, args) {
  const transcript = normalizeVoiceText(args.transcript);
  const recentEvents = await ctx.runQuery(internal.voiceStore.getRecentVoiceEvents, {
    roomId: args.sessionId,
    since: Date.now() - 10000,
  });
  const duplicateRecent = findDuplicateRecentVoiceEvent({
    recentEvents,
    transcript,
    provider: args.provider,
    speakerName: args.speakerName,
  });
  const shouldThrottleAudio = shouldThrottleVoiceSynthesis({
    recentEvents,
    disableThrottle: args.disableThrottle,
  });
  const cacheKey = buildVoiceCacheKey({
    provider: args.provider,
    voiceId: args.voiceId,
    stylePrompt: args.stylePrompt,
    transcript,
  });
  const cached = await ctx.runQuery(internal.voiceStore.getVoiceCache, { cacheKey });
  let audioUrl = cached?.audioUrl;

  if (!audioUrl && !duplicateRecent && !shouldThrottleAudio) {
    audioUrl = await synthesizeAudioClip({
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
    sceneMessageId: args.sceneMessageId,
    speakerType: args.speakerType,
    speakerId: args.speakerId,
    speakerName: args.speakerName,
    transcript,
    provider: args.provider,
    voiceProfileKey: args.voiceProfileKey,
    audioCacheKey: audioUrl ? cacheKey : undefined,
    audioUrl: audioUrl || undefined,
    visibility: args.visibility,
    targetParticipantId: args.targetParticipantId,
  });

  return {
    cacheKey,
    audioUrl: audioUrl || null,
  };
}
