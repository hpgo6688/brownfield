# 故事 2：Split 模块图 — unknown module 与 Shared Bundle

> 与 [故事 1](./01-ota-reentry-registry-lifecycle.md) 症状重叠（都报 `unknown module`），但**根因在构建期 module 归属**，不是 registry 生命周期。

---

## 用户看到什么

| 场景 | 报错 | 堆栈 |
|------|------|------|
| 冷启动直接 OTA（无 Metro） | `Requiring unknown module "745032085"` | `seg-1.js` 渲染阶段 |
| 立即更新 / reload 后 | `unknown module "517556614"` | `remoteStackScreenOptions of undefined` |
| | `unknown module "103560400"` | `OrderListScreen` 渲染失败 |
| OTA order bundle 过小 | ~5KB，缺 OrderNavigator | build 后 audit 即发现 |

**易误判**：以为是本地 `.jsbundle` 被删 — 实际 segment **能 eval**，是**渲染时** require 不到 module id。

---

## 根因：构建期 vs 运行期契约

Metro split bundle 规则：**bundle 内引用的每个 numeric module id 必须在同一 segment 或主包中已定义**。

本项目 DEV 主包 `lazy=true`，主包未必预加载 split 依赖的共享模块 → split 若把共享依赖「排除到主包」，运行时就炸。

### 阶段 1：order 导航未纳入 split（~5KB bundle）

`build-bundles.js` 的 `isFeatureOwnedBySplit()` 只收录 `bundles/ota_*`，未包含 `screens/remote/order/` 与 React Navigation → split 引用但不定义导航 module id。

**修复**：扩展 split 归属路径（order 导航 + `@react-navigation` + `react-native-screens`）。  
→ 记录：[2026-07-09-ota-order-split-missing-navigation.md](../2026-07-09-ota-order-split-missing-navigation.md)

### 阶段 2：过度排除 → `745032085`（~280KB → 仍崩）

旧策略：凡在主包 graph 的模块**一律从 split 排除**。

- `745032085` = `use-latest-callback`（React Navigation 依赖）
- split 运行时 `_r(745032085)` 期望主包已注册，Metro lazy 主包未加载 → 渲染崩溃

**修复**：

1. **新排除策略**：只排除 react/rn/metro core +「主包独有、split 不需要」；split graph 共享依赖**打进 split**
2. **build audit**：`[split-audit]` 外部主包依赖从 ~30 降至 ~12
3. **DEV preload**：`otaSplitHostPreload.ts` warm 关键模块（兼容旧 bundle）
4. **同版本 hash 漂移**：pending 已下载但未 promote → `ensureFeatureCached` 比对磁盘 hash

→ 记录：[2026-07-09-ota-split-shared-deps-unknown-module.md](../2026-07-09-ota-split-shared-deps-unknown-module.md)

| | 修复前 | 修复后 |
|--|--------|--------|
| `745032085` 在 split 内 | ❌ | ✅ |
| order split 体积 | ~280KB | ~2MB |
| 外部主包依赖 | 30 | 12 |

### 阶段 3：每 feature 重复 2MB → Shared Bundle

把 navigation 打进每个 feature 后，order/promo 各 ~2MB，弱网成本高。

**方案**：引入 **`ota_shared.<version>.ios.jsbundle`（segment 0）**

- Shared：navigation + `RemoteScreenShell` + 共享 remote 组件
- Feature split：仅 `bundles/ota_*` + `screens/remote/{order,promo}/`
- Client：先 load shared，再 load feature

| Artifact | Before | After (0.0.7) |
|----------|--------|---------------|
| `ota_shared` | — | 2.25 MB |
| `ota_order` | ~2 MB | 1.32 MB |
| `ota_promo` | ~2 MB | 1.48 MB |

→ 记录：[2026-07-09-ota-shared-deps-bundle-split.md](../2026-07-09-ota-shared-deps-bundle-split.md)

### 阶段 4：shared 未 warm 导航模块（0.0.8–0.0.11 缺陷）

`screens/remote/navigation/*` 标为 shared-owned，但 `ota_shared/index.js` 未 import → split-audit 标 **main-only**。Metro 首次可能碰巧；reload 后 id 消失。

**修复**：

- `ota_shared/index.js` warm navigation + components
- `otaUpdatePoller` reload 前 `ensureSharedBundleCached`
- 修复版本 **0.0.12+**

→ 记录：[2026-07-09-ota-apply-update-unknown-module.md](../2026-07-09-ota-apply-update-unknown-module.md)

---

## 与 Re-entry 问题的区分（面试必答）

| 维度 | 故事 1（Re-entry） | 故事 2（Module Graph） |
|------|-------------------|------------------------|
| 触发 | 同 session **第二次**进入 | 常**首次**冷启动 OTA 即崩 |
| 根因层 | JS registry / module 缓存 | **构建期** module 归属 |
| 版本一致 | 是，文件在磁盘 | 是，文件在磁盘 |
| 修复位置 | `bundleLoader` / `registerFeature` | `build-bundles.js` / shared index |
| 发布动作 | 通常不需 rebundle | **必须 rebuild + upload** |

日志技巧：若 `Finished evaluating segment` 成功但渲染报 `unknown module` → 优先查 **split-audit / module id 归属**。

---

## 最终 checklist（发版 / 排查）

1. `npm run build:bundles:dev` → 看 `[split-audit]`，main-only 仅 react core
2. 三件套 upload：`shared` + `order` + `promo` 同版本
3. Metro `--reset-cache` 后必须 rebuild + upload（主包 module id 会变）
4. DEV 可选 `USE_METRO_BUNDLES=true` 避免静态 split 与 Metro 漂移
5. 缺陷版本 **0.0.8–0.0.11**；修复 **0.0.12+**

---

## STAR 口述（45 秒）

- **S**：冷启动 OTA 进 Order 直接崩 `unknown module 745032085`，segment eval 日志正常。
- **T**：split bundle 在 DEV lazy 主包 + OTA 静态包混用下自洽。
- **A**：对比 split-audit 与 Metro graph → 修正排除策略 → 引入 shared segment → warm shared 入口模块。
- **R**：split-audit 通过；order 从 5KB 无效包到可运行多级导航；shared 拆分后单 feature 体积降 ~35%。

---

## 细粒度记录

- [2026-07-09-ota-order-split-missing-navigation.md](../2026-07-09-ota-order-split-missing-navigation.md)
- [2026-07-09-ota-split-shared-deps-unknown-module.md](../2026-07-09-ota-split-shared-deps-unknown-module.md)
- [2026-07-09-ota-shared-deps-bundle-split.md](../2026-07-09-ota-shared-deps-bundle-split.md)
- [2026-07-09-ota-apply-update-unknown-module.md](../2026-07-09-ota-apply-update-unknown-module.md)
