# OTA / Split Bundle 关键术语词典

> 阅读 [fixes/README.md](./README.md)、[interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md) 时的配套词典。  
> 按「从大到小」组织：架构 → 加载链路 → 注册与 Re-entry → 构建与缓存。

---

## 一、项目架构层

### Brownfield（棕地）

原生 App 已经存在，**往里面嵌入 React Native**，而不是从零写一个纯 RN App。

本项目：iOS SwiftUI 壳 + 内嵌 RN 主包 + 可 OTA 的 Remote 业务页。

### OTA（Over-The-Air）

**不通过 App Store 发版**，从服务器下载新的 JS bundle，在 App 里热替换业务代码。

对应产物：`bundle-server` 上的 `ota_order.0.0.7.ios.jsbundle` 等文件。

### Metro

RN 的**开发服务器**，负责打包与 HMR（热更新）。开发时连 Metro，改代码立刻生效。

| 模式 | 含义 |
|------|------|
| **Metro 模式** | 走开发服务器，源码在 `screens/remote/` |
| **OTA 模式** | 走磁盘/服务器上的静态 `.jsbundle` |

### Split Bundle（分包）

把 App 的 JS 拆成多块：

- **主包**：App 启动时就加载的 JS
- **Split 包**：按需加载的业务包（如 order、promo）

业务页单独更新时，不必重新下载整个 App 的 JS。

### Segment（段）/ segmentId

Split bundle 在 Native 侧加载时的**整数编号**。Metro 构建时固定，Native 与 JS 必须一致。

| 业务 | segmentId |
|------|-----------|
| `ota_shared` | 0 |
| `order` | 1 |
| `promo` | 2 |

单一来源：`rn_app/config/feature-segments.json`。

Native 调用：`registerSegmentWithId(segmentId, path)`。

---

## 二、加载链路里的角色

### FeatureHost

Remote 业务页的**加载调度组件**。负责：

- 判断 Metro / OTA 模式
- 下载或读取沙盒缓存
- 调用 Native 加载 split bundle
- 把最终 React 组件渲染到屏幕

### Manifest（清单）

`bundle-server` 返回的 JSON，描述远程 bundle 元数据：feature id、版本号、hash、下载 URL、segmentId 等。

客户端先读 manifest，再决定要不要下载、加载哪个文件。

### SplitBundleLoader

**Native 模块**（iOS TurboModule），负责把磁盘上的 `.jsbundle` 加载进 RN 运行时。

```
JS: SplitBundleLoader.load(path, segmentId)
         ↓
Native: registerSegmentWithId → evaluateJavaScript（eval 整段 bundle）
```

### Remote / Feature

本项目中特指 manifest 驱动的远程业务页，如 `order`（订单）、`promo`（活动）。  
`featureId` 是 manifest 里的业务 key。

---

## 三、JS 侧注册（Re-entry 问题核心）

### registerFeature

Split bundle 执行入口后，把 **featureId → React 组件** 写入内存：

```js
registerFeature('order', OtaOrderScreen, { version: '0.0.7', source: 'ota' })
```

FeatureHost 随后从 registry 取出组件并 `setScreen(component)`。

### Registry / `__RN_FEATURE_REGISTRY__`

当前 JS runtime 里 **featureId → 组件** 的映射表。

**常见问题**：每次进 Remote 页会 `clearFeatureRegistration()` 清空 registry，但磁盘 bundle 和 Native segment 可能仍在 → **文件在、表空了、页面挂**。

### `__OTA_COMPONENT_CACHE__`（component cache）

OTA 专用**组件备份**：首次 `registerFeature` 成功时缓存 component 引用。

Re-entry 时若 registry 被清，通过 `syncOtaRegistrationFromCache()` 从 backup 恢复，而不依赖 entry 模块重跑。

### `executeSplitBundleEntry` / `__r(entryId)`

Metro 产出的 bundle 末尾有入口代码；`__r(123)` 表示按 module id 123 执行入口模块，通常会调用 `registerFeature`。

### isInitialized / module 缓存

RN require 系统对已加载模块有缓存：**同一 module 第二次不会重新执行 factory**。

因此 Bridgeless 下 Native 可能 full eval 整包，但 entry 模块已 initialized → **`registerFeature` 不会再执行** → 必须靠 component cache 恢复。

### clearFeatureRegistration / clearOtaComponentCache

| 操作 | 清什么 | Re-entry 注意 |
|------|--------|---------------|
| `clearFeatureRegistration` | JS registry | 每次进页通常要清 |
| `clearOtaComponentCache` | OTA 组件备份 | **Re-entry 应保留**；版本升级或 Metro↔OTA 全量切换时才清 |

