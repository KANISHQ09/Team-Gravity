# GRAVITY — Space Mission Design Game

> **Status: 🚧 pre-development.** Planning, repository setup, folder structure and the development environment are done; no game features exist yet (the web app shows a placeholder page and the server only answers `/healthz`). This README describes the **planned** product and will be updated as features are actually built. See the [roadmap](docs/ROADMAP.md).

GRAVITY is a browser game for the **NASA Space Apps Challenge 2026 — Space Mission Design Game**. Solo or in a team of up to four, players design a complete space mission: pick a science objective, turn it into measurable requirements, design the spacecraft and choose instruments, pick a launch vehicle and orbit, balance **mass, power, budget, data, communications and time**, pass a launch-readiness review, fly the mission, and read a report that explains **why** it succeeded or failed.

*Independent project created for the NASA Space Apps Challenge; not a NASA product.*

## Screenshots / demo

None yet. A demo link and screenshots will be added once the first playable build exists.

## Planned features

| Area | MVP (hackathon) |
| --- | --- |
| Mission setup | 3 scenarios (CubeSat Earth Observer, Lunar Orbiter, Mars Orbiter); Explorer / Engineer / Flight Director difficulty |
| NASA-style flow | Six stages: Need & Goals → Concept → Requirements → Design → Build & Verify → Implement |
| Design | Design Studio with live gauges for six resources, launch-compatibility checks, options that show why they're unavailable |
| Readiness | Green/yellow/red checklist and 5×5 risk matrix that gate launch |
| Simulation | Deterministic six-phase simulation with random events affected by design choices |
| Report | 0–100 score, cause-and-effect explanations, "Try changing…" suggestions |
| Team play | Online co-op for 2–4 players with roles, proposals and a GO/NO-GO vote; hot-seat fallback |
| Learning | Tutorial, glossary, plain-language "why" text; every number labeled `NASA` / `DERIVED` / `GAME` |
| Accessibility | Keyboard play, screen-reader labels, reduced motion, colour-blind-safe palette, phone and tablet layout |

Full list: [docs/FEATURES.md](docs/FEATURES.md).

## Technology stack

TypeScript monorepo (pnpm + Turborepo) · React 18, Vite, Zustand, Tailwind CSS, Radix UI, Recharts, react-three-fiber · Node.js 22, Fastify, Socket.IO · PostgreSQL 16 (Neon) + Drizzle · Redis (Upstash) · BullMQ · Vitest, Playwright · GitHub Actions · Vercel + Fly.io.

Details and trade-offs: [docs/TECH_STACK.md](docs/TECH_STACK.md).

## Architecture overview

```mermaid
flowchart LR
  WEB["apps/web<br/>React app + engine in a Web Worker"] <-->|"REST + WebSocket"| SRV["apps/server<br/>Fastify + Socket.IO + engine"]
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
| `pnpm --filter @gravity/server db:generate` | Generate a Drizzle migration from the schema |

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
