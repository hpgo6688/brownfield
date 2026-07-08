import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { ensureDistDir } from './services/bundle.service';
import { registerApiRoutes } from './routes/api';
import { registerAdminRoutes } from './routes/admin';

async function main() {
  // SQLite path in .env is relative to prisma/schema.prisma → bundle-server/data/
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });

  await ensureDistDir();

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  await app.register(fastifyStatic, {
    root: config.distDir,
    prefix: '/bundles/',
    decorateReply: false,
  });

  await registerApiRoutes(app);
  await registerAdminRoutes(app);

  await app.listen({ port: config.port, host: config.host });

  console.log(`Admin UI: http://127.0.0.1:${config.port}/admin`);
  console.log(`Manifest: http://127.0.0.1:${config.port}/api/manifest`);
  console.log(`Mode: ${config.useMetroBundles ? 'metro (dev)' : 'static bundles'}`);
  console.log(`Database: SQLite (see prisma/schema.prisma)`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
