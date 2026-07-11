# OTA 模式下远程业务重复进入 loading 优化

> **⚠️ 已归档 · 部分 superseded**  
> **索引**：[docs/fixes/README.md](../README.md)  
> fast path 已废弃；`verifyOtaBundleBody` 仍有效 → [stories/03-ota-cache-version-semantics.md](../stories/03-ota-cache-version-semantics.md)  
> Re-entry 最终方案：[stories/01-ota-reentry-registry-lifecycle.md](../stories/01-ota-reentry-registry-lifecycle.md)

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: `rn_app/src/features/` — OTA FeatureHost 加载、bundle 缓存复用、下载完整性

## 问题描述

- **现象**：OTA 模式下每次打开 Remote 业务页（Order/Promo）都会重新出现 loading，即使本地缓存版本与远程一致
- **触发条件**：用户离开 Remote 页后再次进入；版本未变化时仍触发完整 bootstrap
- **影响范围**：OTA 模式 Remote 页体验；重复进入感知慢

## 根因分析

`useFeatureHost` 在每次 mount 时无条件：
1. 将 `Screen` 置为 `null`（显示 loading）
2. 调用 `clearFeatureRegistration` / `clearLoadedBundlesForFeature` 清除内存状态
3. 以 `force: true` 强制重新加载 split bundle

磁盘缓存虽已通过 `ensureFeatureCached` 跳过重复下载，但内存注册与 loaded-bundle 追踪被清空，导致每次进入都走完整加载路径。

## 解决方案

1. 新增 `tryReuseOtaFeature`：在 verified active cache + `__OTA_COMPONENT_CACHE__` 可恢复时立即渲染，跳过 clearing 与 force reload
2. `useFeatureHost` fast path：命中复用后后台异步 `ensureFeatureCached`（staging/poll），不阻塞 UI；版本变化时不自动切换屏幕
3. 全量 bootstrap 路径移除 unconditional `force: true`，依赖 `loadFromNativeSplitBundle` 已有 early return
4. 提取 `verifyOtaBundleBody`，`applyPendingFeature` promote 前 re-verify；失败清 pending、保留 active 版本

**关键变更**：
- `rn_app/src/features/otaFeatureReuse.ts` — 新增 fast-path helper
- `rn_app/src/features/useFeatureHost.ts` — fast path + 后台 sync + 条件 full bootstrap
- `rn_app/src/features/bundleUpdater.ts` — `verifyOtaBundleBody`；`applyPendingFeature` 加固
- `rn_app/src/features/__tests__/otaFeatureReuse.test.ts` — fast path 单测
- `rn_app/src/features/__tests__/bundleUpdaterIntegrity.test.ts` — 下载完整性单测

## 验证方式

- [x] `npm test` — 22 tests passed（含 otaFeatureReuse、bundleUpdaterIntegrity、retryWithBackoff）
- [ ] 手动：OTA Order 打开 → 返回 → 再进入（同版本无 loading）
- [ ] 手动：upload 新版本 → banner → 立即更新触发 reload
- [ ] 手动：模拟 hash 失败下载 — 保持旧版本不 crash

## 后续建议（可选）

- 手动 smoke 5.1–5.3 在 Brownfield 壳上确认
- 可考虑 archive OpenSpec change：`fix-ota-remote-bundle-reuse`
