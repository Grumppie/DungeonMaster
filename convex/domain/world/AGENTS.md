## World Domain

Owns run creation, scene blueprints, investigation rules, runtime scene state, scene facts/progress, scene message persistence helpers, and persistence of generated adventure structure.

Does not own turn-by-turn combat mutation, participant/session management, or client rendering.

Add future changes here when they affect:
- scene stack generation
- interactables and investigation rules
- runtime scene snapshot assembly
- message visibility/persistence policy for DM/NPC world outputs
- run persistence
- world-facing contracts

Canonical files:
- `graph/*` for bounded graph orchestration
- `graph/respondToPrompt.js` for streamed DM response orchestration
- `sceneState.js`, `sceneFacts.js`, `sceneProgress.js` for authoritative scene state
- `scenarioUpdates.js` for applying bounded micro-scenarios and stall-recovery state shifts
- `runtimeSnapshot.js` and `runtimeVisibility.js` for session-runtime world projection
- `runtimeQueries.js` for root query payload shaping
- `playerPrompts.js` and `playerMovement.js` for player-scene world mutations
- `messagePersistence.js` for DM/NPC/voice persistence helpers
- `transitions.js` for scene advancement and map-transition coordination

Forbidden patterns:
- reconstructing runtime scene state directly inside root `convex/sceneRuntime.js`
- writing DM/NPC messages from graph modules straight to raw tables
- mixing participant/session ownership checks into world-state helpers
