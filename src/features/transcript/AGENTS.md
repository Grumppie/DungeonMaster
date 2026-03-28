## Transcript Feature

Owns:
- the pinned latest-DM surface
- the compact live transcript lane
- transcript-specific selectors
- history drawer surfaces

Does not own:
- voice provider selection
- audio playback queue behavior

Canonical files:
- `LatestDmPanel.jsx` for the pinned latest-reply card
- `TranscriptLane.jsx` for the compact live line window
- `transcriptSelectors.js` for DM/transcript projections
- `HistoryDrawer.jsx` for history presentation

Forbidden patterns:
- rebuilding DM-history filtering inside runtime shells
- mixing playback queue control into transcript UI components
