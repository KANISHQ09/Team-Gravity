# GRAVITY — API Documentation

> Status: **✅ Implemented in Phase 8** (`apps/server`), with request/response schemas in `packages/shared/src/api.ts` and the typed Socket.IO contract in `packages/shared/src/realtime.ts`. Covered by `apps/server/tests`. Not yet implemented: OpenAPI generation, `Idempotency-Key`, and the post-MVP endpoints listed below.
>
> Implementation notes:
> - Validation: top-level request bodies are strict (unknown fields → 400); unknown fields *inside* a design are dropped.
> - The room-creation limit (5/hour) is counted per guest (read from the bearer token); requests without a valid token are counted per IP.
> - `POST /simulate` and `POST /scores` return **422** with an `issues` array (`code`, `message`, `why`, `fix`) for designs that cannot launch.
> - Socket errors arrive as `room:error` `{ event, title, detail }`; a rejected patch arrives as `design:rejected` `{ title, reason, latestVersion }`.
> - Rooms live in Redis when `REDIS_URL` is set (shared by every server instance through the Socket.IO Redis adapter, and recovered after a restart), otherwise in memory on one instance. Either way they are removed after 30 idle minutes. Launched rooms are archived in Postgres (`rooms`, `room_members`, `designs`, `runs`) when `DATABASE_URL` is set.

## 1. Conventions

| Item | Rule |
| --- | --- |
| Base URL | `/api/v1` (example: `https://<server-host>/api/v1`) |
| Format | JSON (`Content-Type: application/json`) |
| Auth | `Authorization: Bearer <access JWT>`, obtained from `POST /auth/guest`. The refresh token is an `HttpOnly` cookie scoped to `/api/v1/auth` |
| Validation | Every body is checked with Zod; **unknown fields are rejected** (400) |
| Errors | [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457): `type`, `title`, `status`, `detail`, `instance`, plus `correlationId` |
| Rate limits | 60 requests/min per IP; 5 room creations/hour per guest. Exceeding returns 429 with `Retry-After` |
| Idempotency | Planned: `POST /scores` and `POST /rooms` will accept an `Idempotency-Key` header (not implemented yet) |
| Versioning | Breaking changes get a new prefix (`/api/v2`) |

### Error example

```json
{
  "type": "https://gravity.example/problems/validation",
  "title": "Invalid request body",
  "status": 400,
  "detail": "design.parts[3].id: unknown part 'antenna-xl'",
  "instance": "/api/v1/simulate",
  "correlationId": "9f1c2e7a"
}
```

## 2. REST endpoints (MVP)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/guest` | none | Create a guest session |
| POST | `/auth/refresh` | refresh cookie | New access token |
| GET | `/catalogs/:version` | none | Scenarios, parts, launch vehicles, orbits (cacheable, ETag) |
| POST | `/simulate` | guest | Run the engine on the server |
| POST | `/scores` | guest | Submit a run for the leaderboard; **server recomputes the score** |
| GET | `/leaderboards/:scenarioId` | none | Top 50 for a scenario and difficulty |
| POST | `/rooms` | guest | Create a co-op room |
| POST | `/rooms/:code/join` | guest | Join a room by its 6-character code |
| GET | `/healthz` | none | Liveness (outside `/api/v1`) |
| GET | `/readyz` | none | Readiness: database and Redis reachable (outside `/api/v1`) |

**Post-MVP:** `POST /auth/oauth`, `POST/GET/PUT /designs`, `GET /nasa/*`.

### `POST /auth/guest`

Response `201`:

```json
{ "accessToken": "<JWT, 15 min>", "guestId": "g_7Hq2…", "expiresIn": 900 }
```

Also sets the refresh cookie (`HttpOnly; Secure; SameSite=Lax`, 30 days).

### `GET /catalogs/:version`

`version` is an integer or `latest`. Response `200`: `{ "version": 3, "checksum": "…", "scenarios": [...], "parts": [...], "launchVehicles": [...], "orbits": [...] }`. Every numeric field has a sibling `provenance` (`NASA` / `NASA/GMAT` / `DERIVED` / `GAME`).

### `POST /simulate`

```json
{
  "design": { "schemaVersion": 1, "scenarioId": "lunar-orbiter", "goals": [], "parts": [], "launchVehicleId": "medium-lift", "orbitId": "llo-100" },
  "seed": 42,
  "difficulty": "engineer",
  "catalogVersion": 3
}
```

