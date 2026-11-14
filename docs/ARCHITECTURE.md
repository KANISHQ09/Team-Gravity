# GRAVITY — Architecture

> Status: **Draft, based on the approved full stack in [TECH_STACK](TECH_STACK.md).** This is the summary. Detailed design (ER diagram, auth flows, caching, queues, cloud layout, disaster recovery) is Document 3 of [`resources/Gravity.md`](../resources/Gravity.md).

## 1. Principles

1. **Engine first.** All game rules live in one pure, deterministic TypeScript package. The UI and the server are thin layers around it.
2. **Local-first solo play, server-authoritative co-op.** Solo play needs no server. In co-op, the server checks every change with the same engine, so all players see one source of truth.
3. **Data-driven.** Parts, launch vehicles, orbits and scenarios are JSON catalogs, each value labeled with its source (`NASA` / `DERIVED` / `GAME`). Adding a part needs no code change.
4. **Explain everything.** Every engine result records what caused it, so the report can say *why*.
5. **Modular monolith.** One web app, one small server, shared packages. No microservices.

## 2. System context

```mermaid
flowchart LR
  subgraph Browser["Player browser"]
    UI["React UI<br/>(studio, dashboard, report)"]
    ST["Zustand store<br/>+ IndexedDB autosave"]
    WK["Web Worker<br/>@gravity/engine"]
    SW["Service worker<br/>(offline solo)"]
    UI <--> ST
    ST <--> WK
    SW -.-> UI
  end
  CDN["Vercel CDN<br/>(app + catalog JSON)"]
  subgraph Server["Node.js server on Fly.io (2+ instances)"]
    API["REST API (Fastify)"]
    RT["Realtime (Socket.IO)"]
    ENG["@gravity/engine"]
    JOB["Jobs (BullMQ)"]
    API --> ENG
    RT --> ENG
  end
  PG[("PostgreSQL 16 (Neon)")]
  RD[("Redis (Upstash)")]
  OBJ[("Object storage (R2/S3)")]
  MON["Sentry · Better Stack · PostHog"]
  Browser -->|static| CDN
  Browser -->|HTTPS| API
  Browser <-->|"WSS (co-op)"| RT
  API --> PG
  API --> RD
  RT --> RD
  JOB --> PG
  JOB --> RD
  JOB --> OBJ
  Server -.-> MON
```

| Store | Holds |
| --- | --- |
| PostgreSQL | Users (guests), designs + versions, runs, scores, rooms (final snapshot), proposals, catalog versions, audit events |
| Redis | Live room state (30-min idle TTL), votes, presence, leaderboard sorted sets, rate-limit counters |
| IndexedDB (browser) | Solo autosave, undo history |
| Object storage | Nightly database dumps, images and 3D models |

## 3. Packages

```mermaid
flowchart TB
  SH["packages/shared<br/>types, Zod message schemas, design-code codec"]
  CA["packages/catalog<br/>JSON catalogs + Zod schemas + provenance"]
  EN["packages/engine<br/>validate, budgets, readiness, simulate, score, report"]
  WEB["apps/web<br/>React app"]
  SRV["apps/server<br/>room server"]
  CA --> SH
  EN --> SH
  EN --> CA
  WEB --> EN
  WEB --> SH
  SRV --> EN
  SRV --> SH
```

| Package | Responsibility | Depends on |
| --- | --- | --- |
| `packages/shared` | Shared types, Zod schemas for designs and socket messages, design-code encode/decode | — |
| `packages/catalog` | Scenarios, parts, launch vehicles, orbits, requirement templates, similar missions; schema-validated in CI | shared |
| `packages/engine` | Pure functions only (no DOM, no clock, no unseeded randomness) | shared, catalog |
| `apps/web` | UI, state, Web Worker wrapper, service worker | engine, shared |
| `apps/server` | REST API (guest auth, catalogs, simulate, scores, leaderboards, rooms), Socket.IO rooms, Drizzle DB layer, BullMQ jobs | engine, shared |
| `tools/balance` | Automated search proving at least 3 viable designs per scenario | engine |
| `tools/gmat` | GMAT scripts and export notes (offline) | — |

> The roadmap's example layout uses `frontend/` and `backend/`. This proposal uses `apps/` + `packages/` because the engine must be shared by both sides. The full tree and folder rules are in [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) (Phase 3).

## 4. Engine API

| Function | Purpose |
| --- | --- |
| `validate(design, scenario, catalog)` | List of problems (error / warning / info), each with `why` and `fix` text |
| `computeBudgets(design, scenario, catalog)` | Six resource gauges: used, limit, margin, status, contributing items |
| `deriveRequirements(goals, scenario)` | Measurable requirements, each with a verification method |
| `evaluateReadiness(design, scenario, tier)` | Green/yellow/red checklist and the launch-gate decision |
| `buildRiskMatrix(design, scenario)` | 5×5 likelihood × impact matrix |
| `simulate(design, scenario, catalog, seed, tier)` | Timeline, events, outcome and cause-and-effect trace |
| `score(run, scenario, team)` | Score breakdown, outcome class, cause statements, suggestions |
| `matchAnalogs(design)` | Similar real NASA missions (stretch) |

