# Brownfield 0-1 集成指南

项目结构：

- `rn_app/` — React Native 生产者（打包成 XCFramework）
- `ios_native/` — 原生 iOS 消费者（嵌入 RN 页面）

## 已完成

- [x] 安装 `@callstack/react-native-brownfield`
- [x] 添加 `BrownfieldLib` Framework target
- [x] 配置 `Podfile` / `brownfield.config.json`
- [x] 原生 App Swift 代码（`ReactNativeView` + 生命周期）
- [x] 原生多页面导航（RN 为独立子页面，非首页嵌入）
- [x] RN 页面系统导航栏（磨玻璃返回）
- [x] `Info.plist` StatusBar 配置

## 原生壳页面结构

`ios_native` 使用 **NavigationStack**：首页是原生菜单，RN 通过导航 push 进入。

| 页面 | 文件 | 说明 |
|------|------|------|
| 菜单入口 | `ContentView.swift` | 原生页面列表 + RN 入口 |
| 首页 | `HomeView.swift` | 纯原生 |
| 个人中心 | `ProfileView.swift` | 纯原生 |
| 设置 | `SettingsView.swift` | 纯原生 |
| React Native | `ReactNativeScreenView.swift` | `ReactNativeView(moduleName: "rn_app")` |

关键代码位置：

```
ios_native/
├── Info.plist                  # StatusBar 等 plist 配置
├── ios_native/
│   ├── ios_nativeApp.swift     # 初始化 ReactNativeBrownfield
│   ├── ContentView.swift       # NavigationStack 根菜单
│   ├── HomeView.swift
│   ├── ProfileView.swift
│   ├── SettingsView.swift
│   └── ReactNativeScreenView.swift
└── ios_native.xcodeproj
```

RN 页面使用 **系统 NavigationStack 导航栏**（磨玻璃 + 标准返回），不是自定义顶栏。从菜单点「React Native」进入，左上角返回回到原生菜单。

`ios_nativeApp.swift` 初始化要点：

```swift
ReactNativeBrownfield.shared.bundle = ReactNativeBundle
ReactNativeBrownfield.shared.preferEmbeddedBundleInDebug = false  // Debug 连 Metro
ReactNativeBrownfield.shared.startReactNative { ... }
```

## 原生配置（Info.plist）

RN 的 `StatusBar` 模块要求宿主 App 设置：

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

已写在 `ios_native/Info.plist`，并在 Xcode Build Settings 中设置 `INFOPLIST_FILE = Info.plist`（与 `GENERATE_INFOPLIST_FILE` 合并生成）。**不要**只用 `INFOPLIST_KEY_`，该 key 可能不会写入最终产物。

## 日常开发（原生壳 + Metro 热重载）

这就是你说的场景：**模拟器跑原生壳，RN 项目里 `npm start`，JS 渲染在壳子里并支持热重载**。

### 终端 1 — 启动 Metro

```bash
cd rn_app
npm start
```

### 终端 2 / Xcode — 跑原生壳（必须是 Debug）

1. 打开 `ios_native/ios_native.xcodeproj`
2. 确认 scheme 为 **Debug**（不是 Release）
3. Run 到模拟器

改 `rn_app` 里的 JS/TS 会走 Metro 热重载，**不用每次重编原生壳**。

> **热更新不生效？** 确认打的是 **Debug** 包（`brownfield:package:ios:debug`），不是 Release。Release 版 BrownfieldLib 编译时 `#if DEBUG` 为 false，会**始终加载内嵌 bundle**，Metro 连不上（终端会出现 `No apps connected`）。重新打 Debug 包后 Xcode **Clean Build Folder** 再 Run 即可，**无需重新链 SPM**。

### 首次 / 改了原生依赖时

需要重新打 **Debug** 包并刷新 SPM：

```bash
cd rn_app
npm run brownfield:package:ios:debug
```

然后在 Xcode 重新 Build 原生 App（链本地 SPM 那步若已做过，一般不用重复；**重新打包只更新同目录下的 XCFramework，路径不变**）。

### 发版 / 无 Metro 验证

```bash
cd rn_app
npm run brownfield:package:ios   # Release 包，内嵌 JS bundle
```

---

## 不要混淆两种运行方式

| 命令 | 跑的是什么 | 是不是 brownfield 壳 |
|------|-----------|---------------------|
| `ios_native` Xcode Run | 你的原生 App，内嵌 RN | ✅ 是 |
| `cd rn_app && npm run ios` | RN 独立 App | ❌ 不是壳 |

