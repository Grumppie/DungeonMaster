## Retrieval Domain

Owns corpus search policy, hybrid retrieval helpers, domain filters, conservative fallback behavior, and citation-friendly result shaping.

Does not own DM prompting or combat legality itself.

Keep retrieval policy centralized here so agent flows do not invent local search behavior.

Canonical files:
- `searchPolicy.js` for runtime-facing retrieval request shaping
- `queryBuilders.js` for scene-aware query expansion
- `semanticSearch.js` for embedding/vector retrieval orchestration
- `lexicalSearch.js` for deterministic fallback ranking
- `resultRanking.js` for result shaping and ordering
- `conservativeFallback.js` for safe no-retrieval DM behavior
