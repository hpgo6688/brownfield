# OTA 立即更新后 unknown module 517556614

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: OTA shared split · 立即更新 · order/promo navigation

## 问题描述

- **现象**：点击 Banner「立即更新」（0.0.8 → 0.0.9）后白屏/报错  
  `Requiring unknown module "517556614"`、`remoteStackScreenOptions of undefined`
- **触发条件**：DEV OTA 模式，`DevSettings.reload()` 后加载新 shared + feature segment
- **影响范围**：所有使用 `remoteStackScreenOptions` / `RemoteRootHeaderBack` 的 Remote feature

## 根因分析

`build-bundles.js` 将 `screens/remote/navigation/*` 标为 **shared-owned**，feature split 会排除这些模块，仅通过 numeric module id 引用。

但 `bundles/ota_shared/index.js` 未 import `remoteStackScreenOptions` 等 navigation 工具，导致：

1. shared segment **未定义** module `517556614`
2. split-audit 将其标为 **main-only** 外部依赖
3. 首次从 Metro 进入 OTA（`afterMetro=true`）时，Metro 主包碰巧已注册该模块 → 看似正常
4. 「立即更新」全量 reload 后主包不再提供该 id → **unknown module**

## 解决方案

1. 在 `ota_shared/index.js` 预热 `remoteStackScreenOptions`、`RemoteRootHeaderBack`
2. `isSharedOwnedBySplit` 增加 `react-native-safe-area-context`（`RemoteScreenShell` 依赖）
3. `applyUpdate` 在 `DevSettings.reload()` 前先 `ensureSharedBundleCached`，并清除 shared session 标记

**关键变更**：

- `rn_app/bundles/ota_shared/index.js` — warm navigation 模块
- `rn_app/scripts/build-bundles.js` — safe-area-context 归属 shared
- `rn_app/src/features/otaUpdatePoller.ts` — reload 前预缓存 shared

## 验证方式

- [x] `build:bundles` split-audit：module `517556614` 在 shared 中定义，order 通过 shared 引用
- [ ] 发布 **0.0.10** 后：order 0.0.8 → 立即更新 → 0.0.10 正常渲染
- [ ] 冷启动 OTA order（无 Metro 预热）正常

## 后续建议

- split-audit 对 feature bundle 的 main-only 依赖 > 0 时在 release 构建 fail
- 0.0.9–0.0.11 shared/order 对 `remoteStackScreenOptions`（517556614）有缺陷；0.0.10–0.0.11 仍缺 `components`（103560400）→ 请使用 **0.0.12+**

### 补充（0.0.12）

- **103560400** = `screens/remote/components`（`RemoteHero` / `OrderList` / `PromoList`）
- 同上：shared-owned 但未 warm → 立即更新 reload 后 unknown module
- 修复：`ota_shared/index.js` import components；DEV 下 `otaSplitHostPreload` 预加载 components
