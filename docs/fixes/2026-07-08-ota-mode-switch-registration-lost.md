# OTA 模式切换后 registerFeature 丢失（source=none）

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: registerFeature、bundleLoader、FeatureHost · OTA/Metro 模式切换

## 问题描述

- **现象**：OTA 模式首次进入 order 正常，切换 Metro ↔ OTA 后报错：`bundle 已加载但未注册 ota_* 组件（source=none，version=0.0.1）`
- **触发条件**：同一 RN runtime 内第二次进入 OTA，或 Metro/OTA 工具栏来回切换
- **影响范围**：所有 Remote OTA feature（order、promo）

## 根因分析

1. 模式切换时 `FeatureHost` 调用 `clearFeatureRegistration()`，**清空了 JS 侧 `__RN_FEATURE_REGISTRY__`**。
2. 沙盒 **bundle 文件与 metadata 仍然有效**（`checkAndUpdateFeature` 直接命中缓存，version=0.0.1），并非 meta 与 bundle 不一致。
3. Native `registerSegmentWithId` 在同一 session 内对已加载 segment **不会重新 eval**，入口 `__r()` / `registerFeature()` 不再执行。
4. `executeSplitBundleEntry` 在二次加载时可能静默失败，且此前未校验结果，导致「bundle 已加载但 registry 为空」。

**结论**：不是 metadata 没清理，而是 **只清理了 JS registry，native/AppRegistry 模块仍在内存中，re-eval 被跳过**。

## 解决方案

- 新增 `__OTA_COMPONENT_CACHE__`：首次 OTA `registerFeature` 时缓存 component 引用。
- 新增 `syncOtaRegistrationFromCache()`：在 native load 后若 registry 仍为空，从 cache 恢复 OTA 注册。
- `loadFromNativeSplitBundle` 在 load 后检查注册，失败则抛明确错误。
- `FeatureHost` 在 `loadFeatureBundle` 后额外尝试 cache sync（双保险）。

**关键变更**：
- `rn_app/src/features/registerFeature.ts` — OTA component cache + sync
- `rn_app/src/features/bundleLoader.ts` — load 后 sync / throw
- `rn_app/src/features/FeatureHost.tsx` — load 后 fallback sync

## 验证方式

- [ ] OTA 模式进入 order → 显示绿色 `OTA · 远程 Bundle`
- [ ] 切换 Metro → 再切 OTA → 不再报 source=none
- [ ] 多次切换 Metro/OTA → 两种页面内容各自正确
- [ ] 上传新版本 bundle 后 OTA cache 被新 registerFeature 覆盖

## 后续建议

- 若仍异常，删除沙盒 `DocumentDirectory/rn-bundles/` 或重装 App 清除损坏缓存
