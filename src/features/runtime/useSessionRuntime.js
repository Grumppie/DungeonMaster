import { useEffect, useMemo, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/react";

import { api } from "../../../convex/_generated/api";
import { useAuthDebug } from "../../providers/AppProviders";
import { useJoinCodeState, useSessionPageState } from "./runtimeUrlState";
import { useRuntimeLifecycle } from "./useRuntimeLifecycle";
import { useRuntimeHandlers } from "./useRuntimeHandlers";

export function useSessionRuntime() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const authDebug = useAuthDebug();

  const syncUser = useMutation(api.users.sync);
  const ensureDefaults = useMutation(api.archetypes.ensureDefaults);
  const createSession = useMutation(api.sessions.create);
  const joinSession = useMutation(api.sessions.join);
  const chooseArchetype = useMutation(api.sessions.chooseArchetype);
  const startAdventureFallback = useMutation(api.sessions.startAdventure);
  const performCombatAction = useMutation(api.combat.performAction);
  const issueCombatPreview = useMutation(api.combat.issuePreview);
  const confirmCombatPreview = useMutation(api.combat.confirmPreview);
  const primeEncounter = useMutation(api.combat.primeEncounter);
  const searchCorpus = useAction(api.corpusActions.search);
  const submitScenePrompt = useMutation(api.sceneRuntime.submitPlayerPrompt);
  const movePlayerToken = useMutation(api.sceneRuntime.movePlayerToken);
  const shareSceneMessage = useMutation(api.sceneRuntime.shareSceneMessage);
  const respondToScenePrompt = useAction(api.sceneRuntimeActions.respondToPrompt);
  const startAdventure = useAction(api.worldDirectorActions.startAdventureFromGraph);
  const updatePresence = useMutation(api.sessions.updatePresence);

  const archetypes = useQuery(api.archetypes.list) || [];
  const corpusSources = useQuery(api.corpus.listSources) || [];
  const currentUser = useQuery(api.users.current);
  const publicSessions = useQuery(api.sessions.listPublic) || [];

  const [joinCode, setJoinCode] = useJoinCodeState();
  const [activePage, setActivePage] = useSessionPageState();
  const [createCharacterName, setCreateCharacterName] = useState("");
  const [sessionTitle, setSessionTitle] = useState("The Broken Cartographer");
  const [worldPrompt, setWorldPrompt] = useState("");
  const [roomPrivacy, setRoomPrivacy] = useState("private");
  const [joinCharacterName, setJoinCharacterName] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState(joinCode);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selectedCombatTarget, setSelectedCombatTarget] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);

  const session = useQuery(api.sessions.getByJoinCode, joinCode ? { joinCode } : "skip");
  const adventure = useQuery(
    api.sessions.getAdventure,
    session ? { sessionId: session._id } : "skip",
  );
  const combat = useQuery(api.combat.getForSession, session ? { sessionId: session._id } : "skip");
  const sceneRuntime = useQuery(
    api.sceneRuntime.getForSession,
    session ? { sessionId: session._id } : "skip",
  );

  const currentParticipant = useMemo(() => {
    if (!session || !currentUser?._id) {
      return null;
    }
    return session.participants.find((participant) => participant.userId === currentUser._id) || null;
  }, [currentUser?._id, session]);

  const activeScene = useMemo(() => {
    return sceneRuntime?.activeScene || adventure?.scenes?.find((scene) => scene.status === "active") || null;
  }, [adventure?.scenes, sceneRuntime?.activeScene]);

  const currentCombatant = combat?.currentCombatant || null;
  const controlledCombatant = useMemo(() => {
    if (!combat?.combatants?.length || !currentParticipant?._id) {
      return null;
    }
    return combat.combatants.find((combatant) => combatant.participantId === currentParticipant._id) || null;
  }, [combat?.combatants, currentParticipant?._id]);

  useRuntimeLifecycle({
    isLoaded,
    isSignedIn,
    isConvexAuthenticated,
    isConvexAuthLoading,
    syncUser,
    ensureDefaults,
    updatePresence,
    session,
    combat,
    activePage,
    setActivePage,
    primeEncounter,
    setError,
  });

  const handlers = useRuntimeHandlers({
    session,
    createSession,
    joinSession,
    chooseArchetype,
    startAdventure,
    startAdventureFallback,
    performCombatAction,
    issueCombatPreview,
    confirmCombatPreview,
    searchCorpus,
    submitScenePrompt,
    movePlayerToken,
    shareSceneMessage,
    respondToScenePrompt,
    sessionTitle,
    createCharacterName,
    roomPrivacy,
    worldPrompt,
    joinCharacterName,
    joinCodeInput,
    searchQuery,
    setJoinCode,
    setBusy,
    setError,
    setSearchResults,
    setSelectedCell,
  });

  useEffect(() => {
    setJoinCodeInput(joinCode);
  }, [joinCode]);

  useEffect(() => {
    if (!combat?.combatants?.length) {
      setSelectedCombatTarget("");
      return;
    }
    const targetingReference = controlledCombatant || currentCombatant;
    if (!targetingReference) {
      return;
    }
    const defaultTarget = combat.combatants.find(
      (combatant) => combatant.side !== targetingReference.side && !combatant.isDead,
    );
    if (defaultTarget && !selectedCombatTarget) {
      setSelectedCombatTarget(defaultTarget._id);
    }
  }, [combat, controlledCombatant, currentCombatant, selectedCombatTarget]);

  useEffect(() => {
    setSelectedCell(null);
    setSelectedCombatTarget("");
  }, [activeScene?._id]);

  return {
    auth: {
      isSignedIn,
      isConvexAuthenticated,
      authDebug,
    },
    data: {
      archetypes,
      corpusSources,
      currentUser,
      publicSessions,
      session,
      adventure,
      combat,
      sceneRuntime,
      currentParticipant,
      activeScene,
      currentCombatant,
      controlledCombatant,
    },
    state: {
      activePage,
      createCharacterName,
      sessionTitle,
      worldPrompt,
      roomPrivacy,
      joinCharacterName,
      joinCodeInput,
      searchQuery,
      searchResults,
      busy,
      error,
      selectedCombatTarget,
      selectedCell,
    },
    actions: {
      setActivePage,
      setCreateCharacterName,
      setSessionTitle,
      setWorldPrompt,
      setRoomPrivacy,
      setJoinCharacterName,
      setJoinCodeInput,
      setSearchQuery,
      setSelectedCombatTarget,
      setSelectedCell,
      ...handlers,
    },
  };
}
