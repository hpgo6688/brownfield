# React Native 多 Bundle 方案

本文档说明在 brownfield 架构下，如何让不同 RN 页面使用不同的 JS bundle，以及各方案的适用场景与实现路径。

## 当前架构回顾

项目采用 `@callstack/react-native-brownfield` 集成模式：

- `rn_app/` — React Native 生产者（打包成 XCFramework / BrownfieldLib）
- `ios_native/` — 原生 iOS 消费者（通过 NavigationStack push RN 页面）

关键代码位置：

| 文件 | 作用 |
|------|------|
| `ios_native/ios_native/ios_nativeApp.swift` | 初始化 `ReactNativeBrownfield.shared`，加载 JS bundle |
| `ios_native/ios_native/ReactNativeScreenView.swift` | `ReactNativeView(moduleName: "rn_app")` |
| `rn_app/index.js` | `AppRegistry.registerComponent` 注册根组件 |

当前初始化方式：

```swift
ReactNativeBrownfield.shared.bundle = ReactNativeBundle
ReactNativeBrownfield.shared.preferEmbeddedBundleInDebug = false  // Debug 连 Metro
ReactNativeBrownfield.shared.startReactNative { ... }
```

---

## 先澄清概念：moduleName ≠ bundle

`ReactNativeView(moduleName: "rn_app")` 中的 **moduleName** 是 `AppRegistry.registerComponent` 注册的**组件名**，不是 bundle 文件名。

Brownfield 的 `ReactNativeBrownfield.shared` 是**单例**——整个 App 共享**一个 JS Runtime + 一个主 bundle**。以下配置均为**全局**设置，在 `startReactNative` 时生效，无法给每个 `ReactNativeView` 单独指定 bundle：

- `bundlePath` — 内嵌 bundle 路径（默认 `main.jsbundle`）
- `entryFile` — Metro 入口（默认 `index`）
- `bundleURLOverride` — 自定义 bundle URL 回调

因此需要先明确业务目标，再选方案：

| 目标 | 推荐方案 |
|------|----------|
| 不同原生入口 → 不同 RN 页面 UI | **单 bundle + 多 moduleName**（最简单） |
| 按需加载、减小首包体积 | **主 bundle + Split Bundle 懒加载** |
| 各业务线独立发版 / OTA | **Split Bundle + 远程 bundle** 或 **Re.Pack Module Federation** |
| 完全隔离（不同 RN 版本/依赖） | **多个独立 RN 工程 + 多 XCFramework**（成本最高） |

---

## 方案一：单 Bundle + 多 moduleName（推荐起步）

若需求是「首页 RN / 个人中心 RN / 设置 RN」等不同页面，**多数情况下不需要真多 bundle**。

### JS 侧：一个入口，注册多个组件

```javascript
// rn_app/index.js
import { AppRegistry } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);
```

### 原生侧：不同入口传不同 moduleName

```swift
// 首页 RN
ReactNativeView(moduleName: "HomeScreen")

// 个人中心 RN
ReactNativeView(moduleName: "ProfileScreen")
```

### 优点

- 与现有 brownfield 流程完全兼容
- Debug 仍只需一个 Metro（`npm start`），热重载正常
- 打包仍是一个 `brownfield:package:ios`，改动最小

### 局限

- 所有页面代码打进同一个 `main.jsbundle`
- 无法按业务线独立发版或 OTA 单页更新

---

## 方案二：主 Bundle + Split Bundle（真正的多 Bundle）

RN 官方支持的「一个 Runtime、多个 JS bundle」模式：App 启动加载主 bundle（公共依赖 + 路由壳），进入具体页时再 lazy load 子 bundle。

```
App 启动
  └─ 加载 main.jsbundle（React/RN 核心 + 公共代码）
       ├─ 进入 Profile  → loadBundle(profile.jsbundle) → runApplication('ProfileScreen')
       └─ 进入 Settings → loadBundle(settings.jsbundle) → runApplication('SettingsScreen')
```

### 目录结构示例

```
rn_app/
├── index.js                 # 主 bundle 入口（公共依赖）
├── bundles/
│   ├── profile/index.js     # profile.jsbundle 入口
│   └── settings/index.js    # settings.jsbundle 入口
└── scripts/
    └── build-bundles.sh     # 多 bundle 打包脚本
```

### 主 bundle 入口（`index.js`）

负责初始化公共依赖，并提供按需加载能力：

```javascript
import { AppRegistry, NativeModules } from 'react-native';

async function loadFeatureBundle(bundleName) {
  // 需自定义 Native Module，封装 loadAndExecuteSplitBundleURL
  // 或评估 callstack/react-native-multibundle（较老，需验证 RN 0.86 兼容性）
  await NativeModules.MultiBundle.load(bundleName);
}

AppRegistry.registerComponent('RNLoader', () => RNLoaderScreen);
```

### 子 bundle 入口（`bundles/profile/index.js`）

```javascript
import { AppRegistry } from 'react-native';
import ProfileScreen from '../../screens/ProfileScreen';

AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
```

### 打包脚本

```bash
# 主 bundle（含 React/RN 核心）
npx react-native bundle \
  --entry-file index.js \
  --bundle-output ios/BrownfieldLib/main.jsbundle \
  --platform ios --dev false

# 子 bundle（不含 core，需 Metro 配置 moduleId 一致）
npx react-native bundle \
  --entry-file bundles/profile/index.js \
  --bundle-output ios/BrownfieldLib/profile.jsbundle \
  --platform ios --dev false
```

