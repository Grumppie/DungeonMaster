# DND Agent Implementation Roadmap

## 1. Planning Stance

This roadmap is intentionally biased toward shipping a playable core, not proving every idea at once.

Two planning lenses shape it:

- `Sprint Prioritizer`: optimize for dependency order, usable milestones, and a credible MVP
- `Reality Checker`: assume the project is `NEEDS WORK` until each phase has observable proof

For D&D-specific sequencing, this roadmap follows the actual 2014 5e play loop:

1. prepare characters and rules data
2. create or load a scene
3. determine whose turn it is
4. parse one player intent
5. resolve state changes in the engine
6. narrate the resolved result
7. persist the new scene and campaign state

## 2. Current Repo Baseline

The current codebase already has useful groundwork:

- a React/Vite client
- a FastAPI backend
- PHB/rules corpus loading
- `RAG` and `RLM` comparison plumbing
- a duel-focused initial state
- a memory workbench and benchmark harness

That means the next milestone should not be "build an agent from scratch."
It should be "turn the existing duel lab into the first production-shaped gameplay kernel."

## 2.1 Locked Product Decisions

These decisions are now treated as fixed unless you explicitly change them later:

- target release shape: `closed beta`
- beta goal: get early alpha-style feedback from friends as fast as possible
- first playable milestone: `2-4 player one-quest prototype`
- MVP gameplay scope: `combat + simple scene questions`
- initial character intake: `guided form / fast-character flow`, not arbitrary sheet parsing
- MVP character roster: `four curated archetypes`, chosen from prebuilt templates
- users customize: `name`, `background flavor`, and light presentation details
- voice direction: keep the current dramatic world-narrator feel
- beta voice requirement: `one strong narrator voice is enough for beta 1`
- quest shape: `multiple scenes with one or two combat encounters`
- frontend stack: `React`
- backend stack: `Convex`
- hosting target: `internet-hosted closed beta`
- duplicate archetypes: `allowed`
- starting level: `3`
- auth provider: `Clerk`
- public product path: `yes, plan from day one`
- beta 1 voice scope: `Deepgram input + Deepgram output`
- beta access model: `host creates session and shares join link`
- post-beta voice priority: `reliability first`

Implication:

- speed to first playable beta matters more than maximal feature completeness
- anything that slows down the one-quest closed beta without strengthening the core loop should be deprioritized

Important product decision:

- do not randomize class/race combinations in MVP
- hand-pick four archetypes that are mechanically readable, tactically distinct, and easy to test

## 2.2 Locked Stack Implications

Because the stack is now fixed, the architecture should assume:

- `React` owns the UI, private panels, shared board, and local interaction flow
- `Convex` owns authoritative state, realtime sync, persistence, and backend function execution
- model, TTS, embedding, and other external provider calls run through `Convex actions`

Why this fits the product:

- Convex's realtime query model fits multiplayer state sync well
- Convex mutations are a good fit for authoritative combat state transitions
- Convex actions provide a clean place for LLM, TTS, and retrieval orchestration

Official references:

- https://docs.convex.dev/functions
- https://docs.convex.dev/client/react/
- https://docs.convex.dev/realtime
- https://docs.convex.dev/search/vector-search
- https://docs.convex.dev/auth/clerk

## 2.3 OpenClaw Harness Recommendation

Do not make OpenClaw the core runtime for the live D&D product.

Recommended use:

- `Convex + React` for the actual game runtime
- `OpenClaw` only as an optional operator harness, content-authoring assistant, or dev workflow tool

Why:

- your game needs authoritative multiplayer state, deterministic combat mutations, and stable session persistence
- OpenClaw's own docs position ACP sessions as a way to run external coding harnesses, and sub-agents as background agent runs with best-effort announce behavior
- that makes OpenClaw a better fit for orchestration and tooling than for the player-facing source of truth

Official references:

- https://docs.openclaw.ai/tools/acp-agents
- https://docs.openclaw.ai/tools/subagents

## 3. Recommended Delivery Strategy

Build in this order:

1. make the combat/state engine authoritative
2. route the right questions to the right memory subsystem
3. make one short quest playable by text
4. add real multiplayer session handling
5. polish tactical readability and presentation
6. deepen content generation
7. optimize long-session context handling

Anything that does not strengthen one of the first four outcomes should be treated as secondary.

Migration note:

- the existing FastAPI memory lab is still useful as a reference implementation
- the closed-beta path should migrate backend ownership into Convex rather than split authority across two backends

## 4. Phase-by-Phase Plan

## Phase 0: Product Lock and Architecture Contracts

### Why this comes first

Your current scope still has a few choices that can change the entire architecture. Those must be locked before major implementation.

### Must-decide outputs

