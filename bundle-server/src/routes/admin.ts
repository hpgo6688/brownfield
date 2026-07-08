import fs from 'fs/promises';
import path from 'path';
import { FastifyInstance } from 'fastify';

const adminHtmlPath = path.join(__dirname, '..', 'admin', 'index.html');

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/admin', async (_request, reply) => {
    const html = await fs.readFile(adminHtmlPath, 'utf-8');
    return reply.type('text/html').send(html);
  });

  app.get('/', async (_request, reply) => {
    return reply.redirect('/admin');
  });
}
