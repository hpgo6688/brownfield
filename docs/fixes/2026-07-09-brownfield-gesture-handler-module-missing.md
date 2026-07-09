# BrownfieldLib 未更新导致 RNGestureHandlerModule 找不到

**Date**: 2026-07-09
**Status**: Fixed
**Scope**: `ios_native` + BrownfieldLib SPM、`order` React Navigation 集成

## 问题描述

- **现象**：Metro 启动后进入订单页报错：`TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found`
- **触发条件**：JS 侧已安装并 import `react-native-gesture-handler` / `@react-navigation/native-stack`，但 `ios_native` 仍链接旧的 BrownfieldLib
- **影响范围**：Brownfield 壳内所有依赖 React Navigation native-stack 的 Remote 功能无法运行

## 根因分析

React Navigation 集成在 JS 层增加了 `react-native-gesture-handler` 与 `react-native-screens`，`index.js` 首行会立即加载 `RNGestureHandlerModule`。但 `ios_native` 通过 SPM 引用的 `BrownfieldLib.xcframework` 仍是 **7/8 旧产物**（无 `RNGestureHandler` / `RNSScreen` 符号），原生二进制未注册该 TurboModule。

`npm run brownfield:package:ios:debug:sim` 虽已成功编译含新模块的 `Debug-iphonesimulator/BrownfieldLib.framework`，但 brownfield CLI 在合并 xcframework 时失败（缺少 `Debug-iphoneos` 切片），**SPM 目录未自动刷新**，Xcode 继续链接旧库。

## 解决方案

1. 执行 `pod install` 后运行 `npm run brownfield:package:ios:debug:sim`，确认 simulator 产物含 navigation 原生模块
2. 将新 framework 同步到 SPM 本地包 simulator 切片：

```bash
SRC="rn_app/ios/.brownfield/build/Build/Products/Debug-iphonesimulator/BrownfieldLib.framework"
DST="rn_app/ios/.brownfield/package/build/spm-artifacts/BrownfieldLib.xcframework/ios-arm64_x86_64-simulator/BrownfieldLib.framework"
rm -rf "$DST" && cp -R "$SRC" "$DST"
```

3. Xcode：**Product → Clean Build Folder**，重新 Run `ios_native`（**无需**重新 Add Local SPM，路径不变）
4. 若仍缓存旧包：**File → Packages → Reset Package Caches**

**关键变更**：
- `rn_app/ios/.brownfield/package/build/spm-artifacts/BrownfieldLib.xcframework/ios-arm64_x86_64-simulator/` — 更新为含 `RNGestureHandlerModule`、`RNSScreen` 的 Debug simulator BrownfieldLib

## 验证方式

- [ ] `nm .../BrownfieldLib.framework/BrownfieldLib | rg RNGestureHandlerModule` 有输出
- [ ] Xcode Clean Build 后模拟器进入订单页，无 `RNGestureHandlerModule` 报错
- [ ] 列表 → 详情 → 物流，native-stack 转场正常

## 后续建议

- 新增/升级 RN 原生依赖后，流程固定为：`npm install` → `pod install` → `brownfield:package:ios:debug:sim` → 更新 SPM 产物 → Xcode Clean Build
- `brownfield:package:ios:debug`（含真机）当前可能因 hermes 路径指向旧目录失败；模拟器开发优先用 `debug:sim`
- 可考虑在 `docs/sop.md` 或 brownfield 脚本中自动化 simulator xcframework 同步步骤
