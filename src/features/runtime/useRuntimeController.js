import { useMemo } from "react";

import {
  selectActiveScene,
  selectDmHistory,
  selectLatestDmMessage,
  selectNonDmTranscriptHistory,
  selectPartyHistory,
  selectSpeakerName,
} from "./runtimeSelectors";

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
  const nonDmTranscriptHistory = useMemo(
    () => selectNonDmTranscriptHistory(sceneRuntime),
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
    nonDmTranscriptHistory,
    speakerName,
  };
}
