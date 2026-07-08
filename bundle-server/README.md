# bundle-server

Remote RN entry manifest server — serves **Remote 远程业务** entries (not Scheme 1 core pages).

## Stack

- **Fastify** — HTTP server
- **Prisma + SQLite** — Remote entry registry, release history, rollback
- **TypeScript**

## Commands

```bash
npm install
npm run dev          # db:prepare + hot reload
npm run smoke:manifest
npm run build && npm start
```

Database file: `data/bundle-server.db`.  
Uploaded bundle files: `data/bundles/` (persist across server restarts; gitignored with `data/`).

## URLs

- Admin UI: http://127.0.0.1:3001/admin
- Manifest: http://127.0.0.1:3001/api/manifest

## Upload & rollback

```bash
# Target Remote entry (e.g. order)
curl -X POST http://127.0.0.1:3001/api/bundles/upload \
  -F featureId=order \
  -F version=1.0.0 \
  -F file=@../rn_app/dist/bundles/ota_order.1.0.0.ios.jsbundle

curl -X POST http://127.0.0.1:3001/api/features/order/rollback \
  -H 'Content-Type: application/json' \
  -d '{"releaseId":"<id>"}'

# Delete a release (removes DB record + data/bundles file)
curl -X DELETE http://127.0.0.1:3001/api/features/order/releases/<releaseId>

# CI helper
./scripts/upload-bundle.sh order 1.0.0 ../rn_app/dist/bundles/ota_order.1.0.0.ios.jsbundle
```

> Remote entries: `order`, `promo`. Create more via Admin or `POST /api/features`.

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | `file:data/bundle-server.db` | Prisma database (relative to `bundle-server/`) |
| `USE_METRO_BUNDLES` | `false` | Point manifest URLs to Metro split bundles |
| `METRO_HOST` | `http://127.0.0.1:8081` | Metro base URL |

## Docs

- [Remote RN + OTA](../docs/dynamic-multi-bundle.md)
- [Multi-bundle background](../docs/multi-bundle.md)
