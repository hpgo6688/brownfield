# 点「稍后」后 OTA 页加载失败（版本一致仍报错）

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: rn_app OTA — bundleCache、bundleUpdater、bundleLoader、otaUpdatePoller

## 问题描述

- **现象**：Banner 点「稍后」后（或再进页）显示「远程 bundle 不可用」，服务端/本地均 v0.0.3
- **触发条件**：poll 下载 pending 更新；pending 与 active **同版本** 时共用 `{version}.jsbundle` 路径
- **影响范围**：OTA promo / order

## 根因分析（补充）

6. **Bootstrap 同版本 hash 变更会覆盖 active**：`needsUpdate` 在 v0.0.3→v0.0.3 仅 hash 不同时仍触发下载，覆盖 active 文件；Native segment 不 re-eval，`syncFromCache` 又因 hash 不一致拒绝恢复 → 「not registered」。
7. **Re-entry 强制走 Native load**：即使 `__OTA_COMPONENT_CACHE__` 有效，仍调用 `SplitBundleLoader.load`，增加失败面。

## 解决方案（补充）

6. **`needsUpdate`**：同 semver 版本不再 bootstrap 下载（hash 变更仅由 poll + pending apply 处理）。
7. **`syncOtaRegistrationFromCache`**：去掉 hash 校验，version + path 一致即可恢复。
8. **Early sync 短路**：`FeatureHost` / `bundleLoader` 在 Native load 前先 sync cache，已注册则跳过 `SplitBundleLoader.load`。：`writeCachedBundle(featureId, version)` 对 active 与 pending 使用同一路径，poll 下载 pending 时 **覆盖** 正在运行的 active bundle。
2. **清理 pending 误删 active**：丢弃 stale pending 时 `deleteCachedBundle(version)` 删除的是 active 正在用的文件。
3. **下载失败误删 active**：`downloadPendingFeature` catch 里同样调用 `deleteCachedBundle(version)`。
4. **注册失败误删 active**：`bundleLoader` 在 `__r()` 失败时删除 active 缓存，再进页 metadata 仍指向已删文件。

## 解决方案

1. **独立 pending 路径**：`{version}.pending.jsbundle`，poll 下载不再触碰 active 文件。
2. **Apply 时再 promote**：读取 pending 文件 → 写入 active 路径 → 删 pending 文件。
3. **安全清理**：`clearStalePendingRelease` / 下载失败仅删 pending 路径。
4. **Legacy 迁移**：若 pending 与 active 同路径，仅清 `pending.json`。
5. **加载失败不删 active**：仅抛错，便于重试。

**关键变更**：
- `rn_app/src/features/bundleCache.ts` — `writePendingBundle`、`deletePendingBundleByPath`
- `rn_app/src/features/bundleUpdater.ts` — pending 独立存储；apply promote
- `rn_app/src/features/bundleLoader.ts` — 失败不删 active
- `rn_app/src/features/otaUpdatePoller.ts` — dismiss 记忆 + 安全清理

## 验证方式

- [ ] active v0.0.3，remote 同版本新 hash → Banner → 点「稍后」→ 页面保持 v0.0.3 正常
- [ ] 退出再进 promo → 仍正常，不报「远程 bundle 不可用」
- [ ] 点「立即更新」→ 切换到 pending 版本内容
- [ ] dev 条 remote/active 版本显示正确

## 后续建议

- 若沙盒已被旧逻辑破坏：删除 `DocumentDirectory/rn-bundles/` 后重新进入 OTA 页
