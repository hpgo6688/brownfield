# OTA 同版本加载失败（服务端/本地均为 v0.0.x）

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app OTA — bundleUpdater、bundleCache、FeatureHost

## 问题描述

- **现象**：进入 promo/order 显示「远程 bundle 不可用」，但错误页同时显示「服务端版本 v0.0.2 · 本地版本 v0.0.2」
- **触发条件**：进页前 staging / 点「稍后」后再次进入；或 pending 下载失败时本地已有可用 active 缓存
- **影响范围**：OTA promo / order

## 根因分析

1. **`stageRemoteFeatureUpdate` 抛错阻断 bootstrap**：进页前预下载 pending 失败（404/网络）时异常向上抛出，`ensureFeatureCached` 整体失败，即使 active 缓存可用也无法加载。
2. **「稍后」下次自动 apply 未 reload**：`applyDeferredPendingIfNeeded` 切换 active 后清除了 `__OTA_COMPONENT_CACHE__`，Native segment 仍保留旧版本，同 session 内 `executeSplitBundleEntry` 无法 re-register → 「not registered」被包装成「远程 bundle 不可用」。
3. **metadata 与文件路径漂移**：metadata 指向已删 bundle 路径，但 canonical `{version}.jsbundle` 仍存在时未自愈。

## 解决方案

1. **`stageRemoteFeatureUpdate` 改为 best-effort**：manifest 检查 / pending 下载失败仅 warn，不阻断 active 加载。
2. **`applyDeferredPendingIfNeeded` 加 try/catch**，无效 deferred pending 清理 metadata。
3. **`runtimeReloadRequired`**：deferred apply 成功后 FeatureHost 触发 `bumpOtaBundleRevision` + DEV OTA 下 `DevSettings.reload()`，整 runtime 重载后再加载新 active。
4. **`reconcileActiveBundleCache`**：合并 stale/unusable 清理，并修复 metadata 路径与 canonical bundle 路径不一致。

**关键变更**：
- `rn_app/src/features/bundleUpdater.ts` — staging 容错、deferred reload 标志
- `rn_app/src/features/bundleCache.ts` — `reconcileActiveBundleCache`
- `rn_app/src/features/FeatureHost.tsx` — 处理 `runtimeReloadRequired`

## 验证方式

- [ ] active v0.0.2 可用，服务端有更高/不同 hash pending 但 bundle 404 → 仍能进页显示 v0.0.2
- [ ] Banner 点「稍后」→ 退出再进 → 自动切到新版本，不报「远程 bundle 不可用」
- [ ] metadata 路径漂移 / 文件缺失 → 自动清理或修复后重新下载
- [ ] 正常 OTA 升级 / 回滚 Banner 流程不受影响

## 后续建议

- 沙盒若已被旧逻辑破坏：删除 `DocumentDirectory/rn-bundles/` 后重进 OTA 页
- Release 非 DEV OTA 场景若仍需 in-session apply，需 Native 层支持 segment 强制 re-eval
