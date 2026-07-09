# OTA Bundle 压缩与体积优化路线

**Date:** 2026-07-09  
**Status:** 规划（待评估）  
**相关：** [OTA 公共 split](./dynamic-multi-bundle.md#ota-公共-splitota_shared)、[shared split 实施记录](./fixes/2026-07-09-ota-shared-deps-bundle-split.md)

## 背景

当前 OTA 子 bundle 的 **上传、存储、下载、加载** 全链路使用 **未压缩的明文 `.jsbundle`**：

| 环节 | 实现 | 说明 |
|------|------|------|
| 构建 | `rn_app/scripts/build-bundles.js` | Release 已 `minify: true`，无 gzip/brotli |
| 上传 | `bundle-server/scripts/upload-bundle.sh` | `curl -F file=@xxx.jsbundle` 原样 POST |
| 服务端存储 | `bundle-server/src/services/bundle.service.ts` | 写入 `data/bundles/`，`sizeBytes` = 原始字节 |
| 下载 | `rn_app/src/features/bundleUpdater.ts` | `fetch(bundleUrl)` → `response.text()` → sha256 校验 |
| 加载 | `SplitBundleLoader.load(localPath)` | 直接读沙盒中的明文 jsbundle |

上传大小上限 50MB（`@fastify/multipart`）。

引入 `ota_shared` 公共 split 后，**结构性去重**已显著降低重复下载（shared ~2.25MB 一次 + feature ~1.3MB）。但随着业务增长，单次 OTA payload 仍可能继续变大。本文档记录 **压缩与体积优化的可选路线**，供后续评估与选型。

## 体积优化手段对比

| 手段 | 作用层 | 典型收益 | 复杂度 | 与现有链路兼容性 |
|------|--------|----------|--------|------------------|
| **shared split**（已实施） | 构建图 / 模块归属 | 每 feature 少重复 ~1.5MB nav 依赖 | 中 | 已落地 |
| **依赖审计 / tree-shaking** | 构建图 | 视依赖而定 | 持续 | 高 |
| **HTTP 传输压缩（gzip/br）** | 网络 | minified JS 常可再省 60–75% | **低** | 高（见下文设计原则） |
| **存储压缩（磁盘存 .gz）** | 沙盒 | 省磁盘，不省 CPU | 中 | 中（加载前需解压） |
| **差分更新（binary patch）** | 网络 | 小改动时极省流量 | **高** | 需新协议与回滚策略 |
| **Hermes bytecode (.hbc)** | 构建 + 加载 | 更小 + 更快启动 | **高** | 需改 native 加载链路 |

## 三种压缩思路

### 1. HTTP 传输压缩（推荐优先评估）

**只压缩「下载」这一跳**，落盘与 native 加载仍用原始 jsbundle。

```
服务端 .jsbundle ──gzip/br──> 网络 ──解压──> 客户端 sha256 校验 ──> 写 .jsbundle ──> SplitBundleLoader
```

**优点**

- Metro minified 产物 gzip 通常还能再省 **60–75%**（例：2MB → ~500KB，600KB → ~150KB）
- **hash 语义不变**：manifest / upload 的 `sha256:` 仍对 **解压后的 bundle 字节** 计算
- **native 零改动**：`SplitBundleLoader` 继续读明文文件
- 服务端可用 `@fastify/compress` 或对 `GET /bundles/*` 做 on-the-fly gzip/brotli

**待验证**

- RN `fetch` 对 `Content-Encoding: gzip` / `br` 是否透明解压（多数环境会；若不会，客户端需显式解压）
- CDN / 反向代理是否重复压缩
- `Accept-Encoding` 协商与旧客户端回退（无压缩时仍返回明文）

**适合时机**

- shared + feature 合计经常 > ~1MB
- 弱网用户多，或 CDN egress 成本开始敏感

### 2. 存储压缩（磁盘存 `.jsbundle.gz`）—— 不建议先做

下载压缩包，沙盒持久化也存压缩格式，加载时再解压：

**缺点**

- 每次进入 feature 需解压（CPU），或解压后缓存明文（磁盘收益有限）
- warm re-entry、pending/active 双路径变复杂
- native 若将来 mmap / 流式读 bundle，压缩格式是额外负担

**结论：** OTA bundle 不是长期 hoard 的大文件；**省流量**通常比 **省磁盘** 更重要。

### 3. 上传压缩 —— 优先级低

CI → bundle-server 多为内网/同城，带宽压力小。可选 `curl --compressed` 或 CI 侧 gzip 后上传、服务端解压落盘，收益不如下载侧明显。

## 设计原则（若引入压缩）

> **压缩只作用于传输；持久化与 native 加载保持「明文 jsbundle + 现有 sha256 语义」。**

具体约束：

1. **`sizeBytes`**（manifest / admin / DB）继续表示 **解压后** 的 bundle 字节数
2. **`hash`** 继续对 **解压后** 字节计算，与 `build-bundles.js` 产出的 `sha256:` 一致
3. 沙盒路径与文件名保持 `*.jsbundle`（明文），不改为 `*.gz`
4. `SplitBundleLoader`、`bundleCache` session 校验逻辑 **不感知** 传输编码
5. 可选：manifest 增加 `contentEncoding: "gzip" | "br" | null` 做版本协商（旧 App 忽略该字段即可）

## 推荐路线

```mermaid
flowchart LR
  A["现在: shared split + minify"] --> B{"单次 OTA payload"}
  B -->|"< ~1MB 且体验 OK"| C["维持现状"]
  B -->|"> ~1MB 或弱网差"| D["加 HTTP gzip/br"]
  D --> E{"仍不够?"}
  E --> F["差分 patch / Hermes"]
```

### 阶段 0 — 现在（结构性优化，已进行中）

- [x] `ota_shared` 公共 split，feature 只带业务代码
- [x] `build-bundles.js` 体积告警（feature > 600KB warn）
- [ ] 持续依赖审计，向 ~500KB feature 目标收敛（见 [shared split 记录](./fixes/2026-07-09-ota-shared-deps-bundle-split.md)）

### 阶段 1 — 中期（性价比高，待评估）

- [ ] bundle-server：`GET /bundles/*` 支持 gzip / brotli（`@fastify/compress` 或静态预压缩）
- [ ] 确认 RN 客户端 `fetch` 解压行为；必要时在 `downloadBundleBody` 加显式解压
- [ ] Admin / manifest 文档注明：`sizeBytes` = 解压后大小
- [ ] 弱网 / 大包 smoke：对比压缩前后下载耗时与 sha256 校验

### 阶段 2 — 长期（bundle 持续变大且更新频繁）

- [ ] **差分更新**：仅下发 patch（类似 CodePush）；shared 稳定、feature 频繁小改时 ROI 最高
- [ ] **Hermes bytecode**：更小体积 + 更快启动；需评估 `SplitBundleLoader` / segment 注册是否支持 `.hbc`

### 明确不做（短期）

- 沙盒持久化压缩格式（除非磁盘成为硬约束）
- 改动 sha256 语义（对压缩字节算 hash）—— 会破坏现有 upload / 校验 / 回滚一致性

## 待评估项（下一步）

实施阶段 1 前，建议逐项确认：

| # | 问题 | 方法 |
|---|------|------|
| E-1 | 当前各 artifact 解压后体积 vs gzip/br 后传输体积 | 本地对 `dist/bundles/*.jsbundle` 跑 `gzip -9` / `brotli` 对比 |
| E-2 | RN iOS `fetch` 是否自动处理 `Content-Encoding` | 对启用 compress 的 test server 发请求，比对 body 长度与 hash |
| E-3 | Fastify static + compress 与现有 `registerBundleDeliveryHooks` 交互 | bundle-server 本地 POC |
| E-4 | 压缩对 OTA 全链路耗时（下载 + 校验 + 写盘）的净收益 | 弱网模拟（Network Link Conditioner） |
| E-5 | CDN / 生产部署是否需 `Vary: Accept-Encoding` | 运维 / 部署文档 |

## 涉及文件（阶段 1 预估）

| 组件 | 文件 |
|------|------|
| 服务端 | `bundle-server/src/index.ts`、`bundle-server/src/routes/bundles.ts` |
| 客户端下载 | `rn_app/src/features/bundleUpdater.ts`（`downloadBundleBody`） |
| 文档 / SOP | `docs/sop.md`（upload 不变；可选注明 download 压缩） |
| 测试 | `rn_app/src/features/__tests__/bundleUpdaterIntegrity.test.ts` |

## 参考

- [dynamic-multi-bundle.md — OTA 公共 split](./dynamic-multi-bundle.md#ota-公共-splitota_shared)
- [fixes/2026-07-09-ota-shared-deps-bundle-split.md](./fixes/2026-07-09-ota-shared-deps-bundle-split.md)
- OpenSpec change: `openspec/changes/ota-shared-deps-common-bundle/`
