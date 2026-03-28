export function normalizeVoiceText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function buildVoiceCacheKey({ provider, voiceId, stylePrompt, transcript }) {
  return [
    provider,
    voiceId,
    normalizeVoiceText(stylePrompt || ""),
    normalizeVoiceText(transcript).toLowerCase(),
  ].join("::");
}

export function bufferToDataUrl(buffer, mimeType = "audio/mpeg") {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
}
