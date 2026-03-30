export function useRuntimeHandlers({
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
  worldPrompt,
  createCharacterName,
  roomPrivacy,
  joinCharacterName,
  joinCodeInput,
  searchQuery,
  setJoinCode,
  setBusy,
  setError,
  setSearchResults,
  setSelectedCell,
}) {
  const START_ADVENTURE_TIMEOUT_MS = 15000;

  function withTimeout(promise, timeoutMs, timeoutLabel) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  }

  async function handleCreateSession() {
    setBusy("create");
    setError("");
    try {
      const result = await createSession({
        title: sessionTitle,
        worldPrompt,
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
      await withTimeout(
        startAdventure({ sessionId: session._id }),
        START_ADVENTURE_TIMEOUT_MS,
        "Graph adventure start",
      );
    } catch (startError) {
      try {
        await startAdventureFallback({ sessionId: session._id });
      } catch (fallbackError) {
        setError(String(fallbackError || startError));
      }
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

  async function handleSubmitScenePrompt({
    content,
    promptMode,
    visibility,
    sourceKind,
    sourceId,
    sourceLabel,
  }) {
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
        visibility,
        sourceKind,
        sourceId,
        sourceLabel,
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
      const result = await movePlayerToken({
        sessionId: session._id,
        x,
        y,
      });
      if (result?.transitionBlocked && result?.blockerReason) {
        setError(result.blockerReason);
      }
    } catch (moveError) {
      setError(String(moveError));
    }
  }

  async function handleShareSceneMessage(messageId) {
    if (!messageId) {
      return;
    }
    setBusy("scene:share");
    setError("");
    try {
      await shareSceneMessage({ messageId });
    } catch (shareError) {
      setError(String(shareError));
    } finally {
      setBusy((current) => (current === "scene:share" ? "" : current));
    }
  }

  return {
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
    handleShareSceneMessage,
  };
}
