import { bufferToDataUrl } from "../cache";

export async function synthesizeDeepgramAudio({ transcript, voiceId }) {
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
