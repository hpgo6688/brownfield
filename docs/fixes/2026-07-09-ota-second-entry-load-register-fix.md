# OTA 第二次进入 load/register 失败与错误文案误导

> **✅ Fix 摘要** · 完整面试案例（含废弃方案对照）：[docs/interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md)

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: OTA re-entry、`bundleLoader`、`bundleUpdater`、`useFeatureHost`

## 问题描述

- **现象**：OTA 第二次进入报「远程 bundle 不可用（服务端 ota_order 可能已删除或未 upload）」，但服务端/本地均为 v0.0.6
- **触发条件**：Metro → OTA 第一次正常 → 返回 → OTA 第二次进入
- **影响范围**：DEBUG OTA Remote 页（尤其 v0.0.6 等大 split bundle）

## 根因分析

1. **UI 误导**：`formatRemoteBundleError` 将所有 load 错误包成「未 upload」，版本一致时仍显示该文案。
2. **Harmful full eval**：DEV re-entry 对整包 `reevaluateSplitBundleFromDisk`，v0.0.6 含 React Navigation 等大依赖，eval 易失败并污染 runtime，fallback 到 entry 路径仍失败。
3. **Re-entry 过度清 cache**：每次 `ensureSegment` 都 `clearOtaComponentCache`，re-entry 时无法从 cache 恢复 registry。
4. **Bridgeless 时序 + module 缓存（第二次仍失败时）**：
   - `SplitBundleLoader.load()` 立即 resolve，segment eval 在 `scheduleWork` 中异步执行
   - 第二次进入时 entry 模块已 `isInitialized`，`__r(entry)` **不会重跑 factory**，`registerFeature` 不再执行
   - `executeSplitBundleEntry` 在 `syncOtaRegistrationFromCache` 之前以 `requireRegistration` 抛错

详见 [archive/2026-07-09-ota-second-entry-load-failure-analysis.md](./archive/2026-07-09-ota-second-entry-load-failure-analysis.md)（排查笔记，已归档）。

## 解决方案

1. 新增 `formatFeatureLoadError`：版本一致时说明「缓存正常」，并展示真实 `raw` 原因；仅 cache/download 类错误仍用 upload 提示。
2. 移除 re-entry full eval；改为 native segment load + 等待 + entry / cache sync。
3. Re-entry：**必须**先 `SplitBundleLoader.load()`（native segment re-eval），再立刻 `syncOtaRegistrationFromCache`；不可跳过 native load。
4. Re-entry 跳过 3s 轮询；首次进入 bridgeless 仍短 wait 1s。
5. Re-entry 跳过 `ensureFeatureCached` 的 manifest 网络请求。
6. **秒开**：`tryInstantOtaReentry` 在同 session 第二次进入时先读 live registry（不 clear、不 native load），失败再 fallback 完整 load；后台 `warmReentry` 静默对账。

**关键变更**：
- `rn_app/src/features/bundleUpdater.ts` — `formatFeatureLoadError`
- `rn_app/src/features/useFeatureHost.ts` — 错误展示
- `rn_app/src/features/bundleLoader.ts` — re-entry 加载策略
- `rn_app/src/features/splitBundleEntry.ts` — 移除 harmful full eval

## 验证方式

- [x] `npm test` — 23 passed
- [ ] Metro → OTA → Order 第一次 OK → 返回 → 第二次 OK
- [ ] 若仍失败，错误页应显示具体原因（如 `split bundle entry __r(...) failed`）

## 后续建议（可选）

- Release 若 re-entry 仍失败，需在 `SplitBundleLoader` native 层 force re-eval segment
- Metro `--reset-cache` 后需 rebuild + upload OTA split
