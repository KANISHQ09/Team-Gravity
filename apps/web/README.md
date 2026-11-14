# Web app (`@gravity/web`)

React 18 + Vite single-page app. Solo play runs fully here (offline after first load); co-op talks to `apps/server`.

- Imports `@gravity/engine` (via a Web Worker) and `@gravity/shared`.
- Never imports `apps/server`.
- Static assets go in `public/` (created in Phase 5).

See [docs/FOLDER_STRUCTURE.md](../../docs/FOLDER_STRUCTURE.md).
