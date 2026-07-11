# 故事 4：Native Split Loader — RN 0.86 Bridgeless 从零打通

> 这是 OTA split bundle 的**基础设施层**。没有这一层，后面所有 JS 侧 registry / cache 修复都无从谈起。

---

## 用户看到什么

| 阶段 | 现象 |
|------|------|
| 编译期 | `brownfield package:ios` 失败：`executeApplicationScript` selector 不存在 |
| 运行期 | `React Native runtime is not ready` / `NO_RUNTIME` |
| 运行期 | `Split bundle loading is unavailable` / `NO_LOADER` |
| 运行期 | `-[SplitBundleLoader bridge]: unrecognized selector`（TurboModule crash） |
| 运行期 | segment 加载后 JS 仍报组件未注册（promise 过早 resolve） |

---

## 演进时间线

### 1. RN 0.86 编译适配

RN 0.86 + `RCT_REMOVE_LEGACY_ARCH=1` 移除 Legacy Bridge 的 `executeApplicationScript`。

**修复**：改走 Bridgeless — `RCTBridgeProxy` + `jsi::Runtime::evaluateJavaScript`。

→ [2026-07-08-split-bundle-loader-rn086-build.md](../2026-07-08-split-bundle-loader-rn086-build.md)

### 2. Segment 契约（registerSegmentWithId + segmentId）

**错误做法**：`executeApplicationScript` 当主入口跑 — 不是 incremental segment。  
**错误做法**：native 用 `[path hash]` 当 segment id — 与 Metro `requireAsync(id)` 不一致。

**修复**：

- Native 统一 `registerSegmentWithId:path:`
- JS 传入 segmentId；单一来源 `feature-segments.json`（order=1, promo=2, shared=0）
- Manifest / build-manifest 同步 segmentId

→ [2026-07-08-split-bundle-segment-contract.md](../2026-07-08-split-bundle-segment-contract.md)

### 3. Runtime 检测与 Promise 时序

**根因 A**：`RCTBridgeProxy` 继承 `NSProxy`，`isKindOfClass` 失败 → runtime null。  
**根因 B**：`resolve(nil)` 在 `evaluateJavaScript` 完成前调用 → JS 侧 `registerFeature` 尚未执行。

**修复**：

- 从 bridge 捕获 runtime；`dispatchToJSThread` 同步 eval 后再 resolve
- JS：OTA 模式优先 native `SplitBundleLoader.load`，再 Metro fallback

→ [2026-07-08-ota-runtime-not-ready.md](../2026-07-08-ota-runtime-not-ready.md)

### 4. TurboModule + NSProxy 踩坑

| 问题 | 原因 | 修复 |
|------|------|------|
| `bridge` unrecognized selector | 移除 `@synthesize bridge` | 恢复 `__weak RCTBridge *_bridge` |
| `NO_LOADER` | `respondsToSelector:` 对 NSProxy 返回 NO | 直接调用 proxy 上的 `registerSegmentWithId:` |
| Legacy 路径 | 仍用错误 API | Legacy 也用 `registerSegmentWithId` |

最终：Codegen `NativeSplitBundleLoader.ts` + TurboModule JSI。

→ 详见 [2026-07-08-split-bundle-segment-contract.md](../2026-07-08-split-bundle-segment-contract.md) Follow-up 章节

---

## 架构图（面试白板）

```
JS bundleLoader.load(path, segmentId)
    │
    ▼
NativeSplitBundleLoader (TurboModule)
    │
    ├─ Bridgeless: RCTBridgeProxy.registerSegmentWithId(id, path)
    │       └─ ReactInstance::registerSegment → full eval segment
    │
    └─ Legacy (#ifndef RCT_REMOVE_LEGACY_ARCH):
            RCTCxxBridge.registerSegmentWithId(id, path)

segmentId ← feature-segments.json ← build-bundles.js ← manifest
```

---

## 与 JS 层问题的边界

| 现象 | 先看 Native（本故事） | 再看 JS（故事 1/2） |
|------|----------------------|---------------------|
| NO_RUNTIME / NO_LOADER | ✅ | |
| compile 失败 | ✅ | |
| segment eval 日志有，但 not registered | promise 时序 / segmentId | registry / executeSplitBundleEntry |
| unknown module | segmentId 错可能 | module graph / re-entry |

---

## STAR 口述（30 秒）

- **S**：RN 0.86 New Architecture 下 OTA split bundle 编译不过，跑起来报 runtime not ready。
- **T**：Brownfield 宿主能动态加载 Metro 构建的 segment bundle。
- **A**：Legacy API 不可用 → Bridgeless eval；修正 segmentId 契约；修 NSProxy / TurboModule 调用链；promise 等 eval 完成再 resolve。
- **R**：`brownfield:package:ios:debug` 通过；OTA toggle 后 Order/Promo 可加载服务端 bundle。

---

## 细粒度记录

- [2026-07-08-split-bundle-loader-rn086-build.md](../2026-07-08-split-bundle-loader-rn086-build.md)
- [2026-07-08-split-bundle-segment-contract.md](../2026-07-08-split-bundle-segment-contract.md)
- [2026-07-08-ota-runtime-not-ready.md](../2026-07-08-ota-runtime-not-ready.md)
- [docs/TurboModule + Codegen spec.md](../../TurboModule%20+%20Codegen%20spec.md)
