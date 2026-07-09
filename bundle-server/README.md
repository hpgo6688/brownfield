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

构建产物在 **`bundle-server/dist/bundles/`**（由 `rn_app` 的 `npm run build:bundles` 写入）。

### 发布流程（推荐）

```bash
# 1. 构建（在 rn_app 目录；版本号取自 package.json）
cd ../rn_app
npm run build:bundles:dev    # 日常 DEV；发版用 npm run build:bundles

# 2. 上传（在 bundle-server 目录；VERSION 与 package.json 一致）
cd ../bundle-server
npm run dev                  # 确保服务已启动

./scripts/upload-bundle.sh shared 0.0.7 dist/bundles/ota_shared.0.0.7.ios.jsbundle
./scripts/upload-bundle.sh order 0.0.7 dist/bundles/ota_order.0.0.7.ios.jsbundle
./scripts/upload-bundle.sh promo 0.0.7 dist/bundles/ota_promo.0.0.7.ios.jsbundle

# 3. 校验 manifest（含 sharedBundle）
curl -s http://127.0.0.1:3001/api/manifest | jq '{sharedBundle, features: [.features[] | {id, version, sizeBytes}]}'
```

`upload-bundle.sh` 用法：

```bash
./scripts/upload-bundle.sh <featureId> <version> <bundle-file>
# 例：./scripts/upload-bundle.sh order 0.0.7 dist/bundles/ota_order.0.0.7.ios.jsbundle
```

### curl / 回滚

```bash
curl -X POST http://127.0.0.1:3001/api/bundles/upload \
  -F featureId=order \
  -F version=0.0.7 \
  -F file=@dist/bundles/ota_order.0.0.7.ios.jsbundle

curl -X POST http://127.0.0.1:3001/api/features/order/rollback \
  -H 'Content-Type: application/json' \
  -d '{"releaseId":"<id>"}'

# Delete a release (removes DB record + data/bundles file)
curl -X DELETE http://127.0.0.1:3001/api/features/order/releases/<releaseId>
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
