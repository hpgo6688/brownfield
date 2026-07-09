# OTA Re-entry 口述 Cheat Sheet（半页纸）

> 完整版：[ota-reentry-case-study.md](./ota-reentry-case-study.md)

---

## 30 秒版

Brownfield Remote 页：**Metro 开发 + OTA split bundle 发版**。第二次进 OTA 时**版本一致仍崩/慢**——不是 bundle 没下载，是 **磁盘 bundle、JS registry、Metro module 表** 三者生命周期不同步。解法：**ota_ 双路径隔离 + load 后 sync component cache + re-entry 专用顺序**。

---

## 架构（一句话）

`FeatureHost`：Metro → `screens/remote/`；OTA → manifest → 沙盒 `.jsbundle` → `SplitBundleLoader(segmentId)` → `registerFeature(order, ota_OrderScreen)`。

---

## 根因（背这三句）

1. **磁盘有 bundle ≠ 能渲染**——registry 每次进页会被清，entry 模块第二次 **`isInitialized` 不重跑 factory**，`registerFeature` 不会自动再执行。
2. **Bridgeless** 每次 `registerSegment` 会 **full eval 整包**，但 eval 完仍可能 **没注册**——瓶颈在 module 缓存，不是「native 完全不 eval」（Legacy 才常见 skip）。
3. **版本一致还报「未 upload」**——错误文案把 load/register 失败误包装成下载问题。

---

## 最终方案（Re-entry 四铁律）

| # | 做什么 | 不做什么 |
|---|--------|----------|
| 1 | **先** `SplitBundleLoader.load()` | ❌ skip native load 只 sync cache |
| 2 | load **后立刻** `syncOtaRegistrationFromCache` | ❌ 先傻等 3s 再 sync |
| 3 | re-entry **保留** `__OTA_COMPONENT_CACHE__` | ❌ 每次 `clearOtaComponentCache` |
| 4 | re-entry **不** `requireRegistration` 跑 entry | ❌ 强跑 `__r(entry)` 当唯一手段 |

**提速**：re-entry 跳过 manifest 网络；首次 bridgeless 短 wait ≤1s。

---

## 试过但废弃（面试加分句）

「我们试过 **直接渲染 cache / DevSettings.reload / 整包 eval / skip native load**，版本一致证伪了 upload 假设，最后收敛到 **load → sync cache**。」

---

## STAR（60–90 秒）

- **S**：OTA Order 第一次 OK，返回再进崩溃或 loading 3s；报错像没 upload，版本却一致。  
- **T**：同版本 re-entry 稳定 + 快速 + 可定位。  
- **A**：拆链路打日志 → 改错误文案 → 否定 4 种快路径 → 落地 re-entry 顺序 + ota_ 隔离 + 下载 hash 校验。  
- **R**：多次进出稳定；第二次 loading 明显缩短；能区分「缓存正常 vs 真下载失败」。

---

## 日志速查

| 看到 | 说明 |
|------|------|
| `otaReentry=true` | 第二次 session 进入 |
| `active=0.0.6 remote=0.0.6 update=false` | 非下载问题 |
| `Finished evaluating segment 1` | Bridgeless eval 完成 |
| `entry did not register` | 应走 sync cache，别强 require entry |
| `unknown module` | 曾出现在 stale fast path / reload 方案 |

---

## 边界一句

Metro `--reset-cache` 后须 **rebuild:bundles + upload**；否则 split 与主包 module id 不匹配。

---

## 关键词

`Brownfield` · `Split Bundle` · `Bridgeless` · `FeatureHost` · `component cache` · `registry isolation` · `re-entry` · `manifest OTA`