- authoritative runtime location: browser-authoritative vs server-authoritative
- MVP session type: fixed duel, fixed-party encounter, or short quest with multiple scenes
- target party size for MVP
- input mode priority: text-first vs voice-first
- character import source and format
- legal/content boundary for PHB usage

### Recommendation

Choose:

- `server-authoritative` game state
- in this stack, that means `Convex-authoritative` game state
- `text-first` action reliability with retained dramatic TTS narration
- `2-4 player short quest` as the MVP target
- `four curated archetypes + lightweight customization` first, PDF/image ingestion later

### Exit criteria

- one-page technical brief with locked assumptions
- session schema boundaries agreed
- MVP player count and input mode fixed
- archetype roster fixed for beta 1

### Why it matters

If you stay browser-authoritative too long, multiplayer, anti-desync behavior, and auditability become harder than they need to be.

Note on voice:

- keep TTS in the beta because it is part of the desired feel
- keep action submission reliable even if voice input mishears
- treat `spoken output` and `spoken input` as separate priorities

Locked choice:

- beta 1 will support both voice input and voice output
- typed fallback must remain available whenever transcription confidence or parsing confidence is weak

## Phase 1: Combat Kernel Hardening

### Objective

Convert the current duel/demo logic into a reusable authoritative rules engine.

### Scope

- move combat authority into Convex backend domain logic
- define immutable `character sheet` vs mutable `session state`
- define a canonical `action object`
- define a canonical `combat event log`
- implement turn ownership checks
- implement action economy checks
- implement attacks, saves, damage, death saves, opportunity attacks, concentration, movement, and conditions
- implement deterministic state transitions before narration

### Why this is phase 1

Without this, every later feature becomes unstable:

- RAG answers may be correct while the game state is wrong
- multiplayer will desync
- narration quality will mask mechanical inconsistency
- memory compaction can summarize broken state

### Deliverables

- Convex combat engine modules
- action parser contract
- state transition tests
- event log schema
- state inspector endpoint or debug panel

### Exit criteria

- one encounter can run entirely through the backend
- all HP/resource/condition mutations are logged
- invalid or out-of-turn actions fail safely
- narration never mutates state

Additional beta requirement:

- the narration layer can consume resolved state and produce spoken output in the current dramatic style

Convex implementation rule:

- queries expose session state to clients
- mutations own all authoritative state transitions
- actions call LLM/TTS/embedding providers and then pass persistable results back into mutations when needed

## Phase 2: Rules and Question Routing Layer

### Objective

Make the system answer the right kind of question with the right subsystem.

### Scope

- classify incoming questions into:
  - `combat_action`
  - `rules_question`
  - `scene_question`
  - `lore_question`
  - `table_help`
- route `rules_question` to `RAG`
- route `lore_question` and some `scene_question` traffic to `RLM` or structured summarization
- define a safe fallback when evidence is insufficient
- attach citations for rules answers

### Recommendation

Do not let `RLM` answer combat legality when the engine can answer it directly.

Ownership model:

- engine: legality and state mutation
- RAG: explicit rules grounding
- RLM/summaries: lore and long-horizon memory
- DM narrator: presentation only

### External research applied

Current public references suggest the same pattern:

- OpenCode exposes automatic compaction plus pruning controls, which implies context must be managed explicitly rather than left to raw chat history.
- Anthropic's current compaction docs recommend server-side compaction for long-running agent tasks, but only as a context-management mechanism, not as a replacement for external state.
- Public Codex issues show that auto-compaction can drop important task context if the system does not preserve authoritative facts outside the prompt.

### Exit criteria

- combat questions no longer go through vague free-form prompting
- rules answers cite the corpus
- lore answers use memory layers without touching authoritative combat state

## Phase 2.5: Corpus and Skill-Guided Retrieval Layer

### Objective

Let the agent decide what to read by following local files and skill instructions before it reaches for larger corpora.

### Why this exists

You want the system to behave more like a disciplined operator:

- inspect local skill files
- inspect local docs and state
- follow those references
- read the right corpus only when needed

That is a good pattern for both cost control and answer discipline.

### Scope

- define a local knowledge routing order:
  1. active session state
  2. character sheets and scene data
  3. local skill files and linked local references
  4. local design docs and prompts
  5. rule corpora such as PHB / Monster Manual / DMG
- define corpus metadata so each source has:
  - source type
  - authority level
  - rules domain
  - copyright/shipping boundary
- support multiple corpora:
  - PHB
  - Monster Manual
  - DMG
  - project-authored house docs or constraints
- add source selection logic so the system can say:
  - this is a player-rule question
  - this is a monster-stat question
  - this is a worldbuilding/procedure question

### Design rule

The agent should not blindly dump all books into every prompt.

