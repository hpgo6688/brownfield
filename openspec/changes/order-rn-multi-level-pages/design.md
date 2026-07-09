## Context

Remote **order** 由 `FeatureHost` 加载，根组件为 `OrderScreen`（Metro：`screens/remote/`，OTA：`bundles/ota_order/screens/`）。当前为单层布局：`RemoteScreenShell` + `RemoteHero` + 静态 `OrderList`。

原生壳（`ReactNativeScreenView.swift`）用 SwiftUI `NavigationStack` 提供 **功能级** 导航栏（标题「订单」、返回回到菜单）。项目 **未安装** React Navigation；README 明确要求 Remote 页保留系统导航栏，避免自定义顶栏盖住原生返回。

双路径约束（`ota-screens-build-scope-guard` 已落地）：

| 路径 | 编辑位置 | 生效方式 |
|------|----------|----------|
| Metro dev | `screens/remote/` | HMR |
| OTA upload | `bundles/ota_<id>/screens/` | `build:bundles` + upload |

多级页面逻辑必须放在 **共享区**，Metro / OTA wrapper 只做模式标识（badge / subtitle）。

## Goals / Non-Goals

**Goals:**

- order 内实现 3 级演示流：**列表 → 详情 → 物流追踪**
- 列表项点击带 `orderId` 跳转；子页可返回上一级
- Metro 与 OTA 渲染同一套 navigator 与路由表
- 不破坏现有 `FeatureHost`、manifest、split load 流程
- 共享 `OrderList` 组件，OTA scope 护栏（不 import `bundles/ota_*` 到 runtime）保持有效

**Non-Goals:**

- 原生系统返回键与 RN 栈深度联动（v1 用应用内返回；follow-up 可做 TurboModule）
- promo 多级导航
- 服务端 manifest 按子路由拆 bundle
- React Navigation 深链接 / URL routing

## Decisions

### 1. 使用 React Navigation Native Stack

**Decision:** 添加 `@react-navigation/native`、`@react-navigation/native-stack`、`react-native-screens`（及 peer `react-native-gesture-handler` 若 navigation 要求）。

**Rationale:** 社区标准栈导航；与 RN 0.86 brownfield 兼容；便于后续扩展 tab/modal。

**Alternative considered:** 手写 `useState` 屏幕栈 — 拒绝；难维护、无标准转场与类型安全路由参数。

### 2. 目录：`screens/remote/order/`

```
screens/remote/order/
├── OrderNavigator.tsx      # NavigationContainer + NativeStack
├── types.ts                # OrderStackParamList
├── screens/
│   ├── OrderListScreen.tsx
│   ├── OrderDetailScreen.tsx
│   └── OrderTrackingScreen.tsx
└── index.ts
```

**Decision:** 业务路由与屏幕放在 `screens/remote/order/`，属于共享 dev 区；OTA split filter 通过 import 图自动收录进 `ota_order` bundle。

Metro `OrderScreen.tsx` / OTA `OrderScreen.tsx` 瘦身为：

```tsx
<RemoteScreenShell>
  <RemoteHero ... />
  <OrderNavigator />
</RemoteScreenShell>
```

**Rationale:** 符合 colocation + shared components 模式；避免在 `bundles/ota_order/` 重复导航逻辑。

### 3. `headerShown: false` — 保留原生导航栏

**Decision:** Native Stack 全部 `headerShown: false`。子页面在内容区顶部渲染 **轻量返回行**（`← 返回` + 子页标题），不叠加第二套系统级导航栏。

**Rationale:** README 要求使用原生 `NavigationStack` 导航栏；RN stack header 会与 SwiftUI 标题重复。根列表页标题继续由原生栏显示「订单」。

**Alternative considered:** RN stack 自带 header 替换原生栏 — 拒绝；需改 Swift `navigationBarHidden`，与现有 Remote / Scheme 1 约定冲突。

### 4. 路由与演示数据

**Decision:** 定义 `OrderStackParamList`：

| Route | Params | 说明 |
|-------|--------|------|
| `OrderList` | `undefined` | 初始路由 |
| `OrderDetail` | `{ orderId: string }` | 订单详情 |
| `OrderTracking` | `{ orderId: string }` | 物流追踪 |

演示数据复用 `OrderList` 内 `ORDERS` 常量（导出为 `ORDER_FIXTURES` 或 `getOrderById`），详情/追踪页按 `orderId` 查表渲染。

### 5. `OrderList` 组件扩展

**Decision:** `OrderList` 增加可选 `onPressOrder?: (order: OrderItem) => void`。有回调时列表行包 `Pressable`；无回调时保持现有只读样式（promo 等不受影响）。

**Rationale:** 共享组件单一职责；导航由 `OrderListScreen` 注入 `navigation.navigate('OrderDetail', { orderId })`。

### 6. 注册与 bundle 边界

**Decision:** 不新增 `AppRegistry` moduleName。`FeatureHost` 仍加载 `OrderScreen` / `ota_OrderScreen`；navigator 作为其子树挂载。

**Rationale:** manifest `featureId: order` 不变；OTA 无需新 manifest 条目；split bundle 入口 `bundles/ota_order/index.js` 无需改注册名。

**Build:** `OrderNavigator` 及其 screens 被 `bundles/ota_order/screens/OrderScreen.tsx` import 后，由 `build-bundles.js` 图遍历打进 `ota_order.*.ios.jsbundle`。实现后跑 `verify:ota-scope` 确认 main graph 不直接 import OTA 目录。

### 7. 原生返回键（v1 行为）

**Decision:** v1 **不**改 `ReactNativeScreenView.swift`。用户在子页点原生左上角返回 → 直接退出整个 order 功能（与 today 一致）。子页 **必须** 提供应用内返回以 pop RN 栈。

**Rationale:** 原生返回委托需 Swift ↔ RN 事件桥，超出本变更最小可用范围。

**Follow-up:** TurboModule `canPopOrderStack` / `popOrderStack` + Swift `toolbar` 自定义返回。

## Risks / Trade-offs

- **[Risk] 原生返回与子页预期不一致** → 文档与 UI 明确「子页请用页内返回」；follow-up 做原生协同
- **[Risk] navigation 依赖增大 OTA bundle** → 仅 order 引入；接受体积略增；不在主 bundle 全局注册 navigator
- **[Risk] `react-native-screens` 需 pod install** → 任务含 `pod install` + BrownfieldLib 重建说明
- **[Risk] Metro blockList 误拦 `screens/remote/order/`** → 确认 blockList 仅 `bundles/ota_*`；跑 HMR 冒烟
- **[Risk] SafeArea 双重包裹** → `RemoteScreenShell` 保留；navigator screens 不再套 `SafeAreaProvider`

## Migration Plan

1. 安装 navigation 依赖，`pod install`
2. 实现 `screens/remote/order/*` 与 `OrderList` 扩展
3. 瘦身 Metro / OTA `OrderScreen` wrapper
4. Metro 模式冒烟：列表 → 详情 → 追踪 → 应用内返回
5. `npm run build:bundles` → upload `ota_order` → OTA 模式重复冒烟
6. 更新 README / dynamic-multi-bundle 文档

**Rollback:** 移除 navigation 依赖与 `order/` 目录，恢复扁平 `OrderScreen`；manifest 无需变更。

## Open Questions

- 是否在 v1 同步把 **原生返回键 pop RN 栈** 一并做了？（建议 follow-up，不阻塞多级页 demo）
- 详情页是否需要 **操作按钮**（取消订单等）作为第四级演示？（建议 v1 仅三页）
