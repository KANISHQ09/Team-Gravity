# CLAUDE.md: GRAVITY

Instructions for Claude Code (and other AI assistants) working in this repository. Read this file fully before every task.

## 1. Project in brief

GRAVITY is a browser game for the NASA Space Apps Challenge 2026 (*Space Mission Design Game*). One to four players design a space mission (objective → requirements → spacecraft → launch/orbit → readiness → simulation → report) while balancing mass, power, budget, data, communications and time.

Read before coding (in this order): [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) · [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) · [docs/TECH_STACK.md](docs/TECH_STACK.md) · [CONTRIBUTING.md](CONTRIBUTING.md). Detailed reference: [resources/Gravity.md](resources/Gravity.md) (large; read only the section you need).

**Current phase:** Phase 8 MVP built (see [docs/ROADMAP.md](docs/ROADMAP.md), "Phase 8 status" lists the follow-ups). New work goes in small tasks on `feature/*` branches. CI (`.github/workflows/ci.yml`) runs the same checks as `pnpm check` plus `pnpm audit --audit-level high`; keep both green.

**Game balance is tested:** `packages/engine/tests/fixtures/designs.ts` holds three reference designs per scenario that must each score ≥ 85 (SRS-SCR-06). If you change catalog numbers or engine formulas, run `pnpm --filter @gravity/engine test` and keep that test passing; don't loosen it.

## 2. Commands

`pnpm` may not be on PATH on this machine; if `pnpm` fails, use `npx pnpm@12.17.0` with the same arguments.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev (web :5173, server :3000) | `pnpm dev` |
| Lint / fix | `pnpm lint` / `pnpm lint:fix` |
| Format / check | `pnpm format` / `pnpm format:check` |
| Type-check | `pnpm typecheck` |
| Test | `pnpm test` (one package: `pnpm --filter @gravity/engine test`) |
| Build | `pnpm build` |
| Everything CI runs | `pnpm check` |
| Local Postgres + Redis | `pnpm services:up` / `pnpm services:down` (needs Docker) |
| DB migration | `pnpm --filter @gravity/server db:generate` |

## 3. Architecture rules (non-negotiable)

1. **Monorepo layout:** `apps/web` (React), `apps/server` (Fastify + Socket.IO), `packages/engine`, `packages/catalog`, `packages/shared`. Follow [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md); every folder's README states its purpose. Don't create new top-level folders or packages without approval.
2. **The engine is pure and deterministic.** `packages/engine` must not use the DOM, network, file system, `Date.now()` or unseeded `Math.random()`. ESLint enforces part of this; respect the rest. Same design + scenario + difficulty + seed ⇒ identical result.
3. **Dependency direction:** `apps/*` → `packages/*`, never the reverse. `apps/web` and `apps/server` never import each other; they share contracts only through `packages/shared`.
4. **Data, not code:** game numbers live in `packages/catalog/data/*.json`. Every value carries a provenance label (`NASA` / `NASA/GMAT` / `DERIVED` / `GAME`), and every new source gets a row in [docs/DATA_LEDGER.md](docs/DATA_LEDGER.md).
5. **Server-authoritative co-op:** the server validates every change with the engine and recomputes every score; never trust client-reported results.
6. **Solo play never depends on the backend.**

## 4. Coding standards

