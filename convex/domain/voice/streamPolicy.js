export function shouldThrottleVoiceSynthesis({ recentEvents, disableThrottle = false }) {
  if (disableThrottle) {
    return false;
  }
  return (recentEvents || []).length >= 4;
}

export function findDuplicateRecentVoiceEvent({ recentEvents, transcript, provider, speakerName }) {
  return (recentEvents || []).find(
    (entry) =>
      entry.transcript === transcript &&
      entry.provider === provider &&
      entry.speakerName === speakerName,
  );
}
