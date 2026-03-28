## Runtime Feature

Owns:
- top-level in-session layout
- shell-level routing between map, transcript, HUD, and combat surfaces
- session-scoped controller/selectors
- prompt-mode interactions and history modal wiring

Does not own:
- combat engine legality
- backend schema/validators
- map-state derivation details

Canonical files:
- `RuntimeShell.jsx` for composition only
- `useRuntimeController.js` for runtime-facing data selection
- `useSessionRuntime.js` for session/runtime query coordination only
- `runtimeSelectors.js` for projection helpers
- `runtimeEvents.js` for prompt suggestion helpers
- `RuntimeRulesPanel.jsx` for corpus/rules view
- `RuntimeCommandDeck.jsx` for objective/progress/next-step composition
- `RuntimePlayfield.jsx` for map + DM command sidecar composition
- `RuntimeHistoryModals.jsx` for wiring history drawers only
- `DmCommandPanel.jsx` for DM command/history/transcript lane composition

Forbidden patterns:
- reconstructing authoritative scene state from raw messages inside the shell
- adding backend/domain rules directly in JSX event handlers
- keeping map selection or history presentation components inside the runtime feature when dedicated map/transcript surfaces exist
- growing `RuntimeShell.jsx` or `useSessionRuntime.js` into monoliths instead of extracting focused child modules
