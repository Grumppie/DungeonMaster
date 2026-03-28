import { useEffect, useRef } from "react";

export function useRuntimeLifecycle({
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
}) {
  const lastPrimedEncounterIdRef = useRef(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isConvexAuthLoading || !isConvexAuthenticated) {
      return;
    }
    void syncUser().catch((syncError) => {
      console.error("Failed to sync current user.", syncError);
      setError(String(syncError));
    });
  }, [isLoaded, isSignedIn, isConvexAuthLoading, isConvexAuthenticated, setError, syncUser]);

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
  }, [combat, primeEncounter, session, setError]);
}
