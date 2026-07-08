# OTA 远程 bundle 删除后误导性报错与闪退

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app OTA 客户端、ios_native SwiftUI 壳

## 问题描述

- **现象**：服务端 bundle 被误删（或残留无效缓存，如 smoke 测试的 9.9.9）时，进入 OTA Remote 页显示「OTA bundle loaded but ota_* component was not registered」，有时触发 LogBox 后原生闪退（`AppDelegate window` unrecognized selector）
- **触发条件**：manifest 仍有 release 记录但 `data/bundles/` 文件缺失/无效；或沙盒缓存了非真实 OTA split bundle
- **影响范围**：OTA 模式 Remote 页（order/promo）

## 根因分析

1. 下载后未校验 bundle 内容，46 字节的占位文件也能写入沙盒并被当作可用缓存
2. `isCachedBundleUsable` 只检查 `registerFeature` + `__r()`，无法识别非 OTA split bundle
3. 加载失败时 `runFullBundleEval` 触发 RN LogBox，SwiftUI `@main App` 无 `window` 属性导致 LogBox 析构崩溃
4. 错误文案指向「 reinstall app」，未说明远程 bundle 缺失

## 解决方案

1. 加强 OTA bundle 校验（体积、`ota_*`、`AppRegistry`、featureId）
2. 下载/加载前清理无效缓存；注册失败时清除坏缓存并返回友好错误
3. 移除 `runFullBundleEval` 回退，避免无效 bundle 触发 LogBox
4. SwiftUI 壳添加 `@UIApplicationDelegateAdaptor` 提供 `window`
5. 统一用户可见文案：`远程 bundle 不可用（服务端 ota_* 可能已删除或未 upload）`

**关键变更**：
- `rn_app/src/features/bundleCache.ts` — `validateOtaBundleContent`、`clearUnusableActiveMetadata`
- `rn_app/src/features/bundleUpdater.ts` — 下载校验、`formatRemoteBundleError`
- `rn_app/src/features/bundleLoader.ts` — 加载前校验、失败清缓存
- `rn_app/src/features/splitBundleEntry.ts` — 移除 full eval
- `rn_app/src/features/FeatureHost.tsx` — 友好错误 UI
- `ios_native/ios_native/ios_nativeApp.swift` — AppDelegate adaptor

## 验证方式

- [ ] 删除服务端 `data/bundles/*` 后进入 OTA Order → 显示「远程 bundle 不可用…」，应用不闪退
- [ ] 重新 `upload ota_order.*` 后 OTA 页正常加载
- [ ] 沙盒有旧无效缓存时首次进入自动清理并提示，而非「not registered」

## 后续建议

- 服务端 manifest 在 bundle 文件缺失时返回 `hash: sha256:unset` 或 503（可选增强）
