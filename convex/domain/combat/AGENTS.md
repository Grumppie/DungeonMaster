## Combat Domain

Owns:
- encounter lifecycle and turn progression
- combatant formation/bootstrap
- player action resolution
- enemy turn logic
- preview validation
- combat-only resource consumption
- combat event persistence

Does not own:
- room/session lifecycle
- scene exploration gating
- DM freeform narration policy
- world/run generation

Canonical entrypoints:
- `state.js` for encounter persistence, snapshots, timers, and lifecycle
- `resolver.js` for player action legality and resolution
- `aiTurns.js` for enemy turns and auto-advance behavior
- `previews.js` for preview payload creation
- `formations.js` for combatant creation, coordinates, and HP mutation helpers
- `dice.js` and `resources.js` for reusable low-level combat mechanics

Future combat rule changes should land here before touching UI code in `src/features/combat`.

Forbidden patterns:
- adding combat legality directly in React components
- re-implementing dice/resource logic in root `convex/combat.js`
- mixing world-scene progression rules into combat resolvers