It should:

- read local context first
- identify the question domain
- fetch the minimum relevant corpus slices
- preserve citations and source provenance

Convex-specific retrieval rule:

- store corpus chunks and metadata in Convex
- store embeddings with those chunks
- use `vectorSearch` inside Convex actions for semantic retrieval
- use standard queries/mutations to load and filter full records after retrieval

Current platform implication:

- Convex vector search runs in actions rather than ordinary reactive queries
- the RAG pipeline should be designed around that boundary

### Exit criteria

- the agent can justify which local file or corpus it consulted
- rules retrieval remains targeted instead of broad and expensive
- PHB / Monster Manual / DMG can coexist without becoming one undifferentiated blob

### Production-readiness legal strategy

Do not assume that hiding copyrighted books behind embeddings or a vector database solves licensing.

For planning purposes, use this split:

- `public-safe / production-safe core`: SRD 5.1 content and original project-authored content
- `private closed-beta risk bucket`: any full-book PHB / Monster Manual / DMG ingestion that is not clearly licensed for this use

Official source basis:

- Wizards states SRD 5.1 is available under CC-BY-4.0 and can be used commercially with attribution.
- Wizards' Fan Content Policy allows free fan content, but that is not a blanket commercial product license.

Sources:

- https://dnd.wizards.com/fr/resources/systems-reference-document
- https://company.wizards.com/en/legal/fancontentpolicy

Practical implication:

- for closed beta with friends, you can prototype with private corpora more aggressively at your own risk
- for production planning, architect the system so you can swap to SRD-safe or separately licensed corpora without rewriting the retrieval stack

Because you want a public product path from day one:

- treat `SRD-safe / licensed-swappable architecture` as a core requirement
- do not assume PHB / Monster Manual / DMG embeddings are acceptable for public deployment just because the raw text is hidden
- user-provided local rulebooks can be supported for private prototyping, but public deployment should still assume `SRD + original authored content` unless separate licensing exists

## Phase 3: Session Model and Short Quest Vertical Slice

### Objective

Prove the game is more than a duel by shipping one small quest loop.

### Scope

- create `campaign`, `session`, `scene`, and `encounter` models
- define global memory and scene memory schemas
- support non-combat scene state updates
- add quest template generation for a short, conflict-driven adventure
- add encounter startup and encounter teardown flows
- persist quest progress and discovered facts
- add archetype selection and light customization flow for fast onboarding

Recommended Convex tables for this phase:

- `users`
- `parties`
- `characterTemplates`
- `characters`
- `sessions`
- `scenes`
- `encounters`
- `combatEvents`
- `messages`
- `memoryEntries`
- `corpusChunks`

### MVP gameplay target

A party should be able to:

1. choose from four curated archetypes and customize identity details
2. receive a simple quest objective
3. enter a scene
4. ask the DM questions
5. enter combat
6. resolve the encounter
7. carry forward quest state to the next scene

### Why this phase is before multiplayer polish

If the single-session gameplay loop is not coherent, multiplayer only scales the confusion.

### Exit criteria

- one short quest can be completed through multiple scenes
- state persists correctly between scenes
- the DM can answer both rules and scene questions without collapsing the quest state

## Phase 4: Real Multiplayer Runtime

### Objective

Add actual party play instead of local single-user simulation.

### Scope

- session hosting and joining
- player identity and seat ownership
- per-player private state views
- shared board state broadcast
- turn timer and AFK logic
- pause semantics if too many players are inactive
- question lane that does not mutate combat out of turn

Why Convex fits this phase:

- React clients can subscribe to shared session queries
- changes propagate to all players without manual websocket plumbing
- the backend remains one consistent source of truth

Hosted beta session model:

- one player creates a session
- the app generates a shareable join link
- invited friends join the session directly
- once enough players have joined and selected archetypes, the DM agent starts the quest flow for that party size

### Recommendation

Keep the server authoritative for:

- active turn
- legal action intake
- state mutation
- encounter progression

Let clients own only:

- presentation
- local drafts
- private panel layout preferences
- voice capture and UI affordances

### Exit criteria

- 2-4 players can join one session reliably
- only the current actor can commit combat actions
- non-acting players can ask DM questions without corrupting initiative flow
- the closed beta can be run with friends without manual operator intervention on every turn

## Phase 5: Tactical UX and Spell Readability

### Objective

Make decisions readable enough that players trust what they are about to do.

### Scope

- board overlays for spell shapes and ranges
- target previews
- condition/effect indicators
- quick spell detail widget
- private player dashboard refinements
- health-state presentation that is descriptive but not numerically noisy on shared cards

### Priority note

This is important, but it is polish on top of stable rules and session flow. Do not pull this ahead of phases 1-4.

