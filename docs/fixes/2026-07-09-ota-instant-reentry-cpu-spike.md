# OTA instant re-entry 后短时间 CPU 飙高

**Date**: 2026-07-09
**Status**: Documented（待优化）
**Scope**: rn_app OTA — `bundleCache`、`bundleUpdater`、`otaUpdatePoller`、`useFeatureHost`

## 问题描述

- **现象**：日志出现 `[OTA] instant re-entry feature=order (live registry)` 后，短时间内 CPU 占用明显升高（数百毫秒～数秒），页面虽已展示但设备发热或卡顿感明显
- **触发条件**：同 JS runtime session 内 OTA 首次进入 Order 成功 → 原生返回 → 再次进入；版本未变时仍会出现
- **影响范围**：所有走 instant 快路径的 Remote OTA 功能；与 bundle 体积正相关（当前 order split ~2MB 时最明显）

## 背景：instant 已修复项（勿混淆）

白屏/误 reload 问题已在 `2026-07-09-ota-instant-reentry-white-screen.md` 中修复：

- `warmReentry` 顺序修正，版本未变时不再背景 `SplitBundleLoader.load`
- `peekInstantOtaReentry` 首帧同步渲染
- 背景 refresh 仅在 `updateResult.updated === true` 时 load

**本次 CPU 问题发生在上述修复之后**：instant 主路径已不再 eval segment，但并行后台任务仍重。

## 根因分析

### 1. 主因：`isCachedBundleUsable` 整文件读入 JS（×3～5 并行）

`isCachedBundleUsable` 每次调用都会 `RNFS.readFile(path, 'utf8')` 读取完整 bundle，再在 JS 侧做 `registerFeature` / `__r()` 正则校验：

```173:205:rn_app/src/features/bundleCache.ts
export async function isCachedBundleUsable(...) {
  ...
  const code = await RNFS.readFile(path, 'utf8');
  return validateOtaBundleContent(featureId, code);
}
```

instant 成功后，以下路径**几乎同时**触发，且互不短路：

| 调用链 | 触发时机 | 读盘次数（典型） |
|--------|----------|------------------|
| `refreshOtaEntryInBackground` → `ensureFeatureCached` → `reconcileActiveBundleCache` → `clearUnusableActiveMetadata` | instant 后 `useEffect` 背景任务 | active 1 + pending 1 |
| `ensureFeatureCached` session 快路径 | 同上 | active 再 1 |
| `useOtaUpdatePoller` → `runPollCycle` → `checkRemoteFeature` | `screenReady=true` 后立即 | active 再 1 |
| `getPendingUpdate` | poller 同轮 | pending 可能再 1 |

同 session 二次进入、版本未变时：**2MB × 3～5 次 utf8 读盘 + 大字符串校验**，在 Hermes 主线程上叠加，构成 CPU 峰值主因。

若走非 session 快路径或 hash 漂移校验，还会触发 `hashBundleFileAtPath`（再读一遍 + SHA256）：

```213:219:rn_app/src/features/bundleUpdater.ts
const body = await RNFS.readFile(normalizeLocalPath(localPath), 'utf8');
return sha256(body);
```

### 2. 次因：Poller 与 UI 挂载同帧启动

`peekInstantOtaReentry` 使 `screenReady` 首帧即为 `true`，`useOtaUpdatePoller` 的 `enabled` 立刻成立：

```165:175:rn_app/src/features/otaUpdatePoller.ts
refreshPending().catch(() => {});
runPollCycle().catch(() => {});  // 立即 manifest forceRefresh + checkRemoteFeature
```

`runPollCycle` 会：

- `fetchManifest({ forceRefresh: true })` — 网络 + JSON 解析
- `checkRemoteFeature` — 再次 `isCachedBundleUsable(active)`
- `getPendingUpdate` — 可能对 pending 再 `isCachedBundleUsable`

与 `refreshOtaEntryInBackground` 的 `ensureFeatureCached` **并行**，放大读盘次数。

### 3. 次因：React 导航树冷启动

instant 复用的是**组件类型引用**，不是上次的 React 子树。每次进入仍新建：

- `RemoteScreenShell`（白底 `#FFFFFF`）
- `NavigationContainer` + `createNativeStackNavigator`
- `react-native-screens` native stack layout

