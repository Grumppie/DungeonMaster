# DND Agent Scope Breakdown

## 1. Product Goal

Build a multiplayer D&D 5e 2014 experience where:

- the mechanics are resolved strictly by an engine,
- the DM agent narrates and answers questions without inventing rules,
- each player has a personal control surface for their own character,
- the shared screen stays focused on the board and turn flow,
- the system can sustain longer sessions through explicit state and compacted context.

The product should feel like a playable tactical quest generator, not a general-purpose storytelling sandbox.

## 2. Core Product Pillars

### Pillar A: Mechanical Accuracy

- Rules must be grounded in PHB-style 2014 5e data.
- Player intent should be parsed into one action object before state changes.
- Combat state must update deterministically: HP, spell slots, conditions, concentration, initiative, movement, reactions.
- Narration must describe resolved mechanics, not decide them.

### Pillar B: Multiplayer Playability

- Shared board-first interface for the party.
- Private per-player panels for stats, spells, weapons, and character details.
- Turn-based flow with time limits and AFK handling.
- Ability to ask the DM questions while another player is acting, without corrupting turn state.

### Pillar C: Context and Memory Discipline

- Static character sheet data must stay separate from mutable session state.
- Global memory should store campaign-wide facts.
- Scene memory should store the current encounter state.
- Context compaction should summarize history without losing authoritative state.

### Pillar D: Strong Presentation

- The DM should narrate clearly and with style.
- Spell targeting and area of effect should be visually understandable.
- Health feedback should be conveyed through effects and presentation, not only numeric UI.
- Character creation should feel lightweight: upload sheet, generate character, optionally customize portrait.

## 3. Architecture Decision

Do not frame this as `RAG vs RLM`. The cleaner split is:

- `Rules retrieval`: RAG over PHB/rules corpus
- `State authority`: explicit engine state
- `Lore/context reasoning`: RLM or model-driven summarization over structured memory
- `Narration`: separate presentation layer fed by resolved state

Recommended ownership:

- Use `RAG` for rule lookup, citations, and answer grounding.
- Use `RLM` for context navigation, memory compaction experiments, and lore-aware question answering.
- Use the game engine as the only source of truth for combat and resource updates.

This matches the current repo direction because `server/services/memory_service.py` already supports `rag`, `rlm`, and side-by-side comparison.

## 4. System Model

### 4.1 Static Data

- Rule corpus from PHB and supporting references
- Uploaded character sheets
- Precomputed character stats
- Spell definitions
- Equipment definitions
- Monster/NPC templates

### 4.2 Mutable State

- initiative order
- current HP
- spell slots
- conditions
- concentration
- positions
- movement used
- action/bonus action/reaction availability
- scene participants
- encounter log

### 4.3 Memory Layers

#### Global Memory

- party members
- persistent NPCs
- discovered lore
- long-term quest state
- faction/world facts

#### Scene Memory

- active map
- active NPCs/enemies
- positions and distances
- encounter goals
- temporary hazards
- recent action log

#### Compacted History

- summarized prior scenes
- resolved quest milestones
- relationship changes
- unresolved hooks carried forward

Important rule: global memory and scene memory may inform answers, but they must not overwrite authoritative combat state.

## 5. Feature Buckets

### 5.1 Game Engine

- turn order and initiative
- action validation
- attack/spell/save resolution
- resource tracking
- condition tracking
- combat log
- out-of-turn rejection rules

### 5.2 DM Agent

- narrate resolved actions
- answer rules questions with citations
- answer lore questions from memory
- reject impossible or out-of-scope actions
- generate coherent encounter pressure

### 5.3 Player Experience

- private player dashboard
- quick view for HP, spell slots, weapons, prepared spells
- deeper spell/ability details on demand
- optional voice and text input
- customizable panel layout

### 5.4 Shared Party Experience

- map/board-centric screen
- visible turn state
- initiative order
- target highlighting
- spell shape and affected area visualization
- passive question/interaction lane while another player acts

### 5.5 Session Management

- configurable turn timer
- party vote for timer defaults
- AFK detection and pause logic
- prevent game progression if too many players are inactive
- allow players to stay connected while not focused on the board

### 5.6 Content Generation

- simple quest generation
- coherent conflict generation
- NPC dialogue hooks
- encounter escalation

Constraint: keep the story generator simple. The product value is tactical, social, and mechanically coherent play, not deep authored narrative.

## 6. MVP Boundary

The MVP should prove one thing: a party can complete a short encounter-driven quest with accurate rules, clear turn flow, and useful personal UI.

Include in MVP:

