# GRAVITY — Resource Plan

> Status: **Draft for team review.** Covers the provided NASA and partner resources, the libraries and services we'd use, and how data is sourced and labeled. Libraries and services follow the approved [TECH_STACK](TECH_STACK.md) (full Gravity.md stack).

## 1. Provided challenge resources (`resources/resource.docx`)

| Resource | How GRAVITY uses it | Runtime dependency? |
| --- | --- | --- |
| **Design and Develop Science Missions** (NASA) | The six-stage game flow, four mission segments, the mission timeline (ConOps), and requirements that each carry a verification method | No (design source) |
| **Concept Maturity Levels** (JPL) | Difficulty ladder (CML 1–4), green/yellow/red readiness checklist, 35% margin rules, 5×5 risk matrix | No |
| **Mission Design Lab** (NASA) | Co-op roles work like an MDL study team; its four study tiers line up with the difficulty levels; the Master Equipment List and cost views | No |
| **CubeSat 101** (CSLI) | Beginner CubeSat scenario, tutorial wording, glossary | No |
| **GMAT** | Run offline to export Δv budgets, transfer times and trajectory samples to JSON (`tools/gmat/`) | No (offline, stretch) |
| **NASA Mission Viz** | Reference for turning GMAT data into the replay view | No (check its license before reusing any code) |
| **A Learning Game About Telescopes** (NASA) | Patterns: objectives first, disabled options with a reason, level progression, similar real missions in the report | No |
| **VR Mission Visualization** (2023 Space Apps challenge) | Confirms what the replay needs: concept, trajectory, timeline, 3D | No |
| **CSA digital games and activities** | Ideas for age-appropriate educational design | No |

Every source is recorded in `docs/DATA_LEDGER.md` (created in Phase 4) with columns: source, URL, terms, how it's used, label.

## 2. Data sourcing and labels

| Data | MVP source | Label |
| --- | --- | --- |
| Launch vehicle capacities and costs | Class archetypes (small / medium / heavy / super-heavy) scaled from public figures | `GAME` |
| Orbits: period, altitude | Calculated from standard physics | `DERIVED` |
| Eclipse fraction, coverage | Simplified lookup tables | `GAME` |
| Solar flux by distance | 1361 W/m² ÷ r² | `DERIVED` |
| Δv budgets | Analytical (Hohmann-type) estimates; GMAT exports if time allows | `DERIVED` → `NASA/GMAT` |
| Instrument and part mass, power, cost | Simplified ranges informed by public mission fact sheets | `GAME` |
| Similar real missions | Hand-picked list of about 10 missions with links; every fact checked | `NASA` |

## 3. Libraries (approved stack; installed in Phase 5)

| Purpose | Library | License (verify at install) |
| --- | --- | --- |
| UI | react, react-dom, vite | MIT |
| State / persistence | zustand, dexie | MIT / Apache-2.0 |
| Styling / accessible components | tailwindcss, @radix-ui/* | MIT |
| Charts | recharts | MIT |
| 3D (stretch) | three, @react-three/fiber, @react-three/drei | MIT |
| Validation | zod | MIT |
| Animation | framer-motion | MIT |
| Server | fastify, @fastify/jwt, @fastify/rate-limit, @fastify/cookie, socket.io, socket.io-client, pino | MIT |
| Database | drizzle-orm, drizzle-kit, postgres (driver) | Apache-2.0 / Unlicense (verify) |
| Redis / realtime scaling | ioredis, @socket.io/redis-adapter | MIT |
| Jobs | bullmq | MIT |
| API docs | @asteasolutions/zod-to-openapi | MIT |
| Offline | vite-plugin-pwa | MIT |
| i18n | i18next, react-i18next | MIT |
| Monitoring | @sentry/react, @sentry/node, posthog-js | MIT |
| Monorepo | turbo | MIT |
| Testing | vitest, fast-check, @testing-library/react, testcontainers, playwright, axe-core, k6 | MIT / Apache-2.0 / MPL-2.0 (axe-core) / AGPL-3.0 (k6, a CLI tool only, not bundled) |
| Quality | eslint, typescript-eslint, eslint-plugin-jsx-a11y, prettier | MIT |

## 4. Services and accounts

| Service | Purpose | Needed when | Cost |
| --- | --- | --- | --- |
| GitHub | Repo, issues, Actions CI, CodeQL, Dependabot | Phase 2 | Free |
| Docker Desktop | Local Postgres 16 + Redis (Docker Compose) | Phase 5 | Free |
| Neon | Managed PostgreSQL with point-in-time recovery | Phase 5 (create early) | Free tier |
| Upstash | Managed Redis | Phase 5 (create early) | Free tier |
| Vercel | Static web hosting | First deploy (needs approval) | Free tier |
| Fly.io | Docker server (Socket.IO + REST) | First deploy (needs approval) | Free / low tier |
| Cloudflare R2 (or S3) | Backups, images, 3D models | Before production | Free tier |
| Sentry | Error tracking | When monitoring is enabled | Free tier |
| Better Stack or Grafana Cloud | Logs and metrics | When monitoring is enabled | Free tier |
| PostHog | Anonymous analytics, Web Vitals | When analytics is enabled | Free tier |
| NASA Open APIs (`api.nasa.gov`) | Live data panel | **Future only** | Free key |
| Claude API | Mission Mentor coach | **Future only** | Paid |

Account sign-ups are for a team member to do; Claude does not create accounts or handle credentials.

## 5. People (team of 3)

The original plan assumed 4–5 people; with three, the five roles merge into three (as `resources/Gravity.md` §4.11 suggests). Review ownership is enforced through [`.github/CODEOWNERS`](../.github/CODEOWNERS).

| GitHub | Role | Owns |
| --- | --- | --- |
| @KANISHQ09 | **Tech lead + Engine + Science/QA** | `packages/engine` (simulation, scoring), `packages/catalog` (game data), `tools/` (balance script, GMAT), data ledger, test plans, playtests, repo rules and CI |
| @madhavansingh | **Frontend + Design** | `apps/web`: studio, gauges, simulation view, report, accessibility, UX and visual style, tutorial, glossary |
| @dimcodes09 | **Backend + Realtime** | `apps/server`, `packages/shared`: REST API, Socket.IO rooms, database and Redis, local services, deployment (when approved) |

**Shared by everyone:** demo video and submission, playtests, and reviewing each other's PRs (one approval needed; with three people a reviewer is always available).
