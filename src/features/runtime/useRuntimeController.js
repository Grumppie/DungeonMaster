import { useMemo } from "react";

import {
  selectActiveScene,
  selectSceneFacts,
  selectPartyHistory,
} from "./runtimeSelectors";
import {
  selectActiveSceneOpeningMessage,
  selectDmHistory,
  selectLatestDmMessage,
  selectRecentDmMessages,
  selectSpeakerName,
  selectTranscriptAudioHistory,
} from "../transcript/transcriptSelectors";

export function useRuntimeController({ session, adventure, sceneRuntime }) {
  const activeScene = useMemo(
    () => selectActiveScene(sceneRuntime, adventure),
    [sceneRuntime, adventure],
  );
  const latestDmMessage = useMemo(
    () => selectLatestDmMessage(sceneRuntime),
    [sceneRuntime],
  );
  const recentDmMessages = useMemo(
    () => selectRecentDmMessages(sceneRuntime),
    [sceneRuntime],
  );
  const activeSceneOpeningMessage = useMemo(
    () => selectActiveSceneOpeningMessage(sceneRuntime, activeScene?._id),
    [activeScene?._id, sceneRuntime],
  );
  const dmHistoryItems = useMemo(
    () => selectDmHistory(sceneRuntime),
    [sceneRuntime],
  );
  const partyHistory = useMemo(
    () => selectPartyHistory(adventure),
    [adventure],
  );
  const sceneFacts = useMemo(
    () => selectSceneFacts(sceneRuntime),
    [sceneRuntime],
  );
  const transcriptAudioHistory = useMemo(
    () => selectTranscriptAudioHistory(sceneRuntime),
    [sceneRuntime],
  );
  const speakerName = useMemo(
    () => selectSpeakerName(session, sceneRuntime, latestDmMessage),
    [session, sceneRuntime, latestDmMessage],
  );

  return {
    activeScene,
    latestDmMessage,
    recentDmMessages,
    activeSceneOpeningMessage,
    dmHistoryItems,
    partyHistory,
    sceneFacts,
    transcriptAudioHistory,
    speakerName,
  };
}
