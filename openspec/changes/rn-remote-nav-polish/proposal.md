## Why

Remote 订单多级页已接入 React Navigation native-stack，并隐藏了 SwiftUI 原生 navigation bar（`remote-rn-hide-native-nav`）。但当前导航体验仍分散、不一致：

- 根页用 `RemoteNativeExitRow`（「← 菜单」），子页用 `OrderBackRow`（「← 返回」）——样式与布局不统一，缺少统一顶栏
- iOS 边缘 swipe-back / native-stack 手势未显式配置，转场与返回路径不清晰
- 原生 `NavigationStack` 边缘返回与 RN 栈深度未协同（子页时用户期望 pop RN，根页才退出 Remote）

需要在 **不恢复原生 navigation bar** 的前提下，统一 Remote RN 导航 chrome，并优化手势与返回语义。

## What Changes

- 引入统一 **`RemoteNavHeader`** 组件：根路由显示「返回菜单」+ 功能标题；子路由显示「返回上一级」+ 页面标题
- 用 `RemoteNavHeader` **替换** `RemoteNativeExitRow` + `OrderBackRow` 的分散用法（order 子页、promo 根页）
- 配置 React Navigation native-stack：**启用手势返回**（`gestureEnabled`、`fullScreenGestureEnabled`），统一 `animation`
- 扩展 **`nativeShell` 桥**：`canPopRNStack()` / `popRNStackOrNative()`（或 native 侧监听返回）— 根页 pop 到菜单，子页先 pop RN 栈
- Swift 侧：Remote 全屏时 **interactive pop** 与 RN 桥协同（v1 可先 JS 侧 `beforeRemove` + 文档化）
- 文档更新：Remote 导航 UX 约定（根/子返回语义、手势）

## Capabilities

### New Capabilities

- `rn-remote-nav-polish`: Remote RN 统一导航顶栏、手势返回、原生/RN 返回协同

### Modified Capabilities

- `remote-rn-native-chrome`: 补充「子页原生边缘返回应先 pop RN 栈」与统一 header 要求（delta spec）

## Impact

- **rn_app**: `screens/remote/components/RemoteNavHeader.tsx`、`nativeShell.ts` 扩展、order screens、promo、`OrderNavigator` screenOptions
- **ios_native**: 可选 Swift 返回委托增强（`ReactNativeScreenView` / `NativeShellNavigation`）
- **Docs**: `screens/remote/README.md`、与已归档 `remote-rn-hide-native-nav` / 进行中 `order-react-navigation` 对齐
- **Non-breaking**: 路由表与 FeatureHost 注册不变

## Non-Goals

- 恢复 Remote 的 SwiftUI navigation bar
- Tab / Modal / 深链接
- promo 多级 stack（仅统一根页 header）
- Android 壳（iOS-first）
