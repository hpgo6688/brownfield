## Context

- bundle-server Admin（`/admin`）通过 `GET /api/features` 拉取 `Feature` + `releases[]`，表格展示 version、hash、createdAt
- `BundleRelease` 已有 `filename`、`hash`，文件在 `data/bundles/`；**无 size 字段**
- Upload 路径：`createReleaseFromUpload` 已持有 `buffer: Buffer`，可直接取 `buffer.byteLength`
- 近期 OTA 问题表明 **体积是验证 split 构建是否正确的重要信号**（旧包 ~280KB vs 新包 ~2MB）

## Goals / Non-Goals

**Goals:**

- 管理员在 Admin 一眼看到每个 release 的 bundle 大小
- 新 upload 自动持久化 `sizeBytes`
- 旧 release 尽量展示 size（filesystem stat 兜底）
- build-manifest.json 含 `sizeBytes` 便于 CI/本地与服务器对照

**Non-Goals:**

- 不向 OTA 客户端 manifest 暴露 size
- 不做体积告警/阈值（后续可做）
- 不统计 main.ios.jsbundle（仅 Remote sub-bundle）

## Decisions

### 1. 持久化 `sizeBytes` 于 `BundleRelease`

**选择**：Prisma 新增 `sizeBytes Int?`（nullable 兼容历史数据）

**理由**：upload 时已知大小，避免每次 list 都 stat 磁盘；历史记录 migration 后可为 null。

**替代**：仅 stat 不存库 — 删文件后无法展示；list 性能略差。

### 2. 回填策略（legacy releases）

**选择**：`listFeaturesAdmin` 映射 releases 时，若 `sizeBytes == null` 且文件存在，则 `fs.stat` 得到 `size` 填入 API 响应（**不写回 DB**）。

**理由**：零迁移脚本即可让旧数据在 UI 可见；避免 bulk 更新风险。

**可选后续**：一次性 backfill 脚本将 stat 结果写入 DB。

### 3. Admin UI 展示格式

**选择**：`formatBytes(n)` → `< 1 MB` 用 KB（1 位小数），`≥ 1 MB` 用 MB（1 位小数）；原始字节放在 `title` tooltip。

**列位置**：发布历史表 `版本 | 大小 | Hash | 发布时间 | 操作`

### 4. build-manifest 扩展

**选择**：`build-manifest.json` 每条 Remote bundle 增加 `sizeBytes`（文件 stat 结果）。

**理由**：upload 前本地即可核对「是否 2MB 新包」；与 hash 并列。

### 5. API 形状

**选择**：admin API release 对象增加 `sizeBytes: number | null`；upload 响应 `release` 含同字段。

**不修改** `GET /api/manifest` 的 `ManifestFeature` 类型。

## Risks / Trade-offs

- **[Risk] 文件被删但 DB 有 sizeBytes** → UI 仍显示旧大小；可接受，删除 release 应同步删文件（已有逻辑）
- **[Risk] nullable 字段旧客户端忽略** → 仅 admin 消费，无影响
- **[Trade-off] stat 回填不写库** → 每次 list 对 null 记录多一次 stat；release 数量少（<20），可接受

## Migration Plan

1. `prisma migrate dev` 添加 `sizeBytes`
2. 部署 bundle-server；新 upload 自动填充
3. 旧 release 依赖 stat 兜底展示，无需数据迁移

## Open Questions

- 是否在侧边栏 `v0.0.7` 旁显示 `(2.0 MB)`？**建议做**，实现成本低。
