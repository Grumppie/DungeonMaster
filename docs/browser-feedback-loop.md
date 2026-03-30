# Browser Feedback Loop Research

Research date: March 30, 2026

## What I verified locally

- The repo is a React + Vite frontend with Convex realtime state and Clerk auth.
- The main user flow is browser-driven: sign in, create or join a room, pick archetypes, start a run, then drive runtime and combat actions.
- The project had no Playwright, Cypress, Puppeteer, or browser MCP wiring yet.
- This Codex install already supports MCP servers through `~/.codex/config.toml`, and `codex mcp add` is available locally.
- Local tooling is compatible with current browser MCP packages:
  - `node -v` -> `v24.13.0`
  - `npm -v` -> `11.6.2`
  - `@playwright/mcp` current npm version observed -> `0.0.68`
  - `@browserbasehq/mcp-server-browserbase` current npm version observed -> `2.4.3`

## What this app actually needs

This is not a simple one-page CRUD app. The useful browser loop has to cover:

- Clerk sign-in, which is a real auth boundary and cannot be hand-waved away
- Convex-backed realtime updates, so timing and presence bugs matter
- host plus guest behavior, because room creation and join flows are core
- in-session runtime actions, not just landing-page rendering

That means a useful setup needs both:

1. an exploratory browser control path for fast debugging
2. a reproducible regression path so a bug fix does not stay manual forever

## Option comparison

### 1. Playwright MCP

Best fit for local interactive debugging with Codex.

Why it matches this repo:

- Microsoft ships a first-party Playwright MCP server and explicitly includes Codex installation instructions.
- The server supports persistent user profiles, isolated storage-state bootstrapping, saved traces, videos, network logs, console output, screenshots, and direct browser code execution.
- It also has an extension mode that can attach to an already logged-in Chrome/Edge profile, which is useful if Clerk login is annoying to automate repeatedly.

Tradeoffs:

- The Playwright MCP README explicitly notes that coding agents may prefer Playwright CLI plus skills for token efficiency.
- MCP is still the practical choice here because this Codex environment already supports MCP, while no Playwright CLI skill is installed in this session.
- A single Playwright MCP server is strongest for one authenticated user at a time. Multi-user flows are possible, but they are cleaner in scripted Playwright tests.

### 2. Browserbase MCP

Best fit if you want a managed browser service instead of local browser processes.

Why it is credible:

- Browserbase provides both hosted Streamable HTTP MCP and local STDIO MCP.
- It is built on Stagehand and exposes natural-language browser tools like `start`, `navigate`, `act`, `observe`, `extract`, and `end`.
- It supports persistent contexts, session recording, proxies, keep-alive sessions, and remote observability.

Tradeoffs:

- It requires Browserbase credentials.
- It is better for hosted reliability and remote session management than for fine-grained local test authoring.
- For this repo, Browserbase is a strong second option, not the first option, unless local Playwright setup becomes unstable or you want recordings and hosted sessions from day one.

### 3. Plain Playwright test runner

Not a replacement for MCP, but mandatory as the second leg of the loop.

Why it matters:

- Playwright supports isolated browser contexts and explicitly supports multiple contexts in a single test, which is exactly what this app needs for host and guest validation.
- Playwright auth docs recommend saving authenticated browser state under `playwright/.auth` and reusing it across tests.
- Once a bug is discovered via MCP exploration, the durable fix is to convert that path into a Playwright spec.

## Recommendation

Use a two-layer setup.

### Primary layer: Playwright MCP for Codex

Use this for:

- exploratory clicking through the app
- reading console and network behavior
- capturing traces and screenshots
- quickly reproing UI/runtime bugs while editing code

### Secondary layer: Playwright specs in the repo

Use this for:

- host + guest room flow
- archetype selection
- start-adventure path
- first combat action smoke coverage

This is the only reliable way to keep the bug-fixing loop from becoming manual again.

### Optional third layer: Browserbase MCP

Add this only if you need:

- hosted browser infrastructure
- persistent remote sessions
- session recordings and observability outside the local machine
- more resilient runs against sites that are hostile to local automation

## Best setup for this repo

### Recommended now

1. Register Playwright MCP in Codex.
2. Restart Codex so browser tools become available.
3. Sign in once through the Playwright-managed browser profile.
4. Use that profile for interactive debugging and bug triage.
5. Convert each fixed bug into a Playwright test.

### Recommended next for multi-user coverage

Add repo-local Playwright tests that keep two auth states:

- `playwright/.auth/host.json`
- `playwright/.auth/guest.json`

Then write smoke coverage for:

- host creates room
- guest joins with invite code
- both choose archetypes
- host starts run
- at least one combat interaction succeeds and updates UI

## Codex MCP setup

Minimal Codex config:

```toml
[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]
```

Equivalent CLI command:

```powershell
codex mcp add playwright -- npx @playwright/mcp@latest
```

Useful Playwright MCP arguments for this project:

- `--extension`
  Use an already logged-in Chrome/Edge profile via the Playwright MCP Bridge extension.
- `--user-data-dir <path>`
  Persist browser auth and state between sessions.
- `--storage-state <path>`
  Start isolated sessions from a saved auth state.
- `--save-session`
  Save session artifacts.
- `--save-trace`
  Save Playwright traces for post-failure analysis.
- `--save-video=1280x720`
  Save browser video for flaky runtime bugs.
- `--console-level=info`
  Surface console noise that matters when debugging runtime and auth issues.

Example richer config for this repo:

```toml
[mcp_servers.playwright]
command = "npx"
args = [
  "@playwright/mcp@latest",
  "--save-session",
  "--save-trace",
  "--save-video=1280x720",
  "--console-level=info"
]
```

### When to use extension mode

Use Playwright MCP extension mode if you want Codex to attach to a browser where you already signed into Clerk manually.

That is the fastest path when:

- Clerk login has CAPTCHA, email codes, or social login friction
- you want to reuse your real browser session immediately
- you do not want auth automation to block bug reproduction

## Browserbase MCP setup

Hosted Browserbase MCP endpoint:

```text
https://mcp.browserbase.com/mcp
```

Typical hosted config shape:

```toml
[mcp_servers.browserbase]
url = "https://mcp.browserbase.com/mcp?browserbaseApiKey=YOUR_BROWSERBASE_API_KEY"
```

Use Browserbase when you want managed browser sessions and recordings more than local control simplicity.

## Practical feedback loop

1. Start the app with `npm run dev`.
2. Use Playwright MCP to sign in and create a room as host.
3. Reproduce the target flow.
4. If the bug depends on a second user, use Playwright tests for the dual-user path or set up a second persisted browser identity.
5. Capture the failing state with trace, video, screenshot, console output, and network logs.
6. Patch the code.
7. Re-run the exact browser path.
8. Once stable, encode the path as a Playwright spec.

## Repo changes made with this research

- Added `playwright/.auth/` to `.gitignore` so saved auth state does not leak into git.
- Added `playwright-report/`, `test-results/`, and `.codex-playwright/` to `.gitignore` for browser artifacts and debugging output.

## Sources

- Playwright MCP repo: https://github.com/microsoft/playwright-mcp
- Playwright auth guide: https://playwright.dev/docs/auth
- Playwright isolation guide: https://playwright.dev/docs/browser-contexts
- Browserbase MCP introduction: https://docs.browserbase.com/integrations/mcp/introduction
- Browserbase MCP setup: https://docs.browserbase.com/integrations/mcp/setup