---

## 四、Re-entry（第二次进入）

### Re-entry

同一次 App 运行（同一 JS runtime session）内：

1. 第一次 OTA 进入 Order → 成功  
2. 返回上一页  
3. **再次进入 Order**

文档中大部分 OTA bug 发生在此场景。

### otaReentry

代码标记：`wasOtaFeatureLoadedThisSession(featureId) === true`。  
为 true 时走 re-entry 专用加载顺序（跳过 manifest 网络、load 后立即 sync cache 等）。

### afterMetro

本会话内**先用过 Metro 再切 OTA**。此时 registry/cache 状态更复杂，需 `restoreRegistry = otaReentry || afterMetro`。

### Instant re-entry（秒开）

Live registry 中组件仍在时，跳过 loading 与 Native load，首帧直接渲染。

相关 API：`peekInstantOtaReentry`、`tryInstantOtaReentry`、`warmReentry`。

### syncOtaRegistrationFromCache

Native load 之后立刻执行：从 `__OTA_COMPONENT_CACHE__` 写回 registry。

**Re-entry 四铁律之一**：load 后**马上** sync，不要先等数秒。

### requireRegistration

`executeSplitBundleEntry` 的参数：为 true 时若 entry 未注册则抛错。  
Re-entry 时应为 **false**（entry 已 initialized，强跑会误报未注册）。

---

## 五、Bridgeless / Legacy（RN 架构）

### Legacy Bridge（旧架构）

传统 RN：JS ↔ Native 通过 Bridge。  
常见行为：同一 session 内第二次 `registerSegmentWithId` **可能不 re-eval** segment。

### Bridgeless / New Architecture

RN 0.86 + Fabric，无传统 Bridge（本项目运行模式）。

常见行为：每次 `registerSegment` 往往 **full eval 整包**（日志：`Finished evaluating segment N`）。

**面试要点**：Bridgeless 会 eval，瓶颈在 **registry 被清 + module 缓存阻止 entry 重跑**，不是「Native 完全不 eval」。

### Fabric / TurboModule

新架构下的 UI 渲染（Fabric）与 Native 模块调用（TurboModule）机制。  
`SplitBundleLoader` 在本项目中以 TurboModule + Codegen 暴露给 JS。

---

## 六、Module 图与 unknown module

### Module id

Metro 打包时为每个 JS 模块分配的**数字 id**。Bundle 内引用形如 `_r(745032085)`，而非字符串路径。

### unknown module

运行时 require 某 id，但当前 runtime **未注册该 id**：

```
Requiring unknown module "745032085"
```

| 类型 | 根因层 | 典型场景 |
|------|--------|----------|
| **构建期** | split 引用了模块，但未打进 split/shared/主包 | 冷启动 OTA 首次即崩 |
| **运行期** | segment 未 load 或 registry/module 表不一致 | Re-entry、废弃 fast path |

区分方式：segment eval 成功但**渲染阶段**才崩 → 优先查构建期 module 归属（见 [stories/02](./stories/02-split-module-graph-and-shared-bundle.md)）。

### Module graph（模块图）

构建时模块依赖关系。`build-bundles.js` 决定某依赖归属主包、feature split 还是 shared split。

### split-audit

构建后审计：split 引用的 module id 是否都在已加载 segment 中有定义。  
「外部主包依赖」过多 → 运行时 unknown module 风险高。

### ota_shared（shared bundle）

多 feature 共用的 split（导航、`RemoteScreenShell`、公共组件），segmentId = 0。  
加载顺序：**先 shared，再 order/promo**。

### lazy 主包（DEV）

开发模式下 Metro 主包可能**按需加载**模块，不会预注册 split 期望主包已有的 id → split 不能把共享依赖「排除到主包」就完事。

---

## 七、缓存与版本语义

### Active bundle

沙盒中**当前正在使用**的文件，如 `Documents/rn-bundles/order/0.0.7.jsbundle`。

### Pending bundle

已下载、用户尚未点「立即更新」的新版本，路径通常为 `{version}.pending.jsbundle`，**不覆盖** active。

### Promote（晋升）

Apply 更新时：读 pending 文件 → 写入 active 路径 → 删除 pending。

### Hash / Hash 漂移

Bundle 内容的 SHA256 摘要。  
**版本号相同、hash 不同** = 同版本重新 build 过；仅看 semver 会误判「无需更新」。

### Bootstrap vs Polling

| | Bootstrap | Polling |
|--|-----------|---------|
| **时机** | 进页时 | 页面 ready 后定时 |
| **目的** | 确保有可加载的 bundle | 提示 Banner「发现远程版本」 |
| **典型函数** | `ensureFeatureCached`、`needsUpdate` | `remoteDiffersFromActive`、`useOtaUpdatePoller` |
| **语义** | 进页通常只自动**升级** | 升级与**回滚**都应提示 |