---

## 第一步：打包 RN（首次）

```bash
cd rn_app
npm install
cd ios && pod install && cd ..
npm run brownfield:package:ios
```

产物目录：

```
rn_app/ios/.brownfield/package/build/
```

## 第二步：在 Xcode 里链接 SPM 包（只需做一次）

1. 打开 `ios_native/ios_native.xcodeproj`
2. **File → Add Package Dependencies… → Add Local…**
3. 选择：`rn_app/ios/.brownfield/package/build`
4. 选中 target **ios_native**
5. **General → Frameworks, Libraries, and Embedded Content** 添加 **BrownfieldLib** 产品

## 第三步：运行

1. 在 Xcode 选择 scheme **ios_native**，配置 **Debug**，Run
2. 应看到 **Native Shell** 菜单（首页 / 个人中心 / 设置 / React Native）
3. 点 **React Native** 进入 RN 页面（moduleName: `rn_app`），系统导航栏返回回到菜单
4. 终端保持 `cd rn_app && npm start`，改 JS 可热重载

### Debug 说明

开发默认 **连 Metro**（`preferEmbeddedBundleInDebug = false`）。

若要在 Debug 下不启 Metro、只用内嵌 bundle，在 `ios_nativeApp.swift` 里改为 `true`。

### 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 改 JS 页面不更新 | 用了 Release 包 | `npm run brownfield:package:ios:debug`，Xcode Clean + Run |
| Metro 报 `No apps connected` | App 未连 Metro（内嵌 bundle） | 同上，确认 Debug 包 + Debug scheme |
| `RCTStatusBarManager` 崩溃 | 缺 Info.plist 配置 | 确认 `ios_native/Info.plist` 含 `UIViewControllerBasedStatusBarAppearance = false` |
| RN 页无返回 | 误用自定义顶栏或 `navigationBarHidden(true)` | 使用 `ReactNativeScreenView` 现有写法（系统 NavigationStack 导航栏） |

---

## 团队开发：壳打一次，同事只 `npm start`

你说的模式完全成立，也是 brownfield 团队里常见的做法：

| 角色 | 做什么 | 频率 |
|------|--------|------|
| **壳维护者**（1 人） | 打 Debug 原生壳 + Debug RN 原生包，发给团队 | 原生依赖变更 / 壳 UI 变更时 |
| **RN 同事** | 装壳 → `git clone rn_app` → `npm start` → 打开壳 | 日常写 JS |

大家共用**同一份 Debug 壳**，只连各自本机的 Metro，环境一致，同事**不用** Xcode、pod、brownfield 打包。

### 壳维护者：导出可分享的模拟器 App

```bash
# 需已在 Xcode 链好 SPM（见上文第二步）
chmod +x scripts/build-debug-shell.sh
./scripts/build-debug-shell.sh
```

产物：

```
dist/ios_native-debug-simulator.app
```

压缩后发给同事（内网盘 / CI artifact 均可）。

### 同事：安装 + 开发

```bash
# 1. 安装壳（模拟器已启动）
xcrun simctl install booted /path/to/ios_native-debug-simulator.app

# 2. 拉 RN 工程，起 Metro
git clone <rn_app 仓库>
cd rn_app && npm install && npm start

# 3. 在模拟器桌面点开 ios_native
#    Debug 壳会自动连本机 Metro，改 JS 即热重载
```

同事**不需要**：

- Xcode / 编译壳
- `brownfield package:ios`
- 链接 SPM

### 什么时候壳维护者要重新发一版

- `rn_app` 增删/升级**原生依赖**（新 pod、RN 大版本）
- 改了 `ios_native` 原生代码（导航、权限、原生 UI）
- 升级 `@callstack/react-native-brownfield` 大版本

只改 JS/TS → **不用**重发壳。

### 真机同事（可选，稍复杂）

模拟器 `.app` 不能直接装真机。真机需要：

- Ad Hoc / TestFlight 分发 Debug 或 Development 包
- 手机与电脑同一 Wi‑Fi，Metro 能访问开发机 IP（RN 默认会处理）

团队日常 JS 开发，**优先用模拟器 + 共享 .app**，成本最低。

---

## 参考

- [多 Bundle 方案（不同 RN 页面使用不同 bundle）](docs/multi-bundle.md)
- [动态多 Bundle（方案 2 + OTA 热更新）](docs/dynamic-multi-bundle.md)
- [iOS Integration 官方文档](https://oss.callstack.com/react-native-brownfield/docs/getting-started/ios)
