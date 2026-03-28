import { useMemo } from "react";

import {
  selectActiveScene,
  selectSceneFacts,
  selectPartyHistory,
} from "./runtimeSelectors";
import {
  selectDmHistory,
  selectLatestDmMessage,
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
    dmHistoryItems,
    partyHistory,
    sceneFacts,
    transcriptAudioHistory,
    speakerName,
  };
}
