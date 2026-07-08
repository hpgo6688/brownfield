# SOP 操作手册

本文档是 **native-app-multi-rn-bundle** 项目的标准操作流程（SOP），面向日常开发、Remote OTA 发版、原生壳维护与故障排查。技术背景见 [README.md](../README.md)、[multi-bundle.md](./multi-bundle.md)、[dynamic-multi-bundle.md](./dynamic-multi-bundle.md)。

---

## 1. 适用范围与角色

### 1.1 项目结构

| 目录 | 职责 |
|------|------|
| `rn_app/` | React Native 生产者（BrownfieldLib / XCFramework） |
| `ios_native/` | 原生 iOS 壳（NavigationStack + RN 入口） |
| `bundle-server/` | Remote 入口 manifest、bundle 上传与 OTA 服务 |
| `scripts/` | 共享构建脚本（如 Debug 壳导出） |

### 1.2 角色分工

| 角色 | 职责 | 频率 |
|------|------|------|
| **壳维护者** | 打 Debug/Release 原生包、导出共享模拟器 `.app`、升级原生依赖 | 原生依赖变更 / 壳 UI 变更时 |
| **RN 开发者** | 改 JS/TS、`npm start`、Metro 热重载 | 日常 |
| **Remote 业务开发者** | 改 `screens/remote/`、发 OTA 子 bundle | 按需 |
| **服务端维护者** | 运维 `bundle-server`、上传/回滚 bundle、管理 manifest | 发版 / 运维时 |

### 1.3 两种 RN 入口（勿混淆）

| 产品名称 | 技术实现 | 是否 OTA |
|----------|----------|----------|
| **核心 RN（Scheme 1）** | 单 bundle + 多 `moduleName` | ❌ |
| **远程业务（Remote）** | Split Bundle + manifest + FeatureHost | ✅ |

---

## 2. 环境准备（首次）

### 2.1 前置条件

- macOS + Xcode（iOS 模拟器）
- Node.js ≥ 22.11.0
- CocoaPods（`rn_app/ios` 首次需 `pod install`）

### 2.2 克隆与安装

```bash
# 根目录
git clone <repo-url>
cd native-app-multi-rn-bundle

# RN 工程
cd rn_app
npm install
cd ios && pod install && cd ..

# bundle-server（Remote / OTA 开发时需要）
cd ../bundle-server
npm install
```

### 2.3 首次打包 RN + 链接 SPM（壳维护者，只需一次）

```bash
cd rn_app
npm run brownfield:package:ios        # Release；开发用 debug 见下文
```

Xcode 操作：

1. 打开 `ios_native/ios_native.xcodeproj`
2. **File → Add Package Dependencies… → Add Local…**
3. 选择 `rn_app/ios/.brownfield/package/build`
4. target **ios_native** → **General → Frameworks** 添加 **BrownfieldLib**

### 2.4 验证安装成功

1. 终端 1：`cd rn_app && npm start`
2. Xcode：scheme **ios_native**、**Debug**、Run 到模拟器
3. 应看到原生菜单：首页 / 个人中心 / 设置 / React Native / 远程业务

---

## 3. SOP-A：日常 RN 开发（核心页 + Metro 热重载）

**适用：** 改 Scheme 1 核心页（`HomeScreen` / `ProfileScreen` / `SettingsScreen`）或主 bundle 逻辑。

### 步骤

| 步骤 | 操作 | 负责人 |
|------|------|--------|
| A-1 | `cd rn_app && npm start` | RN 开发者 |
| A-2 | Xcode Debug Run `ios_native`（或已安装的共享 Debug 壳） | RN 开发者 |
| A-3 | 修改 `rn_app` 内 JS/TS，保存后观察模拟器热重载 | RN 开发者 |

### 检查清单

- [ ] scheme 为 **Debug**（非 Release）
- [ ] BrownfieldLib 为 **Debug** 包（`npm run brownfield:package:ios:debug`）
- [ ] Metro 终端无报错，模拟器 App 已启动
- [ ] 未误用 `cd rn_app && npm run ios`（那是独立 RN App，不是 brownfield 壳）

### 热重载不生效时

```bash
cd rn_app
npm run brownfield:package:ios:debug
# Xcode：Product → Clean Build Folder，再 Run
```

---

## 4. SOP-B：Remote 业务日常开发（Metro 模式）

**适用：** 改 `screens/remote/` 或 `screens/remote/components/`，需要 HMR。

### 步骤

| 步骤 | 操作 |
|------|------|
| B-1 | 终端 1：`cd rn_app && npm start` |
| B-2 | （可选）终端 2：`cd bundle-server && USE_METRO_BUNDLES=true npm run dev` |
| B-3 | Xcode Debug Run `ios_native` |
| B-4 | 原生壳工具栏选择 **Metro** 模式 |
| B-5 | 进入「远程业务」→ 订单 / 活动页，改 `screens/remote/` 验证 HMR |

