# 订单页只显示淡黄色 Hero 区块

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: `rn_app/screens/remote/order/OrderPageStack.tsx`

## 问题描述

- **现象**：进入订单页后只看到一块淡黄色区域（RemoteHero 背景），无标题文字、无订单列表
- **触发条件**：使用自定义 `OrderPageStack` 整页路由后，在 Metro 或 OTA 打开订单功能
- **影响范围**：订单列表页无法正常浏览与跳转

## 根因分析

`OrderPageStack` 的首屏子节点使用了 `StyleSheet.absoluteFillObject`。在 React Native 中，绝对定位元素不参与 flex 布局；当栈内**仅有**绝对定位子节点时，父级 `flex: 1` 容器可能无法获得有效高度（塌缩为 0）。Hero 按内容撑开可见，下方 `OrderList` 被 `overflow: hidden` 裁切不可见。

## 解决方案

- 顶层当前页改用 `flex: 1` 参与布局，仅底层（push 动画时的 underlay）保留 `absoluteFill`
- 列表页改用 `ScrollView`，避免内容被裁切
- `RemoteHero` 标题显式设置深色，避免深色模式下文字不可见

**关键变更**：
- `OrderPageStack.tsx` — `topPage: { flex: 1 }`，underlay 仍用 `absoluteFill`
- `OrderListScreen.tsx` — `ScrollView` + `contentContainerStyle`
- `RemoteHero.tsx` — `title` 增加 `color: '#0F172A'`

## 验证方式

- [ ] Metro 进入订单：Hero + 三条订单列表均可见
- [ ] 点击订单 → 整页滑入详情 → 返回正常
- [ ] OTA bundle 重建后同样验证
