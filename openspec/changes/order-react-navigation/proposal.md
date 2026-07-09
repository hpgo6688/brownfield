## Why

order 多级页当前使用自研 `OrderPageStack`（`useState` + `Animated.translateX`），因 Brownfield 壳未链接 `react-native-screens` / `react-native-gesture-handler` 而临时放弃 React Navigation。自研栈缺少标准转场、手势返回与可维护的路由类型，跳转体验「怪」且与团队预期（React Navigation）不一致。现在 order 多级 UI 与共享区结构已落地，应补齐原生依赖并切回 React Navigation，获得与 iOS 一致的全页栈导航体验。

## What Changes

- 在 `rn_app` 安装 React Navigation 栈导航依赖：`@react-navigation/native`、`@react-navigation/native-stack`、`react-native-screens`、`react-native-gesture-handler`
- 在 Brownfield iOS 工程中链接上述原生模块，重建 `BrownfieldLib`（Debug/Release 流程文档化）
- 用 `OrderNavigator`（`NavigationContainer` + `NativeStackNavigator`）**替换**自研 `OrderPageStack` / `OrderNavigationContext`
- 保留现有三级路由（`OrderList` → `OrderDetail` → `OrderTracking`）、`OrderBackRow` 应用内返回、`headerShown: false`（原生壳导航栏不变）
- 更新 `build-bundles.js` split filter，确保 React Navigation 与 screens 打进 `ota_order` bundle
- 移除不再需要的自研导航文件（`OrderPageStack.tsx`、`OrderNavigationContext.tsx` 等）
- 文档更新：Brownfield 原生依赖要求、Metro/OTA 验证步骤

## Capabilities

### New Capabilities

- `order-react-navigation`: order 功能内 React Navigation native-stack 集成、Brownfield 原生依赖、自研栈迁移与双路径（Metro + OTA）验证

### Modified Capabilities

- _(none — no archived specs in `openspec/specs/` yet)_

## Impact

- **rn_app**: `package.json`、`index.js`（gesture-handler 入口）、`screens/remote/order/*`（navigator 重写）、删除自研栈模块
- **ios_native / BrownfieldLib**: Pod/SPM 接入 `react-native-screens`、`react-native-gesture-handler`；需 `brownfield:package:ios:debug:sim` 重建
- **OTA**: `ota_order` bundle 体积增加（navigation + screens）；`build:bundles` + upload 后 OTA 模式可用
- **Docs**: `screens/remote/README.md`、`docs/sop.md` 或 brownfield 文档补充 navigation 原生依赖说明
- **Supersedes**: `order-rn-multi-level-pages` 中「自研 JS 栈」实现路径（功能需求不变，实现方式变更）
