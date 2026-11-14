/**
 * Drizzle table definitions (PostgreSQL 16), following the ER diagram in
 * resources/Gravity.md §3.8. Migrations live in ../migrations and are
 * generated with `pnpm --filter @gravity/server db:generate`.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Guests by default; OAuth columns are for the post-MVP sign-in. No personal data for guests. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  isGuest: boolean('is_guest').notNull().default(true),
  displayName: text('display_name'),
  oauthProvider: text('oauth_provider'),
  oauthSubject: text('oauth_subject'),
  createdAt: createdAt(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const catalogVersions = pgTable('catalog_versions', {
  version: integer('version').primaryKey(),
  checksum: text('checksum').notNull(),
  manifest: jsonb('manifest').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const designs = pgTable(
  'designs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').notNull(),
    difficulty: text('difficulty').notNull(),
    catalogVersion: integer('catalog_version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    document: jsonb('document').notNull(),
    designCode: text('design_code'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('designs_owner_updated_idx').on(t.ownerId, t.updatedAt.desc())],
);

export const designVersions = pgTable('design_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  designId: uuid('design_id')
    .notNull()
    .references(() => designs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  document: jsonb('document').notNull(),
  createdAt: createdAt(),
});

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  designId: uuid('design_id')
    .notNull()
    .references(() => designs.id, { onDelete: 'cascade' }),
  seed: integer('seed').notNull(),
  outcome: text('outcome').notNull(),
  resultSummary: jsonb('result_summary').notNull(),
  createdAt: createdAt(),
});

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').notNull(),
    difficulty: text('difficulty').notNull(),
    total: numeric('total', { precision: 6, scale: 1, mode: 'number' }).notNull(),
    breakdown: jsonb('breakdown').notNull(),
    teamName: text('team_name').notNull(),
    playerCount: integer('player_count').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('scores_leaderboard_idx').on(t.scenarioId, t.difficulty, t.total.desc())],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    scenarioId: text('scenario_id').notNull(),
    difficulty: text('difficulty').notNull(),
    designId: uuid('design_id').references(() => designs.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('rooms_code_idx').on(t.code)],
);

export const roomMembers = pgTable(
  'room_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role'),
    isHost: boolean('is_host').notNull().default(false),
    vote: text('vote'),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.userId] })],
);

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  fromUser: uuid('from_user')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetPath: text('target_path').notNull(),
  patch: jsonb('patch').notNull(),
  status: text('status').notNull(),
});

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    detail: jsonb('detail').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('audit_events_created_idx').on(t.createdAt)],
);
