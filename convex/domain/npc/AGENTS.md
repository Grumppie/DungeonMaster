## NPC Domain

Owns NPC memory scoring, memory compaction, NPC action selection inputs, and dialogue support contracts.

Does not own final combat mutation or room/session concerns.

Keep all NPC memory weighting and "key vs compact" logic centralized here.

Canonical files:
- `memory.js` and `memoryJudge.js` for weighted memory retention
- `state.js` for authoritative per-scene NPC state
- `conversation.js` for bounded NPC talk outcomes
- `decisions.js` for NPC scene/combat decision shaping
- `graph/npcConversationGraph.js` for routed conversation handling
- `graph/npcDecisionGraph.js` for bounded NPC action proposals
