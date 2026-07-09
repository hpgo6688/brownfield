# OTA order split bundle 缺少多级导航模块

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: `rn_app/scripts/build-bundles.js`, `ota_order` OTA bundle

## 问题描述

- **现象**：`ota_order.*.ios.jsbundle` 仅 ~5KB，引用 `OrderNavigator` 的 moduleId 在 bundle 内无定义，OTA 加载订单页会缺模块
- **触发条件**：为 order 增加 `screens/remote/order/` 导航后执行 `npm run build:bundles`
- **影响范围**：OTA 模式 order 多级页无法运行；Metro 模式不受影响

## 根因分析

`build-bundles.js` 的 `isFeatureOwnedBySplit()` 只收录 `bundles/ota_*`、`components/`、`RemoteScreenShell`，未包含 `screens/remote/order/` 与 `@react-navigation` / `react-native-screens`。split 输出时这些模块被排除，但 `OrderScreen` 仍引用其 moduleId。

## 解决方案

扩展 `isFeatureOwnedBySplit()`，将 order 导航与 React Navigation 依赖纳入 split 归属：

- `/screens/remote/order/`
- `/node_modules/@react-navigation/`
- `/node_modules/react-native-screens/`

**关键变更**：
- `rn_app/scripts/build-bundles.js` — 扩展 split filter 路径

## 验证方式

- [x] `npm run build:bundles` 后 `ota_order.0.0.5.ios.jsbundle` ≈ 276KB
- [x] bundle 内含 `OrderNavigator`、`NavigationContainer`、`OrderDetailScreen`
- [x] `npm run verify:ota-scope` 通过
