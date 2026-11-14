# Contributing to GRAVITY

Thanks for helping build GRAVITY. This guide covers how we work: branches, commits, pull requests and code standards.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## 1. Before you start

1. Read [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md), [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).
2. Find or open an issue for the work. Small fixes can skip this; features can't.
3. Tell the team on the issue (or the team call) that you're picking it up.

Local setup: [README → Installation and running locally](README.md#installation-and-running-locally). Run `pnpm check` before opening a PR; it runs the same checks as CI.

## 2. Branches

We use **`main` + short-lived branches**. There is no `develop` branch.

| Branch | Use | Example |
| --- | --- | --- |
| `main` | Stable, always deployable. Protected: changes arrive only through PRs | — |
| `feature/<area>-<topic>` | New feature | `feature/engine-budgets` |
| `fix/<topic>` | Bug fix | `fix/gauge-rounding` |
| `docs/<topic>` | Documentation only | `docs/api-endpoints` |
| `chore/<topic>` | Tooling, config, dependencies | `chore/eslint-setup` |

- Branch from an up-to-date `main`.
- Keep branches small and short-lived (hours, not days). Merge or rebase `main` in often.
- One topic per branch.

## 3. Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short summary in present tense>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `build`. Scopes match packages or features: `engine`, `catalog`, `shared`, `web`, `server`, `studio`, `rooms`.

Examples: `feat(engine): add power budget with eclipse fraction` · `fix(studio): show over-limit status for mass gauge`.

## 4. Pull requests

1. Push your branch and open a PR against **`main`**.
2. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) completely.
3. CI must pass: the **CI** workflow (lint, format, type-check, tests, build, dependency audit) and **CodeQL** run on every PR.
4. Get at least **one approval** from another team member. During the hackathon a verbal "ship it" on the team call is acceptable; note it in the PR.
5. A team member **squash-merges**; the branch is then deleted.

PR size: aim for under ~400 changed lines. Split larger work.

### About Claude Code and other AI assistants

AI assistants may edit files locally but **never** commit, push, merge or open PRs. A human team member reviews the changes and runs every Git command. See [CLAUDE.md](CLAUDE.md) §6–7; `.claude/settings.json` blocks those commands for Claude Code. Personal Claude settings go in `.claude/settings.local.json` (git-ignored). Don't use it to weaken the deny rules.

## 5. Code standards

| Area | Rule |
| --- | --- |
| Language | TypeScript in strict mode everywhere |
| Format and lint | Prettier + ESLint (`pnpm format`, `pnpm lint:fix`); fix all warnings before opening a PR |
| Structure | Follow [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md); group code by feature; don't create duplicate components |
| Engine | `packages/engine` stays **pure and deterministic**: no DOM, network, `Date.now()` or unseeded `Math.random()` |
| Data | Game numbers live in `packages/catalog/data/*.json` with a provenance label (`NASA` / `DERIVED` / `GAME`); new sources go in [DATA_LEDGER.md](docs/DATA_LEDGER.md) |
| Validation | All external input (REST, sockets, catalogs, saved designs) is checked with Zod |
| Errors | Engine returns typed results and never throws into the UI; server errors use RFC 9457 Problem Details |
| Secrets | Never hard-code keys or passwords; never commit `.env`; add new variables to `.env.example` |
| Dependencies | Don't add a library without a one-line reason in the PR, and check its license is compatible with MIT |
| Accessibility | Every interactive element works with the keyboard and has a label; status is never shown by colour alone |
| Text | User-facing text goes through i18n; explain *why*, avoid jargon, and link terms to the glossary |

## 6. Tests

- Add or update tests for any behaviour you change.
- Engine: unit tests plus property tests for determinism (target ≥ 80% coverage).
- UI: component tests for gauges, pickers, warnings; Playwright for main flows.
- Server: integration tests for routes and socket rooms.

## 7. Definition of Done

A task is done when it is: typed · tested · accessible (keyboard + labels) · provenance-labeled if it touches data · documented if behaviour changed · reviewed and merged by a human.

## 8. Reporting bugs and ideas

Use the issue templates: **Bug report** or **Feature request**. For security problems, don't open a public issue; follow [SECURITY.md](SECURITY.md).
