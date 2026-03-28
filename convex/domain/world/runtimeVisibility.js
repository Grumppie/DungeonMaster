export function isMessageVisibleToParticipant(message, participantId) {
  if (message.visibility !== "private") {
    return true;
  }
  if (!participantId) {
    return false;
  }
  return message.participantId === participantId || message.targetParticipantId === participantId;
}

export function normalizeVisibleMessages(messages, participantId) {
  return messages.filter((message) => isMessageVisibleToParticipant(message, participantId));
}

export function normalizeVisibleSceneFacts(sceneFacts, participantId) {
  return (sceneFacts || []).filter((fact) => {
    if (fact.isPublic) {
      return true;
    }
    if (!participantId) {
      return false;
    }
    return fact.targetParticipantId === participantId;
  });
}

export function normalizeVoiceEvents(voiceEvents, participantId) {
  return voiceEvents.filter((event) => {
    if (event.visibility !== "private") {
      return true;
    }
    if (!participantId) {
      return false;
    }
    return event.targetParticipantId === participantId;
  });
}
