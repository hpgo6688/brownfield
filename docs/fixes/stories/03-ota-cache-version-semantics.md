# 故事 3：OTA 缓存与版本语义

> 症状常是「远程 bundle 不可用」，但服务端/本地版本号显示一致 — 与 [故事 1](./01-ota-reentry-registry-lifecycle.md) 的 load/register 失败不同，本簇根因在 **沙盒文件布局、版本比较语义、pending/active 生命周期**。

---

## 用户看到什么

| 场景 | 现象 |
|------|------|
| Banner 点「稍后」再进 | 版本 v0.0.3 / v0.0.3 一致，仍报错 |
| pending 下载后 | 日志 `staged pending order@0.0.6`，仍加载旧 active 文件 |
| Admin 回滚版本 | 无 Banner；或回切后二次进入失败 |
| Apply 立即更新后 | subtitle 仍是旧版文案 |
| 服务端 bundle 被删 | 「not registered」+ 原生闪退 |
| staging 404 | 有 active 缓存也无法进页 |

---

## 根因簇

### 1. Pending 与 Active 共用路径（最严重）

Poll 下载 pending 时 **覆盖** 正在运行的 active `.jsbundle`；清理 pending 或加载失败时 **误删 active**。

**修复**：

- Pending 独立路径：`{version}.pending.jsbundle`
- Apply 时再 promote → 写入 active → 删 pending
- 加载失败 **不删 active**，便于重试

→ [2026-07-08-ota-dismiss-deletes-active-bundle.md](../2026-07-08-ota-dismiss-deletes-active-bundle.md)

### 2. Bootstrap vs Polling 语义混用

为防进页自动降级，`needsUpdate` 在 remote < local 时返回 false — 被 polling 误用 → Admin 回滚后无 Banner。

**修复**：分离两套语义

| 场景 | 函数 | 行为 |
|------|------|------|
| 进页 bootstrap | `needsUpdate` | 仅**升级**时自动下载 |
| Polling / Banner | `remoteDiffersFromActive` | 版本或 hash 任一不同即提示（含回滚） |
| Apply | `clearOtaComponentCache` + version bust | 切换版本时清 stale component |

→ [2026-07-08-ota-server-rollback-reentry-failure.md](../2026-07-08-ota-server-rollback-reentry-failure.md)

### 3. 同版本 hash 漂移

`needsUpdate()` 同 semver 返回 false；pending 已下载但未 promote；服务端 hash 与本地 active 不一致。

**修复**：

- `ensureFeatureCached` 比对**磁盘文件 hash** 与 manifest（不只 metadata）
- active 与 remote 不一致 → 立即 `applyPendingFeature` 或重新下载

→ 补充于 [2026-07-09-ota-split-shared-deps-unknown-module.md](../2026-07-09-ota-split-shared-deps-unknown-module.md)

### 4. Staging 失败阻断 bootstrap

进页前预下载 pending 404/网络失败时异常向上抛出，即使 active 可用也无法加载。

**修复**：`stageRemoteFeatureUpdate` 改为 best-effort；deferred apply 成功后 `runtimeReloadRequired` + DEV reload。

→ [2026-07-08-ota-same-version-load-failure.md](../2026-07-08-ota-same-version-load-failure.md)

### 5. Apply 后 UI 仍显示旧版

Native segment 不 re-eval 新文件；`syncOtaRegistrationFromCache` 恢复**旧版** component。

**修复**：sync 仅允许**同 version/hash/path** 恢复；版本升级必须 bust cache + reload。

→ [2026-07-08-ota-apply-stale-component-cache.md](../2026-07-08-ota-apply-stale-component-cache.md)

### 6. 无效 bundle 写入沙盒

46 字节占位文件也能当缓存；`runFullBundleEval` 触发 LogBox → SwiftUI 壳闪退。

**修复**：

- `validateOtaBundleContent`（体积 + `ota_*` + `AppRegistry`）
- `verifyOtaBundleBody` promote 前 re-verify
- 移除 harmful full eval；SwiftUI 加 AppDelegate adaptor

→ [2026-07-08-ota-remote-bundle-deleted-graceful-error.md](../2026-07-08-ota-remote-bundle-deleted-graceful-error.md)

### 7. useEffect 竞态 + 损坏小 bundle

`setForceOtaInDev` 触发 effect 重复执行；764B 损坏 bundle 不被淘汰。

→ [2026-07-08-ota-mode-load-failure.md](../2026-07-08-ota-mode-load-failure.md)

---

## 演进关系（多次修改如何收敛）

```
07-08  pending 覆盖 active → 独立 pending 路径
07-08  回滚无 Banner → bootstrap/polling 语义分离
07-08  「稍后」再进失败 → 同版本 bootstrap 不覆盖 active
07-08  apply 后旧 UI → cache 按版本失效
07-08  无效 bundle / 闪退 → 内容校验 + 友好错误
07-09  hash 漂移 / pending 未 promote → ensureFeatureCached 磁盘 hash 比对
07-09  verifyOtaBundleBody → 与故事 2 构建修复配合
```

---

## 面试怎么讲

**一句话**：OTA 客户端要区分 **「有没有文件」**、**「文件对不对」**、**「runtime 有没有加载对版本」** 三层；版本号相同不代表 hash 相同，更不代表 JS registry 已是新版本。

**排查顺序**：

1. 看 dev 条 `active` / `remote` / `pending` 版本与 hash
2. 看沙盒路径：active vs `.pending.jsbundle`
3. 区分 bootstrap 失败（真没文件）vs load 失败（见故事 1）
4. Admin 回滚场景用 `remoteDiffersFromActive`，不用 `needsUpdate`

---

## STAR 口述（45 秒）

- **S**：Banner 点「稍后」再进 promo，版本一致却「远程 bundle 不可用」；Admin 回滚后 dev 条显示 remote 更低但没有更新 Banner。
- **T**：沙盒缓存安全、版本语义正确、回滚/升级 UX 一致。
- **A**：审计 pending/active 路径发现覆盖 bug → 独立 pending 文件 → 分离 bootstrap 与 polling 比较函数 → 加 bundle 内容校验与 hash 比对。
- **R**：「稍后」不再误删 active；回滚出现 Banner；无效 bundle 友好报错不闪退。

---

## 细粒度记录

- [2026-07-08-ota-dismiss-deletes-active-bundle.md](../2026-07-08-ota-dismiss-deletes-active-bundle.md)
- [2026-07-08-ota-server-rollback-reentry-failure.md](../2026-07-08-ota-server-rollback-reentry-failure.md)
- [2026-07-08-ota-same-version-load-failure.md](../2026-07-08-ota-same-version-load-failure.md)
- [2026-07-08-ota-apply-stale-component-cache.md](../2026-07-08-ota-apply-stale-component-cache.md)
- [2026-07-08-ota-remote-bundle-deleted-graceful-error.md](../2026-07-08-ota-remote-bundle-deleted-graceful-error.md)
- [2026-07-08-ota-mode-load-failure.md](../2026-07-08-ota-mode-load-failure.md)
