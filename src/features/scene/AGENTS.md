## Scene Feature

Owns objective, progress, pressure, and scene-level event presentation for the runtime.

Does not own map rendering, combat rules, or DM generation logic.

Future scene-facing UI changes should land here when they affect:
- objective and progress surfaces
- pressure or transition affordances
- scene-level event summaries

Canonical files:
- `SceneObjectiveCard.jsx` for current scene heading and objective
- `SceneProgressChips.jsx` for discovery/commitment/pressure state
- `SceneEventFeed.jsx` for recent visible scene-fact updates
