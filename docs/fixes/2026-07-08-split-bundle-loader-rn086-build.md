# SplitBundleLoader 在 RN 0.86 下编译失败

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app iOS BrownfieldLib / SplitBundleLoader

## 问题描述

- **现象**：执行 `brownfield package:ios` 时编译失败，报错 `no visible @interface for 'RCTCxxBridge' declares the selector 'executeApplicationScript:url:async:'`
- **触发条件**：RN 0.86 + New Architecture + `RCT_REMOVE_LEGACY_ARCH=1` 下打包 BrownfieldLib
- **影响范围**：无法重打 iOS BrownfieldLib，Release OTA split bundle 加载受阻

## 根因分析

RN 0.86 在启用 `RCT_REMOVE_LEGACY_ARCH=1` 后，Legacy Bridge 的 `RCTCxxBridge.executeApplicationScript:url:async:` 从头文件与实现中移除。项目实际运行时使用 Bridgeless 模式（`RCTBridgeProxy` + `RCTHost`），原 `SplitBundleLoader` 仍调用已废弃的 Legacy API，导致编译失败。

## 解决方案

改为 Bridgeless 路径：通过 `RCTBridgeProxy` 获取 `runtime` 与 `jsCallInvoker`，在 JS 线程用 `jsi::Runtime::evaluateJavaScript` 加载 split bundle。Legacy 路径保留在 `#ifndef RCT_REMOVE_LEGACY_ARCH` 分支中以便兼容。

**关键变更**：
- `rn_app/ios/BrownfieldLib/SplitBundleLoader.mm` — 适配 RN 0.86 Bridgeless API

## 验证方式

- [x] `npm run brownfield:package:ios:debug` 编译通过（BUILD SUCCEEDED）
- [ ] 真机/模拟器验证 Release OTA split bundle 动态加载

## 后续建议

- 在宿主 App 中验证 `SplitBundleLoader.load()` 端到端加载 remote bundle
- 关注 RN 后续版本是否提供官方 split bundle 公开 API，减少依赖 private 接口
