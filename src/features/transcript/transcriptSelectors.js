export function selectLatestDmMessage(sceneRuntime) {
  return [...(sceneRuntime?.messages || [])]
    .reverse()
    .find((message) => message.speakerType === "dm" && message.content?.trim());
}

export function selectDmHistory(sceneRuntime) {
  return (sceneRuntime?.messages || []).filter((message) => message.speakerType === "dm" && message.content?.trim());
}

export function selectTranscriptAudioHistory(sceneRuntime) {
  return (sceneRuntime?.transcriptHistory || []).filter((entry) => entry.audioUrl);
}

export function selectSpeakerName(session, sceneRuntime, latestDmMessage) {
  const dmStatus = session?.dmStatus || "idle";
  return ["retrieving", "responding", "speaking"].includes(dmStatus)
    ? latestDmMessage?.speakerLabel || "DM"
    : sceneRuntime?.liveTranscript?.slice(-1)?.[0]?.speakerName || latestDmMessage?.speakerLabel || "DM";
}
