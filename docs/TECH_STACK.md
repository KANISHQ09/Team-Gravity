# GRAVITY — Technology Stack (PROPOSAL)

> Status: **⏳ Awaiting team approval. Install nothing until this is approved.**
>
> `resources/Gravity.md` §0.3 describes a production-grade stack (PostgreSQL, Redis, BullMQ, Sentry and others). For a 48-hour build, this proposal recommends a **lean MVP stack** that keeps the same language and engine design, so the production pieces can be added later without a rewrite.

## 1. Recommendation summary

| Layer | Recommended for MVP | Why | Alternative and trade-off |
| --- | --- | --- | --- |
| Language | **TypeScript** (strict) everywhere | One language, so the same simulation engine runs in the browser and on the server; types catch mistakes early | JavaScript: faster to start, but loses type safety across the engine |
| Package manager / monorepo | **pnpm workspaces** | Shares the engine package between client and server with no publishing | npm workspaces: zero extra install, slower; Turborepo can be added later for caching |
| Frontend | **React 18 + Vite** | Fast dev server; the team most likely already knows React | SvelteKit: lighter, smaller ecosystem |
| State | **Zustand** | Tiny, simple store; easy to persist | Redux Toolkit: more boilerplate |
| Styling / UI | **Tailwind CSS + Radix UI primitives** | Fast styling; Radix provides keyboard and screen-reader support out of the box (needed for WCAG 2.2 AA) | Plain CSS modules: no dependency, slower to build accessible widgets |
| Charts / 2D visuals | **Recharts** + SVG/Canvas for the replay | Gauges, trade-space chart and 2D replay with little code | D3: more control, more time |
| 3D (stretch only) | **react-three-fiber + drei** | Declarative Three.js; lazy-loaded so it never slows first load | Skip 3D entirely (it's the first item on the cut list) |
| Simulation engine | **Pure TypeScript package** (`@gravity/engine`), seeded random-number generator, run in a **Web Worker** | Same result every time, testable, works offline | Rust/WASM: faster but unnecessary at this scale |
| Validation | **Zod** | One schema checks catalogs, saved designs and network messages | Hand-written checks: more bugs |
| Multiplayer server | **Node.js 22 LTS + Fastify + Socket.IO**, rooms kept **in memory** | Real-time rooms for 2–4 players with the least setup; reuses the engine | Colyseus: richer room framework, steeper learning curve; PartyKit / Cloudflare Durable Objects: elegant but a new programming model |
| Database | **None at MVP.** Solo saves use the browser's IndexedDB (via Dexie); the leaderboard is a JSON file or in memory | Removes setup and hosting time from a 48-hour build | PostgreSQL (Neon) + Drizzle: add it in Track B or once the leaderboard is confirmed |
| Cache / shared room state | **None at MVP** (one server instance) | One instance doesn't need Redis | Redis (Upstash): needed only to scale across several server instances |
| Offline support | **vite-plugin-pwa** (service worker) | Solo play works offline (FR-12) | Hand-written service worker: error-prone |
| Testing | **Vitest** (unit), **fast-check** (property tests for determinism), **Testing Library**, **Playwright** (end-to-end), **axe-core** (accessibility) | Fast, works natively with Vite | Jest: slower with ESM and TypeScript |
| Lint / format | **ESLint (flat config) + typescript-eslint + Prettier** | Standard and widely supported | Biome: one fast tool, fewer plugins (no jsx-a11y) |
| CI | **GitHub Actions**: install, lint, type-check, test, build. **Validates only: no deploy, no auto-merge** | Free for public repos; matches the manual-PR rule | — |
| Hosting (when approved) | **Vercel or Netlify** for the static web app; **Render or Fly.io** for the Socket.IO server | Free tiers; WebSocket support | Run everything on one Render/Fly service: simpler, but no CDN for the app |
| Monitoring | **None at MVP**; console logs with structured output (pino) on the server | Saves time | Sentry free tier: add if time allows |
| AI | **None at MVP** | Explanations are built from templates using the engine's cause-and-effect trace, so they're always correct | Claude API "Mission Mentor" is Future scope |

## 2. What changes compared with `resources/Gravity.md`

| Gravity.md (full stack) | Lean MVP | When to add it back |
| --- | --- | --- |
| PostgreSQL (Neon) + Drizzle ORM | IndexedDB on the client, JSON/in-memory leaderboard | When accounts or a persistent leaderboard are needed |
| Redis (Upstash) + Socket.IO Redis adapter | In-memory rooms, one instance | When running more than one server instance |
| BullMQ jobs | None | When background jobs exist (backups, refresh) |
| Sentry, Better Stack, PostHog | Console/pino logs | Before a public classroom release |
| OAuth sign-in | Guest only (no auth at MVP; rooms joined by code) | Track B accounts phase |
| Turborepo | Plain pnpm workspaces | When CI build times hurt |

**Effect:** about 6–8 fewer hours of setup and hosting work during the hackathon, at the cost of no persistent leaderboard or accounts in the MVP.

## 3. Decisions needed from the team

1. Approve the **lean MVP stack** above, or the **full stack** from Gravity.md §0.3.
2. Is **multiplayer online rooms** in MVP scope, or do we start with **hot-seat co-op** and add rooms if time allows?
3. **Hosting** choice (or decide later; no deployment workflow will be added without approval).

## 4. Dependency policy

- No library is installed without a one-line reason in the PR description.
- Exact versions are pinned by the lockfile; each new dependency is checked for license compatibility.
- Prefer the platform (Web APIs) over a library when the effort is similar.
