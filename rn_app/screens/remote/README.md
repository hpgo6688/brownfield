# screens/remote — Metro 日常开发

**改这里 → Metro HMR 即时生效**（原生壳 DEBUG **Metro** 模式）。

## 职责

| 文件 | 用途 |
|------|------|
| `OrderScreen.tsx` / `PromoScreen.tsx` | Metro dev 页面包装（badge：`Remote · 远程业务`） |
| `components/` | 共享业务 UI（OrderList、PromoList、RemoteHero） |
| `featureMeta.ts` | Remote featureId → moduleName 映射 |
| `RemoteScreenShell.tsx` | 页面外壳布局 |

## 不要做什么

- ❌ 不要在这里期望 OTA upload 行为；OTA 走 `bundles/ota_*/`
- ❌ 不要 import `bundles/ota_*`（build-only 目录）
- ❌ 不要把 Remote 页放进 Scheme 1 的 `screens/HomeScreen` 等

## 快速验证

```bash
cd rn_app && npm start
# Xcode Debug → 原生壳工具栏选 Metro → 进入订单/活动页
```

## 更多信息

- [docs/dynamic-multi-bundle.md](../../docs/dynamic-multi-bundle.md) — Remote 双路径架构
- OTA 发版：`npm run build:bundles` → upload → 原生壳 **OTA** 模式
