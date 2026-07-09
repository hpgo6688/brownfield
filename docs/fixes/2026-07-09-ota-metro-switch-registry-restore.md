# Metro 切回 OTA 后加载失败

**Date**: 2026-07-09
**Status**: Fixed (see [OTA 开发态会话修复总览](./2026-07-09-ota-dev-session-fixes-summary.md))
**Scope**: OTA feature host / split bundle loader (iOS bridgeless)

## 问题描述

- **现象**：Metro → OTA（首次 OK）→ OTA 二次进入 OK → 再切 Metro → 再切 OTA 时，segment 重新 eval 但 JS registry 未恢复，页面加载失败或白屏
- **触发条件**：同一会话内先 OTA 再 Metro 再 OTA；日志中 `otaReentry=false`，无 `syncFromCache`
- **影响范围**：开发态 Metro/OTA 切换；生产若存在类似模式切换也可能受影响

## 根因分析

1. Metro 入口调用 `clearOtaComponentCache()`，销毁了 OTA 组件缓存，`syncOtaRegistrationFromCache` 无法恢复 registry
2. Metro 入口 `clearOtaFeatureSessionMark()`，使后续 OTA 走冷路径（`otaReentry=false`）
3. `tryInstantOtaReentry` 的 cache-only 分支在 registry 已清空时跳过 native load，无法触发 segment 后的 cache 同步
4. bridgeless 下 `registerSegment` 总会 re-eval segment，但 `registerFeature` 不会重跑，必须从 `__OTA_COMPONENT_CACHE__` 恢复

## 解决方案

1. **保留 OTA 组件缓存**：Metro 模式只清 JS registration，不清 `__OTA_COMPONENT_CACHE__`
2. **Metro 会话标记**：新增 `__METRO_LOADED_THIS_SESSION__`，OTA 加载时识别 `afterMetro` 路径
3. **`restoreRegistry`**：`otaReentry || afterMetro` 时保留 cache、segment eval 后立即 `syncFromCache`，且 `requireRegistration=false`
4. **收紧 instant 路径**：仅 live OTA registry 可 instant；Metro 之后或 registry 为空时走完整 load + restore
5. **reload 时** 同时清空 OTA/Metro 会话标记

**关键变更**：
- `rn_app/src/features/otaSessionLoad.ts` — Metro 会话追踪 API
- `rn_app/src/features/useFeatureHost.ts` — Metro 不再 `clearOtaComponentCache`，标记 Metro 会话
- `rn_app/src/features/bundleLoader.ts` — `afterMetro` + `restoreRegistry` 路径
- `rn_app/src/features/otaFeatureReuse.ts` — instant 仅 live OTA registry
- `rn_app/src/features/featureReload.ts` — reload 清空双会话标记

## 验证方式

- [x] `npm test` — 28 passed
- [ ] 手动：Metro → OTA → OTA 二次 → Metro → OTA，日志应出现 `afterMetro=true` 且页面正常
- [ ] 手动：纯 OTA→OTA 二次进入仍可有 `instant re-entry (live registry)`

## 后续建议

- `LeakChecker` Surface 泄漏与 NavigationLink 反复 mount 可单独排查
- 考虑在 Metro→OTA 成功恢复后也支持 instant（当前 intentional 走 restore 路径）
