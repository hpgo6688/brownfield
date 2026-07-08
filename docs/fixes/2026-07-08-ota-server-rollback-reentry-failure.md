# 服务端版本回切后 OTA 页报「远程 bundle 不可用」

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app OTA 客户端 — bundleLoader、bundleUpdater

## 问题描述

- **现象**：服务端有 0.0.1–0.0.5 五个版本，Admin 将线上版本切到 0.0.3 后客户端未升级，再切回 0.0.5 后进入 order 页显示「远程 bundle 不可用（服务端 ota_order 可能已删除或未 upload）」
- **触发条件**：同一 RN session 内二次进入 OTA Remote 页；或服务端 active 版本先降后升；polling 曾下载过低于当前 active 的 pending bundle
- **影响范围**：OTA 模式 order / promo

## 根因分析

1. **`bundleLoader` 顺序错误**：`executeSplitBundleEntry` 失败后立即删除沙盒缓存并抛错，**尚未**调用 `syncOtaRegistrationFromCache()`。Native `registerSegmentWithId` 对同 segment 不会 re-eval，二次进入时 `__r()` 常失败，但 `__OTA_COMPONENT_CACHE__` 里仍有有效 component。
2. **`needsUpdate` 对回滚过于激进**：服务端 active 低于本地 active 时（0.0.3 vs 0.0.5），仅 hash 不同也会触发 bootstrap 下载并 **覆盖 active**，可能 prune 掉更高版本文件，造成 metadata / native segment / 缓存不一致。
3. **`ensureFeatureCached` 不校验远端**：本地 active 文件可用时直接返回，服务端已升到更新版本时不会拉取新版本。
4. **过期的 pending**：服务端 0.0.3 时 poll 下载的 pending，在服务端回到 0.0.5 后仍残留，干扰后续 poll。

## 解决方案

1. `loadFromNativeSplitBundle`：native load 后 **先** sync cache，再 `executeSplitBundleEntry`，失败后再 sync，最后才删缓存。
2. `needsUpdate`：远端 semver **低于** 本地时不自动降级 active。
3. `ensureFeatureCached`：命中本地缓存时仍拉 manifest，若 `needsUpdate` 则走 `checkAndUpdateFeature`。
4. `getPendingUpdate`：pending 版本不高于 active 时清除 stale pending。

**关键变更**：
- `rn_app/src/features/bundleLoader.ts` — sync 顺序调整
- `rn_app/src/features/bundleUpdater.ts` — needsUpdate / ensureFeatureCached / getPendingUpdate

## 验证方式

- [ ] OTA 进入 order（v0.0.5）→ 正常
- [ ] Admin 切 active 到 0.0.3，客户端不点更新 → 仍显示 v0.0.5
- [ ] Admin 切回 0.0.5 → 再次进入 order 正常，不再报「远程 bundle 不可用」
- [ ] 同一 session 多次进出 order / Metro↔OTA 切换仍正常

## 后续建议

- 若沙盒已被旧逻辑删坏，删除 `DocumentDirectory/rn-bundles/` 或重装 App 后重新进入 OTA 页
