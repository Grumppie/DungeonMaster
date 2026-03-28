import {
  createEncounterForScene as createEncounterForSceneState,
  loadCombatSnapshot as loadCombatSnapshotState,
  getActiveEncounterForSession as getActiveEncounterForSessionState,
  completeEncounter as completeEncounterState,
  activateCombatEncounter as activateCombatEncounterState,
  writeEvent as writeEncounterEvent,
} from "./state";

export const createEncounterForScene = createEncounterForSceneState;
export const loadCombatSnapshot = loadCombatSnapshotState;
export const getActiveEncounterForSession = getActiveEncounterForSessionState;
export const completeEncounter = completeEncounterState;
export const activateCombatEncounter = activateCombatEncounterState;
export const writeEvent = writeEncounterEvent;
