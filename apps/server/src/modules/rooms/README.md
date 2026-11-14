# Rooms module

`POST /api/v1/rooms`, `POST /api/v1/rooms/:code/join` and room lifecycle (lobby → design → vote → simulating → report).

- `service.ts`: the co-op rules (roles, versions, proposals, votes, leave/remove, host handover). Every change is load → change → compare-and-swap save, retried on conflict.
- `store.ts`: where rooms live: `memoryRoomStore` (one instance) or `redisRoomStore` (shared, 30-minute TTL, survives restarts).
- `archive.ts`: saves launched rooms to Postgres.
- `routes.ts`: REST create/join.

See [docs/FOLDER_STRUCTURE.md](../../../../../docs/FOLDER_STRUCTURE.md).
