# screens/remote — Metro 日常开发

**改这里 → Metro HMR 即时生效**（原生壳 DEBUG **Metro** 模式）。

## 职责

| 文件 | 用途 |
|------|------|
| `OrderScreen.tsx` / `PromoScreen.tsx` | Metro dev 页面包装（badge：`Remote · 远程业务`） |
| `order/` | 订单多级 RN 导航（`OrderNavigator`、详情、物流追踪） |
| `navigation/` | 共享 native-stack header 样式、`RemoteRootHeaderBack` |
| `components/` | 共享业务 UI（OrderList、PromoList、RemoteHero） |
| `featureMeta.ts` | Remote featureId → moduleName 映射 |
| `RemoteScreenShell.tsx` | 页面外壳（bottom safe area；top 由 RN header 处理） |

## Remote 全屏 chrome（无原生 navigation bar）

Remote 入口（`RemoteReactNativeScreenView`）**隐藏 SwiftUI 原生 navigation bar**，避免双导航叠加。见已归档 change `remote-rn-hide-native-nav`。

### React Navigation native-stack header

Remote 功能内使用 **React Navigation 原生导航栏**（`headerShown: true`），统一配置见 `navigation/remoteStackScreenOptions.ts`：

| 路由层级 | 导航栏行为 |
|----------|------------|
| 根页（OrderList / PromoRoot） | 标题 + 左侧「菜单」→ `popToNative()` |
| 子页（OrderDetail / OrderTracking） | 系统返回按钮「返回」+ 侧滑手势 → `goBack()` |

根页 `RemoteHero` 使用 `showTitle={false}`，标题由 navigation header 展示。

- JS API：`src/features/nativeShell.ts` → `NativeShellNavigation.popToNative()`
- Scheme 1 本地 RN（Home/Profile/Settings）**仍保留** SwiftUI navigation bar

### 手势返回

子路由启用 `gestureEnabled` + `fullScreenGestureEnabled`。根列表 `OrderList` / `PromoRoot` 禁用全屏手势，避免与 `ScrollView` 冲突。

### 已知限制（v1）

SwiftUI 边缘 interactive pop 在 RN 子页仍可能 **直接 dismiss 整个 Remote**；v1 依赖 RN navigation header + native-stack 侧滑。

## 订单多级页面（Metro dev）

| 路由 | 说明 |
|------|------|
| `OrderList` | 列表（初始页，RN header + 「菜单」） |
| `OrderDetail` | 详情 |
| `OrderTracking` | 物流追踪 |

```bash
cd rn_app && npm start
# 菜单 → 订单 → 列表 → 详情 → 物流 → 导航栏返回/侧滑 ×2 → 「菜单」回 Shell
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
