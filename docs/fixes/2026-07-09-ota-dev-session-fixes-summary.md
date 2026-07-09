# OTA 开发态会话修复总览（冷启动 / 二次进入 / Metro 切换）

**Date**: 2026-07-09  
**Status**: Fixed  
**Scope**: iOS bridgeless OTA、`FeatureHost`、split bundle 构建与缓存、bundle-server 发布  
**Release**: `order` / `promo` **v0.0.7** 已 upload（含新 split 构建策略）

> 细分记录见文末「相关文档」。面试口述见 [docs/interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md)。

---

## 问题簇一览

本次调试实际包含 **三个独立根因**，症状相似（白屏 / `unknown module` / 加载失败），需按日志区分：

| # | 症状 | 典型日志 | 根因 |
|---|------|----------|------|
| A | OTA 二次进入或 Metro→OTA 失败 | `otaReentry=false`，无 `syncFromCache`；或 `instant re-entry` 后 Metro 再 OTA 白屏 | bridgeless 下 segment 会 re-eval，但 `registerFeature` 不重跑；Metro 清了 cache/registry |
| B | 冷启动首次 OTA 崩溃 | `Requiring unknown module "745032085"`，`seg-1.js` 渲染阶段 | 旧 split 把 `use-latest-callback` 排除在主包，Metro lazy 主包未注册该 module id |
| C | 已 download 仍用旧包 | `staged pending order@0.0.6`，path 仍指向旧 `0.0.6.jsbundle` | 同版本 hash 漂移：`needsUpdate()` 跳过；metadata 与磁盘/服务端不一致 |

**易误判**：版本号 UI 显示 v0.0.6 / v0.0.6 一致，不代表 bundle 字节相同；**不是**「本地文件被删」。

---

## A. OTA 二次进入 & Metro ↔ OTA 切换

### 现象

- OTA → OTA 二次：曾出现 `unknown module` 或「远程 bundle 不可用」
- Metro → OTA：日志 `afterMetro=false`，`otaReentry=false`，registry 未从 cache 恢复

### 根因

1. `clearOtaComponentCache()` 在 Metro 入口销毁 `__OTA_COMPONENT_CACHE__`
2. `tryInstantOtaReentry` cache-only 分支跳过 native load，registry 空时无法恢复
3. bridgeless：`registerSegment` **总会** re-eval segment；`registerFeature` **不会**因 entry `isInitialized` 重跑

### 方案

- Metro 只清 registration，**保留** OTA component cache
- 新增 `__METRO_LOADED_THIS_SESSION__` → `afterMetro` + `restoreRegistry = otaReentry || afterMetro`
- segment eval 后立即 `syncFromCache`；`requireRegistration=false`
- `tryInstantOtaReentry` 仅 **live OTA registry**（且未经 Metro）；禁止 cache-only instant

### 关键文件

- `otaSessionLoad.ts` — OTA/Metro 会话标记
- `useFeatureHost.ts` — Metro 路径不再 `clearOtaComponentCache`
- `bundleLoader.ts` — `afterMetro` / `restoreRegistry`
- `otaFeatureReuse.ts` — 收紧 instant 条件
- `featureReload.ts` — reload 清空双会话标记

---

## B. 冷启动 unknown module `745032085`

### 现象

重新 build 原生后，**未经 Metro Remote**，直接 OTA 首次进入即崩溃。

### 根因

1. module `745032085` = `use-latest-callback/esm.mjs`，React Navigation 依赖
2. 旧 `build-bundles.js`：凡在主包 graph 的模块一律从 split **排除**
3. split 运行时 `_r(745032085)` 期望主包已注册；DEV Metro `lazy=true` 主包未必加载
4. segment eval 成功，**渲染** OrderNavigator 时才报错

### 方案

1. **split 排除策略**：只排除 react/rn/metro core +「主包独有、split 不需要」的模块；split graph 共享依赖**打进 split**
2. **build audit**：`[split-audit]` 外部主包依赖从 ~30 降至 ~12（仅 react core）
3. **DEV preload**：`otaSplitHostPreload.ts` + `index.js` 启动时 warm（兼容旧 bundle）
4. **发布**：必须 `build:bundles` + **upload**；仅本地 dist 不够

### 关键文件

- `scripts/build-bundles.js` — `collectSplitModulePaths`、新 `shouldExcludeFromSplitModule`
- `otaSplitHostPreload.ts` — `use-latest-callback/esm.mjs` 等
- `bundleLoader.ts` — load 前 preload
- `bundleUpdater.ts` — `unknown module` 友好文案

