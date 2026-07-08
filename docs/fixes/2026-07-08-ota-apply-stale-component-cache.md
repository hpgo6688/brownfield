# OTA 更新后 UI 仍显示旧版本（OTA cache 未失效）

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: registerFeature、bundleLoader、applyPendingFeature · OTA polling apply

## 问题描述

- **现象**：poll 显示 `active v0.0.1 · remote v0.0.1`，或 apply 后 subtitle 仍是旧文案
- **触发条件**：同一 session 内 OTA 版本升级（apply pending / 立即更新）
- **影响范围**：所有 Remote OTA feature

## 根因分析

1. Native `registerSegmentWithId` 对已加载 segment **不会 re-eval** 新 bundle 文件。
2. `syncOtaRegistrationFromCache()` 在 load 后把 **旧版 component** 从 `__OTA_COMPONENT_CACHE__` 恢复到 registry。
3. 结果：metadata 已是新版本，但 React 渲染的仍是旧 OTA 屏幕。

**结论**：版本升级时必须 **按 active metadata 版本失效 OTA cache**，且 sync 仅允许恢复 **同版本** cache（Metro↔OTA 切换场景）。

## 解决方案

- 不在 apply 时清空 `__OTA_COMPONENT_CACHE__`；新版本 `registerFeature` 成功后自然覆盖
- `syncOtaRegistrationFromCache` 仅在同 version/hash/path 时恢复（Metro↔OTA 切换）
- `executeSplitBundleEntry` 在 native load 前后均尝试 `globalEvalWithSourceUrl`
- DEV 下点「立即更新」后 `DevSettings.reload()` 确保整页加载新 bundle

## 验证方式

- [ ] OTA 停留在 v0.0.4，服务端发 v0.0.5 → poll 出现 Banner
- [ ] 点「立即更新」→ subtitle 变为 v0.0.5 文案
- [ ] Metro ↔ OTA 切换仍正常（同版本 cache sync）
