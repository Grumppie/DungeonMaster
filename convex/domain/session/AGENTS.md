## Session Domain

Owns room/session lifecycle, public/private room policy, host transfer, participant presence, readiness, join visibility rules, and session-level scene transition authority.

Does not own adventure generation, combat legality, DM replies, or voice playback.

Add future changes here when they affect:
- room creation or join
- participant projection
- host moderation
- room cleanup or presence
- session-scoped transition authorization

Do not add:
- combat mutations
- scene generation
- DM narration logic

Canonical files:
- `queries.js` for session/public/adventure projections
- `mutations.js` for room and participant mutations
- `hostPolicy.js` for host succession
- `cleanupPolicy.js` for idle/archival cleanup
- `presencePolicy.js` for presence and leave-state patching
- `transitionPolicy.js` for host-gated scene advancement
- `participantAccess.js` for current-viewer and participant lookup
- `participantProjection.js` for visible participant shape

Forbidden patterns:
- duplicating app-user auth bootstrap in root entry files
- re-implementing host succession outside `hostPolicy.js`
- mixing world/adventure blueprint generation back into session policy files
