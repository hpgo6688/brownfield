# OTA instant re-entry 白屏与卡顿

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: rn_app OTA — `bundleLoader`、`useFeatureHost`、`otaFeatureReuse`

## 问题描述

- **现象**：日志已有 `[OTA] instant re-entry feature=order (live registry)`，但二次进入仍出现白屏或长时间无内容，体感像又在加载 2MB bundle
- **触发条件**：同 session 内 OTA → 返回 → 再进 Order；版本未变时最明显
- **影响范围**：所有 Remote OTA 功能的重复进入体验

## 根因分析

1. **warmReentry 顺序错误**：`loadFromNativeSplitBundle` 在 `ensureSegment` 时先 `clearFeatureRegistration`，再判断 `warmReentry`，导致 `isFeatureLoadedFromOta` 恒为 false，背景 `refreshOtaEntryInBackground` 仍执行 `SplitBundleLoader.load` 整段 eval，阻塞 JS 主线程。
2. **首帧空窗**：`useFeatureHost` 的 `Screen` 初始为 `null`，须等 `useEffect` 异步跑完才 `setScreen`，第一帧必为 loading/空白。
3. **不必要的背景 reload**：instant 成功后，版本未变时仍调用 `loadFeatureBundle(ensureSegment: true)`，放大上述问题。

## 解决方案

1. 在清 registry **之前**用 `liveOtaRegistration` 判断 `warmReentry`，命中则直接 return，跳过 native segment load。
2. 导出同步 `peekInstantOtaReentry`，`useState` 初始化时若 session + live registry 存在则首帧直接渲染。
3. `refreshOtaEntryInBackground` 仅在 `updateResult.updated === true` 时才 `loadFeatureBundle`。

**关键变更**：
- `rn_app/src/features/bundleLoader.ts` — warmReentry 提前判断，避免误触发 2MB eval
- `rn_app/src/features/otaFeatureReuse.ts` — 新增 `peekInstantOtaReentry`
- `rn_app/src/features/useFeatureHost.ts` — 首帧同步渲染 + 背景 refresh 降级

## 验证方式

- [x] `npm test` — `bundleLoaderWarmReentry.test.ts`、`otaFeatureReuse.test.ts` 通过
- [ ] 手动：OTA 进 Order → 返回 → 再进，应首帧有内容；日志有 `instant re-entry` 且**无**后续 `[SplitBundleLoader] load`（版本未变时）

## 后续建议（可选）

- 将 `NavigationContainer` 提升到 session 级缓存，减少 react-native-screens 冷启动白闪
- DEV 下 `resolveUseOtaMode` 优先用 native 传入的 `devOtaMode`，避免 RNFS 读盘延迟
- **CPU 飙高（instant 后短时间）**：见 `docs/fixes/2026-07-09-ota-instant-reentry-cpu-spike.md`（已落文档，待优化）
