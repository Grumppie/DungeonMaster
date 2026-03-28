export function projectParticipant(participant) {
  return {
    ...participant,
    visibleName: participant.characterName || participant.displayName,
  };
}

export function getDefaultScenePosition(seatIndex = 0) {
  return {
    sceneX: 1 + (seatIndex % 4),
    sceneY: 6 + Math.floor(seatIndex / 4),
  };
}

export function getNextSeatIndex(participants) {
  return participants.reduce((highest, participant) => Math.max(highest, participant.seatIndex ?? -1), -1) + 1;
}
