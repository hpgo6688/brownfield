# bundle-server

Scheme 2 dynamic bundle manifest server.

## Stack

- **Fastify** — HTTP server
- **Prisma + SQLite** — feature registry, release history, rollback (swap `DATABASE_URL` for PostgreSQL in production)
- **TypeScript**

## Commands

```bash
npm install
npm run db:push
npm run db:seed
npm run dev          # development
npm run build && npm start
```

## URLs

- Admin UI: http://127.0.0.1:3001/admin
- Manifest: http://127.0.0.1:3001/api/manifest

## Upload & rollback

Use the admin UI or:

```bash
curl -X POST http://127.0.0.1:3001/api/bundles/upload \
  -F featureId=home \
  -F version=1.0.0 \
  -F file=@dist/bundles/home.ios.jsbundle

curl -X POST http://127.0.0.1:3001/api/features/home/rollback \
  -H 'Content-Type: application/json' \
  -d '{"releaseId":"<id>"}'
```

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | `file:../data/bundle-server.db` | Prisma database |
| `USE_METRO_BUNDLES` | `false` | Point manifest URLs to Metro split bundles |
| `METRO_HOST` | `http://127.0.0.1:8081` | Metro base URL |
