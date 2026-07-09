# OTA instant re-entry 后短时间 CPU 飙高

**Date**: 2026-07-09
**Status**: Fixed
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

## 解决方案

1. **Session 级 bundle 校验缓存**（`bundleCache.ts`）：`markBundleUsable` / `clearBundleUsabilityForPath`；`isCachedBundleUsable` 同 path 二次调用跳过 `readFile`（`stat.size` 守卫）
2. **轻量 session probe**（`probeActiveCacheLight` + `ensureFeatureCached`）：`wasOtaFeatureLoadedThisSession` + live registry 时跳过 `reconcile` 全文件校验，直接返回 active cache
3. **Hash 降级**：`activeBundleFileMatchesRemote(..., { trustMetadata: true })` 在 session re-entry 且 metadata 与 remote 一致时跳过 SHA256
4. **Poller 延迟**：instant mount 时 `deferInitialPollMs: 1500`；`refreshPending` 仍立即执行，interval 不变

**关键变更**：
- `rn_app/src/features/bundleCache.ts` — session usability cache、`probeActiveCacheLight`
- `rn_app/src/features/bundleUpdater.ts` — early light path in `ensureFeatureCached`
- `rn_app/src/features/otaUpdatePoller.ts` — `deferInitialPollMs`
- `rn_app/src/features/useFeatureHost.ts` — instant mount 传 defer + full reload 清 cache

## 验证方式

- [x] `npm test` — 40 passed（`bundleCacheSessionUsability`、`ensureFeatureCachedLightPath`、`otaUpdatePollerDefer`）
- [ ] Instruments：instant 后 1s 内 `readFile` 占比下降
- [ ] 手动：OTA → 返回 → 再进；instant 日志后约 1.5s 才有 `[OTA poll]`，无 `[SplitBundleLoader] load`

## 后续建议（可选）

- **P4 导航保活**：session 级缓存 `NavigationContainer`（收益小于读盘优化）

## 相关文档

- `docs/fixes/2026-07-09-ota-instant-reentry-white-screen.md` — 白屏 / 误 reload（已修复）
- `docs/interview/ota-reentry-cheat-sheet.md` — re-entry 四铁律
- `docs/fixes/2026-07-09-ota-dev-session-fixes-summary.md` — session 修复总览
