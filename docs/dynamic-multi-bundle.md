# Dynamic Multi-Bundle

服务端控制 RN 动态入口（**方案 2**）。与 **方案 1**（单 Bundle + 多 moduleName）在原生壳中共存，菜单分两组。

| 分组 | 方案 | 说明 |
|------|------|------|
| React Native · 方案1（单 Bundle） | 方案 1 | 主 bundle 内直接 `moduleName`，无需 bundle-server |
| React Native · 方案2（动态 Bundle） | 方案 2 | manifest 控入口，按需加载子 bundle |

## 架构

```
bundle-server (Node.js)
  GET /api/manifest          → 返回启用的 feature 列表 + bundleUrl
  GET /bundles/*.jsbundle    → 静态子 bundle（Release / 联调）

rn_app
  index.js                   → 主 bundle：方案1 注册 HomeScreen 等 + 方案2 注册 FeatureHost
  bundles/{home,profile,settings}/index.js → 方案2 子 bundle 入口
  src/features/FeatureHost   → 拉 manifest → 下载 bundle → 渲染页面

ios_native
  LocalReactNativeScreenView   → 方案1：直接 moduleName
  DynamicReactNativeScreenView → 方案2：FeatureHost + featureId
  BundleManifestService        → 方案2 菜单动态读取 manifest
```

## 快速开始

### 1. 启动 bundle-server

```bash
cd bundle-server
npm install
npm start
```

Manifest 地址：`http://127.0.0.1:3001/api/manifest`

### 2. 开发模式（Metro 热重载子 bundle）

```bash
# 终端 1 — Metro
cd rn_app && npm start

# 终端 2 — bundle-server（指向 Metro）
cd bundle-server
USE_METRO_BUNDLES=true npm start

# 终端 3 — Xcode Debug Run ios_native
```

此模式下 manifest 里的 `bundleUrl` 会指向 Metro 的 split bundle 路径，改 `screens/` 可热重载。

### 3. 静态 bundle 模式（接近 Release）

```bash
# 构建全部 bundle 到 bundle-server/dist/bundles/
cd rn_app
npm run build:bundles

# 启动静态服务
cd ../bundle-server
npm start

# Xcode Run（Debug 连 Metro 主 bundle + 静态子 bundle，或 Release 全静态）
```

### 4. 服务端控制入口

编辑 `bundle-server/manifest.config.js`，将某个 feature 的 `enabled` 设为 `false`，重启 server（或使用 API）后，原生菜单会自动隐藏该入口。

```bash
# 运行时切换（示例：关闭 settings）
curl -X POST http://127.0.0.1:3001/api/features/settings/toggle \
  -H 'Content-Type: application/json' \
  -d '{"enabled": false}'
```

下拉刷新原生壳菜单即可看到变化。

## 新增一个 RN 页面

1. 在 `rn_app/screens/` 添加页面组件
2. 新建 `rn_app/bundles/<id>/index.js` 并 `registerFeature`
3. 在 `bundle-server/manifest.config.js` 注册 feature
4. 在 `rn_app/scripts/build-bundles.js` 的 `bundles` 数组里加一项
5. `npm run build:bundles`

## 关键文件

| 文件 | 说明 |
|------|------|
| `bundle-server/manifest.config.js` | 服务端入口配置（启用/禁用、bundle 文件名） |
| `bundle-server/server.js` | Express 服务 |
| `rn_app/src/features/FeatureHost.tsx` | RN 动态加载容器 |
| `rn_app/src/features/bundleLoader.ts` | 下载并执行子 bundle |
| `ios_native/ios_native/BundleManifestService.swift` | 原生拉 manifest |

## 说明

- **方案 1** 只依赖 Metro / 主 bundle，适合日常开发、server 不可用时的兜底。
- **方案 2** 主 bundle 由 Brownfield / Metro 加载；子 bundle 由 `FeatureHost` 按需加载，需 bundle-server。
- Debug 默认主 bundle 连 Metro（`preferEmbeddedBundleInDebug = false`）。
- 模拟器访问本机服务使用 `127.0.0.1`；真机需改为电脑局域网 IP。
- 多 bundle 使用 deterministic moduleId（见 `metro.config.js`），保证主/子 bundle 模块 ID 一致。

更多背景见 [multi-bundle.md](./multi-bundle.md)。
