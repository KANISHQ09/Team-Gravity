import { defineConfig } from 'drizzle-kit';

// Used by `pnpm --filter @gravity/server db:generate` and `db:migrate`, which
// load the root .env first (like `dev`), so a changed DATABASE_URL port is used.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://gravity:gravity@localhost:5432/gravity',
  },
  strict: true,
  verbose: true,
});
