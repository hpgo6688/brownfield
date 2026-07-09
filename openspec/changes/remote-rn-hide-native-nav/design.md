## Context

当前架构：

```
Native Shell (NavigationStack)
  └─ push → RemoteReactNativeScreenView
              ├─ SwiftUI navigationTitle + toolbar（原生栏可见）
              └─ FeatureHost → OrderNavigator (React Navigation, headerShown: false)
                    ├─ OrderList
                    ├─ OrderDetail  ← OrderBackRow
                    └─ OrderTracking
```

- 原生栏：功能级标题（「订单」）+ 系统返回 → **直接 dismiss 整个 Remote 功能**
- RN 栏：应用内「← 返回」→ pop RN 栈一级
- 用户反馈：双导航 chrome 同屏很奇怪；希望 Remote 多级页 **不显示原生导航栏**，且 RN 能 **正常退回原生页面**

`ReactNativeScreenView.swift` 已有 `.onReceive(.popToNative) { dismiss() }` 骨架，但 `Notification.Name.popToNative` 未完整定义，RN 侧尚无调用入口。

## Goals / Non-Goals

**Goals:**

- Remote RN 功能全屏展示，**隐藏** SwiftUI 原生 navigation bar
- RN 功能内：React Navigation 负责多级 push/pop
- RN 栈 **根路由**：用户可退出到 Native Shell 菜单（显式按钮 + 尽量保留 iOS 边缘 swipe back）
- RN 栈 **子路由**：仅 pop RN 栈，不退出 Remote 功能
- Metro / OTA 双路径行为一致
- Scheme 1 本地 RN 保持现有原生栏（非本变更范围）

**Non-Goals:**

- 原生栏随 RN 栈深度动态显隐
- 改造 promo 以外的 Remote 功能内部导航结构（promo 仅受益于隐藏原生栏 + 根页退出）
- TurboModule Codegen 大改（优先复用 Notification / 现有 Brownfield 消息通道）

## Decisions

### 1. 仅 Remote 入口隐藏原生栏

**Decision:** 在 `RemoteReactNativeScreenView` / `ReactNativeScreenContainer` 增加 Remote 专用配置 `hidesNativeNavigationBar: true`；`LocalReactNativeScreenView` 保持 `false`。

**Implementation sketch:**

```swift
.toolbar(hidesNativeNavigationBar ? .hidden : .visible, for: .navigationBar)
```

**Rationale:** 用户痛点集中在 Remote 多级业务；Scheme 1 单页 RN 仍适合原生栏。

### 2. RN 根页提供「退出到原生」

**Decision:** 在 Remote 根 screen（`OrderListScreen`；promo 的 `PromoScreen` 可选同模式）增加 **退出原生** 控件（如 top-left「← 菜单」），调用 JS API `popToNative()`。

**Alternative considered:** 仅依赖 iOS 边缘 swipe back — 作为 **补充**，不作为唯一路径（可发现性差）。

### 3. RN → Native dismiss 桥接

**Decision:** v1 使用 **轻量 Native Module**（或 Brownfield 已有扩展点）从 JS 调用 Swift `NotificationCenter.default.post(name: .popToNative)`，由现有 `ReactNativeScreenContainer` 的 `dismiss()` 处理。

**JS API:**

```ts
// rn_app/src/features/nativeShell.ts
export function popToNative(): void { NativeShellNavigation?.popToNative?.(); }
```

**Swift:** 定义 `extension Notification.Name { static let popToNative = ... }`；模块实现 `popToNative()` 发通知。

**Alternative considered:** TurboModule Codegen 新 spec — 更规范但更重；可 follow-up 与 SplitBundleLoader 对齐。

### 4. React Navigation 行为不变

**Decision:** 保持 `headerShown: false`；不在 RN 层启用 stack header 替代原生栏。子页继续 `OrderBackRow` + `navigation.goBack()`。

**Rationale:** 隐藏原生栏后，RN 应用内返回行即为唯一功能内 chrome，避免第三套 header。

### 5. Safe Area 与 DevOta 工具栏

**Decision:**

- `RemoteScreenShell` 继续用 `SafeAreaProvider` / `SafeAreaView` 处理 top inset（无原生栏时 status bar 区域由 RN 负责）
- DEBUG Metro/OTA 切换 **仅** 在 Native Shell 根列表 toolbar（已有），Remote 页内不再依赖原生栏右上角

### 6. 边缘 swipe back（NavigationStack）

**Decision:** 隐藏 navigation bar 后，尽量 **不禁用** NavigationStack 的 interactive pop；若 SwiftUI 默认手势失效，评估 `.navigationBarBackButtonHidden(true)` 配合自定义 dismiss 或启用 `UINavigationController` 交互返回。

**Risk mitigation:** 根页显式「退出原生」按钮作为可靠兜底。

## Risks / Trade-offs

- **[Risk] 隐藏原生栏后用户找不到返回** → 根页强制提供「退出原生」；文档说明；保留 swipe back 若可用
- **[Risk] Safe Area 双包或顶栏被刘海遮挡** → Remote 根/子页统一走 `RemoteScreenShell` + 测试模拟器
- **[Risk] popToNative 与 RN goBack 混淆** → 根页才显示退出原生；子页仅 OrderBackRow
- **[Risk] BrownfieldLib 需重打若新增 Native Module** → 任务含 debug:sim 重建说明

## Migration Plan

1. Swift：Remote 隐藏原生栏 + 定义 `popToNative` + Native Module
2. RN：`nativeShell.popToNative()` + OrderList 根页退出控件
3. 文档更新（README / remote README）
4. 模拟器冒烟：菜单 → 订单 → 详情 → RN 返回 → 列表 → 退出原生 → 菜单
5. OTA 模式重复冒烟

**Rollback:** 恢复 `RemoteReactNativeScreenView` 显示原生栏；移除 RN 退出按钮与 bridge。

## Open Questions

- promo 根页是否也需要「退出原生」按钮，还是仅 order？（建议 **所有 Remote 根页统一**）
- v2 是否用 TurboModule Codegen 正式化 `NativeShellNavigation`？
