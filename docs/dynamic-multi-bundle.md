# Remote RN · 远程业务块（Split Bundle + OTA）

服务端配置 **Remote 入口**（远程 RN 业务块），支持 manifest 增删、子 bundle 按需加载与 OTA 热更新。与 **Scheme 1 核心 RN**（本地固定页面）在原生壳中共存，菜单分两组。

> **术语：** 本文档中的 **「方案 2」** 仅指 **Split Bundle + manifest + FeatureHost** 这套**技术实现**，不是菜单上的第二组页面名称。产品上第二组应称为 **「远程业务 / Remote entries」**。

## 术语对照

| 名称 | 层级 | 含义 |
|------|------|------|
| **Scheme 1 · 核心 RN** | 产品 | 本地固定入口：`HomeScreen` / `ProfileScreen` / `SettingsScreen`。主 bundle 直接 `moduleName`，**不走 manifest / OTA** |
| **Remote entry · 远程入口** | 产品 | 服务端配置的 RN 业务页（目标：`order`、`promo` 等）。manifest 控制可见性、版本、bundle URL，**可 OTA** |
| **Scheme 2 · Split Bundle** | 技术 | 在同一 Brownfield Runtime 内 lazy load 子 bundle + `FeatureHost` + OTA，**用来交付 Remote 入口** |
| **multi-bundle 方案三** | 技术 | Re.Pack Module Federation — **不在当前范围** |
| **multi-bundle 方案四** | 技术 | 多 RN 工程 / 多 XCFramework — **不在当前范围**（除非 Remote 业务需要不同 RN 版本） |

**关键规则：**

1. OTA 只作用于 **Remote 入口**，不影响 Scheme 1 核心页
2. Remote 入口**不必**与 Scheme 1 一一对应（不是「远程版首页」）
3. Remote 与 Scheme 1 共用 **同一个** `rn_app`、同一个 BrownfieldLib、同一个 JS Runtime

### 原生壳菜单（目标形态）

```
Native Shell
├── 原生页面
├── React Native · 核心 RN（Scheme 1）     ← 本地固定
└── React Native · 远程业务（Remote）      ← manifest 动态 + OTA
```

> **Demo 技术债：** 已迁移至 `screens/remote/`（`order`、`promo`）。旧 `screens/dynamic/Dynamic*` 镜像页面已移除。

## 架构

```
bundle-server (Fastify + Prisma)
  GET /api/manifest          → 启用的 Remote 入口 + version/hash/bundleUrl
  POST /api/bundles/upload   → 上传子 bundle，更新 active release
  GET /bundles/*.jsbundle    → 静态子 bundle

rn_app
  screens/                   → Scheme 1 核心页
  screens/remote/            → Remote 业务页（Metro dev）+ components/ 共享 UI
  index.js                   → 主 bundle：Scheme 1 注册 + Remote registerFeature fallback
  bundles/ota_{order,promo}/ → OTA split bundle 入口 + screens/（输出 ota_*.ios.jsbundle）
  src/features/
    FeatureHost              → Remote 容器：manifest → OTA → 渲染
    bundleUpdater            → 版本比对、下载、缓存
    bundleCache              → 沙盒持久化
    bundleLoader             → Dev Metro split / Release SplitBundleLoader

ios_native
  LocalReactNativeScreenView     → Scheme 1：直接 moduleName
  DynamicReactNativeScreenView   → [deprecated alias] RemoteReactNativeScreenView
  RemoteReactNativeScreenView    → Remote：FeatureHost + featureId
  BundleManifestService        → Remote 菜单动态读取 manifest
```