Response `200`: `{ "outcome": "partial", "score": { "total": 78, "breakdown": { … } }, "timeline": [ … ], "causes": [ "Because …" ] }`. A design that fails validation returns `422` with the list of problems (each with `why` and `fix`).

### `POST /scores`

Same body as `/simulate`, plus `teamName` (filtered) and `playerCount`. The server re-runs `simulate` + `score`; any score the client sends is ignored. Response `201`: `{ "runId": "…", "total": 78, "rank": 12 }`.

### `GET /leaderboards/:scenarioId?difficulty=engineer`

Response `200`: `{ "entries": [ { "rank": 1, "total": 96.4, "teamName": "Orbiteers", "playerCount": 4, "designCode": "…" } ] }`.

### `POST /rooms` and `POST /rooms/:code/join`

Create body: `{ "scenarioId": "mars-orbiter", "difficulty": "flight-director" }` → `201 { "code": "K7QX2M", "roomId": "…" }`.
Join → `200 { "roomId": "…", "role": null }`, or `404` (unknown code), `409` (room full or already launched).

## 3. Socket.IO events (MVP)

The connection handshake sends the access JWT (`auth: { token }`). Every payload is Zod-validated and unknown fields are rejected; at most 20 events/second per connection.

Types for every event live in `packages/shared/src/realtime.ts`. Type the web client with them so both sides stay in step:

```ts
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@gravity/shared';
import type { MissionResult } from '@gravity/engine';
const socket: Socket<ServerToClientEvents<MissionResult>, ClientToServerEvents> =
  io(API_URL, { auth: { token: accessToken } });
```

### Client → server

| Event | Payload | Notes |
| --- | --- | --- |
| `room:join` | `{ code }` | Joins (or rejoins) the room; server broadcasts `room:state`. After launch, also sends `sim:result` to this player |
| `room:leave` | none or `{}` | Leaves for good: frees the player's roles and drops their open proposals. If the host leaves, the earliest-joined player becomes host; the last player out closes the room |
| `role:claim` | `{ roles: Role[] }` | `mission-architect` · `spacecraft-engineer` · `science-lead` · `operations`. Replaces the caller's roles; `Role taken` if another player holds one |
| `design:patch` | `{ edit: DesignEdit, baseVersion }` | `edit` is one of the `DesignEdit` types in `packages/shared/src/edits.ts`. Rejected (`design:rejected`) if the edit belongs to another role, or if `baseVersion` is not the room's current version |
| `proposal:create` | `{ edit, message }` | `message` is one of the preset `PROPOSAL_MESSAGES` (no free text) |
| `proposal:respond` | `{ proposalId, accept }` | Only a holder of the edit's owning role |
| `vote:cast` | `{ vote: "go" }` or `{ vote: "no-go", reason }` | `reason` is one of the preset `NO_GO_REASONS`. Any design change resets every vote |
| `member:remove` | `{ userId }` | Host only, and only for a player offline for at least 2 minutes (`REJOIN_GRACE_SECONDS`, SRS-COL-06) |
| `sim:start` | none or `{}` | Host only; needs every player's GO and a passed readiness review |

A host who stays offline past the 2-minute grace period hands the host role to the earliest-joined online player on the next change in the room.

### Server → client

| Event | Payload |
| --- | --- |
| `room:state` | `RoomSnapshot`: `roomId, code, hostId, scenarioId, difficulty, status, design, version, members[] { userId, roles, vote, connected, isHost }, proposals[]` |
| `design:applied` | `{ edit, version, design, by }` (also sent when a proposal is accepted) |
| `design:rejected` | `{ title, reason, latestVersion }` |
| `proposal:update` | `{ proposal, status: "open" \| "accepted" \| "rejected" }` |
| `vote:update` | `{ votes: [{ userId, vote }], allGo }` |
| `sim:result` | The engine's `MissionResult` `{ run, report }`, identical for every player |
| `room:left` | `{ reason: "left" \| "removed" }`, sent to the player who is no longer in the room |
| `room:error` | `{ event, title, detail }` |

Version conflicts: if `baseVersion` is older than the room's version, the server returns `design:rejected` with the latest version and the client rebases.
