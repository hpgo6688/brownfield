# OTA 服务端版本回滚 / 回切与 polling 一致性

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app OTA 客户端 — bundleLoader、bundleUpdater、otaUpdatePoller、FeatureHost、OtaUpdateBanner

## 问题描述

### 问题 A：回切后页面加载失败

- **现象**：Admin 将线上版本在 0.0.3 ↔ 0.0.5 间切换后，再次进入 order 页显示「远程 bundle 不可用（服务端 ota_order 可能已删除或未 upload）」
- **触发条件**：同一 RN session 内二次进入 OTA Remote 页；bootstrap 曾自动把 active 覆盖为较低版本
- **影响范围**：OTA 模式 order / promo

### 问题 B：回滚后无更新 Banner（回归）

- **现象**：dev 条显示 `active v0.0.5 · remote v0.0.2`，但无「立即更新」Banner，也无法切换至远程版本
- **触发条件**：本地 active 高于服务端 active（Admin 回滚）；问题 A 修复后 `needsUpdate` 被 polling 误用
- **影响范围**：OTA polling / staged apply 流程

### 问题 C：加载失败缺少版本上下文

- **现象**：「页面加载失败」仅显示通用文案，无法区分服务端与沙盒版本
- **触发条件**：任意 OTA bootstrap / load 失败
- **影响范围**：FeatureHost 错误 UI

## 根因分析

1. **`bundleLoader` 顺序错误**：`executeSplitBundleEntry` 失败时先删沙盒再抛错，未先 `syncOtaRegistrationFromCache()`。Native segment 同 session 不 re-eval，`__OTA_COMPONENT_CACHE__` 仍有效却被删掉。
2. **bootstrap 与 polling 混用 `needsUpdate`**：为防进页自动降级加入的「remote < local → false」被 polling 沿用，导致回滚场景 `updateAvailable=false`。
3. **`getPendingUpdate` 误删降级 pending**：`!semver.gt(pending, active)` 时清除 pending，回滚下载的 0.0.2 无法保留。
4. **Apply 降级未 bust component cache**：`__OTA_COMPONENT_CACHE__` 仍为高版本 component，`syncOtaRegistrationFromCache` 因 version 不匹配拒绝恢复。
5. **`ensureFeatureCached` 不比对远端**：本地文件可用时从不拉 manifest，服务端升到更高版本时不会 bootstrap 下载（已在本次一并修复）。

## 解决方案

分离 **bootstrap** 与 **polling** 两套语义：

| 场景 | 函数 | 行为 |
|------|------|------|
| 进页 bootstrap | `needsUpdate` | 仅 **升级** 时自动下载；remote < local 不覆盖 active |
| Polling / Banner | `remoteDiffersFromActive` | remote 与 active 版本或 hash 任一不同即提示（含回滚） |
| Pending 校验 | `matchesRemoteRelease` | pending 须与当前 manifest 一致，否则丢弃重下 |
| Apply | `clearOtaComponentCache` + `shouldBustOtaComponentCache` | 切换版本时清 stale component，再 load |

**关键变更**：

- `rn_app/src/features/bundleLoader.ts` — sync 顺序；版本变更时 bust OTA cache
- `rn_app/src/features/bundleUpdater.ts` — `needsUpdate` / `remoteDiffersFromActive` / `matchesRemoteRelease`；`ensureFeatureCached` 比对 manifest；`applyPendingFeature` 清 cache
- `rn_app/src/features/otaUpdatePoller.ts` — 用 `remoteDiffersFromActive` 驱动 poll；stale pending 丢弃
- `rn_app/src/features/OtaUpdateBanner.tsx` — 文案改为「发现远程版本」（兼容升级与回滚）
- `rn_app/src/features/FeatureHost.tsx` — 加载失败展示服务端版本 / 本地版本

## 验证方式

- [ ] OTA 进入 order（v0.0.5）→ 正常
- [ ] Admin 切 active 到 0.0.3，不点更新 → 仍显示 v0.0.5，不闪退
- [ ] Admin 切回 0.0.5 → 再次进入 order 正常
- [ ] Admin 切 active 到 0.0.2（低于本地 0.0.5）→ 出现 Banner「发现远程版本 v0.0.2」
- [ ] 点「立即更新」→ 页面切换为 v0.0.2
- [ ] 人为触发加载失败 → 错误页显示「服务端版本 / 本地版本」
- [ ] 同一 session 多次进出 order、Metro↔OTA 切换仍正常

## 后续建议

- 沙盒若被旧逻辑删坏：删除 `DocumentDirectory/rn-bundles/` 或重装 App
- 发版：`bundle-server/scripts/publish-ota-versions.sh` 可批量 build + upload 0.0.1–0.0.5