### 重要规则

| 目录 | 用途 | 是否 Metro HMR |
|------|------|----------------|
| `screens/remote/` | 日常 UI 开发 | ✅ |
| `bundles/ota_*/` | 仅 build/upload | ❌ |

**禁止：** 在 `src/`、`screens/remote/` 中 `import bundles/ota_*`。

发版前可跑：

```bash
cd rn_app && npm run verify:ota-scope
```

---

## 5. SOP-C：Remote OTA 发版

**适用：** 将 Remote 子 bundle 发布到 `bundle-server`，供 App OTA 模式加载。

### 5.1 发布前检查

- [ ] UI 改动已在 Metro 模式验证
- [ ] 版本号符合 semver（如 `0.0.3`）
- [ ] `bundle-server` 可访问
- [ ] 若只改共享 UI（`components/`），OTA 包装层无特殊改动时可只 rebuild

### 5.2 构建子 bundle

```bash
cd rn_app
npm run build:bundles
# 产物示例：dist/bundles/ota_order.0.0.3.ios.jsbundle
```

### 5.3 上传（二选一）

**方式 1 — Admin UI（推荐）**

1. 打开 http://127.0.0.1:3001/admin
2. 选择 Remote 入口（如 `order`）
3. 填写版本号，上传 `.jsbundle`
4. 勾选「上传后立即上线」，或在历史版本中 **设为线上**

**方式 2 — 命令行**

```bash
cd bundle-server
./scripts/upload-bundle.sh order 0.0.3 ../rn_app/dist/bundles/ota_order.0.0.3.ios.jsbundle
```

### 5.4 客户端验证

| 步骤 | 操作 |
|------|------|
| C-1 | 确认 `bundle-server` 运行：`cd bundle-server && npm run dev` |
| C-2 | 原生壳切 **OTA** 模式 |
| C-3 | 下拉刷新 Remote 菜单（如需） |
| C-4 | 进入订单页，确认显示 OTA 标识 / 新版本内容 |
| C-5 | （可选）等待 20s polling 或点页面内「检查更新」验证 Banner |

### 5.5 回滚

**Admin：** 历史版本 → **设为线上** / **回滚**

**API：**

```bash
curl -X POST http://127.0.0.1:3001/api/features/order/rollback \
  -H 'Content-Type: application/json' \
  -d '{"releaseId": "<release-id>"}'
```

### 5.6 OTA 仍显示旧内容

删除沙盒缓存或重装 App：

```
DocumentDirectory/rn-bundles/
```

---

## 6. SOP-D：bundle-server 运维

### 6.1 启动服务

```bash
cd bundle-server
npm run dev          # 开发：db:prepare + 热重载
# 或
npm run build && npm start   # 生产
```

| 地址 | 说明 |
|------|------|
| http://127.0.0.1:3001/admin | 管理后台 |
| http://127.0.0.1:3001/api/manifest | manifest JSON |

数据库：`bundle-server/data/bundle-server.db`

### 6.2 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3001` | 服务端口 |
| `USE_METRO_BUNDLES` | `false` | manifest 指向 Metro split bundle |
| `METRO_HOST` | `http://127.0.0.1:8081` | Metro 地址 |

### 6.3 冒烟测试

**先启动 server，再另开终端：**

```bash
cd bundle-server
npm run smoke:manifest

# 需先 build bundles
cd ../rn_app && npm run build:bundles
cd ../bundle-server && npm run smoke:e2e
```

### 6.4 禁用 Remote 入口

Admin 禁用，或：

```bash
curl -X POST http://127.0.0.1:3001/api/features/promo/toggle \
  -H 'Content-Type: application/json' \
  -d '{"enabled": false}'
```

原生壳下拉刷新 Remote 菜单生效。

---

## 7. SOP-E：新增 Remote 入口

| 步骤 | 操作 | 文件/位置 |
|------|------|-----------|
| E-1 | 添加 Metro dev 页面 | `screens/remote/<Name>Screen.tsx` |
| E-2 | 共享 UI 放 components | `screens/remote/components/` |
| E-3 | 注册 moduleName | `screens/remote/featureMeta.ts` |
| E-4 | 新建 OTA 入口 | `bundles/ota_<id>/index.js` |
| E-5 | OTA 包装页 | `bundles/ota_<id>/screens/` |
| E-6 | 注册服务端入口 | Admin 或 `prisma/seed.ts` |
| E-7 | 加入构建列表 | `scripts/build-bundles.js` 的 `bundles` 数组 |
| E-8 | 构建并上传 | `npm run build:bundles` → upload |

