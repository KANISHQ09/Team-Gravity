# GRAVITY — Roadmap

> Status: **Draft for team review.** Combines the 8-phase project-initialization roadmap with the hackathon build plan in [`resources/Gravity.md`](../resources/Gravity.md) Document 4. Each ⛔ gate needs explicit team approval before the next phase starts.
>
> **Git rule:** all work stays local. Claude never commits, pushes, merges or opens PRs; it prints the commands for a team member to run manually.

## Part A — Project initialization

| Phase | Goal | Outputs | Gate |
| --- | --- | --- | --- |
| **1 Planning** ✅ drafted | Understand the project | `docs/PROJECT_OVERVIEW.md`, `REQUIREMENTS.md`, `FEATURES.md`, `TECH_STACK.md` (proposal), `ARCHITECTURE.md`, `ROADMAP.md`, `RESOURCE_PLAN.md` | ⛔ Approve the requirements and **tech stack** |
| **2 Repository** | Repo basics | `.gitignore`, `.editorconfig`, `.gitattributes`; branch strategy decided | ⛔ Decide license and branch model |
| **3 Folder structure** | Skeleton | `apps/web`, `apps/server`, `packages/{shared,catalog,engine}`, `tools/`, `docs/`, `.github/` with a short explanation of each | ⛔ Approve the structure |
| **4 Documentation** | Community files | `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/PULL_REQUEST_TEMPLATE.md`, issue templates, `docs/DATA_LEDGER.md`, `docs/API_DOCUMENTATION.md` | Review |
| **5 Dev environment** | Tooling | pnpm workspace, TypeScript configs, ESLint, Prettier, Vitest, Playwright, `.env.example` | Review dependency list |
| **6 Claude Code config** | Rules for Claude | Root `CLAUDE.md`: development rules, coding standards, **strict Git restrictions** | Review |
| **7 Validation** | Everything works | `pnpm install`, lint, type-check, test, build all pass; GitHub Actions CI that only validates (no deploy); secret scan; repo review report | ⛔ Approve the start of feature work |
| **8 Development** | Build features | Small tasks, one per branch, PRs raised manually | Per PR |

### Phase 2 decisions needed

| Decision | Options | Suggestion |
| --- | --- | --- |
| License | MIT · Apache-2.0 · GPL-3.0 · All rights reserved | MIT (Gravity.md assumed it; good for open education), **team's call** |
| Branch model | `main` + `feature/*` / `fix/*`, **or** `main` + `develop` + `feature/*` | During a 48-h hackathon: `main` + short-lived `feature/*`, with PRs against `main`. Add `develop` only if the team wants a staging line |
| Visibility | Public · Private | Public (free Actions minutes; Space Apps submissions usually link a public repo) |

## Part B — Hackathon build (after Phase 7 approval)

Times are relative to the team's kickoff (T+0). Detail: Gravity.md §4.3.

| Milestone | Window | Exit criteria |
| --- | --- | --- |
| **M1 Foundation** | T+0 → T+6 h | Monorepo runs, CI green, catalogs load, "Hello GRAVITY" renders |
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
- [ ] Technology stack approved
- [x] Architecture documented (draft)
- [ ] Folder structure approved
- [x] GitHub repository created (`KANISHQ09/Team-Gravity` exists as a remote; no commits yet)
- [ ] Branching strategy decided
- [ ] LICENSE selected
- [ ] README.md created
- [ ] CONTRIBUTING.md created
- [ ] SECURITY.md created
- [ ] CODE_OF_CONDUCT.md created
- [ ] CLAUDE.md configured
- [ ] Strict Git restrictions added
- [ ] Environment variables configured
- [ ] .gitignore configured
- [ ] Linting and formatting configured
- [ ] Testing environment configured
- [ ] GitHub Actions CI configured
- [ ] Initial build and tests verified
