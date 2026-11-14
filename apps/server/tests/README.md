# Integration tests

REST + database and socket-room tests. Postgres and Redis tests run only when their URLs are set (local Docker):

```bash
TEST_DATABASE_URL=postgres://gravity:gravity@localhost:5432/gravity \
  TEST_REDIS_URL=redis://localhost:6379/15 pnpm --filter @gravity/server test
```

`TEST_REDIS_URL` should point at a spare database number (here `/15`): the Redis test flushes it.

See [docs/FOLDER_STRUCTURE.md](../../../docs/FOLDER_STRUCTURE.md).
