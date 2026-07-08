import fs from 'fs/promises';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';

function resolveBundleFilePath(urlPath: string): string | null {
  const relative = decodeURIComponent(
    urlPath.replace(/^\/bundles\//, '').split('?')[0],
  );
  if (!relative || relative.includes('..')) {
    return null;
  }

  const filePath = path.join(config.bundlesDir, relative);
  const resolved = path.resolve(filePath);
  const bundlesRoot = path.resolve(config.bundlesDir);
  if (resolved !== bundlesRoot && !resolved.startsWith(`${bundlesRoot}${path.sep}`)) {
    return null;
  }

  return resolved;
}

/** Return 503 + Retry-After when bundle file is missing; existing files fall through to static. */
export async function registerBundleDeliveryHooks(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return;
    }

    const urlPath = request.url.split('?')[0];
    if (!urlPath.startsWith('/bundles/')) {
      return;
    }

    const resolved = resolveBundleFilePath(urlPath);
    if (resolved == null) {
      return reply.code(400).send({ error: 'invalid_path' });
    }

    try {
      await fs.access(resolved);
    } catch {
      request.log.warn({ path: urlPath }, 'bundle file missing');
      return reply
        .code(503)
        .header('Retry-After', String(config.bundleRetryAfterSeconds))
        .send({ error: 'bundle_file_missing', retryable: true });
    }
  });
}