### verifyOtaBundleBody

下载或 promote 前校验 bundle 体积、`registerFeature`、`ota_*` 等关键字，防止无效文件（如 46 字节占位）进入沙盒。

### formatFeatureLoadError

改进后的错误文案：版本一致时标明「缓存正常」并展示 raw 原因，避免把所有 load 失败都说成「未 upload」。

---

## 八、双路径隔离

### ota_ 前缀

Metro 与 OTA 使用不同模块名/文件名，避免注册互相污染：

| 模式 | 示例 |
|------|------|
| Metro | `OrderScreen`，`screens/remote/order/` |
| OTA | `ota_OrderScreen`，`ota_order.*.jsbundle` |

### Registry isolation（注册隔离）

Metro 路径清 Metro 相关 session 标记；OTA 路径清 registry 但 Re-entry 时**保留** component cache；全量模式切换时 `reloadFeatureRuntime()` 清双会话标记。

---

## 九、Re-entry 四铁律（最终方案）

| # | 要做 | 不要做 |
|---|------|--------|
| 1 | **先** `SplitBundleLoader.load()` | ❌ skip native load，只 sync cache |
| 2 | load **后立刻** `syncOtaRegistrationFromCache` | ❌ 先等 3s 再 sync |
| 3 | re-entry **保留** `__OTA_COMPONENT_CACHE__` | ❌ 每次 `clearOtaComponentCache` |
| 4 | re-entry **不** 对 entry 使用 `requireRegistration` | ❌ 强跑 `__r(entry)` 当唯一手段 |

---

## 十、已废弃的中间方案（面试可主动提及）

| 术语 | 做法 | 为何废弃 |
|------|------|----------|
| **Fast path** | 直接渲染 cache 里的 component | module 表缺失 → unknown module |
| **DevSettings.reload()** | 整页 JS runtime 重载 | Native segment 仍在，reload 后更乱 |
| **Full eval** | `reevaluateSplitBundleFromDisk` 整包再 eval | 大包易冲突；不保证 registerFeature |
| **Skip native load** | 只 sync cache，不调 SplitBundleLoader | segment/module 表未就绪 |

最终收敛：**load → sync cache**。

---

## 十一、端到端加载链路

```
用户打开 Order 页
    │
    ▼
FeatureHost
    ├─ Metro → require('screens/remote/order/...')
    │
    └─ OTA
         ├─ manifest（版本 / hash / URL / segmentId）
         ├─ ensureFeatureCached（沙盒 active / pending）
         ├─ [shared] SplitBundleLoader.load(sharedPath, 0)
         ├─ SplitBundleLoader.load(featurePath, segmentId)  ← Native eval
         ├─ registerFeature 或 syncOtaRegistrationFromCache  ← JS registry
         └─ setScreen(component) → 渲染
```

### 两类典型失败

| 现象 | 优先怀疑 |
|------|----------|
| 版本一致，第二次进入失败 / not registered | Re-entry registry 生命周期 → [stories/01](./stories/01-ota-reentry-registry-lifecycle.md) |
| 冷启动或渲染时 unknown module | 构建期 module 归属 → [stories/02](./stories/02-split-module-graph-and-shared-bundle.md) |
| 版本一致，报「远程 bundle 不可用」 | 可能是 load 失败被误包装；或 pending/active 路径问题 → [stories/03](./stories/03-ota-cache-version-semantics.md) |
| NO_RUNTIME / 编译失败 | Native Split Loader → [stories/04](./stories/04-native-split-loader-bridgeless.md) |

---

## 十二、日志速查

| 日志 | 含义 |
|------|------|
| `otaReentry=true` | 本会话第二次 OTA 进入 |
| `afterMetro=true` | Metro 切回 OTA |
| `Finished evaluating segment N` | Bridgeless Native eval 完成 |
| `instant re-entry (live registry)` | 秒开路径命中 |
| `split bundle entry did not register` | entry 已 initialized，应走 sync cache |
| `Requiring unknown module` | module 表不一致或构建归属错误 |
| `[OTA poll] active=X remote=X update=false` | 版本一致，非下载问题 |

---

## 相关文档

- [fixes/README.md](./README.md) — 问题簇索引
- [interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md) — 面试主案例
- [interview/ota-reentry-cheat-sheet.md](../interview/ota-reentry-cheat-sheet.md) — 半页纸速查
- [case-study-remote-ota-metro-isolation.md](../case-study-remote-ota-metro-isolation.md) — Metro/OTA 双路径架构
