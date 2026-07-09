# OTA fast path 复用导致 unknown module 崩溃

> **⚠️ 中间方案（已废弃）**  
> `tryReuseOtaFeature` 直接渲染 cache 会导致 `unknown module`。最终方案见：[docs/interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md)

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: OTA fast path、`bundleLoader` split segment 加载

## 问题描述

- **现象**：OTA 模式重复进入 Remote 页时报错 `Requiring unknown module "745032085"`，堆栈指向 `seg-1.js`
- **触发条件**：版本一致时走 fast path，直接渲染 `__OTA_COMPONENT_CACHE__` 中的组件
- **影响范围**：OTA Remote 页重复进入崩溃

## 根因分析

**不是磁盘 bundle 被删掉。** `Documents/rn-bundles/` 里的 `.jsbundle` 通常还在；出问题的是 **JS 侧 module 注册表**。

1. Native `registerSegmentWithId` 在同一 RN runtime 内 **不会重新 eval** 已加载的 segment（见 `docs/fixes/2026-07-08-ota-register-feature-not-called.md`）
2. 离开 Remote 页后，split bundle 的 module id（如 `745032085`）可能从 require 表消失，但 `__OTA_COMPONENT_CACHE__` 仍保留旧 component
3. `ensureSegment` 路径在 entry 失败时会 **fallback 到 stale cache**，渲染触发 `registerExportsForReactRefresh` → `unknown module`
4. **DEV + Metro `--reset-cache`** 会改变主包 module id，与已 upload 的 OTA split 不匹配时也会报同样错误

## 解决方案

1. `ensureSegment` 时 `clearOtaComponentCache`，**禁止** fallback 到 stale cache
2. `executeSplitBundleEntry` 失败时直接 throw（不再静默吞掉）
3. **DEV re-entry**：检测到 disk cache 命中时，先 `DevSettings.reload()` 一次（marker 持久化在 RNFS，离开页面时清除），再 load segment

**关键变更**：
- `otaFeatureReuse.ts` — `probeOtaFastPath` 替代直接 component 复用
- `useFeatureHost.ts` — fast path 先 ensure segment 再 setScreen
- `bundleLoader.ts` — `ensureSegment` + 始终 register segment

## 验证方式

- [x] `npm test` — 21 passed
- [ ] OTA Order：打开 → 返回 → 再进入（无 unknown module 崩溃）

## 后续建议（可选）

- 若 segment reload 仍有短暂 loading，可考虑 session 级 warm 标记优化 UX