### Metro 关键配置

多 bundle 必须共享 module ID，否则运行时会模块错乱：

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  serializer: {
    createModuleIdFactory: () => {
      const fileToIdMap = new Map();
      let nextId = 0;
      return (path) => {
        if (!fileToIdMap.has(path)) {
          fileToIdMap.set(path, nextId++);
        }
        return fileToIdMap.get(path);
      };
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### 原生侧加载子 bundle

Brownfield 目前没有内置 split bundle API，需要自行扩展。思路：在 push RN 页面前，先加载对应 bundle，再展示 `ReactNativeView`：

```swift
func openProfileRN() {
    if let url = ReactNativeBundle.url(forResource: "profile", withExtension: "jsbundle") {
        // 通过 Bridge 加载 split bundle
        bridge?.loadAndExecuteSplitBundleURL(url)
    }
    // 再展示 ReactNativeView(moduleName: "ProfileScreen")
}
```

Debug 下 Metro 支持 split bundle：`RCTBundleURLProvider.jsBundleURLForSplitBundleRoot("bundles/profile/index")`。

### 需要改造的部分

1. 扩展 Xcode Build Phase，打出 `main.jsbundle` + 各子 bundle
2. 子 bundle 作为资源放进 `BrownfieldLib` framework
3. 编写薄 Native Module 封装 `loadAndExecuteSplitBundleURL`
4. 原生 push 前先 load bundle，再 `ReactNativeView(moduleName:)`

### 优点

- 首包体积小，按需加载
- 子 bundle 可独立 OTA 更新
- 仍是一个 RN Runtime，内存可控

### 缺点

- Metro 配置、打包脚本、原生加载逻辑需自行维护
- brownfield CLI 默认只打 `main.jsbundle`，需扩展 Build Phase
- [callstack/react-native-multibundle](https://github.com/callstack/react-native-multibundle) 对 RN 0.86 / 新架构支持需自行验证

---

## 方案三：Re.Pack + Module Federation（微前端）

若目标是**多团队独立开发、独立部署**：

- 用 [Re.Pack](https://re-pack.dev/) 替代 Metro
- 各业务线产出 remote bundle，主 App 运行时 `import()` 远程模块
- Callstack 在大型项目里常用此模式

### 与 brownfield 的冲突

- brownfield CLI 基于 Metro + Xcode Build Phase
- 接入 Re.Pack 需改打包链路，`brownfield:package:ios` 可能无法直接复用
- 更适合 RN 为主、原生为壳，或自建 CI 打包的场景

---

## 方案四：多个 XCFramework（完全隔离）

每个 RN 业务单独一个工程，各自执行 `brownfield:package:ios`：

```
rn_home/     → HomeBrownfieldLib.xcframework
rn_profile/  → ProfileBrownfieldLib.xcframework
```

### 问题

`ReactNativeBrownfield.shared` 是单例，**不能**同时跑两个 Runtime。可选做法：

1. 每次进页面前 `stopReactNative()` → 换 bundle → 再 `startReactNative()`（切换慢、状态丢失）
2. 自行维护多个 `RCTBridge`（brownfield 不支持，工作量大）

除非业务必须不同 RN 版本或完全不同 native 依赖，否则**不推荐**。

---

## 推荐实施路径

结合当前项目结构（原生 NavigationStack + 单 BrownfieldLib）：

### 阶段 1 — 现在就能做

**单 bundle + 多 moduleName**

- 在 `ContentView` 增加多个 RN 入口，各传不同 `moduleName`
- JS 侧拆成 `screens/HomeScreen.tsx` 等
- 零 brownfield 改造，Debug 热重载不受影响

### 阶段 2 — 需要按需加载或独立 OTA 时

**主 bundle + Split Bundle**

1. 扩展 Xcode Build Phase，打出多个 `.jsbundle`
2. 子 bundle 放进 BrownfieldLib framework resources
3. 编写 Native Module 封装 split bundle 加载
4. 原生 push 前先 load，再 `ReactNativeView(moduleName:)`

### 阶段 3 — 多团队微前端

评估 Re.Pack，调整 CI，不一定继续依赖 brownfield 默认打包流程。

---

## Debug 开发体验

| 模式 | Metro | 热重载 |
|------|-------|--------|
| 单 bundle 多 module | 一个 `npm start` | 全部页面可用 |
| Split bundle | 主 bundle 连 Metro，子 bundle 用 `jsBundleURLForSplitBundleRoot` | 子 bundle 需单独配置 entry |
| 多 XCFramework | 每个工程一个 Metro 端口 | 极难维护 |

当前 `preferEmbeddedBundleInDebug = false` 适合单 bundle 开发。若采用 split bundle，Debug 时需为主/子 bundle 分别配置 Metro entry。

---

## 小结

| 要点 | 说明 |
|------|------|
| moduleName ≠ bundle | 换 `moduleName` 只是换根组件，仍在同一 bundle 内 |
| Brownfield 单例 Runtime | 真多 bundle 应在同一 Runtime 内 lazy load，而非多个 XCFramework 各起一个 RN |
| 最务实路径 | 先用方案一验证多 RN 页；有体积或独立发版需求再上方案二 |

---

## 参考

- [react-native-brownfield iOS Integration](https://oss.callstack.com/react-native-brownfield/docs/getting-started/ios)
- [callstack/react-native-multibundle](https://github.com/callstack/react-native-multibundle)
- [Re.Pack](https://re-pack.dev/)
- 项目根目录 [README.md](../README.md)
