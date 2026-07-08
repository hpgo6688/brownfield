# OTA split bundle 已加载但 registerFeature 未注册

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: bundleLoader、FeatureHost、build-bundles

## 问题描述

- **现象**：OTA 模式加载 order 时，先显示「加载中…」，随后报错：`bundle 已加载，但组件未注册`
- **触发条件**：同一 RN runtime 内第二次加载 feature，或切换 OTA/Metro 后再次进入
- **影响范围**：所有 OTA Remote feature（order / promo）

## 根因分析

1. `FeatureHost` 在加载前调用 `clearFeatureRegistration()`，清除了 `registerFeature` 注册。
2. Native `registerSegmentWithId` 在同一 session 内对已注册 segment **不会重新 eval bundle**，入口 `__r(entryId)` 不再执行。
3. `loadFeatureBundle` 在 `updated: false` 时 `force: false` 可能跳过加载，加剧问题。
4. 部分上传的 bundle（如 764B）入口 `__r` 错误，也会导致 `registerFeature` 未执行。

## 解决方案

- 新增 `splitBundleEntry.ts`：native load 后显式调用 `global.__r(entryModuleId)` 重跑入口。
- `FeatureHost` OTA 路径始终 `force: true` 并清 `loadedBundleKeys`。
- `finalizeSplitBundle` 增强入口 module id 匹配，去掉多余 `__r()`。

**关键变更**：
- `rn_app/src/features/splitBundleEntry.ts` — 解析并重跑 split 入口
- `rn_app/src/features/bundleLoader.ts` — load 后调用 `executeSplitBundleEntry`
- `rn_app/src/features/FeatureHost.tsx` — 强制重载
- `rn_app/scripts/build-bundles.js` — 修复 finalize 逻辑

## 验证方式

- [ ] `npm run build:bundles` 后 upload order bundle
- [ ] OTA 模式进入 order → 正常显示
- [ ] 切换 Metro/OTA 或退出重进 → 不再报「组件未注册」
- [ ] 活动页「检查 Remote 更新」下载新 bundle 后立即生效

## 后续建议

- 删除 bundle-server 上过小的损坏 bundle（如 order.10.0.1/10.0.2 仅 764B）
- 重新 upload 最新 `order.0.0.1.ios.jsbundle` 并设为 active release
