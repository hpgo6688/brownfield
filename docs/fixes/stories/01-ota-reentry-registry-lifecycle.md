# 故事 1：OTA 二次进入 — Registry 与 Segment 生命周期

> **面试完整版**：[ota-reentry-case-study.md](../../interview/ota-reentry-case-study.md) · **速查**：[ota-reentry-cheat-sheet.md](../../interview/ota-reentry-cheat-sheet.md)

**项目背景**：Brownfield App，Remote 页同时支持 DEBUG 下 Metro 热更新与 OTA split bundle 发版。

---

## 用户看到什么（症状簇）

同一根因，不同表现：

| 症状 | 典型报错 | 容易误判为 |
|------|----------|------------|
| 第二次 OTA 进入崩溃 | `Requiring unknown module "745032085"` | bundle 被删 / 未 upload |
| 第二次 OTA 进入失败 | `split bundle entry did not register feature "order"` | 同上 |
| 版本一致仍报错 | 「远程 bundle 不可用（服务端 ota_order 可能已删除或未 upload）」 | 服务端问题 |
| 第二次 loading 很长 | 转圈 2–3 秒 | 又在下载 bundle |
| Metro → OTA 再进挂 | 同上 | Metro 污染（部分相关） |

**关键判断**：版本号 UI 显示一致时，沙盒文件和 metadata 通常正常，失败在 **load / register / render** 阶段。

---

## 根因（面试讲清三层）

### 1. 三个状态源不同步

| 状态 | 离开 Remote 页后 | 第二次进入时 |
|------|------------------|--------------|
| 磁盘 bundle + metadata | 保留 | 仍可用 |
| JS `__RN_FEATURE_REGISTRY__` | 常被 `clearFeatureRegistration` 清掉 | 空 |
| Native segment / Metro module 表 | Bridgeless 下 segment 可 re-eval；entry 模块 **`isInitialized` 不重跑 factory** | `registerFeature` 不会自动再执行 |

**结论**：磁盘有 bundle ≠ 页面能渲染。必须显式恢复 registry 或重跑入口。

### 2. Legacy vs Bridgeless 差异

| 架构 | `registerSegmentWithId` 第二次调用 |
|------|-----------------------------------|
| Legacy + RAM registry | 常不 re-eval，只登记 path |
| **Bridgeless（本项目）** | `ReactInstance::registerSegment` **每次 full eval 整包** |

真正瓶颈：**eval 了但 entry factory 因 module 缓存不会重跑 `registerFeature`**，不是「native 完全不 eval」。

### 3. 错误文案误导排查

`formatRemoteBundleError` 曾把所有 load 错误包成「未 upload」。版本一致时仍显示该句 → 浪费大量时间。  
**最终**：`formatFeatureLoadError` — 版本一致时标明「缓存正常」并展示 raw cause。

---

## 演进时间线（同一问题的多次修改）

```
07-08  registerFeature 未执行
         └─ executeSplitBundleEntry：native load 后显式 __r(entryId)
07-08  Metro/OTA 切换 registry 丢失
         └─ __OTA_COMPONENT_CACHE__ + syncOtaRegistrationFromCache
07-09  第二次进入仍失败 + 错误文案误导
         └─ formatFeatureLoadError；re-entry 专用 load 顺序
07-09  ❌ fast path 直接渲染 cache → unknown module（废弃）
07-09  ❌ DevSettings.reload / 整包 eval（废弃）
07-09  Metro 切回 OTA 白屏
         └─ 保留 component cache；afterMetro + restoreRegistry
07-09  instant re-entry 白屏 / CPU 飙高
         └─ peekInstantOtaReentry；warmReentry 顺序；session 读盘缓存
```

---

## 试过但废弃的方案（面试加分）

| 方案 | 动机 | 为何放弃 |
|------|------|----------|
| Fast path：直接渲染 `__OTA_COMPONENT_CACHE__` | 去掉重复 loading | module id 不在 require 表 → `unknown module` |
| Re-entry `DevSettings.reload()` | 清空 JS module 表 | reload 后 native segment 仍在 → 映射更乱 |
| `reevaluateSplitBundleFromDisk` 整包 eval | 强制重跑 entry | 大 bundle 易冲突；eval 成功也不保证 registerFeature |
| Re-entry 跳过 native load，只 sync cache | 提速 | segment / module 表未经过 native load → 渲染仍崩 |
| Re-entry 先等 3s 再 sync | 等 bridgeless async eval | eval 不会触发 registerFeature，白等 |

