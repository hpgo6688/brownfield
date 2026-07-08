# OTA 模式加载不到 Remote 资源

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: FeatureHost、bundleLoader、bundleUpdater、splitBundleEntry

## 问题描述

- **现象**：切到 OTA 模式后一直「加载中」或报「bundle 已加载但组件未注册」，感觉加载不到 Remote 资源
- **触发条件**：Native shell OTA 切换、重复进入 Remote 页、本地有损坏的小体积缓存 bundle
- **影响范围**：order / promo Remote feature

## 根因分析

1. **useEffect 竞态**：`setForceOtaInDev()` 在依赖 `forceOtaInDev` 的 effect 内调用，导致 effect 重复执行、前一次 load 被 `cancelled`。
2. **Split 入口重跑失败**：单独 `global.__r(entryId)` 在 segment 上下文外无效，registerFeature 未执行。
3. **损坏缓存未淘汰**：764B 等小 bundle 仍被当作有效缓存（如 order.10.0.1），不会触发重新下载。

## 解决方案

- FeatureHost：移除 `forceOtaInDev` 依赖，用 `resolveUseOtaMode()` + `otaMode` 参数直传 loader；RNFS 不可用时给出明确错误。
- splitBundleEntry：优先 `globalEvalWithSourceUrl` 重 eval 整个 bundle。
- bundleCache：新增 `isCachedBundleUsable()`（体积 + registerFeature + __r 校验）。
- PromoScreen：检查更新成功后 OTA 模式自动 reload。

## 验证方式

- [ ] Native shell 切 OTA → 进入订单/活动正常显示
- [ ] 活动页「检查 Remote 更新」→ 重新下载后自动 reload
- [ ] 损坏小 bundle 被自动丢弃并重新拉取

## 后续建议

- 确认 bundle-server active release 为完整 bundle（order.10.0.5 ≈ 7KB+）
- 若仍失败，执行 `npm run brownfield:package:ios:debug:sim` 确保 RNFS 已链接
