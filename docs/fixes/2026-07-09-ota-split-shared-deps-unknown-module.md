# OTA split 缺少主包共享依赖（unknown module 745032085）

**Date**: 2026-07-09
**Status**: Fixed (see [OTA 开发态会话修复总览](./2026-07-09-ota-dev-session-fixes-summary.md))
**Scope**: `build-bundles.js`、DEV OTA 加载、`bundleUpdater` 错误提示

## 问题描述

- **现象**：重新 build 原生后，冷启动直接进 OTA 报 `Requiring unknown module "745032085"`，堆栈在 `seg-1.js` 渲染阶段
- **触发条件**：DEV + Metro（尤其 `--reset-cache`）+ 磁盘/服务端静态 split bundle（非 `USE_METRO_BUNDLES`）
- **影响范围**：OTA 首次进入即崩溃；**不是**本地 `.jsbundle` 文件丢失

## 根因分析

1. `745032085` 对应 `use-latest-callback`，被 React Navigation 依赖
2. 旧 `build-bundles.js` 把**所有**主包 graph 模块都从 split 排除
3. split 运行时 `_r(745032085)` 期望主包已注册，但 Metro `lazy=true` 主包未必预加载该模块
4. segment 能 eval、组件能注册，**渲染**时才触发 unknown module

**不是磁盘 bundle 丢失**：能进入 `seg-1.js` 说明 split 文件已加载。

## 解决方案

1. **修正 split 排除策略**：只排除 core host（react / react-native / metro）和「主包独有、split 不需要」的模块；split graph 也需要的共享依赖（如 `use-latest-callback`）**打进 split**
2. **build 后 audit**：输出仍依赖主包独有的 module id 数量（预期 ~12 个 react core）
3. **DEV preload**：`otaSplitHostPreload.ts` 在 native segment load 前 warm 关键共享模块（兼容旧 bundle）
4. **错误提示**：`unknown module` 时提示 rebuild + upload 或 `USE_METRO_BUNDLES=true`

**关键变更**：
- `rn_app/scripts/build-bundles.js` — `collectSplitModulePaths` + 新 `shouldExcludeFromSplitModule`
- `rn_app/src/features/otaSplitHostPreload.ts` — DEV warm imports
- `rn_app/src/features/bundleLoader.ts` — load 前 preload
- `rn_app/src/features/bundleUpdater.ts` — unknown module 友好文案

## 验证方式

- [x] `npm run build:bundles:dev` — `745032085` 已在 split 内定义（module 356 个，~2MB）
- [x] `[split-audit]` 外部主包依赖从 30 降至 12（仅剩 react core）
- [x] `npm run verify:ota-scope` + `npm test` 通过
- [ ] upload 新 `ota_order.0.0.6.ios.jsbundle`（hash 已变）后模拟器 OTA 冷启动
- [ ] 或删 App 重装 / 清 `Documents/rn-bundles/` 强制重新下载

## 后续建议

- upload 后若仍用旧 hash 缓存，需 bump 版本或清沙盒缓存
- 长期 DEV 推荐 `USE_METRO_BUNDLES=true` 避免静态 split 与 Metro 漂移

---

## 补充修复（同版本 hash 漂移）

**现象**：日志有 `[OTA] staged pending order@0.0.6 (pre-entry download)`，但仍加载旧 `Documents/.../0.0.6.jsbundle` 并报 `745032085`。

**原因**：`needsUpdate()` 在同版本时返回 false，pending 已下载但不会 promote 到 active，首屏仍用旧 active。

**修复**：`ensureFeatureCached` 在 active hash ≠ remote 时，若 pending 已就绪则**立即 apply**，再加载新路径。
