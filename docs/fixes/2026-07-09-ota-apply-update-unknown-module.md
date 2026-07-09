# OTA shared split unknown module（立即更新）

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: OTA shared split · 立即更新 · navigation · components

## 问题描述

- **现象**：OTA 加载/「立即更新」后报错  
  - `unknown module "517556614"` → `remoteStackScreenOptions of undefined`  
  - `unknown module "103560400"` → `OrderListScreen` 渲染失败
- **触发条件**：DEV OTA + `DevSettings.reload()`；或冷启动 OTA（无 Metro 预热）
- **影响范围**：order / promo Remote 页面

## 根因分析

`build-bundles.js` 将 `screens/remote/navigation/*` 与 `screens/remote/components/*` 标为 **shared-owned**，feature split 排除这些模块，仅通过 numeric module id 引用。

但 `bundles/ota_shared/index.js` 未 import 对应模块 → shared segment 未定义这些 id → split-audit 标为 **main-only**。Metro 首次进入可能碰巧由主包注册；全量 reload 后 id 消失。

| Module id | 模块 |
|-----------|------|
| `517556614` | `remoteStackScreenOptions` / navigation |
| `103560400` | `screens/remote/components` |

## 解决方案

1. **`ota_shared/index.js`** — warm navigation + components（`RemoteHero`、`OrderList`、`PromoList`）
2. **`build-bundles.js`** — `react-native-safe-area-context` 归入 shared
3. **`otaUpdatePoller.ts`** — reload 前 `ensureSharedBundleCached` + 清 shared session
4. **`otaSplitHostPreload.ts`** — DEV 预加载 `screens/remote/components`

**关键变更**：

- `rn_app/bundles/ota_shared/index.js`
- `rn_app/scripts/build-bundles.js`
- `rn_app/src/features/otaUpdatePoller.ts`
- `rn_app/src/features/otaSplitHostPreload.ts`

## 验证方式

- [x] split-audit：`517556614`、`103560400` 由 shared 定义，order 通过 shared 引用
- [x] 发布 **0.0.12+**（当前 active **0.0.13**）
- [ ] 用户确认：立即更新 + 冷启动 OTA 无 unknown module

## 后续建议

- release 构建：feature bundle 存在非 core 的 main-only 依赖时 fail
- 缺陷版本：**0.0.8–0.0.11**；修复版本：**0.0.12+**
