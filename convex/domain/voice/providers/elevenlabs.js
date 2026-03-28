import { bufferToDataUrl } from "../cache";

export async function synthesizeElevenLabsAudio({ transcript, voiceId }) {
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
