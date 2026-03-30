# DungeonMaster

Prompt-driven multiplayer D&D runtime built with React, Convex, Clerk, and a browser-first play loop.

This repo is not trying to be a generic fantasy generator anymore. The host can now seed the run with an explicit world prompt, and the opener is shaped around that brief:

- dark cathedral hunt
- pirate harbor raid
- jungle ruin expedition
- infernal fortress breach
- skybridge skirmish

If the world brief reads combat-heavy, the first level can open in combat. If it reads like mystery, exploration, or intrigue, the first level opens with visible leads, NPC pressure, and interactables instead of an empty room.

## Current Shape

- Multiplayer room flow with private or public sessions
- Four fixed archetypes for fast party setup
- Authoritative Convex combat with preview/confirm flow
- Prompt-driven world seeding from the host's world brief
- DM scene replies constrained by live map, scene, transition, and door state
- Clause-level DM voice chunking so Deepgram can start speaking before the full reply finishes
- Playwright E2E harness for the two-user host/join/start flow

## Stack

- Frontend: React + Vite
- Backend: Convex
- Auth: Clerk
- Voice: Deepgram
- LLM orchestration: LangGraph + OpenAI-compatible responses

## Local Setup

Create `.env.local` or `.env` with:

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`

Install and run:

```bash
npm install
npm run dev
```

`npm run dev` starts both Convex and the Vite client.

## Creating A Better Run

From the room creation screen, provide:

- `Character name`
- `Session title`
- `World prompt`

Example world prompts:

- `A brutal pirate city under blood-red tides, with boarding fights, drowned vaults, and cursed harpoon gangs.`
- `A gothic abbey full of grave choirs, false saints, and candlelit crypt ambushes.`
- `A serpent jungle ruin with dinosaur hunts, collapsing rope bridges, and venom cultists.`
- `A sky-fortress war where chain bridges, boarding hooks, and storm cannons matter.`

The world prompt is persisted on the session and used by both the graph path and the deterministic fallback builder.

## Testing

Build the app:

```bash
npm run build
```

Refresh Convex bindings after schema or function changes:

```bash
npx convex codegen
```

### Playwright E2E

Install Chromium once:

```bash
npx playwright install chromium
```

Start the local app in another terminal:

```bash
npm run dev
```

Bootstrap auth for the host:

```bash
npm run test:e2e:bootstrap:host
```

Bootstrap auth for the guest:

```bash
npm run test:e2e:bootstrap:guest
```

Run the two-user room-flow spec:

```bash
npm run test:e2e
```

Automatic Clerk bootstrap also works with shell env vars:

```powershell
$env:PLAYWRIGHT_E2E_HOST_USERNAME="host-username"
$env:PLAYWRIGHT_E2E_HOST_PASSWORD="host-password"
$env:PLAYWRIGHT_E2E_GUEST_USERNAME="guest-username"
$env:PLAYWRIGHT_E2E_GUEST_PASSWORD="guest-password"
```

## Browser Feedback Loop

Research and setup notes for the Codex + Playwright MCP workflow live in `docs/browser-feedback-loop.md`.

## Notes

- Combat legality is authoritative in the combat engine and now has deterministic guardrails in the scene-prompt lane for off-sheet ability requests.
- Doorway narration is bound to actual door and transition state; the DM should not narrate a new corridor or room before the map state changes.
- Scene transitions are still anchor-driven. Scene change, map change, and level flow are tied to transition unlock + actual advancement rather than DM prose alone.
