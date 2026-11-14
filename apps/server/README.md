# Server (`@gravity/server`)

Node.js 22 + Fastify (REST) + Socket.IO (co-op rooms). Server-authoritative: re-runs `@gravity/engine` to validate every change and recompute every score.

- Imports `@gravity/engine` and `@gravity/shared`.
- Never imports `apps/web`.
- Dockerfile and package.json are added in Phase 5.

See [docs/FOLDER_STRUCTURE.md](../../docs/FOLDER_STRUCTURE.md).
