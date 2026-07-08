import { FastifyInstance, FastifyRequest } from 'fastify';
import { buildManifest } from '../services/manifest.service';
import {
  activateRelease,
  createReleaseFromUpload,
  listFeaturesAdmin,
  rollbackFeature,
  toggleFeature,
} from '../services/bundle.service';

function requestBaseUrl(request: FastifyRequest) {
  const host = request.headers.host ?? request.hostname;
  return { protocol: request.protocol, host };
}

function getMultipartFieldValue(
  fields: Record<string, unknown>,
  name: string,
): string | undefined {
  const entry = fields[name] as { value?: string } | { value?: string }[] | undefined;
  if (!entry) return undefined;
  if (Array.isArray(entry)) return entry[0]?.value;
  return entry.value;
}

export async function registerApiRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));

  app.get('/api/manifest', async (request) => {
    const { protocol, host } = requestBaseUrl(request);
    const query = request.query as { appVersion?: string };
    return buildManifest({ protocol, host, appVersion: query.appVersion });
  });

  app.get('/api/features', async () => {
    const features = await listFeaturesAdmin();
    return {
      features: features.map(feature => ({
        id: feature.id,
        title: feature.title,
        enabled: feature.enabled,
        activeVersion: feature.activeRelease?.version ?? null,
      })),
    };
  });

  app.get('/api/admin/features', async () => {
    const features = await listFeaturesAdmin();
    return { features };
  });

  app.post('/api/features/:id/toggle', async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { enabled?: boolean };
    const feature = await toggleFeature(id, body.enabled);
    const { protocol, host } = requestBaseUrl(request);
    return { feature, manifest: await buildManifest({ protocol, host }) };
  });

  app.post('/api/features/:id/rollback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { releaseId: string };

    if (!body?.releaseId) {
      return reply.code(400).send({ error: 'releaseId is required' });
    }

    try {
      const feature = await rollbackFeature(id, body.releaseId);
      return { feature };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rollback failed';
      return reply.code(404).send({ error: message });
    }
  });

  app.post('/api/features/:id/activate/:releaseId', async (request, reply) => {
    const { id, releaseId } = request.params as { id: string; releaseId: string };

    try {
      const feature = await activateRelease(id, releaseId);
      return { feature };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Activate failed';
      return reply.code(404).send({ error: message });
    }
  });

  app.post('/api/bundles/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'file is required' });
    }

    const fields = data.fields as Record<string, unknown>;
    const featureId = getMultipartFieldValue(fields, 'featureId');
    const version = getMultipartFieldValue(fields, 'version');
    const notes = getMultipartFieldValue(fields, 'notes');
    const activateRaw = getMultipartFieldValue(fields, 'activate');
    const activate = activateRaw !== 'false';

    if (!featureId || !version) {
      return reply.code(400).send({ error: 'featureId and version are required' });
    }

    try {
      const buffer = await data.toBuffer();
      const release = await createReleaseFromUpload({
        featureId,
        version,
        buffer,
        notes,
        activate,
      });

      const { protocol, host } = requestBaseUrl(request);
      return reply.send({
        release,
        manifest: await buildManifest({ protocol, host }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      const status = message.includes('not found') ? 404 : 400;
      return reply.code(status).send({ error: message });
    }
  });
}
