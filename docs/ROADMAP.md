# GRAVITY — Roadmap

> Status: **Draft for team review.** Combines the 8-phase project-initialization roadmap with the hackathon build plan in [`resources/Gravity.md`](../resources/Gravity.md) Document 4. Each ⛔ gate needs explicit team approval before the next phase starts.
>
> **Git rule:** all work stays local. Claude never commits, pushes, merges or opens PRs; it prints the commands for a team member to run manually.

## Part A — Project initialization

| Phase | Goal | Outputs | Gate |
| --- | --- | --- | --- |
| **1 Planning** ✅ drafted | Understand the project | `docs/PROJECT_OVERVIEW.md`, `REQUIREMENTS.md`, `FEATURES.md`, `TECH_STACK.md` (approved), `ARCHITECTURE.md`, `ROADMAP.md`, `RESOURCE_PLAN.md` | Tech stack ✅ approved (full Gravity.md stack); ⛔ requirements review pending |
| **2 Repository** | Repo basics | `.gitignore`, `.editorconfig`, `.gitattributes`; branch strategy decided ✅ License MIT, `main` + `feature/*`, public; `.gitignore`, `.gitattributes`, `.editorconfig` added |
| **3 Folder structure** | Skeleton [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md): `apps/web`, `apps/server`, `packages/{shared,catalog,engine}`, `tools/`, each with a README | ✅ Approved (2026-11-14); skeleton created |
| **4 Documentation** | Community files | `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/PULL_REQUEST_TEMPLATE.md`, issue templates, `docs/DATA_LEDGER.md`, `docs/API_DOCUMENTATION.md`, `.github/CODEOWNERS` | ✅ Drafted (2026-11-14); review |
| **5 Dev environment** | Tooling | pnpm + Turborepo workspace, TypeScript configs, ESLint, Prettier, Vitest, Docker Compose (Postgres 16 + Redis), Drizzle config, `.env.example` | ✅ Done (2026-11-14): lint, format, typecheck, test and build pass. Deferred: Playwright (with the first E2E flow), migration `0001_init` (with the schema, Phase 8). Team creates Neon/Upstash accounts |
| **6 Claude Code config** | Rules for Claude | Root `CLAUDE.md`: development rules, coding standards, **strict Git restrictions**; `.claude/settings.json` deny rules that block Git/GitHub write commands | ✅ Done (2026-11-14); deny rules verified live |
| **7 Validation** | Everything works | `.github/workflows/ci.yml` (lint, format, typecheck, test, build, `pnpm audit` high+) and `codeql.yml`, `dependabot.yml`; actions pinned to commit SHAs; validation only (no deploy, no merge). Local run: frozen install + `pnpm check` + audit pass; secret scan clean; stale docs fixed; Git deny rules extended to 100 | ✅ Done locally (2026-11-14); CI's first real run happens after push. ⛔ Approve the start of feature work |
| **8 Development** | Build features | Small tasks, one per branch, PRs raised manually | Per PR |

### Phase 2 decisions needed

| Decision | Options | Suggestion |
| --- | --- | --- |
| License | MIT · Apache-2.0 · GPL-3.0 · All rights reserved | ✅ **MIT** chosen (2026-11-14); `LICENSE` added at the repo root. Third-party data and media keep their own terms (see `docs/DATA_LEDGER.md`) |
| Branch model | `main` + `feature/*` / `fix/*`, **or** `main` + `develop` + `feature/*` | ✅ **`main` + `feature/*`** chosen (2026-11-14). No `develop` branch |
| Visibility | Public · Private | ✅ **Public** (`KANISHQ09/Team-Gravity`) |

### Branching rules (decided)

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Stable, always-deployable code | Protected: changes arrive only through PRs; CI must pass; no force-push |
| `feature/<area>-<topic>` | One feature (e.g. `feature/engine-budgets`, `feature/studio-gauges`) | Branch from `main`, keep it short-lived (hours, not days), raise a PR against `main` |
| `fix/<topic>` | Bug fix (e.g. `fix/gauge-rounding`) | Same as feature branches |
| `docs/<topic>`, `chore/<topic>` | Documentation or tooling only | Same as feature branches |

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- PRs are squash-merged by a team member; at least one reviewer approval (or a verbal "ship it" on the team call during the hackathon).
- Tag `v0.1.0` at submission (done manually by a team member).
- Branches are created, pushed and merged only by team members. Claude never creates or switches branches unless asked.

### Recommended GitHub settings (for a team member to apply manually)

Settings → Branches → add a rule for `main`: require a pull request before merging; require status checks to pass and select **"Lint, typecheck, test, build"** and **"Analyze (JavaScript/TypeScript)"** (they appear after the first CI run); block force pushes; block deletions. Settings → General → allow **squash merging** only; enable "Automatically delete head branches".

## Part B — Hackathon build (after Phase 7 approval)

Times are relative to the team's kickoff (T+0). Detail: Gravity.md §4.3.

| Milestone | Window | Exit criteria |
| --- | --- | --- |
| **M1 Foundation** | T+0 → T+6 h | Monorepo runs, CI green, catalogs load, Postgres + Redis connected, `/healthz` live, "Hello GRAVITY" renders |
| **M2 Engine + Studio** | T+6 → T+18 h | `validate`, `computeBudgets`, `evaluateReadiness` tested; a valid design can be built with live gauges in all 3 scenarios |
| **M3 Full loop** | T+18 → T+30 h | Six-stage flow → simulate → score → causal report; hot-seat co-op works; online rooms if on track |
| **M4 Demo-ready** | T+30 → T+40 h | Tutorial, glossary, accessibility pass, mobile layout, 2D replay, About page |
| **M5 Submitted** | T+40 → T+48 h | Code freeze at T+40, playtests, demo video, submission |

**Cut order if behind:** 3D views → sensitivity view → leaderboard → Mars scenario → online rooms (fall back to hot-seat).

## Part C — After the event (about 8 weeks)

| Phase | Weeks | Content |
| --- | --- | --- |
| Hardening | 1–2 | Raise test coverage, security review, full WCAG audit, load test |
| Accounts and content | 3–4 | Database, sign-in, saved designs, 3 more scenarios, sandbox |
| Classroom and localization | 5–6 | Teacher dashboard, classroom codes, Hindi/Italian, PWA install |
| Beta | 7 | 3–5 classroom pilots |
| v1.0 | 8 | Production launch with monitoring and backups |

## Pre-development checklist

- [ ] Project requirements finalized (drafted, awaiting review)
- [x] Technology stack approved (full Gravity.md stack, 2026-11-14)
- [x] Architecture documented (draft)
- [x] Folder structure approved
- [x] GitHub repository created (`KANISHQ09/Team-Gravity`, public)
- [x] Branching strategy decided (`main` + `feature/*`)
- [x] LICENSE selected (MIT)
- [x] README.md created
- [x] CONTRIBUTING.md created
- [x] SECURITY.md created
- [x] CODE_OF_CONDUCT.md created
- [x] CLAUDE.md configured
- [x] Strict Git restrictions added (CLAUDE.md §6–7 + `.claude/settings.json` deny rules)
- [x] Environment variables configured (`.env.example`, validated by the server)
- [x] .gitignore configured
- [x] Linting and formatting configured
- [x] Testing environment configured (Vitest; Playwright added with the first E2E flow)
- [x] GitHub Actions CI configured (first run on GitHub after push)
- [x] Initial build and tests verified (locally: 9 tests, build, audit)
