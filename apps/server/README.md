# Server (`@gravity/server`)

Node.js 22 + Fastify (REST) + Socket.IO (co-op rooms). Server-authoritative: re-runs `@gravity/engine` to validate every change and recompute every score.

- Imports `@gravity/engine` and `@gravity/shared`.
- Never imports `apps/web`.
- Entry point `src/main.ts`; the Fastify app is built in `src/app.ts` so tests can use `app.inject()`.
- A `Dockerfile` is added only when deployment is approved.

See [docs/FOLDER_STRUCTURE.md](../../docs/FOLDER_STRUCTURE.md).
