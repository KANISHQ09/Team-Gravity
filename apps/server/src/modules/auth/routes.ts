import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { sendProblem } from '../../plugins/errors.ts';
import type { TokenPayload } from '../../plugins/security.ts';

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_PATH = '/api/v1/auth';

/** Guest sessions: no personal data, just a random guest ID (SRS-AUTH). */
export function authRoutes(
  app: FastifyInstance,
  opts: { secure: boolean; onGuest?: (guestId: string) => Promise<void> },
) {
  const issue = (guestId: string) => ({
    access: app.jwt.sign({ sub: guestId, typ: 'access' } satisfies TokenPayload, {
      expiresIn: ACCESS_SECONDS,
    }),
    refresh: app.jwt.sign({ sub: guestId, typ: 'refresh' } satisfies TokenPayload, {
      expiresIn: REFRESH_SECONDS,
    }),
  });
  const cookieOptions = {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    maxAge: REFRESH_SECONDS,
  };

  app.post('/api/v1/auth/guest', async (_request, reply) => {
    const guestId = randomUUID();
    await opts.onGuest?.(guestId);
    const tokens = issue(guestId);
    return reply
      .code(201)
      .setCookie('gravity_refresh', tokens.refresh, cookieOptions)
      .send({ accessToken: tokens.access, guestId, expiresIn: ACCESS_SECONDS });
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const token = request.cookies['gravity_refresh'];
    if (!token)
      return sendProblem(
        request,
        reply,
        401,
        'Unauthorized',
        'No refresh cookie. Start a new guest session.',
      );
    let payload: TokenPayload;
    try {
      payload = app.jwt.verify<TokenPayload>(token);
    } catch {
      return sendProblem(
        request,
        reply,
        401,
        'Unauthorized',
        'The refresh token is invalid or expired.',
      );
    }
    if (payload.typ !== 'refresh')
      return sendProblem(request, reply, 401, 'Unauthorized', 'Wrong token type.');
    const tokens = issue(payload.sub);
    return reply
      .setCookie('gravity_refresh', tokens.refresh, cookieOptions)
      .send({ accessToken: tokens.access, guestId: payload.sub, expiresIn: ACCESS_SECONDS });
  });
}
