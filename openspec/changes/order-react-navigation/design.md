## Context

order 多级页已在 `screens/remote/order/` 落地（`OrderListScreen`、`OrderDetailScreen`、`OrderTrackingScreen`、`OrderBackRow`、`fixtures`），Metro / OTA wrapper 通过 `OrderNavigator` 挂载。当前 navigator 使用自研 `OrderPageStack`（`useState` 路由栈 + `Animated.translateX`），因 Brownfield 壳运行时缺少以下原生模块而未能使用 React Navigation：

| 缺失模块 | 报错 |
|----------|------|
| `react-native-screens` | `unimplemented component: <RNSScreenStack>`（native-stack） |
| `react-native-gesture-handler` | `RNGestureHandlerModule not found`（stack 手势 / 部分 navigation 路径） |

`order-rn-multi-level-pages` 变更的功能需求（三级路由、应用内返回、双路径共享、原生导航栏保留）仍然有效；本变更仅将实现从自研栈迁移到 React Navigation，并补齐 Brownfield 原生依赖。

Brownfield 打包流程：`npm run brownfield:package:ios:debug:sim` → Xcode 引用 `rn_app/ios/.brownfield/package/build` 中的 `BrownfieldLib`。

## Goals / Non-Goals

**Goals:**

- 安装并链接 React Navigation native-stack 所需 JS + 原生依赖
- `OrderNavigator` 改用 `NavigationContainer` + `createNativeStackNavigator`
- 保留现有三级路由表、`headerShown: false`、页内 `OrderBackRow` 返回
- 删除自研导航模块（`OrderPageStack`、`OrderNavigationContext`）
- Metro 与 OTA 双路径冒烟通过；`build:bundles` split 收录 navigation 依赖
- 文档说明 Brownfield 重建步骤

**Non-Goals:**

- 原生系统返回键与 RN 栈 pop 联动（follow-up TurboModule）
- promo 或其他 Remote 功能接入 React Navigation
- Tab / Modal / 深链接路由
- Android Brownfield（若当前仓库仅 iOS 演示，任务可标注 iOS-first）

## Decisions

### 1. 使用 `@react-navigation/native-stack`（非 JS stack）

**Decision:** `@react-navigation/native` + `@react-navigation/native-stack` + `react-native-screens`。

**Rationale:** 原生栈转场与 iOS 体验一致；项目最初设计即为此方案。

**Alternative considered:** `@react-navigation/stack`（纯 JS Animated 卡片）— 仍依赖 `react-native-gesture-handler`，且转场不如 native-stack；拒绝。

### 2. Brownfield 原生链接为前置条件

**Decision:** 实现顺序：安装 npm 依赖 → `pod install`（`rn_app/ios`）→ `brownfield:package:ios:debug:sim` 重建 BrownfieldLib → 再改 JS navigator。

**Rationale:** 无原生模块时 native-stack 必崩；先打通原生再换 JS，避免反复回退。

**Alternative considered:** 仅 Metro standalone `npm run ios` 验证 — 不足；主路径是 Brownfield 壳。

### 3. `index.js` 入口导入 gesture-handler

**Decision:** 在 `rn_app/index.js` 最顶部添加 `import 'react-native-gesture-handler'`（React Navigation 官方要求）。

**Rationale:** 避免手势相关 runtime 警告；Brownfield 与 standalone 共用入口。

### 4. Navigator 结构替换自研栈

**Decision:** 重写 `OrderNavigator.tsx`：

```tsx
<NavigationContainer independent>
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="OrderList" component={OrderListScreen} />
    <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
  </Stack.Navigator>
</NavigationContainer>
```

子 screen 使用 `useNavigation<NativeStackNavigationProp<OrderStackParamList>>()` 替代 `useOrderNavigation()`。

**Rationale:** 标准 API；类型安全路由参数；删除自研状态机与动画代码。

**Screen 参数传递:** `OrderDetail` / `OrderTracking` 通过 `route.params.orderId` 读取；列表页 `navigation.navigate('OrderDetail', { orderId })`。

### 5. 保留 Hero 仅在列表页

**Decision:** 维持当前 UX：`RemoteHero` 仅在 `OrderListScreen`；详情/追踪用 `OrderPageShell` 全页布局。不回到 wrapper 层统一 Hero。

**Rationale:** 与用户已验证的整页路由 UX 一致；减少 wrapper 差异。

### 6. OTA split filter 扩展

**Decision:** 在 `build-bundles.js` 的 `isFeatureOwnedBySplit()` 增加：

- `/node_modules/@react-navigation/`
- `/node_modules/react-native-screens/`

（`react-native-gesture-handler` 若被 order 图引用且不在 main graph，同样纳入；实现时以 `verify:ota-scope` + bundle 体积/模块 grep 为准。）

**Rationale:** 此前 OTA 5KB 缺模块问题的根因；navigation 必须打进 `ota_order`。

### 7. 删除文件清单

**Remove:**

- `OrderPageStack.tsx`
- `OrderNavigationContext.tsx`

**Keep / adapt:**

- `types.ts` — `OrderStackParamList` 供 React Navigation 泛型
- `OrderFeatureContext.tsx` — Hero 配置
- `components/OrderBackRow.tsx`、`OrderPageShell.tsx`
- 三个 screen 文件 — 改 navigation hook

### 8. `NavigationContainer independent`

**Decision:** 使用 `independent` 嵌套容器（order 功能嵌在 FeatureHost / 原生栈内，非 App 根导航）。

**Rationale:** 避免与潜在外层 NavigationContainer 冲突；Remote 功能自包含。

## Risks / Trade-offs

- **[Risk] Brownfield 重建耗时、CI/同事环境差异** → 文档化 Debug simulator 命令；tasks 含验证步骤
- **[Risk] OTA bundle 体积显著增加** → 可接受；navigation 仅 order split 引用
- **[Risk] `react-native-screens` 与 RN 0.86 brownfield 版本兼容** → 选用与 RN 0.86 兼容的 navigation/screens 版本；pod install 失败时 pin 版本
- **[Risk] 原生返回仍退出整个 order** → 保持 v1 行为；UI 文案保留「子页请用 ← 返回」
- **[Risk] 迁移期间 Metro 短暂不可用** → 先合 native 依赖分支，再合 JS 切换，或 feature flag（非必须）

## Migration Plan

1. `npm install` navigation 依赖 + `pod install`
2. `brownfield:package:ios:debug:sim` 重建 BrownfieldLib
3. 重写 `OrderNavigator` 与 screen navigation hooks
4. 删除自研栈文件
5. Metro 冒烟：列表 → 详情 → 追踪 → 返回 ×2
6. `build:bundles` → 确认 `ota_order` 含 navigation 模块 → upload → OTA 冒烟
7. 更新 README / SOP

**Rollback:** 恢复自研 `OrderPageStack` 提交；卸载 navigation 依赖；Brownfield 重建不含 screens/gesture-handler（若原生已发布需同步回滚 lib）。

## Open Questions

- Android Brownfield 是否同步链接 screens/gesture-handler？（建议 iOS-first，Android 单独 follow-up）
- navigation 依赖是否 pin 到具体 minor 版本写入 lockfile？（建议 yes，避免 CI 漂移）