> 详细的双路径说明、目录职责、防误操作护栏见下一节 **[Remote 双路径架构](#remote-双路径架构metro-dev--ota-upload)**。

## Remote 双路径架构（Metro dev · OTA upload）

Remote 业务页有 **两条互不影响的源码路径**。搞混目录是常见误操作：改了 OTA 路径却等 Metro HMR，或改了 Metro 路径却期望 upload 后生效。

### 一览

```mermaid
flowchart TB
  subgraph dev["日常开发 · Metro HMR"]
    R["screens/remote/<br/>OrderScreen.tsx"]
    C["screens/remote/components/<br/>共享 UI（目标）"]
    R --> C
    FH_M["FeatureHost<br/>DEBUG Metro 模式"]
    FH_M -->|"dynamic import"| R
  end

  subgraph upload["构建上传 · OTA 生效"]
    B["bundles/ota_order/screens/<br/>OrderScreen.tsx（目标 colocate）"]
    E["bundles/ota_order/index.js"]
    E --> B
    B --> C
    BUILD["npm run build:bundles"]
    UP["upload ota_order.*.ios.jsbundle"]
    BUILD --> UP
    FH_O["FeatureHost<br/>DEBUG OTA / Release"]
    FH_O -->|"manifest → download → split load"| UP
  end

  subgraph guard["防误操作（目标 ota-screens-build-scope-guard）"]
    L["ESLint：runtime 禁止 import bundles/ota_*"]
    M["Metro blockList：dev 不解析 OTA 目录"]
    V["npm run verify:ota-scope"]
  end
```

### 改哪里、如何生效

| 你想做什么 | 编辑目录 | 如何看到效果 | 模块名 |
|------------|----------|--------------|--------|
| 日常 UI 开发、Metro 热重载 | `screens/remote/` + `components/`（共享 UI） | `npm start` + 原生壳 **Metro** 模式 | `OrderScreen` / `PromoScreen` |
| OTA 标识、upload 专用文案 | `bundles/ota_<id>/screens/` | `npm run build:bundles` → upload → 原生壳 **OTA** 模式 | `ota_OrderScreen` / `ota_PromoScreen` |
| 运行时逻辑（加载、缓存、注册） | `src/features/` | 按模式分别走 Metro import 或 OTA pipeline | — |
| 上传产物 / manifest | `bundle-server` + Admin | upload 后 pull manifest | `featureId` 仍为 `order` / `promo` |

**记住：** `bundles/ota_*/screens/` **不会**被 `npm start` 热重载。只有 rebuild + upload 后，OTA 模式才会用到。

### 目录职责（目标布局）

```
rn_app/
├── screens/remote/                 ← Metro dev：日常改这里
│   ├── components/                 ← 共享业务 UI（OrderList 等）
│   ├── OrderScreen.tsx             ← Metro 包装：Remote · 远程业务 badge
│   └── PromoScreen.tsx
│
├── bundles/                        ← 仅 build/upload，非 Metro dev 入口
│   ├── README.md
│   ├── ota_order/
│   │   ├── index.js                ← registerFeature + AppRegistry（ota_OrderScreen）
│   │   └── screens/
│   │       └── OrderScreen.tsx     ← OTA 包装：OTA · 远程 Bundle badge
│   └── ota_promo/
│       ├── index.js
│       └── screens/
│           └── PromoScreen.tsx
│
└── src/features/
```

### DEBUG 模式切换（原生壳工具栏）

| 模式 | 加载路径 | 屏幕来源 | 模块名 |
|------|----------|----------|--------|
| **Metro** | Metro dynamic import | `screens/remote/` | `OrderScreen` / `PromoScreen` |
| **OTA** | manifest → 下载 → split load | `bundles/ota_*/screens/` | `ota_OrderScreen` / `ota_PromoScreen` |

**隔离规则：**

- 上传 bundle 文件名带 `ota_` 前缀：`ota_order.<version>.ios.jsbundle`
- manifest `featureId` 不变（`order` / `promo`）
- 两种模式 **不互相 fallback**；切换时清除 JS registry 与 loaded bundle 标记后重载
- Native segment 在同一 session 内可能跳过 re-eval；`__OTA_COMPONENT_CACHE__` 用于恢复 registry（见 `docs/fixes/2026-07-08-ota-mode-switch-registration-lost.md`）
- upload 后 OTA 仍显示旧内容 → 删除沙盒 `DocumentDirectory/rn-bundles/` 或重装 App

### 防误操作护栏（目标）

| 护栏 | 作用 |
|------|------|
| **目录 colocate** | OTA 屏幕移入 `bundles/ota_*/screens/`，与 upload 入口同目录，避免与 `screens/remote/` 并列误导 |
| **共享 components** | 业务 UI 只在 `screens/remote/components/` 维护一份；Metro/OTA 包装层只改 badge/文案 |
| **ESLint** | `src/`、`index.js`、`screens/remote/` 禁止 import `bundles/ota_*` |
| **Metro blockList** | `npm start` 时不解析 `bundles/ota_*` |
| **verify:ota-scope** | `npm run verify:ota-scope` 检查 main bundle 图不含 OTA 专用模块 |
| **README** | `screens/remote/README.md`、`bundles/README.md` 说明编辑流程 |

### 典型工作流

**改 UI（大多数情况）：**

```bash
# 1. 改 screens/remote/ 或 components/
cd rn_app && npm start
# 2. Xcode Debug，原生壳切 Metro 模式，进订单页 → HMR 即时生效
```

**发 OTA 版本：**

```bash
cd rn_app && npm run build:bundles
cd ../bundle-server
./scripts/upload-bundle.sh order 0.0.2 dist/bundles/ota_order.0.0.2.ios.jsbundle
# 原生壳切 OTA 模式，进订单页 → 显示 OTA bundle 内容
```

**新增 Remote 入口：** 见下文 [新增一个 Remote 入口](#新增一个-remote-入口)。

## 快速开始

### 1. 启动 bundle-server

```bash
cd bundle-server
npm install
npm run dev          # db:prepare + 热重载
```

| 地址 | 说明 |
|------|------|
| http://127.0.0.1:3001/admin | 管理后台：上传、回滚、启用/禁用入口 |
| http://127.0.0.1:3001/api/manifest | Remote manifest JSON |

`npm run dev` 会自动 `prisma db push` + seed。数据库：`bundle-server/data/bundle-server.db`。

### 2. 上传与回滚

1. 打开 `/admin`
2. 选择 Remote 入口，填写 semver，上传 `.jsbundle`
3. 勾选「上传后立即上线」，或在历史版本里 **设为线上** / **回滚**
4. 原生壳下拉刷新 Remote 菜单；进入页面时 `FeatureHost` 拉 OTA

```bash
# 回滚示例（目标 entryId：order）
curl -X POST http://127.0.0.1:3001/api/features/order/rollback \
  -H 'Content-Type: application/json' \
  -d '{"releaseId": "<release-id>"}'

# CI 上传示例（featureId 不变，文件名带 ota_ 前缀）
./scripts/upload-bundle.sh order 1.0.0 dist/bundles/ota_order.1.0.0.ios.jsbundle
./scripts/upload-bundle.sh promo 1.0.0 dist/bundles/ota_promo.1.0.0.ios.jsbundle
```

### 3. 开发模式（Metro 热重载 Remote 子 bundle）

```bash
# 终端 1 — Metro
cd rn_app && npm start

# 终端 2 — bundle-server 指向 Metro
cd bundle-server && USE_METRO_BUNDLES=true npm run dev

# 终端 3 — Xcode Debug Run ios_native
```

此模式下 manifest 里的 `bundleUrl` 会指向 Metro 的 split bundle 路径，改 `screens/remote/` 可热重载。详见上文 [Remote 双路径架构](#remote-双路径架构metro-dev--ota-upload)。

### 4. 静态 bundle 模式（接近 Release）

```bash
cd rn_app && npm run build:bundles    # 输出 build-manifest.json + hash
cd ../bundle-server && npm run dev
```

### 5. 服务端控制 Remote 入口可见性

Admin 禁用入口，或：

```bash
curl -X POST http://127.0.0.1:3001/api/features/promo/toggle \
  -H 'Content-Type: application/json' \
  -d '{"enabled": false}'
```

下拉刷新原生壳 Remote 菜单即可。

## 新增一个 Remote 入口

1. 在 `screens/remote/` 添加 Metro dev 页面；共享 UI 放 `screens/remote/components/`
2. 在 `screens/remote/featureMeta.ts` 注册 `moduleName`（Metro 用 unprefixed 名）
3. 新建 `bundles/ota_<entryId>/index.js`，注册 `ota_<ModuleName>` 并 `registerFeature(..., { source: 'ota' })`
4. 在 `bundles/ota_<entryId>/screens/` 添加 OTA 包装页
5. 在 Admin 或 `prisma/seed.ts` 注册 Remote 入口
6. 在 `scripts/build-bundles.js` 的 `bundles` 数组加一项（output 带 `ota_` 前缀）
7. `npm run build:bundles` → upload `ota_<entryId>.*.ios.jsbundle`

> 日常开发只改 `screens/remote/`；OTA 包装仅在需要改 upload 标识或 OTA 专用逻辑时动 `bundles/ota_*/screens/`。

## 迁移到 Remote 模型

| 之前（demo） | 当前 |
|-------------|------|
| seed: `home` / `profile` / `settings` | seed: `order` / `promo` |
| `screens/dynamic/Dynamic*Screen` | `screens/remote/OrderScreen` 等 |
| 菜单「方案2（动态 Bundle）」 | 菜单「远程业务（Remote）」 |

## App 启动预加载（可选）

**默认：** 仅 Swift `BundleManifestService` 在 `.task` / 下拉刷新时拉 manifest，控制 Remote **菜单**。

**可选 JS 预加载：** 在任意已加载的 RN 页面（如 Scheme 1 首页或 Remote 页）调用：

```typescript
import { preloadFeatures } from './src/features/bundleUpdater';

useEffect(() => {
  preloadFeatures(['order', 'promo']);
}, []);
```

无需原生改动；`FeatureHost` 进页时仍会 `checkAndUpdateFeature`。原生 startup hook 非必须。

## 验证脚本

**先在一个终端启动 server**（smoke 脚本不会自动启动）：

```bash
cd bundle-server && npm run dev
```

**再在另一个终端：**

```bash
cd bundle-server
npm run db:seed                 # Remote 入口 order/promo
npm run smoke:manifest          # manifest v2 字段

# 需先 build bundles
cd ../rn_app && npm run build:bundles
cd ../bundle-server && npm run smoke:e2e
```

若 server 未运行，脚本会提示：`Start it first: cd bundle-server && npm run dev`

| 场景 | 验证方式 |
|------|----------|
| 8.1 上传后 manifest 版本 bump | `npm run smoke:e2e` |
| 8.2 服务端不可用 fallback | 停 server，进 Remote 页应显示主 bundle 内置页 |
| 8.3 Dev Metro split | `USE_METRO_BUNDLES=true npm run dev` + Metro |

## 关键文件

| 文件 | 说明 |
|------|------|
| `bundle-server/prisma/schema.prisma` | Remote 入口 + 版本历史 |
| `bundle-server/src/services/manifest.service.ts` | manifest v2（version/hash） |
| `bundle-server/src/services/bundle.service.ts` | 上传、激活、回滚 |
| `bundle-server/scripts/smoke-manifest.js` | manifest v2 冒烟测试 |
| `rn_app/src/features/bundleUpdater.ts` | OTA 比对 / 下载 / 缓存 |
| `rn_app/src/features/bundleCache.ts` | 沙盒路径与 metadata |
| `rn_app/src/features/bundleLoader.ts` | Dev Metro / Release SplitBundleLoader |
| `rn_app/src/features/FeatureHost.tsx` | Remote 页面容器 |
| `rn_app/screens/remote/README.md` | Metro dev 编辑说明 |
| `rn_app/bundles/README.md` | OTA build/upload 说明 |
| `rn_app/ios/BrownfieldLib/SplitBundleLoader.mm` | Release split load |
| `ios_native/.../BundleManifestService.swift` | Remote 菜单 |

---

## OTA 热更新

**目标：** Remote 子 bundle 打包上传到 Node 服务 → 移动端拉 manifest → 比对版本 → 下载 → 校验 hash → 沙盒缓存 → split load，**无需 App Store 发版**。

> **当前状态：** 服务端 manifest v2、上传、Admin、回滚已就绪。客户端 `bundleCache` / `bundleUpdater` / `SplitBundleLoader` 已实现；**Remote 模型重构**（§9）与 BrownfieldLib 重打包验证仍进行中。

### 能力对照

| 能力 | 状态 | 说明 |
|------|------|------|
| Node 托管 bundle | ✅ 已有 | `dist/bundles/` + `GET /bundles/*` |
| manifest Remote 入口 | ✅ 已有 | `GET /api/manifest` |
| manifest version/hash | ✅ 已有 | manifest v2 |
| 上传 + Admin + 回滚 | ✅ 已有 | Prisma `BundleRelease` |
| 原生 Remote 菜单 | ✅ 已有 | `BundleManifestService` |
| Dev Metro split | ✅ 已有 | `modulesOnly=true` |
| 客户端缓存 | ✅ 已有 | `bundleCache.ts` + RNFS；未链接时降级主 bundle |
| 版本比对 / 下载 | ✅ 已有 | `bundleUpdater.ts`（staged: check / pending / apply） |
| OTA polling + 用户确认更新 | ✅ 已有 | `otaUpdatePoller.ts` + `OtaUpdateBanner`（20s） |
| Release split load | ✅ 已有 | `SplitBundleLoader`（需重打 BrownfieldLib） |
| 新建 Remote 入口 API | ✅ 已有 | `POST /api/features` + Admin 表单 |
| Remote 页面 / seed | ✅ 已有 | `order` / `promo` |

### OTA 作用范围

| 对象 | 是否 OTA |
|------|----------|
| Scheme 1 核心页（HomeScreen 等） | ❌ |
| 主 bundle / BrownfieldLib | ❌（需原生发版） |
| Remote 入口子 bundle | ✅ |
| Remote 菜单可见性 | ✅（manifest `enabled`，非 bundle OTA） |

### OTA 触发点

| 触发位置 | 控制什么 | 实现 |
|----------|----------|------|
| 原生下拉刷新 | Remote **菜单**是否展示 | `BundleManifestService.load()` |
| 进入 Remote 页（OTA） | **bootstrap** 加载已有 active 缓存 | `FeatureHost` → `ensureFeatureCached` |
| OTA 页 polling（20s） | 检测新版本 → 后台下载 pending | `useOtaUpdatePoller` |
| 页面底部 Banner | 用户点 **「立即更新」** 应用 pending | `applyPendingFeature` + reload |
| Remote 页内按钮 | 手动检查（下载 pending，不 auto-reload） | `checkRemoteFeature` + `downloadPendingFeature` |
| 静默预加载 | 后台下载其他 Remote bundle | `preloadFeatures([...])` |

**OTA 模式 in-session 升级流程：**

1. 用户已在 OTA 模式查看 v0.0.2（active cache）
2. 服务端 upload v0.0.3 → manifest 更新
3. `useOtaUpdatePoller` 每 **20s** poll manifest，发现新版本后 **后台下载** 到 `pending.json`（不 reload）
4. 页面底部出现 Banner：**「发现新版本 v0.0.3」** + **「立即更新」**
5. 用户点击 **立即更新** → `applyPendingFeature` 提升 pending → active → `FeatureHost` reload → 显示 v0.0.3

**冷启动**（无缓存）：仍走 `ensureFeatureCached` / `checkAndUpdateFeature` 立即下载加载，无需用户确认。

**Metro 模式**：不 polling、不显示 Banner；`screens/remote/` HMR 不变。

```typescript
import {
  checkRemoteFeature,
  downloadPendingFeature,
  applyPendingFeature,
  ensureFeatureCached,
} from '../features/bundleUpdater';

// OTA bootstrap（有缓存则直接用，无缓存才下载）
await ensureFeatureCached('order');

// 手动检查（只下载 pending）
const check = await checkRemoteFeature('order');
if (check.updateAvailable) {
  await downloadPendingFeature(check.remoteFeature);
}

// 用户确认后应用
await applyPendingFeature('order');
```

### 整体架构

```mermaid
flowchart TB
    subgraph Publish["发布侧"]
        A["改 screens/remote/components/"] --> B["npm run build:bundles"]
        B2["（可选）改 bundles/ota_*/screens/ 包装"] --> B
        B --> C["POST /api/bundles/upload<br/>ota_*.ios.jsbundle"]
        C --> D["DB 更新 active release"]
    end

    subgraph Server["bundle-server"]
        D --> E["dist/bundles/*.jsbundle"]
        D --> F["GET /api/manifest"]
    end

    subgraph Mobile["移动端"]
        H["触发：刷新菜单 / 进页 / polling / RN 按钮"] --> I["GET /api/manifest"]
        I --> J{"version/hash 一致?"}
        J -->|是| K["读沙盒 active 缓存"]
        J -->|否| L["下载 bundle → pending.json"]
        L --> M{"sha256"}
        M -->|通过| N["写 pending，显示 Banner"]
        M -->|失败| O["fallback：内置 registerFeature"]
        N --> P2["用户点「立即更新」"]
        P2 --> P["SplitBundleLoader.load active"]
        K --> P
        O --> P
        P --> Q["渲染 Remote 页面"]
    end

    F --> I
    E --> L
```

### 目标 manifest 示例

```json
{
  "version": 2,
  "updatedAt": "2026-07-08T12:00:00.000Z",
  "manifestUrl": "http://127.0.0.1:3001/api/manifest",
  "features": [
    {
      "id": "order",
      "title": "订单",
      "icon": "cart",
      "moduleName": "ota_OrderScreen",
      "version": "1.2.0",
      "hash": "sha256:abc123...",
      "bundleUrl": "http://127.0.0.1:3001/bundles/ota_order.1.2.0.ios.jsbundle",
      "minAppVersion": "1.0.0"
    }
  ]
}
```

### 本地缓存

```
DocumentDirectory/rn-bundles/
  order/
    1.2.0.jsbundle
    metadata.json
```

### Dev vs Release

| 环境 | 主 bundle | Remote 子 bundle | 注意 |
|------|-----------|------------------|------|
| Debug + Metro | Metro | Metro split（`USE_METRO_BUNDLES=true`） | 可热重载 |
| Release OTA | 内嵌 BrownfieldLib | 下载 + `SplitBundleLoader` | **禁止 eval 完整包** |

> **为什么不能 eval 完整 bundle？** 每份完整 bundle 含一份 React，eval 进同一 Runtime 会导致 `useSyncExternalStore of null`。Release 必须用增量 split bundle。

### 降级策略

1. 网络失败 → 用上次成功缓存
2. hash 不匹配 → 丢弃下载，保留旧版
3. split load 失败 → 主 bundle 内置 `registerFeature` fallback
4. manifest 不可用 → Remote 菜单为空；Scheme 1 不受影响

---

## 说明

- **Scheme 1** 只依赖主 bundle，server 不可用时仍可用
- **Remote** 使用 Split Bundle 技术（方案 2）；manifest 管入口，OTA 管 bundle 内容
- 主 bundle 内 `registerFeature` 仅作 offline / 首次安装 fallback
- Debug 默认连 Metro（`preferEmbeddedBundleInDebug = false`）
- 模拟器用 `127.0.0.1`；真机改局域网 IP
- moduleId 见 `metro.config.js` deterministic factory

更多背景：[multi-bundle.md](./multi-bundle.md)  
面试 / 复盘案例：[case-study-remote-ota-metro-isolation.md](./case-study-remote-ota-metro-isolation.md)
