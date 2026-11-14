# GRAVITY — Technology Stack

> Status: **✅ Approved by the team (2026-11-14): full stack from [`resources/Gravity.md`](../resources/Gravity.md) §0.3.** Any change to this stack needs team approval first.

## 1. Approved stack

| Layer | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Language | **TypeScript** (strict) end to end | The same engine runs in the browser and on the server | Python backend: would mean writing the engine twice |
| Monorepo | **pnpm workspaces + Turborepo** | Shared packages; build and test results are cached | npm workspaces: slower, no caching |
| Frontend | **React 18 + Vite + Zustand + Tailwind CSS + Radix UI** | Fast iteration; Radix gives keyboard and screen-reader support | SvelteKit: smaller component ecosystem |
| 3D / visuals | **react-three-fiber + drei (Three.js)**, **Recharts**, Canvas 2D low-power fallback | Interactive spacecraft and orbit views; gauges and charts | Canvas 2D only |
| Animation | **Framer Motion** (respects reduced motion) | Accessible transitions | CSS only |
| Simulation engine | **Pure TypeScript package `@gravity/engine`**, seeded random-number generator (mulberry32), run in a **Web Worker** | Same result every time, testable; shared by solo play and the server | Rust/WASM: unnecessary at this scale |
| Validation | **Zod** (+ `zod-to-openapi`) | One schema for catalogs, REST, socket messages and OpenAPI docs | Hand-written checks |
| Backend | **Node.js 22 LTS + Fastify + Socket.IO** | Real-time rooms for up to 4 players | Colyseus: steeper learning curve |
| Database | **PostgreSQL 16 (Neon) + Drizzle ORM** | Designs, runs, scores, rooms; design documents stored as JSONB | Supabase: ties auth and real-time to one vendor |
| Cache / shared room state | **Redis (Upstash)** + Socket.IO Redis adapter | Room state, leaderboard sorted sets, rate limits, rooms that work across server instances | In-memory: loses state on restart |
| Background jobs | **BullMQ** (inside the server process at MVP) | Score recompute, cleanup, backups | Cron only |
| Local storage | **Dexie** (IndexedDB) | Solo autosave, undo history | Raw IndexedDB |
| Offline | **vite-plugin-pwa** | Solo play works offline | Hand-written service worker |
| Auth | **Guest login token (JWT)** at MVP (15-min access + 30-day `HttpOnly` refresh cookie); **Google/GitHub sign-in** (OIDC + PKCE) after MVP | No personal data for guests | Accounts required: blocks classrooms |
| Logging | **pino** (structured JSON) | Fast, no personal data in logs | console |
| Hosting | **Vercel** (static web) + **Fly.io** (Docker server, 2+ instances in production) + **Cloudflare R2/S3** (backups, assets) | Free/cheap tiers, WebSocket-friendly | Render / Railway |
| CI | **GitHub Actions**: lint, type-check, tests, catalog validation, build, Playwright, Lighthouse CI, CodeQL, Dependabot | Free for public repos | GitLab CI |
| Monitoring | **Sentry** (errors), **Better Stack or Grafana Cloud** (logs/metrics), **PostHog** (anonymous analytics) | Generous free tiers | Self-hosted Prometheus |
| Testing | **Vitest**, **fast-check**, **Testing Library**, **Testcontainers**, **Playwright**, **axe-core**, **k6** | Unit to load testing | Jest |
| Lint / format | **ESLint (flat config) + typescript-eslint + eslint-plugin-jsx-a11y + Prettier** | Standard | Biome |
| i18n | **i18next** (English at MVP) | Ready for Hindi/Italian later | — |
| AI (post-MVP) | **Claude API** through a server proxy for the "Mission Mentor" coach | Explanations grounded in the engine's report | Template-based explanations only (MVP default) |

**Key architectural decision:** solo play runs **fully in the browser** (no server, works offline). Co-op uses a **server-authoritative** room that runs the same engine package.

## 2. Guardrails for the team

| Rule | Why |
| --- | --- |
| **Automation that only validates.** CI runs checks; deploy workflows stay disabled until the team approves them; no auto-merge | Matches the manual-PR rule |
| **Set up accounts early** (Vercel, Fly.io, Neon, Upstash, Sentry) in Phase 0/1 | The full stack adds about 6–8 h of setup, so start it early |
| **Solo play never depends on the backend** | If Postgres, Redis or Fly.io fails, solo play still demos |
| **Hot-seat co-op stays as a fallback** | If real-time rooms are unstable at T+27 h, switch to hot-seat |
| **Use a local Docker Compose** with Postgres 16 + Redis | Everyone develops against the same services |
| **Secrets only in platform secret stores** and `.env` (git-ignored); `.env.example` documents them | No credentials in the repo |

## 3. Environment variables (planned)

| Variable | Used by | Phase |
| --- | --- | --- |
| `DATABASE_URL` | server | 5 |
| `REDIS_URL` | server | 5 |
| `JWT_SIGNING_KEY` | server | 5 |
| `CORS_ORIGIN` | server | 5 |
| `SENTRY_DSN` (web + server) | both | when monitoring is enabled |
| `POSTHOG_KEY` | web | when analytics is enabled |
| `OAUTH_GOOGLE_*`, `OAUTH_GITHUB_*` | server | post-MVP |
| `NASA_API_KEY` | server | post-MVP data panel |
| `ANTHROPIC_API_KEY` | server | post-MVP Mission Mentor |

## 4. Dependency policy

- No library is installed without a one-line reason in the PR description.
- Versions are pinned by the lockfile; each new dependency's license is checked.
- Prefer platform Web APIs over a library when the effort is similar.
