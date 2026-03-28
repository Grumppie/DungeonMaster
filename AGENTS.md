## Repository Workflow

This file defines repo-wide agent rules. Folder-local `AGENTS.md` files add narrower ownership rules and do not override this file.

### Commit Discipline

Agents must commit regularly.

- After any meaningful, self-contained slice of work is complete, create a git commit before continuing.
- Treat a change as "meaningful" when it materially changes behavior, architecture, contracts, UX, or test coverage.
- Do not let large stacks of unrelated or only loosely related changes accumulate without commits.
- Run the relevant validation for the slice first when practical, then commit.
- If the current slice is incomplete or knowingly broken, keep working until it reaches a coherent commit boundary.
- Use focused, descriptive, non-interactive commit messages.
- Do not amend existing commits unless the user explicitly asks for it.

### Architecture Discipline

- Root entry files should stay thin and delegate into domain or feature modules.
- Shared contracts belong in `src/contracts/` or canonical backend validators/helpers, not duplicated inline.
- Use the nearest folder-level `AGENTS.md` to decide where new code belongs.
- If a file starts mixing orchestration, domain logic, and presentation, split it immediately.

### Ownership Lookup

- `convex/domain/*/AGENTS.md` defines backend domain ownership.
- `src/features/*/AGENTS.md` defines frontend feature ownership.
- `src/contracts/AGENTS.md` defines shared contract ownership.
