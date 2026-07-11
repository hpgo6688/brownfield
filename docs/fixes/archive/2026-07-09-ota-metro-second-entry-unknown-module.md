# Metro → OTA 第二次进入 unknown module

> **⚠️ 已归档 · 中间方案（已废弃）**  
> **索引**：[docs/fixes/README.md](../README.md)  
> 最终方案：[stories/01-ota-reentry-registry-lifecycle.md](../stories/01-ota-reentry-registry-lifecycle.md)

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: OTA re-entry、`bundleLoader`、`splitBundleEntry`、`useFeatureHost`

## 问题描述

- **现象**：先 Metro 打开 Remote 页正常，切 OTA 第一次正常，**OTA 第二次进入**报 `Requiring unknown module "745032085"`（堆栈含 `registerExportsForReactRefresh` / `seg-1.js`）
- **触发条件**：Metro 与 OTA 切换后，在同一 RN runtime 内重复进入 OTA Remote 页
- **影响范围**：DEBUG 下 OTA Remote 页（order / promo）

## 根因分析

1. Native `registerSegmentWithId` 对已加载 segment **不会 re-eval**（segment 路径仍注册在 native RAM registry）。
2. 此前 DEV re-entry 方案用 `DevSettings.reload()` 清空 JS module 表，但 **native segment 状态保留**，reload 后 `__r(entry)` 无法恢复 split 内 module id 映射 → `unknown module`。
3. Metro 连接时 Fast Refresh 可能进一步破坏 segment module 与 `__OTA_COMPONENT_CACHE__` 的一致性。
4. 磁盘 bundle **未被删除**；问题在 JS/native 加载状态，不在缓存文件。

## 解决方案

1. **移除** `maybeReloadForOtaReentry`（不再在第二次 OTA 进入时 `DevSettings.reload()`）。
2. **新增** `reevaluateSplitBundleFromDisk`：DEV 下 OTA re-entry 时对磁盘 split bundle 做 full eval（`globalEvalWithSourceUrl` / `eval`），`__d` 对已存在 module id 会跳过，末尾 `__r(entry)` 重新 `registerFeature`。
3. Metro 路径进入时清除 OTA session mark / component cache / loaded bundle keys，避免 Metro 与 OTA 状态串扰。
4. `reloadFeatureRuntime()` 额外 `clearOtaComponentCache()`。

**关键变更**：
- `rn_app/src/features/splitBundleEntry.ts` — `reevaluateSplitBundleFromDisk`
- `rn_app/src/features/bundleLoader.ts` — re-entry 走 re-eval 快路径
- `rn_app/src/features/useFeatureHost.ts` — 移除 harmful reload；Metro 清 OTA 状态
- `rn_app/src/features/featureReload.ts` — 模式切换清 OTA cache

## 验证方式

- [x] `npm test`
- [ ] Metro → OTA → 进入 Order → 返回 → 再进入 Order（无 unknown module）
- [ ] 多次 Metro ↔ OTA 切换后 OTA 重复进入仍正常

## 后续建议（可选）

- Release（`__DEV__ false`）若仍有 re-entry 问题，需在 `SplitBundleLoader` native 层增加 force re-eval API
- OTA split 与主包 module id 不一致时（如 Metro `--reset-cache` 后未 rebuild/upload），需重新 `build:bundles` + upload