日常开发只改 `screens/remote/`；OTA 包装仅在需要不同 badge/文案时改 `bundles/ota_*/screens/`。

---

## 8. SOP-F：原生壳维护与团队分发

### 8.1 何时需要重新打壳

- `rn_app` 增删/升级**原生依赖**（新 pod、RN 大版本）
- 修改 `ios_native` 原生代码
- 升级 `@callstack/react-native-brownfield` 大版本
- 修改 `SplitBundleLoader` 等原生模块

**只改 JS/TS → 不需要重发壳。**

### 8.2 Debug 包（开发连 Metro）

```bash
cd rn_app
npm run brownfield:package:ios:debug
# Xcode Clean + Run
```

### 8.3 Release 包（内嵌 JS，无 Metro）

```bash
cd rn_app
npm run brownfield:package:ios
```

### 8.4 导出共享模拟器 App

```bash
chmod +x scripts/build-debug-shell.sh
./scripts/build-debug-shell.sh
# 产物：dist/ios_native-debug-simulator.app
```

### 8.5 同事安装与开发

```bash
# 安装壳（模拟器已启动）
xcrun simctl install booted /path/to/ios_native-debug-simulator.app

# 开发
cd rn_app && npm install && npm start
# 模拟器桌面打开 ios_native
```

同事**不需要** Xcode、pod、brownfield 打包。

---

## 9. SOP-G：发版前完整验证（Release 路径）

| 步骤 | 操作 | 预期 |
|------|------|------|
| G-1 | `npm run brownfield:package:ios` | BrownfieldLib Release 产物更新 |
| G-2 | `npm run build:bundles` | 子 bundle + hash 正常 |
| G-3 | upload 全部 Remote 入口 | manifest version/hash 更新 |
| G-4 | `npm run smoke:e2e` | 服务端冒烟通过 |
| G-5 | Xcode **Release** Run | 核心页正常 |
| G-6 | OTA 模式进 Remote 页 | split load 成功，无 `useSyncExternalStore` 崩溃 |
| G-7 | 断网进 Remote 页 | fallback 到主 bundle 内置页 |

---

## 10. 故障排查速查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 改 JS 不更新 | Release 包 / Release scheme | `brownfield:package:ios:debug` + Debug scheme + Clean |
| Metro `No apps connected` | App 加载内嵌 bundle | 同上 |
| `RCTStatusBarManager` 崩溃 | 缺 Info.plist 配置 | 确认 `UIViewControllerBasedStatusBarAppearance = false` |
| Remote Metro 模式无 HMR | 改错目录 | 改 `screens/remote/`，非 `bundles/ota_*` |
| OTA 模式仍旧版 | 沙盒缓存 | 删 `DocumentDirectory/rn-bundles/` 或重装 |
| OTA 切换后白屏 | registry 未清 | 切换模式后重进页；见 fixes 文档 |
| manifest 拉不到 | server 未启 / IP 不对 | 启动 server；真机改局域网 IP |
| split load 崩溃 | eval 完整 bundle | 必须用 `ota_*.ios.jsbundle` + SplitBundleLoader |
| smoke 失败 | server 未运行 | 先 `cd bundle-server && npm run dev` |

详细修复记录：[docs/fixes/](./fixes/)

---

## 11. 命令速查

```bash
# Metro
cd rn_app && npm start

# Debug / Release 打包
cd rn_app && npm run brownfield:package:ios:debug
cd rn_app && npm run brownfield:package:ios

# Remote 子 bundle
cd rn_app && npm run build:bundles
cd rn_app && npm run verify:ota-scope

# bundle-server
cd bundle-server && npm run dev
cd bundle-server && USE_METRO_BUNDLES=true npm run dev
cd bundle-server && ./scripts/upload-bundle.sh order 1.0.0 dist/bundles/ota_order.1.0.0.ios.jsbundle

# 共享 Debug 壳
./scripts/build-debug-shell.sh
```

---

## 12. 相关文档

| 文档 | 内容 |
|------|------|
| [README.md](../README.md) | Brownfield 集成与日常开发 |
| [multi-bundle.md](./multi-bundle.md) | 多 Bundle 方案选型 |
| [dynamic-multi-bundle.md](./dynamic-multi-bundle.md) | Remote + OTA 架构详解 |
| [case-study-remote-ota-metro-isolation.md](./case-study-remote-ota-metro-isolation.md) | Metro / OTA 隔离案例 |
| [rn_app/screens/remote/README.md](../rn_app/screens/remote/README.md) | Remote Metro 开发说明 |
| [bundle-server/README.md](../bundle-server/README.md) | 服务端 API 与命令 |

---

*最后更新：2026-07-08*
