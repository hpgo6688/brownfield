# 故事 5：构建、UI 与工程杂项

> 不属于 OTA 核心链路，但在集成 React Navigation、Brownfield 打包、Admin 工具时踩过的坑 — 面试可作为「工程完整度」补充。

---

## 1. BrownfieldLib 未更新 → RNGestureHandlerModule 找不到

### 现象

Metro 进订单页：`TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found`

### 根因

JS 已集成 `react-native-gesture-handler` + `@react-navigation/native-stack`，但 `ios_native` SPM 引用的 `BrownfieldLib.xcframework` 仍是旧产物（无 RNGH / RNSScreen 符号）。

`brownfield:package:ios:debug:sim` 编译成功，但 CLI 合并 xcframework 失败（缺 iphoneos 切片）→ **SPM 目录未自动刷新**。

### 解决

1. `pod install` → `npm run brownfield:package:ios:debug:sim`
2. 手动同步 simulator framework 到 SPM artifacts
3. Xcode Clean Build Folder + Reset Package Caches

### 面试一句

新增 RN 原生依赖后，Brownfield 流程必须是 **pod install → brownfield package → 刷新 xcframework → Clean Build**，不能只改 JS。

→ [2026-07-09-brownfield-gesture-handler-module-missing.md](../2026-07-09-brownfield-gesture-handler-module-missing.md)

---

## 2. 订单页只显示淡黄色 Hero

### 现象

Order 页只见 RemoteHero 背景，无标题、无列表。

### 根因

`OrderPageStack` 首屏子节点用 `StyleSheet.absoluteFillObject` — 绝对定位不参与 flex；栈内仅有绝对定位子节点时父容器高度塌缩为 0，列表被 `overflow: hidden` 裁切。

### 解决

- 顶层当前页改 `flex: 1`；仅 push underlay 保留 absoluteFill
- 列表改 `ScrollView`
- Hero 标题显式深色（深色模式可见）

→ [2026-07-09-order-page-stack-zero-height.md](../2026-07-09-order-page-stack-zero-height.md)

---

## 3. bundle-server 数据库双路径

### 现象

仓库同时存在 `brownfield/data/bundle-server.db` 与 `bundle-server/data/bundle-server.db`；seed 后 Admin 读不到数据。

### 根因

Prisma CLI 与 runtime 对 `DATABASE_URL` 相对路径解析不一致（`../data/` vs `data/`）。

### 解决

统一到 `bundle-server/data/bundle-server.db`；`db-url.ts` + seed 共用 `getDatabaseUrl()`。

→ [2026-07-08-bundle-server-db-path-duplication.md](../2026-07-08-bundle-server-db-path-duplication.md)

---

## 面试怎么用

这三条适合放在 STAR 的 **Action** 末尾作「周边工程保障」：

- 原生模块与 JS 依赖版本对齐（Brownfield xcframework）
- Remote UI 在 Metro / OTA 双路径下布局一致
- 发版基础设施（bundle-server DB）路径单一可信

不必展开细节，体现 **全栈 ownership** 即可。
