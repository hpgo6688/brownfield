# bundle-server 数据库路径重复（data/ vs bundle-server/data/）

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: bundle-server · Prisma · seed · 运行时

## 问题描述

- **现象**：仓库中同时存在 `brownfield/data/bundle-server.db` 与 `bundle-server/data/bundle-server.db`，清理/seed 后数据出现在错误位置，或运行时读不到刚写入的数据
- **触发条件**：执行 `prisma db push`、`npm run db:seed`、`npm run dev` / `npm start` 时
- **影响范围**：Remote manifest 数据不一致，Admin 与 API 可能指向空库或旧库

## 根因分析

1. `.env` 使用 `DATABASE_URL="file:../data/bundle-server.db"`，Prisma CLI 从 `bundle-server/` 解析为 **`brownfield/data/`**
2. 旧版 `db-url.ts` / `seed.ts` 通过 `path.resolve(cwd, 'prisma', filePath)` 解析，落到 **`bundle-server/data/`**
3. `npm run dev`（tsx 读 src）与 `npm start`（读 dist）在修复前也可能指向不同路径

## 解决方案

统一数据库到 **`bundle-server/data/bundle-server.db`**，并让 Prisma CLI、seed、dev、start 使用同一解析规则。

**关键变更**：
- `bundle-server/.env` — `DATABASE_URL` 改为 `file:data/bundle-server.db`
- `bundle-server/src/lib/db-url.ts` — 默认 URL 同步；路径相对 `bundle-server/` 项目根解析
- `bundle-server/prisma/seed.ts` — 复用 `getDatabaseUrl()`，移除重复路径逻辑
- 迁移 `brownfield/data/bundle-server.db` → `bundle-server/data/`，删除仓库根 `data/` 目录
- `npm run build` — 重新编译 `dist/lib/db-url.js`
- `bundle-server/README.md`、`docs/dynamic-multi-bundle.md` — 更新文档说明

## 验证方式

- [x] `src` 与 `dist` 的 `getDatabaseUrl()` 均输出 `.../brownfield/bundle-server/data/bundle-server.db`
- [x] `npm run db:seed` 成功，`sqlite3 bundle-server/data/bundle-server.db` 可查到 order/promo
- [x] 仓库根 `brownfield/data/` 已不存在

## 后续建议

- 本地若仍留有 `brownfield/data/bundle-server.db`，可手动删除
- 修改 `.env` 后需重启 bundle-server 进程
