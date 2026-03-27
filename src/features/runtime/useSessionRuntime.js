import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/react";

import { api } from "../../../convex/_generated/api";
import { useAuthDebug } from "../../providers/AppProviders";

const SESSION_PAGES = ["runtime", "rules"];

function useJoinCodeState() {
  const [joinCode, setJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("join") || "").trim().toUpperCase();
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (joinCode) {
      url.searchParams.set("join", joinCode);
    } else {
      url.searchParams.delete("join");
    }
    window.history.replaceState({}, "", url);
  }, [joinCode]);

  return [joinCode, setJoinCode];
}

function useSessionPageState() {
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("page") || "").trim().toLowerCase();
    return SESSION_PAGES.includes(requested) ? requested : "runtime";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (page && page !== "runtime") {
      url.searchParams.set("page", page);
    } else {
      url.searchParams.delete("page");
    }
    window.history.replaceState({}, "", url);
  }, [page]);

  return [page, setPage];
}

export function useSessionRuntime() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const authDebug = useAuthDebug();

  const syncUser = useMutation(api.users.sync);
  const ensureDefaults = useMutation(api.archetypes.ensureDefaults);
  const createSession = useMutation(api.sessions.create);
  const joinSession = useMutation(api.sessions.join);
  const chooseArchetype = useMutation(api.sessions.chooseArchetype);
  const performCombatAction = useMutation(api.combat.performAction);
  const issueCombatPreview = useMutation(api.combat.issuePreview);
  const confirmCombatPreview = useMutation(api.combat.confirmPreview);
  const primeEncounter = useMutation(api.combat.primeEncounter);
  const searchCorpus = useAction(api.corpusActions.search);
  const submitScenePrompt = useMutation(api.sceneRuntime.submitPlayerPrompt);
  const movePlayerToken = useMutation(api.sceneRuntime.movePlayerToken);
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
  const [roomPrivacy, setRoomPrivacy] = useState("private");
  const [joinCharacterName, setJoinCharacterName] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState(joinCode);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selectedCombatTarget, setSelectedCombatTarget] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const lastPrimedEncounterIdRef = useRef(null);

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

  useEffect(() => {
    setJoinCodeInput(joinCode);
  }, [joinCode]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isConvexAuthLoading || !isConvexAuthenticated) {
      return;
    }
    void syncUser().catch((syncError) => {
      console.error("Failed to sync current user.", syncError);
      setError(String(syncError));
    });
  }, [isLoaded, isSignedIn, isConvexAuthLoading, isConvexAuthenticated, syncUser]);

  useEffect(() => {
    void ensureDefaults().catch((seedError) => {
      console.error("Failed to seed archetypes.", seedError);
    });
  }, [ensureDefaults]);

  useEffect(() => {
    if (!session?._id || !isConvexAuthenticated) {
      return undefined;
    }
    void updatePresence({ sessionId: session._id, presenceState: "online" }).catch(() => {});
    const handleVisibility = () => {
      const nextState = document.visibilityState === "visible" ? "online" : "reconnecting";
      void updatePresence({ sessionId: session._id, presenceState: nextState }).catch(() => {});
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isConvexAuthenticated, session?._id, updatePresence]);

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
    if (!session) {
      return;
    }
    if (combat?.encounter?.status === "active") {
      setActivePage("runtime");
      return;
    }
    if (activePage !== "rules") {
      setActivePage("runtime");
    }
  }, [activePage, combat?.encounter?.status, session, setActivePage]);

  useEffect(() => {
    if (!session || !combat || combat.encounter.status !== "active") {
      lastPrimedEncounterIdRef.current = null;
      return;
    }
    if (combat.currentCombatant?.kind !== "enemy") {
      lastPrimedEncounterIdRef.current = null;
      return;
    }
    if (lastPrimedEncounterIdRef.current === combat.encounter._id) {
      return;
    }
    lastPrimedEncounterIdRef.current = combat.encounter._id;
    void primeEncounter({ sessionId: session._id }).catch((primeError) => {
      console.error("Failed to prime combat encounter.", primeError);
      setError(String(primeError));
    });
  }, [combat, primeEncounter, session]);

  async function handleCreateSession() {
    setBusy("create");
    setError("");
    try {
      const result = await createSession({
        title: sessionTitle,
        displayName: createCharacterName || "Host",
        characterName: createCharacterName || "Host",
        roomPrivacy,
        isAnonymous: true,
        turnTimerSeconds: 20,
      });
      setJoinCode(result.joinCode);
    } catch (createError) {
      setError(String(createError));
    } finally {
      setBusy("");
    }
  }

  async function handleJoinSession(code = joinCodeInput) {
    setBusy("join");
    setError("");
    try {
      const normalized = code.trim().toUpperCase();
      const result = await joinSession({
        joinCode: normalized,
        displayName: joinCharacterName || "Adventurer",
        characterName: joinCharacterName || "Adventurer",
        isAnonymous: true,
      });
      setJoinCode(result.joinCode);
    } catch (joinError) {
      setError(String(joinError));
    } finally {
      setBusy("");
    }
  }

  async function handleChooseArchetype(archetypeKey) {
    if (!session) {
      return;
    }
    setBusy(`pick:${archetypeKey}`);
    setError("");
    try {
      await chooseArchetype({
        sessionId: session._id,
        archetypeKey,
      });
    } catch (pickError) {
      setError(String(pickError));
    } finally {
      setBusy("");
    }
  }

  async function handleStartAdventure() {
    if (!session) {
      return;
    }
    setBusy("start");
    setError("");
    try {
      await startAdventure({ sessionId: session._id });
    } catch (startError) {
      setError(String(startError));
    } finally {
      setBusy("");
    }
  }

  async function handlePerformCombatAction(action) {
    if (!session) {
      return;
    }
    setBusy(`combat:${action.profileKey || action.type}`);
    setError("");
    try {
      await performCombatAction({
        sessionId: session._id,
        action,
      });
      setSelectedCell(null);
    } catch (combatError) {
      setError(String(combatError));
    } finally {
      setBusy("");
    }
  }

  async function handleIssueCombatPreview(action) {
    if (!session) {
      return null;
    }
    setBusy(`combat:preview:${action.profileKey || action.type}`);
    setError("");
    try {
      return await issueCombatPreview({
        sessionId: session._id,
        action,
      });
    } catch (previewError) {
      setError(String(previewError));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function handleConfirmCombatPreview(previewId) {
    if (!session) {
      return;
    }
    setBusy("combat:confirm");
    setError("");
    try {
      await confirmCombatPreview({
        sessionId: session._id,
        previewId,
      });
      setSelectedCell(null);
    } catch (confirmError) {
      setError(String(confirmError));
    } finally {
      setBusy("");
    }
  }

  async function handleSearchCorpus() {
    setBusy("search");
    setError("");
    try {
      const results = await searchCorpus({
        queryText: searchQuery,
        limit: 4,
      });
      setSearchResults(results);
    } catch (searchError) {
      setError(String(searchError));
    } finally {
      setBusy("");
    }
  }

  async function handleSubmitScenePrompt({ content, promptMode }) {
    if (!session) {
      return;
    }
    setBusy("scene:submit");
    setError("");
    try {
      const result = await submitScenePrompt({
        sessionId: session._id,
        content,
        promptMode,
      });
      setBusy("");
      void respondToScenePrompt({
        sessionId: session._id,
        playerMessageId: result.messageId,
        promptMode: result.promptMode,
      }).catch((sceneError) => {
        setError(String(sceneError));
      });
    } catch (sceneError) {
      setError(String(sceneError));
    } finally {
      setBusy((current) => (current === "scene:submit" ? "" : current));
    }
  }

  async function handleMovePlayerToken(x, y) {
    if (!session) {
      return;
    }
    setError("");
    try {
      await movePlayerToken({
        sessionId: session._id,
        x,
        y,
      });
    } catch (moveError) {
      setError(String(moveError));
    }
  }

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
      setRoomPrivacy,
      setJoinCharacterName,
      setJoinCodeInput,
      setSearchQuery,
      setSelectedCombatTarget,
      setSelectedCell,
      handleCreateSession,
      handleJoinSession,
      handleChooseArchetype,
      handleStartAdventure,
      handlePerformCombatAction,
      handleIssueCombatPreview,
      handleConfirmCombatPreview,
      handleSearchCorpus,
      handleSubmitScenePrompt,
      handleMovePlayerToken,
    },
  };
}