- strict 2014 5e combat loop
- PHB-grounded rule lookup
- one shared board
- one private player panel per connected user
- text input first, voice optional later
- global memory + scene memory in basic form
- simple generated quest structure
- short combat narration from resolved state

Exclude from MVP:

- heavy story branching
- deep sandbox world simulation
- advanced image generation pipeline
- full screen customization system
- polished non-D&D side activity support
- complex long-campaign memory research before a playable core exists

## 7. Scope Cuts To Avoid Early Failure

- Do not make concurrent chatter mutate combat state. Only the active turn action should enter resolution.
- Do not let the DM model decide mechanics in prose.
- Do not build broad quest-generation complexity before the encounter loop works.
- Do not treat memory compaction research as a blocker for shipping a first playable version.
- Do not mix player-private data and party-shared data in the same UI/state channel.

## 8. Execution Plan

### Phase 1: Lock the Core Loop

Goal: make one encounter fully playable and mechanically trustworthy.

Tasks:

- define authoritative combat state schema
- separate static character sheet data from mutable session state
- define action object format
- implement turn validation and action resolution pipeline
- log every state mutation
- constrain DM narration to resolved outcomes
- define rules-answer contract with citations

Exit criteria:

- one encounter can run start to finish without manual correction
- every HP/resource/condition change is inspectable
- invalid actions fail safely without corrupting state

### Phase 2: Split the Memory Responsibilities

Goal: stop treating memory as one vague subsystem.

Tasks:

- define global memory schema
- define scene memory schema
- define compaction/summarization output format
- route rules questions to RAG
- route lore/context questions to RLM or summarization layer
- create evaluation prompts for memory correctness

Exit criteria:

- rules answers are grounded in corpus retrieval
- scene answers use scene state first
- long logs can be compacted without losing combat authority

### Phase 3: Build the Multiplayer UX

Goal: make the game usable by a real group.

Tasks:

- shared board view
- per-player private panel
- initiative and turn timer UI
- AFK and pause rules
- action submission flow
- spectator/question lane while another player acts

Exit criteria:

- multiple players can stay in the same session
- each player sees their own actionable data cleanly
- the party understands whose turn it is and what can be done

### Phase 4: Spell and Combat Readability

Goal: make tactical decisions visually clear.

Tasks:

- area-of-effect overlays
- target previews
- effect/buff/debuff indicators
- damage-state visual feedback on cards
- quick spell detail widget

Exit criteria:

- players can judge spell shape, targets, and likely impact before committing
- health state is conveyed without relying entirely on raw numbers

### Phase 5: Lightweight Content Generation

Goal: generate repeatable, coherent play sessions.

Tasks:

- simple quest template system
- encounter seed generation
- NPC role generation
- conflict escalation rules
- rewards and progression hooks

Exit criteria:

- the agent can spin up a short quest with coherent encounters
- generated content remains mechanically tractable

### Phase 6: Research Track

Goal: improve context efficiency without destabilizing the product roadmap.

Tasks:

- study context compaction patterns in Codex/OpenCode/frontier-style repos
- compare summarization formats against token cost and answer quality
- benchmark long-session behavior
- test when RLM adds value over simpler summarization

Constraint:

- this phase should run in parallel as research, not block core gameplay delivery.

## 9. Priority Order

If you want the shortest path to a real product, do the work in this order:

1. authoritative state and action resolution
2. rules grounding with RAG
3. DM narration bounded by engine results
4. multiplayer turn flow and private/shared UI split
5. memory layering and compaction
6. spell visualization and polish
7. content generation depth

## 10. Concrete Backlog Starters

These are good first tickets:

1. Define a JSON schema for static sheet data vs session state.
2. Define a single action object format for player input.
3. Add an event log format for every combat mutation.
4. Route question types into `rules`, `lore`, `scene`, and `table-help`.
5. Specify which questions hit RAG and which hit RLM.
6. Design the shared board vs private player panel responsibilities.
7. Define AFK, timer, and pause semantics.
8. Create one playable vertical slice: `upload sheet -> enter scene -> take turns -> resolve combat -> finish encounter`.

## 11. Success Criteria

You are on track if:

- a session can run without the model improvising core mechanics,
- players can understand their available actions quickly,
- rule answers are cited and trustworthy,
- long sessions remain coherent through explicit state plus compacted memory,
- generated quests are simple but consistently playable.

## 12. One-Sentence Project Definition

`DND Agent` is a multiplayer, board-first, 2014 5e tactical quest runner where a strict rules engine resolves play, RAG grounds the rules, RLM supports lore/context handling, and the DM agent narrates the results.
