---
name: fix
description: >-
  Document problem and solution after each bug fix. Use when fixing bugs,
  resolving errors, debugging failures, patching regressions, or when the user
  asks to fix, repair, or troubleshoot an issue.
---

# Fix — 问题修复与记录

每次完成问题修复后，**必须**整理一份结构化的问题与解决方案摘要，并在回复中展示给用户。

## 何时启用

- 用户要求 fix / 修复 / 排查 / debug
- 正在处理 bug、报错、测试失败、CI 失败、回归问题
- 已完成代码修改以解决某个具体问题

## 修复流程

1. **定位问题**：复现症状，确认错误信息、影响范围、触发条件
2. **分析根因**：找到真正原因，避免只修表面现象
3. **实施修复**：最小化改动，遵循项目现有约定
4. **验证修复**：运行相关测试、手动验证或复现步骤确认已解决
5. **整理记录**：按下方模板输出摘要，并写入 `docs/fixes/`

## 输出要求

修复完成后，在最终回复中**必须**包含「Fix Summary」区块。

同时将被写入 `docs/fixes/YYYY-MM-DD-<简短-slug>.md`（slug 用英文 kebab-case，如 `admin-login-redirect`）。

若同一对话中连续修复多个独立问题，每个问题单独一份文件。

## Fix Summary 模板

```markdown
# [简短标题 — 一句话描述修复内容]

**Date**: YYYY-MM-DD
**Status**: Fixed
**Scope**: [影响的模块 / 文件 / 功能]

## 问题描述

- **现象**：[用户看到什么 / 报错信息 / 失败行为]
- **触发条件**：[在什么情况下出现]
- **影响范围**：[谁受影响、严重程度]

## 根因分析

[为什么会出现这个问题 — 逻辑错误、配置遗漏、边界条件、依赖版本等]

## 解决方案

[做了什么改动，为什么这样改]

**关键变更**：
- `path/to/file` — [简述改动]

## 验证方式

- [ ] [如何确认已修复 — 命令、测试、手动步骤]

## 后续建议（可选）

[预防复发、待跟进项、相关技术债]
```

## 写作原则

- **准确**：根因与方案要对应，不夸大、不模糊
- **简洁**：每个小节 2–5 句，避免粘贴大段日志
- **可检索**：标题和 slug 要能独立看懂问题
- **中文为主**：摘要内容用中文；文件路径、命令、标识符保持原文

## 示例

**场景**：Admin 页面刷新后 bundle 列表为空

输出文件：`docs/fixes/2026-07-08-admin-bundle-list-empty.md`

```markdown
# Admin 刷新后 bundle 列表为空

**Date**: 2026-07-08
**Status**: Fixed
**Scope**: bundle-server admin UI

## 问题描述

- **现象**：打开 `/admin` 后首次加载正常，刷新页面后列表为空
- **触发条件**：浏览器硬刷新或 F5
- **影响范围**：管理员无法查看 bundle 列表

## 根因分析

`fetchBundles()` 在 DOM 未就绪时执行，且未处理 API 错误，导致静默失败。

## 解决方案

将初始化移到 `DOMContentLoaded`，并添加错误提示。

**关键变更**：
- `bundle-server/src/admin/index.html` — 延迟初始化并显示 fetch 错误

## 验证方式

- [x] 刷新 `/admin` 后列表正常显示
- [x] API 不可用时页面显示错误信息
```

## 注意事项

- 修复未完成时不要写 Fix Summary
- 若仅调查未改代码，输出「调查结论」即可，不写 Status: Fixed
- 不要创建或修改用户未要求的其他文档；仅写入 `docs/fixes/` 下的修复记录