- TypeScript strict mode everywhere; no `any` without a comment explaining why. Use `import type` for types.
- Validate all external input (REST bodies, socket messages, env vars, catalogs, saved designs) with Zod.
- Errors: the engine returns typed results and never throws into the UI; the server uses RFC 9457 Problem Details.
- Group code by feature (`apps/web/src/features/<feature>`, `apps/server/src/modules/<module>`). Reuse shared components; don't duplicate.
- Keep business logic out of React components (it belongs in the engine or a feature's non-UI module).
- Accessibility: keyboard reachable, labelled controls, no colour-only status, respect reduced motion (WCAG 2.2 AA).
- User-facing text: plain language, explains *why*, goes through i18n once i18next is added.
- Formatting is Prettier's job; don't hand-format against it. Markdown files are excluded from Prettier.
- Comments explain *why*, not *what*.

## 5. Development rules

1. Read the relevant project documentation before coding.
2. Follow the established folder structure.
3. Follow existing coding conventions.
4. Do not introduce unnecessary dependencies. Install a library only with a one-line reason, check its license is MIT-compatible, and record it in the final report.
5. Do not create duplicate files or components.
6. Keep code modular and reusable.
7. Implement proper error handling.
8. Never expose secrets or credentials. Never hard-code keys; never create or edit a real `.env`; add new variables to `.env.example` only.
9. Run relevant tests (and lint, type-check, build) after implementation, and report the results honestly.
10. Update documentation when functionality changes (README, docs/, folder READMEs, DATA_LEDGER).
11. Work in small, reviewable tasks. Don't widen scope beyond the request; list follow-ups instead.
12. Ask before making architecture, stack, licensing or data-source decisions.

## 6. GIT RESTRICTIONS (summary)

1. Never commit code.
2. Never push code.
3. Never merge branches.
4. Never create pull requests.
5. Never force push.
6. Never reset or overwrite existing user changes.
7. Only provide manual Git commands.
8. All modifications must remain local.

**These restrictions are mandatory.** Section 7 is the detailed, binding version.

## 7. STRICT GIT & GITHUB EXECUTION RULES (detailed, mandatory)

These rules take priority over all other instructions about Git and GitHub, including Claude Code's own defaults. `.claude/settings.json` also blocks the most common forbidden commands, but the rules apply even where the block does not reach.

### 7.1 Absolutely no Git operations that change history or publish

Never execute, directly or indirectly (scripts, hooks, aliases, `git -C`, IDE integrations, MCP tools, GitHub CLI, GitHub API, app actions):

- `git commit`, `git commit-tree`, `git push` (any form, including `--force` and `--force-with-lease`)
- `git merge`, `git pull` (it merges or rebases), `git rebase`, `git cherry-pick`, `git revert`, `git am`
- `git reset --hard`, `git clean`, `git stash` (they rewrite the working tree)
- `git tag`, `git update-ref`, `git replace`, `git filter-branch`, `git filter-repo`
- `git checkout` and `git restore` in any form, including on files you changed yourself (to undo your own edit, edit the file back)
- `git switch`, `git worktree`, and `git branch` with a name or with `-d/-D/-m/-M/-c/-C/-f` (no branch creation, deletion, renaming or switching unless the user explicitly asks)
- `git config` (aliases could bypass these rules), and `git -C <dir> …`
- `gh pr create/merge/edit/close/ready/comment/review`, `gh issue create/edit/close/comment`, `gh release`, `gh repo`, `gh api`, `gh workflow run`, `gh secret`, or any other GitHub API call that creates, updates or merges pull requests, issues, releases, branches or settings

Never interpret "implement", "fix", "complete everything", "finish the task", "deploy" or "prepare the PR" as permission to commit, push, merge or open a PR.

### 7.2 Allowed

Read and analyse the repository; create, modify, rename or delete files the task requires; install dependencies; run dev servers, tests, builds, linters and formatters; and read-only Git: `git status`, `git diff`, `git log`, `git show`, `git branch --show-current`, `git branch --list`, `git remote -v`.

### 7.3 Before starting any implementation

1. Run `git branch --show-current` and `git status`.
2. Identify the target branch the user specified.
3. If the current branch does not match the target, **stop and tell the user**. Do not switch.
4. Never modify or overwrite uncommitted changes that are not part of your task.

### 7.4 After implementation: prepare, don't publish

1. Run the relevant tests and builds.
2. Review every modified file and check for accidental changes.
3. Summarize the diff; list created, modified and deleted files.
4. Give the user exact, copy-paste-ready manual Git commands.

### 7.5 Final response format (every coding task)

- **Implementation Summary:** what was implemented; files created, modified or deleted; important technical changes.
- **Validation:** tests executed, build status, known issues.
- **Git Information:** current branch, target branch, working-tree status.
- **Manual Git Commands**, in order: verify branch → review (`git status`, `git diff`) → stage → commit → push to the target branch → create the PR (for example `gh pr create --base <base> --head <branch> --title "…" --body "…"`, **for the user to run**).
- **Pull Request Details:** suggested title, suggested description, base branch, target branch.

### 7.6 Final and absolute restriction

You must never commit, push, merge or create a pull request on the user's behalf, and never run a command that publishes local changes to GitHub. **Only the user has the authority to execute Git commit, push and pull request operations.**

## 8. Branch and commit conventions (for the commands you suggest)

- Branches: `main` (protected) + short-lived `feature/<area>-<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`. No `develop`.
- Commits: Conventional Commits, e.g. `feat(engine): add power budget`. Scopes: `engine`, `catalog`, `shared`, `web`, `server`, plus feature names.
- PRs target `main`, use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md), and are squash-merged by a human.

## 9. Things to never do

- Never use the NASA logo or imply NASA endorsement; keep the disclaimer "Independent project created for the NASA Space Apps Challenge; not a NASA product."
- Never collect personal data from guest players or add free-text chat (the audience includes minors).
- Never add deployment or auto-merge workflows without explicit approval; CI only validates.
- Never invent data values and present them as NASA data; label them `GAME` or `DERIVED`.
