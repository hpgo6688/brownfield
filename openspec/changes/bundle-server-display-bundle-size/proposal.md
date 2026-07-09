## Why

OTA split bundle 在引入 React Navigation 等共享依赖后体积从 ~280KB 增至 ~2MB；管理员在 bundle-server Admin 只能看到 version/hash，**无法快速判断 upload 是否成功、是否误传了错误文件**。近期调试 `unknown module` 时，需手动 `ls` 或 `shasum` 对比服务端文件，效率低且易漏。

## What Changes

- `BundleRelease` 持久化 `sizeBytes`（upload 时从 buffer 写入）
- Admin API（`GET /api/features`）每个 release 返回 `sizeBytes`
- Admin UI 发布历史表新增 **大小** 列（人类可读，如 `276 KB` / `2.0 MB`）
- 侧边栏当前线上版本旁展示 active release 大小（可选摘要）
- 历史 release 若 DB 无 `sizeBytes`，从 `data/bundles/<filename>` `stat` 回填（只读展示，不写库）
- **不**在公开 `GET /api/manifest` 中暴露 size（客户端 OTA 不依赖）

## Capabilities

### New Capabilities

- `bundle-admin-size-display`: Admin UI 与 admin API 展示各 release 的 bundle 文件大小

### Modified Capabilities

- `bundle-upload-service`: upload 流程持久化 `sizeBytes`；build-manifest 可选附带 `sizeBytes` 供 CI 对照

## Impact

- `bundle-server/prisma/schema.prisma` — 新字段 + migration
- `bundle-server/src/services/bundle.service.ts` — upload 写 size；list 回填
- `bundle-server/src/admin/index.html` — 表格列与格式化
- `bundle-server/src/routes/api.ts` — 响应形状（Prisma 透传，无 breaking）
- `rn_app/scripts/build-bundles.js` — build-manifest 增加 `sizeBytes`（可选）
