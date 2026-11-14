import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodError } from 'zod';

/** RFC 9457 Problem Details body. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  correlationId: string;
  [extra: string]: unknown;
}

const TYPE_BASE = 'https://github.com/KANISHQ09/Team-Gravity/blob/main/docs/API_DOCUMENTATION.md#';

export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  title: string,
  detail?: string,
  extra: Record<string, unknown> = {},
) {
  const body: Problem = {
    type: `${TYPE_BASE}${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    status,
    ...(detail ? { detail } : {}),
    instance: request.url,
    correlationId: request.id,
    ...extra,
  };
  return reply.code(status).type('application/problem+json').send(body);
}

export function zodDetail(error: ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
    .join('; ');
}

/** Maps every error to Problem Details; never leaks stack traces (SRS-ERR). */
export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) =>
    sendProblem(request, reply, 404, 'Not Found', `No route for ${request.method} ${request.url}`),
  );

  app.setErrorHandler(
    (error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
      const status =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500;
      if (status >= 500) {
        request.log.error({ err: error }, 'unhandled error');
        return sendProblem(
          request,
          reply,
          500,
          'Internal Server Error',
          'Something went wrong. Quote the correlation ID when reporting it.',
        );
      }
      const title =
        status === 429 ? 'Too Many Requests' : status === 401 ? 'Unauthorized' : 'Bad Request';
      return sendProblem(request, reply, status, title, error.message);
    },
  );
}

export const genRequestId = () => randomUUID().slice(0, 8);
