## Why

Remote **order** 入口目前只有单层列表页（`OrderScreen` + `OrderList`），无法演示真实业务里常见的 **列表 → 详情 → 子页** 多级跳转。原生壳用 `NavigationStack` 只负责从菜单 push 进 Remote 功能；**功能内部的页面栈应由 RN 自己管理**，且须同时兼容 Metro 开发路径与 OTA split bundle 路径。

## What Changes

- 在 order Remote 功能内引入 **RN 栈式导航**（`@react-navigation/native` + `native-stack`），以 `OrderNavigator` 为根
- 新增多级页面：`OrderList`（列表）→ `OrderDetailScreen`（详情）→ `OrderTrackingScreen`（物流/追踪，演示第三级）
- 列表项可点击，携带 `orderId` 等参数进入详情；详情可继续下钻
- 子页面提供 **应用内返回** 控件；根页保持与现有原生导航栏「订单」标题一致
- 导航与页面源码放在 **共享区**（`screens/remote/order/`），Metro `OrderScreen` 与 `bundles/ota_order/screens/OrderScreen` 均挂载同一 navigator（仅保留模式 badge 差异）
- 更新 `OrderList` 共享组件：支持 `onPressOrder` 回调，默认保持只读展示
- 增加依赖：`@react-navigation/native`、`@react-navigation/native-stack`、`react-native-screens`（navigation 对等依赖）
- 文档补充：order 多级导航在 Metro / OTA 下的开发与验证步骤

## Capabilities

### New Capabilities

- `order-rn-stack-navigation`: order Remote 功能内的 RN 栈导航、多级页面路由、双路径（Metro + OTA）挂载与参数传递

### Modified Capabilities

- _(none — no archived specs in `openspec/specs/` yet)_

## Impact

- **rn_app**: `screens/remote/order/`（navigator + screens）、`screens/remote/components/OrderList.tsx`、`screens/remote/OrderScreen.tsx`、`bundles/ota_order/screens/OrderScreen.tsx`、`package.json` / `Podfile`（新 navigation 依赖）
- **ios_native**: 可选后续增强原生返回键与 RN 栈协同（本变更 v1 以应用内返回为主，不强制改 Swift）
- **Docs**: `screens/remote/README.md`、`docs/dynamic-multi-bundle.md` 增加 order 多级页说明
- **OTA**: 新页面打进 `ota_order` split bundle，需 `build:bundles` + upload 后 OTA 模式可见

## Non-Goals

- promo 或其他 Remote 功能的多级导航（可后续复用模式）
- 改造 Scheme 1 核心页导航
- 每个子页面独立 `moduleName` / 独立 split bundle
- 完整原生系统返回键与 RN 栈双向同步（可作为 follow-up）
