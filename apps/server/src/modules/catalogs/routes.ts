import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { catalog } from '@gravity/catalog';
import { sendProblem } from '../../plugins/errors.ts';

const body = JSON.stringify(catalog);
const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 22)}"`;

/** GET /api/v1/catalogs/:version: game data with ETag caching. */
export function catalogRoutes(app: FastifyInstance) {
  app.get<{ Params: { version: string } }>('/api/v1/catalogs/:version', async (request, reply) => {
    const { version } = request.params;
    if (version !== 'latest' && version !== String(catalog.version)) {
      return sendProblem(
        request,
        reply,
        404,
        'Not Found',
        `Catalog version ${version} does not exist. Latest is ${catalog.version}.`,
      );
    }
    reply.header('etag', etag).header('cache-control', 'public, max-age=3600');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type('application/json').send(body);
  });
}