---

## 最终方案

### Re-entry 四铁律

1. **必须** `SplitBundleLoader.load()`（不可 skip native load）
2. load **后立刻** `syncOtaRegistrationFromCache`（不要先傻等 3s）
3. re-entry **保留** `__OTA_COMPONENT_CACHE__`（不 `clearOtaComponentCache`）
4. re-entry **不** 对 `executeSplitBundleEntry` 使用 `requireRegistration`

### 加载顺序（简化）

```
ensureFeatureCached（re-entry 跳过 manifest 网络）
  → loadFeatureBundle(ensureSegment)
  → clearFeatureRegistration（保留 OTA component cache）
  → SplitBundleLoader.load()（native segment eval）
  → syncOtaRegistrationFromCache（re-entry 立即）
  → [首次] wait ≤1s → executeSplitBundleEntry
  → setScreen(component)
```

### Metro ↔ OTA 切换

- Metro 路径：只清 JS registration，**保留** `__OTA_COMPONENT_CACHE__`
- `afterMetro` 标记 → `restoreRegistry = otaReentry || afterMetro`
- 模式切换：`reloadFeatureRuntime()` 清双会话标记 + OTA cache

### Instant 快路径（体验层）

- `peekInstantOtaReentry`：live registry 存在时首帧直接渲染
- `warmReentry` 在清 registry **之前**判断，避免误触发 2MB segment eval
- CPU 优化：session 级 bundle 校验缓存 + poller defer 1.5s

---

## 关键文件

| 文件 | 职责 |
|------|------|
| `useFeatureHost.ts` | Metro/OTA 双路径、错误展示、instant 首帧 |
| `bundleLoader.ts` | split load + re-entry 顺序 |
| `splitBundleEntry.ts` | 解析 bundle 末尾 `__r(entryId)` |
| `registerFeature.ts` | registry + `__OTA_COMPONENT_CACHE__` + sync |
| `otaSessionLoad.ts` | `wasOtaFeatureLoadedThisSession` / Metro 会话 |
| `otaFeatureReuse.ts` | instant / warmReentry |
| `bundleUpdater.ts` | `formatFeatureLoadError`、下载完整性 |
| `SplitBundleLoader.mm` | native `registerSegmentWithId` |

---

## STAR 口述（60–90 秒）

- **S**：OTA Order 第一次 OK，返回再进崩溃或 loading 3s；报错像没 upload，版本却一致。
- **T**：同版本 re-entry 稳定、尽量快、能准确定位失败阶段。
- **A**：拆链路打日志 → 改错误文案证伪 upload 假设 → 否定 fast path / reload / full eval → 落地 load→sync cache + ota_ 双路径隔离。
- **R**：Metro→OTA 多次进出稳定；第二次 loading 从 ~3s 降到接近首次；错误页区分缓存正常 vs 真下载失败。

---

## 细粒度记录

| 文档 | 内容 |
|------|------|
| [2026-07-08-ota-register-feature-not-called.md](../2026-07-08-ota-register-feature-not-called.md) | executeSplitBundleEntry |
| [2026-07-08-ota-mode-switch-registration-lost.md](../2026-07-08-ota-mode-switch-registration-lost.md) | component cache |
| [2026-07-09-ota-second-entry-load-register-fix.md](../2026-07-09-ota-second-entry-load-register-fix.md) | 最终 fix 摘要 |
| [2026-07-09-ota-metro-switch-registry-restore.md](../2026-07-09-ota-metro-switch-registry-restore.md) | Metro 切换 |
| [2026-07-09-ota-instant-reentry-white-screen.md](../2026-07-09-ota-instant-reentry-white-screen.md) | 白屏 |
| [2026-07-09-ota-instant-reentry-cpu-spike.md](../2026-07-09-ota-instant-reentry-cpu-spike.md) | CPU |
| [2026-07-09-ota-dev-session-fixes-summary.md](../2026-07-09-ota-dev-session-fixes-summary.md) | 工程总览 |

**归档（中间方案）**：见 [archive/](../archive/)
