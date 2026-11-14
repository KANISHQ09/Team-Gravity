import { randomBytes } from 'node:crypto';
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
  /** Optional: without it, scores and leaderboards are kept in memory. */
  DATABASE_URL: z.string().url().optional(),
  /** Optional: without it, rate-limit counters are kept per instance. */
  REDIS_URL: z.string().url().optional(),
  JWT_SIGNING_KEY: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema> & {
  /** Always set after loading: generated for development/test when not configured. */
  readonly jwtKey: string;
  readonly jwtKeyGenerated: boolean;
};

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
  const env = result.data;
  if (!env.JWT_SIGNING_KEY && env.NODE_ENV === 'production') {
    throw new Error(
      'Invalid environment configuration:\n  - JWT_SIGNING_KEY: required in production',
    );
  }
  return {
    ...env,
    jwtKey: env.JWT_SIGNING_KEY ?? randomBytes(48).toString('base64url'),
    jwtKeyGenerated: !env.JWT_SIGNING_KEY,
  };
}