### 构建对比（order split）

| | 修复前 | 修复后 |
|--|--------|--------|
| `745032085` 在 split 内 | ❌ | ✅ |
| 体积 | ~280KB | ~2MB |
| 外部主包依赖 | 30 | 12 |

---

## C. 同版本 hash 漂移 & 缓存 bootstrap

### 现象

`[OTA] staged pending order@0.0.6 (pre-entry download)` 后仍加载旧 `Documents/.../0.0.6.jsbundle`。

### 根因

1. `needsUpdate()` 同 semver 返回 `false`（hash-only 变更交给 poll/pending）
2. pending 已下载但未 **promote → active**，首屏仍用旧 active
3. 服务端曾长期是旧 hash（282KB），与本地 metadata 一致 → 不会触发更新

### 方案

- `ensureFeatureCached`：比对 **磁盘文件 hash** 与 manifest（不只 metadata）
- active 文件或 metadata 与 remote 不一致 → 立即 `applyPendingFeature` 或 `checkAndUpdateFeature`
- 发布流程：`upload-bundle.sh`；版本 bump（**0.0.7**）强制客户端拉新

### 关键文件

- `bundleUpdater.ts` — `hashBundleFileAtPath`、`activeBundleFileMatchesRemote`、bootstrap apply pending

---

## 杂项修复

| 问题 | 修复 |
|------|------|
| `useOtaUpdatePoller doesn't exist` | 恢复 `useFeatureHost.ts` 中误删的 import |
| `otaSplitHostPreload` 动态 `require()` | 改静态 require，避免 Metro bundle build 失败 |

---

## 发布记录（2026-07-09）

```bash
# 构建
cd rn_app && npm run build:bundles:dev   # package.json → 0.0.7

# 上传
cd bundle-server
./scripts/upload-bundle.sh order 0.0.7 dist/bundles/ota_order.0.0.7.ios.jsbundle
./scripts/upload-bundle.sh promo 0.0.7 dist/bundles/ota_promo.0.0.7.ios.jsbundle
```

| Feature | Version | Hash (prefix) |
|---------|---------|---------------|
| order | 0.0.7 | `sha256:0cbd8ee5…` |
| promo | 0.0.7 | `sha256:72c1f83d…` |

---

## 验证清单

### 自动化

- [x] `npm test` — 29 passed
- [x] `npm run verify:ota-scope`
- [x] `npm run build:bundles:dev` — split-audit 通过

### 手动（建议顺序）

1. **冷启动 OTA**：Reload Metro → 直接进 OTA Order → 下载/应用 v0.0.7 → 页面正常
2. **OTA → OTA 二次**：返回再进 → 可有 `instant re-entry (live registry)`
3. **Metro → OTA**：切 Metro Remote → 再 OTA → 日志 `afterMetro=true`，页面正常
4. **全路径**：Metro → OTA → OTA 二次 → Metro → OTA

### 仍失败时

- 模拟器 Delete App 重装（清 `Documents/rn-bundles/`）
- 确认 manifest hash 与 [build-manifest.json](../../bundle-server/dist/bundles/build-manifest.json) 一致
- DEV 可选：`USE_METRO_BUNDLES=true` 避免静态 split 与 Metro 漂移

---

## 后续建议

- `LeakChecker` Surface 泄漏（反复 mount）单独排查
- 每次 `Metro --reset-cache` 或改 split 归属后：**rebuild + upload**
- 面试材料以 [ota-reentry-case-study.md](../interview/ota-reentry-case-study.md) 为准；本总览供工程落地检索

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [ota-metro-switch-registry-restore.md](./2026-07-09-ota-metro-switch-registry-restore.md) | 问题簇 A |
| [ota-split-shared-deps-unknown-module.md](./2026-07-09-ota-split-shared-deps-unknown-module.md) | 问题簇 B + C 补充 |
| [ota-second-entry-load-register-fix.md](./2026-07-09-ota-second-entry-load-register-fix.md) | 早期 re-entry register 修复 |
| [ota-second-entry-load-failure-analysis.md](./2026-07-09-ota-second-entry-load-failure-analysis.md) | 排查笔记（部分已 superseded） |
| [ota-fast-path-unknown-module.md](./2026-07-09-ota-fast-path-unknown-module.md) | 已废弃 fast path 方案 |
