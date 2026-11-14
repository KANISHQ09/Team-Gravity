import { z } from 'zod';

/**
 * Environment variables, validated at boot. The server refuses to start
 * when a value is missing or malformed. Document every variable in the
 * root .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Required once the database and Redis modules are implemented (Phase 8).
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  JWT_SIGNING_KEY: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * `KEY=` lines in a .env file arrive as empty strings. Treat them as "not set"
 * so a freshly copied .env.example works and optional values stay optional.
 */
function dropEmptyValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(dropEmptyValues(source));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
