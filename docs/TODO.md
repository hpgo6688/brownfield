# OTA Bundle 体积优化 — TODO

**Updated:** 2026-07-09  
**路线文档：** [ota-bundle-compression-roadmap.md](./ota-bundle-compression-roadmap.md)  
**预估工期（Cursor 辅助）：** HTTP 压缩 1～2 天 · 差分 MVP 1～1.5 周 · 差分生产级 2～3 周

---

## 阶段 0 — 结构性优化（进行中）

目标：继续缩小 split 体积，优先于传输压缩。

- [ ] **0.1** 依赖审计：从 feature split 排除 `registerFeature` 等 infra 模块（见 [shared split 记录](./fixes/2026-07-09-ota-shared-deps-bundle-split.md)）
- [ ] **0.2** 将 `ota_order` / `ota_promo` 从当前 ~1.3MB 向 **~500KB** 目标收敛
- [ ] **0.3** 评估 `ota_shared`（~2.25MB）是否还能剥离非 nav 依赖
- [ ] **0.4** CI：`build:bundles` feature > 600KB 时在 release 构建 **fail**（当前仅 warn）

---

## 阶段 1 — 评估（实施压缩前必做）

| ID | 任务 | 方法 | 预估 |
|----|------|------|------|
| E-1 | [ ] 测量 gzip/br 压缩率 | 对 `dist/bundles/*.jsbundle` 跑 `gzip -9` / `brotli -q 11`，记录原始 vs 压缩字节 | 30 min |
| E-2 | [ ] 验证 RN iOS `fetch` 解压行为 | 启用 compress 的 test server + `Accept-Encoding: gzip`，比对 body 长度与 sha256 | 2～4 h |
| E-3 | [ ] Fastify static + compress POC | `@fastify/compress` 与 `registerBundleDeliveryHooks` 共存；确认 503 / Retry-After 不受影响 | 2～4 h |
| E-4 | [ ] 弱网全链路耗时对比 | Network Link Conditioner：压缩开/关下 download + 校验 + 写盘 | 2～4 h |
| E-5 | [ ] 生产部署注意事项 | CDN / 反向代理 `Vary: Accept-Encoding`、避免双重压缩 | 1～2 h |

**E-1 决策门：** 若 gzip 后 shared+feature 合计 < ~1MB 且弱网可接受，可暂缓阶段 1 实现。

---

## 阶段 1 — HTTP 传输压缩（gzip / brotli）

设计原则：**压缩只作用于传输；hash / sizeBytes 对解压后字节；沙盒仍存明文 `.jsbundle`。**

### 服务端

- [ ] **1.1** 安装并注册 `@fastify/compress`（或静态预压缩 `.jsbundle.br`）
- [ ] **1.2** `GET /bundles/*` 支持 gzip / brotli，明文 fallback（无 `Accept-Encoding`）
- [ ] **1.3** 确认与 `bundle-server/src/routes/bundles.ts` 缺失文件 503 逻辑不冲突
- [ ] **1.4** 生产文档：`Vary: Accept-Encoding`、禁止 CDN 二次压缩明文

### 客户端

- [ ] **1.5** 确认 `bundleUpdater.ts` → `downloadBundleBody` 在压缩响应下 sha256 仍正确
- [ ] **1.6** 若 E-2 失败：增加显式解压（`ArrayBuffer` + pako / 原生）
- [ ] **1.7** （可选）manifest 增加 `contentEncoding` 字段，旧 App 忽略

### 测试与文档

- [ ] **1.8** 单测：`bundleUpdaterIntegrity.test.ts` 覆盖压缩响应 mock
- [ ] **1.9** e2e smoke：upload → manifest → OTA 下载 → load → 无 hash mismatch
- [ ] **1.10** 更新 `docs/sop.md`：upload 仍明文；download 可压缩
- [ ] **1.11** Admin / manifest 文档注明 `sizeBytes` = 解压后大小

**涉及文件：** `bundle-server/src/index.ts`、`bundle-server/src/routes/bundles.ts`、`rn_app/src/features/bundleUpdater.ts`

---

## 阶段 2 — 差分更新（binary patch）

> 建议在阶段 1 上线且仍不满足弱网 / 成本目标时再启动。当前无 patch 基础设施。

### 方案与设计

- [ ] **2.1** OpenSpec proposal：patch 协议、manifest 字段、fallback 策略
- [ ] **2.2** 选型 patch 算法（bsdiff / courgette / 自建）及 RN 侧 apply 方案（native / WASM）
- [ ] **2.3** 定义 manifest 扩展：`patchUrl`、`baseVersion`、`fullBundleUrl`（fallback）

### MVP（单 feature，约 1 周）

- [ ] **2.4** 上传/CI：相对上一 active release 自动生成 patch 文件
- [ ] **2.5** 服务端：存储 patch、`GET` 下发；无 patch 时仅全量
- [ ] **2.6** 客户端：本地有 `baseVersion` → 下 patch → apply → sha256 校验
- [ ] **2.7** apply 失败 / hash 失败 → 自动全量重下
- [ ] **2.8** 先只覆盖 `order`（或一个 feature），shared 仍全量
- [ ] **2.9** 单测 + 真机 smoke

### 生产级（再加 1～2 周）

- [ ] **2.10** 覆盖 `shared` + 全部 Remote feature
- [ ] **2.11** 集成 `downloadPendingFeature` / pending.json 路径
- [ ] **2.12** 版本回滚：patch base 与本地 active 不一致时走全量
- [ ] **2.13** Admin：patch 大小、base→target 版本展示
- [ ] **2.14** `upload-bundle.sh` / publish 脚本：lockstep 生成 patch
- [ ] **2.15** SOP：回滚演练、patch 损坏恢复
- [ ] **2.16** e2e：弱网 patch 失败 fallback、磁盘空间不足

---

## 阶段 2 — Hermes bytecode（可选，长期）

- [ ] **3.1** Spike：`SplitBundleLoader` / `registerSegmentWithId` 是否支持 `.hbc`
- [ ] **3.2** 评估 build 链路改为 Hermes bundle 的改动面
- [ ] **3.3** 与 gzip / 差分的叠加策略（通常 Hermes 替代明文 jsbundle，非叠加）

---
## 阶段 3 - 多环境支持 dev pre pro
## 明确不做（短期）

- [ ] ~~沙盒持久化 `.jsbundle.gz`~~（除非磁盘成为硬约束）
- [ ] ~~对压缩字节计算 sha256~~（破坏 upload / 校验 / 回滚一致性）
- [ ] ~~CI 上传压缩~~（内网收益低，优先级最低）

---

## 建议执行顺序

```
1. E-1 压缩率测量（30 min）
2. 阶段 0 依赖审计（与压缩并行）
3. E-2～E-3 → 阶段 1 实现（1～2 天）
4. 视 E-1 / 弱网结果决定是否启动阶段 2 差分
```

---

## 参考

- [ota-bundle-compression-roadmap.md](./ota-bundle-compression-roadmap.md)
- [dynamic-multi-bundle.md — OTA 公共 split](./dynamic-multi-bundle.md#ota-公共-splitota_shared)
- [fixes/2026-07-09-ota-shared-deps-bundle-split.md](./fixes/2026-07-09-ota-shared-deps-bundle-split.md)
