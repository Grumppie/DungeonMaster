## Map Feature

Owns:
- board rendering
- tile/interactable/token presentation
- map overlays and legend surfaces
- map-state projection for the runtime shell

Does not own:
- mutation legality
- scene progression rules
- combat resolution

Canonical files:
- `SceneGrid.jsx` for map composition only
- `useMapState.js` for derived board-state projection
- `MapLegend.jsx` for map status chips
- `MapOverlay.jsx` for in-map progress/speaker/selection context
- `SelectionPopover.jsx` for compact tile/interactable/combatant action surfacing

Future changes that affect what a tile means should start in backend scene/map contracts first, then flow into this feature.

Forbidden patterns:
- deriving gameplay rules from CSS classes
- putting mutation side effects inside `useMapState`
- rebuilding map-state derivation ad hoc in `RuntimeShell`
