# DND Agent

Closed-beta D&D 5e session runner built with React, Convex, Clerk, Deepgram, and Gemini-based corpus search.

## What It Does

- Host or join a session through a shared link
- Pick one of four fixed level-3 archetypes
- Start an adaptive quest that scales to party size
- Run authoritative combat in Convex
- Search indexed rulebook and project corpora with vector retrieval

## Tech Stack

- Frontend: React + Vite
- Backend: Convex
- Auth: Clerk
- Voice: Deepgram
- Embeddings: Google Gemini

## Environment

Add the required values to `.env` or `.env.local`:

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` starts both the Convex dev server and the Vite client.

## Test The Game

1. Sign in with Clerk in the browser.
2. Create a hosted session from one tab.
3. Copy the join link or join code.
4. Open a second browser window or incognito session and join the same session.
5. Pick archetypes for both players.
6. Start the adventure as the host.
7. When combat starts, use the combat panel to:
   - select a target
   - attack
   - cast a spell
   - move
   - end turn
8. Watch the encounter log and combatant HP update in realtime.

## Corpus Ingestion

If you add lawful source files under `data/`, reindex them with:

```bash
npm run corpus:ingest
```

## Production Check

```bash
npm run build
```

## Browser Feedback Loop

Research and setup guidance for Codex + Playwright MCP + browser-based bug fixing lives in `docs/browser-feedback-loop.md`.

## Playwright E2E

Install Playwright browsers once:

```bash
npx playwright install chromium
```

Start the app locally in a separate terminal:

```bash
npm run dev
```

Bootstrap saved auth state for the host user:

```bash
npm run test:e2e:bootstrap:host
```

Or run it with credentials in the shell for automatic Clerk sign-in:

```powershell
$env:PLAYWRIGHT_E2E_HOST_USERNAME="host-username"
$env:PLAYWRIGHT_E2E_HOST_PASSWORD="host-password"
npm run test:e2e:bootstrap:host
```

Bootstrap saved auth state for the guest user:

```bash
npm run test:e2e:bootstrap:guest
```

Automatic guest sign-in uses:

```powershell
$env:PLAYWRIGHT_E2E_GUEST_USERNAME="guest-username"
$env:PLAYWRIGHT_E2E_GUEST_PASSWORD="guest-password"
npm run test:e2e:bootstrap:guest
```

Run the two-user room flow:

```bash
npm run test:e2e
```

## Notes

- Combat resolution is authoritative in Convex.
- The beta starts with four curated archetypes:
  - Human Fighter
  - Dwarf Cleric
  - Elf Rogue
  - Tiefling Sorcerer
- The current engine supports turn order, attacks, spells, movement, downed states, and death saves.
