# screens/remote — Metro 日常开发

**改这里 → Metro HMR 即时生效**（原生壳 DEBUG **Metro** 模式）。

## 职责

| 文件 | 用途 |
|------|------|
| `OrderScreen.tsx` / `PromoScreen.tsx` | Metro dev 页面包装（badge：`Remote · 远程业务`） |
| `order/` | 订单多级 RN 导航（`OrderNavigator`、详情、物流追踪） |
| `components/` | 共享业务 UI（OrderList、PromoList、RemoteHero、`RemoteNativeExitRow`） |
| `featureMeta.ts` | Remote featureId → moduleName 映射 |
| `RemoteScreenShell.tsx` | 页面外壳布局（Remote 全屏 safe area） |

## Remote 全屏 chrome（无原生导航栏）

Remote 入口（`RemoteReactNativeScreenView`）**隐藏 SwiftUI 原生 navigation bar**，避免与 RN 内栈双导航叠加。

| 层级 | 返回方式 |
|------|----------|
| RN 根页（列表 / 活动） | **「← 菜单」** → `popToNative()` 回到 Native Shell |
| RN 子页（详情 / 物流） | **「← 返回」** → React Navigation `goBack()` |

- JS API：`src/features/nativeShell.ts` → `NativeShellNavigation` 原生模块（BrownfieldLib）
- Scheme 1 本地 RN（Home/Profile/Settings）**仍保留**原生 navigation bar

## 订单多级页面（Metro dev）

订单功能内使用 **React Navigation native-stack**（`screens/remote/order/`，见 change `order-react-navigation`）：

| 路由 | 说明 |
|------|------|
| `OrderList` | 列表（初始页，含「← 菜单」） |
| `OrderDetail` | 详情（点击列表项进入） |
| `OrderTracking` | 物流追踪（第三级） |

- 依赖原生模块：`react-native-screens`、`react-native-gesture-handler`、`NativeShellNavigation`
- **新增/升级原生依赖后**须 `pod install` + `npm run brownfield:package:ios:debug:sim` 重建 BrownfieldLib
- 子页使用 **「← 返回」** pop RN 栈；根页 **「← 菜单」** 退出 Remote 功能

```bash
cd rn_app && npm start
# 菜单 → 订单（无原生栏）→ 列表 → 详情 → 物流 → RN 返回 ×2 → 「← 菜单」回 Shell
```

## 不要做什么

- ❌ 不要在这里期望 OTA upload 行为；OTA 走 `bundles/ota_*/`
- ❌ 不要 import `bundles/ota_*`（build-only 目录）
- ❌ 不要把 Remote 页放进 Scheme 1 的 `screens/HomeScreen` 等

## 快速验证

```bash
cd rn_app && npm start
# Xcode Debug → 原生壳工具栏选 Metro → 进入订单/活动页
```

## 更多信息

- [docs/dynamic-multi-bundle.md](../../docs/dynamic-multi-bundle.md) — Remote 双路径架构
- OTA 发版：`npm run build:bundles` → upload → 原生壳 **OTA** 模式
