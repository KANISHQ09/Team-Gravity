import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.ts';
import { sendProblem } from './errors.ts';

export interface TokenPayload {
  sub: string;
  typ: 'access' | 'refresh';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that requires a valid guest access token. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** CORS, rate limits, cookies and guest JWT auth (SRS-SEC, SRS-AUTH). */
export async function registerSecurity(app: FastifyInstance, env: Env, redis: Redis | null) {
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    ...(redis ? { redis } : {}),
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      message: `Too many requests: limit is ${context.max} per ${context.after}.`,
    }),
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.jwtKey,
    cookie: { cookieName: 'gravity_refresh', signed: false },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<TokenPayload>();
      if (payload.typ !== 'access') throw new Error('Wrong token type');
    } catch {
      await sendProblem(
        request,
        reply,
        401,
        'Unauthorized',
        'A valid guest access token is required. Call POST /api/v1/auth/guest first.',
      );
    }
  });
}