### Exit criteria

- players can understand spell impact before committing
- shared and private information boundaries remain clear

## Phase 6: Voice and Performance Layer

### Objective

Add voice where it improves play rather than destabilizing it.

### Scope

- live speech capture
- interruption and barge-in rules
- transcript visibility
- voice-command normalization into the same action object pipeline
- latency budgeting

### Recommendation

Voice should be an alternative input transport, not a separate gameplay path.

The same parser and action contract must power both:

- typed commands
- spoken commands

For beta speed, split voice into two layers:

- `beta-core`: dramatic DM/NPC spoken output
- `beta-plus`: spoken player input

This preserves the theatrical feel without making speech recognition a blocker.

Locked implementation requirement:

- Deepgram handles both speech-to-text and text-to-speech for beta 1
- every spoken command must still end as the same validated action object used by typed input

### Current vendor note

Deepgram's current TTS docs show selectable Aura/Aura-2 voice models, so voice selection is a viable implementation path today.
Sources:

- https://developers.deepgram.com/docs/text-to-speech
- https://developers.deepgram.com/docs/tts-models
- https://developers.deepgram.com/docs/speech-to-text

Convex integration note:

- TTS generation should run in actions
- cached or persisted audio should use Convex File Storage if you decide to keep generated voice assets

Reference:

- https://docs.convex.dev/file-storage

### Exit criteria

- voice produces the same action objects as text
- failed transcription cannot silently corrupt state

## Phase 7: Content Generation Depth

### Objective

Increase replayability after the gameplay kernel is stable.

### Scope

- richer quest seeds
- NPC generation
- encounter escalation rules
- reward and progression logic
- optional portrait generation/customization
- later expansion beyond the initial four archetypes

### Recommendation

Keep generated plots simple. The system should generate coherent pressure, not sophisticated literature.

### Exit criteria

- content generation increases replayability without breaking rules coherence

## Phase 8: Long-Session Memory and Compaction Research

### Objective

Improve long-session continuity without trusting summarization to hold critical state.

### Scope

- define compaction format for prior scenes
- benchmark token cost vs answer quality
- archive raw transcript separately from compacted history
- evaluate when `RLM` beats deterministic summarization
- add tooling to inspect what facts survived compaction

### Hard rule

Never rely on compaction summaries for authoritative combat or resource state.

Compaction should preserve:

- what happened
- why it matters
- what is unresolved

It should not become the only source of truth for:

- HP
- slots
- conditions
- initiative
- position

### Exit criteria

- long-session summaries can be regenerated and audited
- context compaction reduces token pressure without causing state drift

## 5. What To Delay On Purpose

Delay these until after phase 4 unless they are trivially cheap:

- full dashboard customization
- sophisticated cinematic damage effects
- image generation workflow
- polished side-activity support while waiting between turns
- deep narrative branching
- broad monster/manual support beyond MVP needs

Nuance:

- support multiple corpora in architecture early
- do not attempt full encyclopedic rules coverage in the first beta

## 6. Suggested Ticket Order For The Next Work Cycle

If starting immediately, the next sequence should be:

1. scaffold Convex into the project and define the initial schema
2. integrate Clerk auth with React + Convex
3. write Convex combat state schema
4. write action object schema
5. write combat event log schema
6. move duel resolution into Convex mutations/actions
7. add tests for attacks, spell saves, concentration, and death saves
8. add question classification and routing
9. define global memory and scene memory storage contracts
10. integrate Deepgram STT/TTS through Convex actions
11. implement one short quest vertical slice

## 7. Highest-Risk Unknowns

These are the decisions most likely to reshape the roadmap:

- whether NPC voice switching is required in a later beta
- how robust voice-input recovery and typed fallback need to be in beta 1
- how much moderation / abuse handling the hosted beta needs
- what licensed/public-safe corpus strategy will replace or complement private PHB / Monster Manual / DMG ingestion

## 8. Missing Context I Need From You

No major product blockers remain.

Current working assumptions:

1. ship the four recommended archetypes first
2. support solo testing and adapt quest flow to the number of connected players
3. index user-provided corpora from the root `data/` folder for private prototyping

## 9. Recommendation If You Want The Fastest Credible Path

If your goal is fastest execution with the least architectural regret, choose:

- closed beta with friends
- 3-4 players
- text-reliable MVP with dramatic spoken narration
- four curated archetypes first
- combat + simple scene questions only
- one short multi-scene quest prototype
- Convex-authoritative state from the start
- Clerk for auth
- Deepgram for both voice input and voice output
- public-safe corpus boundaries designed from day one

That path keeps the product ambitious enough to be real, but not so broad that context, UI, networking, voice, and content generation all explode at once.
