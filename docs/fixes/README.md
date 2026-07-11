# 问题修复记录 — 索引与面试导读

> **面试口述主文档**（STAR / 架构 / 废弃方案对照）：[docs/interview/ota-reentry-case-study.md](../interview/ota-reentry-case-study.md)  
> **半页纸速查**：[docs/interview/ota-reentry-cheat-sheet.md](../interview/ota-reentry-cheat-sheet.md)  
> **术语词典**：[GLOSSARY.md](./GLOSSARY.md)（Brownfield / registry / re-entry / unknown module 等）

本目录记录了 Brownfield + Multi-RN-Bundle + OTA 项目中的真实问题与修复过程。同一问题往往经历多次迭代（排查笔记 → 中间方案 → 最终方案），**面试请优先读 `stories/` 下的主题叙事**，细粒度 commit 级记录见各 dated 文件。

---

## 面试怎么讲（推荐顺序）

| 顺序 | 主题 | 故事文档 | 一句话 |
|------|------|----------|--------|
| 1 | OTA 二次进入 / Metro 切换 | [stories/01-ota-reentry-registry-lifecycle.md](./stories/01-ota-reentry-registry-lifecycle.md) | 磁盘有 bundle ≠ 能渲染；registry / module 缓存 / native segment 生命周期不同步 |
| 2 | Split 模块图 / unknown module | [stories/02-split-module-graph-and-shared-bundle.md](./stories/02-split-module-graph-and-shared-bundle.md) | 构建期 module 归属错误 → 运行时 `Requiring unknown module` |
| 3 | OTA 缓存与版本语义 | [stories/03-ota-cache-version-semantics.md](./stories/03-ota-cache-version-semantics.md) | pending/active 隔离、回滚 Banner、同版本 hash 漂移 |
| 4 | Native Split Loader（Bridgeless） | [stories/04-native-split-loader-bridgeless.md](./stories/04-native-split-loader-bridgeless.md) | RN 0.86 新架构下 segment 加载从零打通 |
| 5 | 构建 / UI / 工程杂项 | [stories/05-build-ui-misc.md](./stories/05-build-ui-misc.md) | BrownfieldLib 同步、布局 bug、DB 路径 |

**工程落地总览**（2026-07-09 会话）：[2026-07-09-ota-dev-session-fixes-summary.md](./2026-07-09-ota-dev-session-fixes-summary.md)

---

## 问题簇与文档状态

### A. OTA Re-entry & Registry（最多迭代 · 面试重点）

| 状态 | 文档 | 说明 |
|------|------|------|
| ✅ 面试主叙事 | [stories/01-…](./stories/01-ota-reentry-registry-lifecycle.md) | 含废弃方案对照 |
| ✅ 最终 fix | [2026-07-09-ota-second-entry-load-register-fix.md](./2026-07-09-ota-second-entry-load-register-fix.md) | commit 级摘要 |
| ✅ Metro 切换 | [2026-07-09-ota-metro-switch-registry-restore.md](./2026-07-09-ota-metro-switch-registry-restore.md) | `afterMetro` + 保留 component cache |
| ✅ Instant 体验 | [2026-07-09-ota-instant-reentry-white-screen.md](./2026-07-09-ota-instant-reentry-white-screen.md) | 首帧渲染 + warmReentry 顺序 |
| ✅ CPU 优化 | [2026-07-09-ota-instant-reentry-cpu-spike.md](./2026-07-09-ota-instant-reentry-cpu-spike.md) | session 校验缓存 + poller defer |
| ✅ 基础机制 | [2026-07-08-ota-register-feature-not-called.md](./2026-07-08-ota-register-feature-not-called.md) | `executeSplitBundleEntry` 由来 |
| ✅ 基础机制 | [2026-07-08-ota-mode-switch-registration-lost.md](./2026-07-08-ota-mode-switch-registration-lost.md) | `__OTA_COMPONENT_CACHE__` 设计 |
| 📦 归档 | [archive/2026-07-09-ota-second-entry-load-failure-analysis.md](./archive/2026-07-09-ota-second-entry-load-failure-analysis.md) | 排查笔记，部分假设已被 Bridgeless 验证修正 |
| 📦 归档 | [archive/2026-07-09-ota-fast-path-unknown-module.md](./archive/2026-07-09-ota-fast-path-unknown-module.md) | ❌ 直接渲染 cache → unknown module |
| 📦 归档 | [archive/2026-07-09-ota-metro-second-entry-unknown-module.md](./archive/2026-07-09-ota-metro-second-entry-unknown-module.md) | ❌ DevSettings.reload / full eval |
| 📦 归档 | [archive/2026-07-09-ota-remote-bundle-reuse.md](./archive/2026-07-09-ota-remote-bundle-reuse.md) | fast path 已废弃；`verifyOtaBundleBody` 仍有效 |

