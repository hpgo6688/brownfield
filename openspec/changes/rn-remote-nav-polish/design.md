## Context

当前 Remote 导航栈（以 order 为例）：

```
Native Shell
  └─ RemoteReactNativeScreenView（原生栏隐藏）
       └─ FeatureHost → OrderNavigator (native-stack, headerShown: false)
            ├─ OrderList      ← RemoteNativeExitRow + RemoteHero
            ├─ OrderDetail    ← OrderBackRow
            └─ OrderTracking  ← OrderBackRow
```

已归档能力：

- `remote-rn-native-chrome` — 隐藏原生栏、根页 `popToNative()`、RN 内栈归 RN 管
- `order-react-navigation`（进行中）— React Navigation native-stack 三级路由

**痛点**：两套返回 UI、手势未调优、用户从子页使用系统边缘返回时行为与「← 返回」不一致。

## Goals / Non-Goals

**Goals:**

- 单一 `RemoteNavHeader` 覆盖根/子页导航 chrome
- native-stack 开启 iOS 全屏侧滑返回，与按钮返回等效
- 明确返回语义：子页 → pop RN；根页 → `popToNative()`
- order + promo 根页视觉与交互一致
- 为原生边缘返回 ↔ RN 栈协同预留桥接（v1 至少 JS 按钮 + 手势；native 委托可作为增强）

**Non-Goals:**

- 自定义 React Navigation header（仍 `headerShown: false`）
- 重做 order 路由或 OTA 拆分
- 复杂 deep linking

## Decisions

### 1. 统一 `RemoteNavHeader`

**Decision:** 新建 `RemoteNavHeader`，props：

| Prop | 根页 | 子页 |
|------|------|------|
| `mode` | `'root'` | `'stack'` |
| `title` | 功能名（订单） | 页面名（订单详情） |
| `onBack` | `popToNative` | `navigation.goBack()` |

布局：单行顶栏 — 左返回文案 + 居中/左下标题（与 iOS 内页习惯接近），统一样式 token（颜色、字号、hitSlop）。

**Rationale:** 消除 `RemoteNativeExitRow` / `OrderBackRow` 重复；后续 promo / 新 Remote 功能复用。

**Migration:** `OrderListScreen` 用 `mode="root"`；`OrderDetailScreen` / `OrderTrackingScreen` 用 `mode="stack"`；删除或 deprecate 旧组件。

### 2. native-stack 手势与动画

**Decision:** `OrderNavigator`（及未来 Remote navigator）统一：

```tsx
screenOptions={{
  headerShown: false,
  animation: 'slide_from_right',
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
}}
```

**Rationale:** 利用 `react-native-screens` 原生手势，接近系统 App 体验。

### 3. 根页 header 与 Hero 关系

**Decision:** 根页 layout：`RemoteNavHeader` → `RemoteHero` → 内容。Hero 保留模式 badge，标题以 header 为主（Hero 内 title 可保留或简化为 subtitle-only — 实现时避免双大标题）。

**Rationale:** 顶栏负责导航，Hero 负责模式标识。

### 4. nativeShell 返回协同（v1 分级）

**Decision:**

- **v1（本变更）**: 按钮 + RN 全屏手势；`popToNative()` 仅在根页 header 触发
- **v1.1（可选任务）**: 扩展 `NativeShellNavigation`：
  - `getRNNavigationState(): { canGoBack: boolean }` 或由 RN 注册 listener
  - Swift interactive pop / 硬件返回前先问 RN 能否 goBack

**Rationale:** 最小可用先统一 UI + RN 手势；native 协同可分 task 不阻塞。

**Alternative considered:** 仅文档要求用户只用按钮 — 体验差，拒绝。

### 5. Hook：`useRemoteNavBack`

**Decision:** 提供 hook 封装返回逻辑：

```ts
function useRemoteNavBack(isRoot: boolean) {
  const navigation = useNavigation();
  return useCallback(() => {
    if (isRoot) popToNative();
    else navigation.goBack();
  }, [isRoot, navigation]);
}
```

根页通过 route name（`OrderList`）或 `navigation.canGoBack()` 判断。

### 6. promo 与其他 Remote 根页

**Decision:** promo 单页同样使用 `RemoteNavHeader mode="root"`，移除独立 `RemoteNativeExitRow`。

## Risks / Trade-offs

- **[Risk] 双标题（header + Hero title）** → Hero 仅保留 badge/subtitle，title 移到 header
- **[Risk] fullScreenGestureEnabled 与 ScrollView 冲突** → 列表页测横向冲突；必要时根列表 `gestureEnabled: false` 仅子页开启
- **[Risk] native 边缘 pop 仍直接 dismiss Remote** → v1.1 桥接；文档说明直至修复

## Migration Plan

1. 实现 `RemoteNavHeader` + `useRemoteNavBack`
2. 迁移 order screens + promo
3. 更新 `OrderNavigator` screenOptions
4.  deprecate `OrderBackRow` / `RemoteNativeExitRow`（或 thin wrapper）
5. 文档 + 模拟器冒烟
6. OTA rebuild 若仅 JS 变更则无需 Brownfield；若扩展 native 模块则重建

## Open Questions

- 根列表页是否禁用 fullScreenGestureEnabled（避免与 ScrollView 抢手势）？
- v1 是否必须做 Swift 边缘返回委托，还是 v1.1？