首帧 native layout 有固定 CPU 成本，通常短于读 bundle，但叠在峰值时间段内。

### 4. 非主因（可排除）

| 现象 | 结论 |
|------|------|
| 日志有 `[SplitBundleLoader] load` 且无 `warm re-entry skip` | 属 segment reload，不是本次 instant CPU 问题（白屏修复后版本未变应不出现） |
| bundle 2MB 体积本身 | 体积决定**单次读盘成本**；instant 后问题是**重复读**，不是单次 load |
| Metro / 首次 OTA 进入 | 不走 instant 路径，CPU 模型不同 |

## 时间线（instant 日志之后）

```
[OTA] instant re-entry feature=order (live registry)
    │
    ├─ T+0ms   peekInstantOtaReentry → 首帧渲染 OrderScreen
    │          └─ NavigationContainer / native screens 开始 mount
    │
    ├─ T+0ms   screenReady=true → useOtaUpdatePoller enabled
    │          ├─ refreshPending() → getPendingUpdate → isCachedBundleUsable?
    │          └─ runPollCycle() → checkRemoteFeature → isCachedBundleUsable
    │
    ├─ T+0ms   useEffect loadFeature → refreshOtaEntryInBackground
    │          └─ ensureFeatureCached → reconcile + isCachedBundleUsable ×N
    │
    └─ T+?ms   多路 readFile(2MB) 完成 → CPU 回落
```

## 日志对照

| 日志 | 含义 |
|------|------|
| `[OTA] instant re-entry ... (live registry)` | 主路径跳过 segment eval ✓ |
| `[SplitBundleLoader] warm re-entry skip native load` | 背景 load 也被跳过 ✓ |
| `[OTA poll] order active=… remote=… update=false` | poller 与读盘校验同时发生 |
| **无** `[SplitBundleLoader] load` | 排除 segment reload 导致 CPU |

## 计划优化（待实施）

按收益 / 风险排序：

### P0 — Session 级 bundle 校验缓存

- 在 `bundleCache` 维护 `Map<normalizedPath, { size, mtime?, validatedAt }>` 或 session Set
- 本 session 内同 path 已通过 `isCachedBundleUsable` → 直接返回 true（或仅 `stat` 比对 size）
- `wasOtaFeatureLoadedThisSession(featureId)` 为 true 时，对 active path 信任 metadata，跳过全文件 read

### P1 — instant re-entry 延迟 poller 首轮

- `useOtaUpdatePoller` 增加 `deferInitialPollMs`（如 1500～2000ms）或在 `useFeatureHost` instant 分支传入 `pollDeferred`
- 首屏 mount 完成后再 `runPollCycle`；interval 轮询不变
- 降低与 `ensureFeatureCached` 的并行读盘

### P2 — instant 时精简 `ensureFeatureCached`

- session re-entry + live registry 场景：`refreshOtaEntryInBackground` 跳过 `reconcileActiveBundleCache` 中的 `clearUnusableActiveMetadata`（全文件校验）
- 或拆出 `ensureFeatureCachedLight`：只读 metadata + `exists` + `stat.size`，不 `readFile`

### P3 — hash 校验降级

- `activeBundleFileMatchesRemote` 在 session re-entry 时信任 metadata hash，不全量 SHA256
- 完整 hash 仅在 download / apply pending / bootstrap 时执行

### P4 — 导航保活（体验项，CPU 收益较小）

- session 级缓存 `NavigationContainer` 子树，减少 `react-native-screens` 冷启动

## 验证方式（优化后）

- [ ] Instruments Time Profiler：instant 后 1s 内 JS 线程 `readFile` / 大字符串处理占比应显著下降
- [ ] 日志：instant 后仍有 `[OTA poll]`，但无重复 `[SplitBundleLoader] load`
- [ ] 手动：OTA → 返回 → 再进 Order，体感无卡顿、CPU 峰值缩短
- [ ] `npm test` — 新增 session 缓存短路用例

## 相关文档

- `docs/fixes/2026-07-09-ota-instant-reentry-white-screen.md` — 白屏 / 误 reload（已修复）
- `docs/interview/ota-reentry-cheat-sheet.md` — re-entry 四铁律
- `docs/fixes/2026-07-09-ota-dev-session-fixes-summary.md` — session 修复总览
