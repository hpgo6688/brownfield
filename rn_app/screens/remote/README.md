# screens/remote — Metro 日常开发

**改这里 → Metro HMR 即时生效**（原生壳 DEBUG **Metro** 模式）。

## 职责

| 文件 | 用途 |
|------|------|
| `OrderScreen.tsx` / `PromoScreen.tsx` | Metro dev 页面包装（badge：`Remote · 远程业务`） |
| `order/` | 订单多级 RN 导航（`OrderNavigator`、详情、物流追踪） |
| `components/` | 共享业务 UI（OrderList、PromoList、RemoteHero） |
| `featureMeta.ts` | Remote featureId → moduleName 映射 |
| `RemoteScreenShell.tsx` | 页面外壳布局 |

## 订单多级页面（Metro dev）

订单功能内使用 React Navigation native stack（`screens/remote/order/`）：

| 路由 | 说明 |
|------|------|
| `OrderList` | 列表（初始页） |
| `OrderDetail` | 详情（点击列表项进入） |
| `OrderTracking` | 物流追踪（第三级） |

- 子页使用应用内 **「← 返回」** pop RN 栈
- v1：原生导航栏左上角返回仍会 **退出整个订单功能**（未做原生返回委托）
- 日常改 `order/` 或 `components/OrderList.tsx` → Metro HMR 即时生效

```bash
cd rn_app && npm start
# Xcode Debug → Metro 模式 → 订单 → 点列表项 → 详情 → 物流 → 页内返回
```

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
