# Realtime

Socket.IO gateway, event handlers and Redis adapter. Checks role ownership on every `design:patch`.

Typed with `ClientToServerEvents` / `ServerToClientEvents` from `packages/shared/src/realtime.ts`. With `REDIS_URL` set, `@socket.io/redis-adapter` relays room broadcasts between server instances.

See [docs/FOLDER_STRUCTURE.md](../../../../docs/FOLDER_STRUCTURE.md).