```mermaid
flowchart LR
  D["Design JSON"] --> V["validate"] --> B["computeBudgets"] --> R["evaluateReadiness"]
  R -->|"gate passed + team GO"| S["simulate (seeded)"]
  S --> SC["score"] --> RP["Report"]
  C["Catalogs + provenance"] --> V & B & S
```

**Simple models used** (full table in Gravity.md §3.3.1): rocket equation for Δv; solar power falling with distance squared; eclipse fraction per orbit; battery charge and discharge; a simplified communications link budget; per-part reliability; cost totals. Each constant carries a source label.

## 5. Key flows

### 5.1 Solo design loop

Edit → store → worker runs `validate` + `computeBudgets` → gauges and warnings update (< 100 ms) → autosave to IndexedDB.

### 5.2 Co-op change

```mermaid
sequenceDiagram
  participant P as Player (role owner)
  participant S as Room server
  participant E as Engine
  participant O as Other players
  P->>S: design:patch {path, value, version}
  S->>S: Zod check + role ownership check
  alt owned by caller
    S->>E: validate + computeBudgets
    S-->>P: design:applied
    S-->>O: design:applied
  else owned by another role
    S-->>O: proposal:update (owner accepts/rejects)
  end
```

### 5.3 Launch

All players vote GO → server runs `evaluateReadiness` → `simulate` with a shared seed → broadcasts results → every client renders the same report.

### 5.4 Leaderboard submission

Client sends `POST /api/v1/scores {design, scenarioId, seed, difficulty}` → server checks auth, rate limit and schema → engine re-runs `simulate` + `score` (the client's score is never trusted) → result saved to Postgres → `ZADD` to the Redis leaderboard → server returns rank.

## 6. REST API (MVP, `/api/v1`)

Full request/response contract: [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/guest` | Issue a guest login token |
| `POST /auth/refresh` | New access token from the refresh cookie |
| `GET /catalogs/:version` | Parts, vehicles, orbits, scenarios (cacheable) |
| `POST /simulate` | Server-side engine run |
| `POST /scores` | Submit a run; the server recomputes the score |
| `GET /leaderboards/:scenario?difficulty=` | Top 50 |
| `POST /rooms`, `POST /rooms/:code/join` | Create or join a room |
| `GET /healthz`, `GET /readyz` | Liveness / readiness |

Post-MVP: `POST /auth/oauth`, `/designs` CRUD, `GET /nasa/*`. Errors use RFC 9457 Problem Details. OpenAPI 3.1 is generated from the Zod schemas.

## 7. Socket events (MVP)

| Client → server | Server → client |
| --- | --- |
| `room:join`, `room:leave`, `role:claim`, `design:patch`, `proposal:create`, `proposal:respond`, `vote:cast`, `member:remove`, `sim:start` | `room:state`, `design:applied`, `design:rejected`, `proposal:update`, `vote:update`, `sim:result`, `room:left`, `room:error` |

Every message is validated with Zod and unknown fields are rejected. Limits: 20 events per second per connection, 5 rooms per hour per client.

## 8. Security and privacy (MVP)

- Guest JWT (15-min access token + `HttpOnly`, `Secure`, `SameSite=Lax` refresh cookie scoped to `/auth`); the socket handshake verifies the JWT. No personal data. Rate limits are stored in Redis (60 REST requests/min/IP).
- No named accounts at MVP. Display names come from a preset list or pass a profanity filter; there is no free-text chat.
- The server owns room state and checks role ownership on every patch.
- Leaderboard scores are recomputed by the server from the design and seed.
- Database queries are parameterized (Drizzle); unknown JSON keys are rejected.
- Strict Content-Security-Policy; secrets only in environment variables; `.env` is git-ignored.

## 9. Quality attributes

| Attribute | How it's achieved |
| --- | --- |
| Determinism | Seeded random-number generator; engine is pure; property tests; results cached by hash(design, seed, difficulty, catalog version) |
| Performance | Engine runs in a worker; 3D lazy-loaded; small critical bundle |
| Offline | Service worker caches the app and catalogs |
| Accessibility | Radix primitives, axe in CI, manual keyboard pass |
| Fault tolerance | Solo play never depends on the server; Redis down → rooms fall back to in-memory on that instance; DB down → catalogs read-only, scores queued on the client; co-op falls back to hot-seat |
| Scalability | Stateless API; Socket.IO Redis adapter across instances; leaderboards and catalogs served from Redis/CDN |
