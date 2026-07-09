## Why

Remote 功能（如 order 多级页）已使用 React Navigation 管理 **功能内** 页面栈，同时 SwiftUI `NavigationStack` 仍显示 **原生导航栏**（标题 + 返回）。同一屏叠加两套导航 chrome，体验割裂；子页用 RN 返回、原生栏返回却直接退出整个功能，行为也不一致。

应在 Remote RN 全屏展示时 **隐藏原生导航栏**，由 RN 统一负责功能内导航；同时保证用户能 **可靠退回原生菜单**（Native Shell）。

## What Changes

- **Remote 入口**（`RemoteReactNativeScreenView`）进入后隐藏 SwiftUI 原生 navigation bar；Scheme 1 本地 RN 页（`LocalReactNativeScreenView`）保持现有原生栏不变
- RN Remote 根页（如 `OrderList`）提供 **退出到原生** 控件（或复用手势），调用原生 dismiss（`popToNative`）
- 完善 Swift ↔ RN 桥：`popToNative` 通知 / 轻量 Native Module，RN 栈在根路由时可触发原生 `dismiss()`
- RN 子页继续用 React Navigation + `OrderBackRow` pop 一级；**不再依赖**原生栏作为 RN 栈返回
- 更新 `RemoteScreenShell` / 文档：Remote 为 fullscreen chrome；Safe Area 由 RN 侧处理
- DEBUG：Remote 的 Metro/OTA 切换仍保留在 **Native Shell 根菜单** toolbar，不依赖 Remote 页原生栏

## Capabilities

### New Capabilities

- `remote-rn-native-chrome`: Remote RN 全屏 chrome 策略、隐藏原生导航栏、RN 退回原生菜单的交互与桥接

### Modified Capabilities

- _(none — 不修改已归档 bundle/OTA specs；本变更聚焦 ios_native + Remote RN UX)_

## Impact

- **ios_native**: `ReactNativeScreenView.swift`（隐藏 Remote 原生栏、`popToNative` 定义与 dismiss）、可选新 Swift helper / TurboModule 宿主
- **rn_app**: `RemoteScreenShell`、order/promo 根页退出原生入口、轻量 `nativeShell` JS API
- **Docs**: `screens/remote/README.md`、`README.md` Remote 导航约定更新（与旧「保留原生栏」文档冲突处修正）
- **依赖关系**: 与 `order-react-navigation` 互补；可先合入导航，再合本变更

## Non-Goals

- Scheme 1 核心页（Home/Profile/Settings）隐藏原生栏
- 原生侧感知 RN 栈深度并动态切换原生栏显隐（v1 对 Remote 统一隐藏）
- Android 壳（若未来有）一并改造
