# GRAVITY — Space Mission Design Game

> **Status: ✅ playable MVP (Phase 8).** All three scenarios can be designed, launched and scored in the browser, solo or hot-seat with up to four players. The server provides guest login, server-side scoring, leaderboards and online co-op rooms (the web lobby for online rooms is a follow-up). See the [roadmap](docs/ROADMAP.md).

GRAVITY is a browser game for the **NASA Space Apps Challenge 2026 — Space Mission Design Game**. Solo or in a team of up to four, players design a complete space mission: pick a science objective, turn it into measurable requirements, design the spacecraft and choose instruments, pick a launch vehicle and orbit, balance **mass, power, budget, data, communications and time**, pass a launch-readiness review, fly the mission, and read a report that explains **why** it succeeded or failed.

*Independent project created for the NASA Space Apps Challenge; not a NASA product.*

## Screenshots / demo

No public deployment yet. Run it locally with `pnpm dev` (see below) and open <http://localhost:5173>.

## Features (built)

| Area | What works today |
| --- | --- |
| Mission setup | 3 scenarios (CubeSat Earth Observer, Lunar Orbiter, Mars Orbiter); Explorer / Engineer / Flight Director difficulty |
| NASA-style flow | Six stages: Need & Goals → Concept → Requirements → Design → Build & Verify → Implement |
| Science first | Goal selection and a live Science Traceability Matrix (goal → measurement → instrument → requirement) |
| Design | 40 parts, 5 launch vehicles, 13 orbits; Master Equipment List; live gauges for mass, power, budget, data, communications and schedule; unavailable options show why |
| Requirements | 12+ measurable requirements, each with a verification method (test, analysis, inspection, demonstration) |
| Readiness | Green/yellow/red launch review (≥ 80% green and every critical item green) and a 5×5 risk matrix |
| Simulation | Deterministic six-phase simulation with random events (solar storms, wheel failures, launch slips, budget cuts, antenna anomalies, battery wear) that your design choices soften |
| Report | 0–100 score in five parts, cause-and-effect explanations, one-click "Try changing…" suggestions, similar real NASA missions, 2D mission replay |
| Team play | Hot-seat co-op for 2–4 players with roles, proposals and a GO/NO-GO vote. Server-side online rooms (Socket.IO) are implemented and tested; the web lobby for them is a follow-up |
| Sharing | Autosave in the browser; shareable design codes; optional online leaderboard (server recomputes every score) |
| Learning | Explorer hints, glossary, "why does this matter?" on every part; every number labelled `NASA` / `DERIVED` / `GAME` |
| Accessibility | Keyboard play, labelled controls, status never shown by colour alone, reduced motion, phone layout |

Full list and roadmap: [docs/FEATURES.md](docs/FEATURES.md), [docs/ROADMAP.md](docs/ROADMAP.md).

## Technology stack

TypeScript monorepo (pnpm + Turborepo) · React 18, Vite, Zustand, Tailwind CSS · Node.js 22, Fastify, Socket.IO · PostgreSQL 16 + Drizzle · Redis · Vitest, fast-check · GitHub Actions.

Details and trade-offs: [docs/TECH_STACK.md](docs/TECH_STACK.md).

## Architecture overview

```mermaid
flowchart LR
  WEB["apps/web<br/>React app + engine (runs in the browser)"] <-->|"REST + WebSocket"| SRV["apps/server<br/>Fastify + Socket.IO + engine"]
  SRV --> PG[("PostgreSQL")]
  SRV --> RD[("Redis")]
  WEB --> ENG["packages/engine<br/>pure, deterministic game rules"]
  SRV --> ENG
```

Solo play runs entirely in the browser (offline after the first load). Co-op rooms are server-authoritative and use the same engine. More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- **Node.js 22 LTS** (22.12 or newer; see `.nvmrc`)
- **pnpm 12.17.0** (pinned in `package.json`). Install it with `corepack enable` (recommended) or `npm install -g pnpm@12.17.0`. If neither works, prefix commands with `npx pnpm@12.17.0` instead of `pnpm`.
- **Docker Desktop**: runs PostgreSQL 16 and Redis locally (only needed once server features use them). Setup and everyday commands: [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)
- Git

## Installation and running locally

```bash
pnpm install                  # install all workspace dependencies
cp .env.example .env          # defaults work for local dev; JWT_SIGNING_KEY can stay empty for now
pnpm services:up              # start local PostgreSQL + Redis (Docker)
pnpm dev                      # web on http://localhost:5173, server on http://localhost:3000
```

Everyone creates their own `.env` from `.env.example`; don't send `.env` files to each other (they are per machine and will hold secrets later). The defaults work as they are unless another Postgres or Redis already uses port 5432 or 6379 on your machine: then set `POSTGRES_PORT` / `REDIS_PORT` and the matching port in `DATABASE_URL` / `REDIS_URL` (see [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)). Apply the database tables once with `pnpm --filter @gravity/server db:migrate`.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts the web app (Vite) and the server (tsx watch) together. If port 5173 is busy, use `pnpm --filter @gravity/web dev --port 5174` |
| `pnpm build` | Production build of the web app (`apps/web/dist`) and server (`apps/server/dist`) |
| `pnpm test` | Runs all Vitest suites |
| `pnpm typecheck` | Strict TypeScript check of every package |
| `pnpm lint` / `pnpm lint:fix` | ESLint (includes accessibility and engine-purity rules) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm check` | Lint, format check, typecheck, tests and build: the same checks CI runs |
| `pnpm services:down` | Stop the local database and Redis |
| `pnpm --filter @gravity/server db:migrate` | Apply database migrations (needed once before using Postgres) |
| `pnpm --filter @gravity/server db:generate` | Generate a new Drizzle migration after changing the schema |

The server runs without Postgres or Redis: scores are then kept in memory. With `DATABASE_URL` and `REDIS_URL` set (see `.env.example`), it stores scores in Postgres and `/readyz` checks both. With `REDIS_URL` set, co-op rooms are kept in Redis, shared across server instances and recovered after a restart. To run the Postgres and Redis integration tests: `TEST_DATABASE_URL=postgres://gravity:gravity@localhost:5432/gravity TEST_REDIS_URL=redis://localhost:6379/15 pnpm --filter @gravity/server test`.

## Environment variables

All variables are documented in [`.env.example`](.env.example); copy it to `.env` for local development. The server validates them at startup and refuses to start if one is invalid. Never commit a real `.env` file. Background: [docs/TECH_STACK.md §3](docs/TECH_STACK.md#3-environment-variables-planned).

## API documentation

Planned REST endpoints and socket events: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## Folder structure

```text
apps/web        React web app
apps/server     REST API + Socket.IO rooms
packages/engine game rules (pure, deterministic)
packages/catalog game data (JSON + schemas)
packages/shared types and message schemas shared by both apps
tools/          balance search, GMAT scripts
docs/           planning and reference documentation
resources/      challenge brief and NASA resources guide
```

Every folder has its own README. Full explanation: [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License and credits

Code is released under the [MIT License](LICENSE). Third-party data and media keep their own terms; every source is listed in the [data ledger](docs/DATA_LEDGER.md).

Built by **Team Gravity** for the NASA Space Apps Challenge 2026. Mission-design concepts come from the NASA and partner resources provided for the challenge (see [docs/RESOURCE_PLAN.md](docs/RESOURCE_PLAN.md)). NASA does not endorse this project.