### B. Split Module Graph & Shared Bundle

| 状态 | 文档 | 说明 |
|------|------|------|
| ✅ 面试叙事 | [stories/02-…](./stories/02-split-module-graph-and-shared-bundle.md) | |
| ✅ 根因 fix | [2026-07-09-ota-split-shared-deps-unknown-module.md](./2026-07-09-ota-split-shared-deps-unknown-module.md) | `745032085` / 排除策略 |
| ✅ 架构演进 | [2026-07-09-ota-shared-deps-bundle-split.md](./2026-07-09-ota-shared-deps-bundle-split.md) | `ota_shared` segment 0 |
| ✅ 立即更新 | [2026-07-09-ota-apply-update-unknown-module.md](./2026-07-09-ota-apply-update-unknown-module.md) | shared 未 warm navigation 模块 |
| ✅ 早期 | [2026-07-09-ota-order-split-missing-navigation.md](./2026-07-09-ota-order-split-missing-navigation.md) | order 导航未纳入 split |

### C. OTA Cache & Version Semantics

| 状态 | 文档 | 说明 |
|------|------|------|
| ✅ 面试叙事 | [stories/03-…](./stories/03-ota-cache-version-semantics.md) | |
| ✅ | [2026-07-08-ota-dismiss-deletes-active-bundle.md](./2026-07-08-ota-dismiss-deletes-active-bundle.md) | pending 独立路径 |
| ✅ | [2026-07-08-ota-same-version-load-failure.md](./2026-07-08-ota-same-version-load-failure.md) | staging best-effort |
| ✅ | [2026-07-08-ota-server-rollback-reentry-failure.md](./2026-07-08-ota-server-rollback-reentry-failure.md) | bootstrap vs polling 语义分离 |
| ✅ | [2026-07-08-ota-apply-stale-component-cache.md](./2026-07-08-ota-apply-stale-component-cache.md) | 版本升级 cache 失效 |
| ✅ | [2026-07-08-ota-remote-bundle-deleted-graceful-error.md](./2026-07-08-ota-remote-bundle-deleted-graceful-error.md) | 无效 bundle 校验 + 友好错误 |
| ✅ | [2026-07-08-ota-mode-load-failure.md](./2026-07-08-ota-mode-load-failure.md) | useEffect 竞态、损坏缓存 |

### D. Native Split Loader

| 状态 | 文档 | 说明 |
|------|------|------|
| ✅ 面试叙事 | [stories/04-…](./stories/04-native-split-loader-bridgeless.md) | |
| ✅ | [2026-07-08-split-bundle-segment-contract.md](./2026-07-08-split-bundle-segment-contract.md) | segmentId 契约 + TurboModule |
| ✅ | [2026-07-08-split-bundle-loader-rn086-build.md](./2026-07-08-split-bundle-loader-rn086-build.md) | Bridgeless 编译适配 |
| ✅ | [2026-07-08-ota-runtime-not-ready.md](./2026-07-08-ota-runtime-not-ready.md) | NO_RUNTIME / promise 时序 |

### E. Build / UI / Infra

| 状态 | 文档 | 说明 |
|------|------|------|
| ✅ | [stories/05-…](./stories/05-build-ui-misc.md) | |
| ✅ | [2026-07-09-brownfield-gesture-handler-module-missing.md](./2026-07-09-brownfield-gesture-handler-module-missing.md) | SPM xcframework 未刷新 |
| ✅ | [2026-07-09-order-page-stack-zero-height.md](./2026-07-09-order-page-stack-zero-height.md) | absoluteFill 布局塌缩 |
| ✅ | [2026-07-08-bundle-server-db-path-duplication.md](./2026-07-08-bundle-server-db-path-duplication.md) | Prisma 双路径 |

---

## 新增修复记录规范

按 [.cursor/skills/fix/SKILL.md](../../.cursor/skills/fix/SKILL.md)：

1. 每次独立 fix 仍写 `YYYY-MM-DD-<slug>.md`
2. 若属于已有问题簇，在 README 对应表格追加一行，并在 `stories/` 文档末尾「演进记录」补一句
3. **中间方案**（最终废弃）直接进 `archive/`，文首标注 ⚠️ 已废弃

---

## 目录结构

```
docs/fixes/
├── README.md                 ← 本文件（索引 + 面试导读）
├── GLOSSARY.md               ← 关键术语词典
├── stories/                  ← 按主题整理的面试叙事（优先阅读）
├── archive/                  ← 已废弃的中间方案 / 排查笔记
├── 2026-07-08-*.md           ← 按日期的细粒度 fix 记录
└── 2026-07-09-*.md
```
