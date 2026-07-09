# bundles — OTA split bundle（build / upload only）

**改这里 → 必须 `npm run build:bundles` + upload 后，OTA 模式才生效。**

Metro dev（`npm start`）**不会**加载此目录下的屏幕源码。

## 目录结构

```
bundles/
├── ota_shared/
│   └── index.js          ← 公共依赖入口（React Navigation 等，segment 0）
├── ota_order/
│   ├── index.js          ← 入口：registerFeature + AppRegistry（ota_OrderScreen）
│   └── screens/          ← OTA 包装页（BUILD/UPLOAD ONLY）
│       └── OrderScreen.tsx
└── ota_promo/
    ├── index.js
    └── screens/
        └── PromoScreen.tsx
```

## 职责

| 部分 | 用途 |
|------|------|
| `ota_shared/index.js` | 公共 split（导航栈、screens、gesture-handler） |
| `ota_<featureId>/index.js` | split bundle 入口，注册 `ota_*` 模块名 |
| `ota_<featureId>/screens/` | OTA 专用包装（badge：`OTA · 远程 Bundle`） |
| 构建产物（RN 侧） | `bundle-server/dist/bundles/ota_<id>.<version>.ios.jsbundle` |
| 服务端存储（upload 后） | `bundle-server/data/bundles/ota_<id>.<version>.ios.jsbundle` |

## 发版流程

```bash
# 1. 更新 rn_app/package.json 版本号

# 2. 构建
cd rn_app
npm run build:bundles:dev    # DEV；发版用 npm run build:bundles

# 3. 上传（版本号与 package.json 一致）
cd ../bundle-server
npm run dev
./scripts/upload-bundle.sh shared 0.0.7 dist/bundles/ota_shared.0.0.7.ios.jsbundle
./scripts/upload-bundle.sh order 0.0.7 dist/bundles/ota_order.0.0.7.ios.jsbundle
./scripts/upload-bundle.sh promo 0.0.7 dist/bundles/ota_promo.0.0.7.ios.jsbundle

# 4. 校验（含 sharedBundle）
curl -s http://127.0.0.1:3001/api/manifest | jq '{sharedBundle, features: [.features[] | {id, version, sizeBytes}]}'
```

## 日常 UI 开发改哪里？

大多数 UI 改动应在 **`screens/remote/`** 或 **`screens/remote/components/`** 完成（Metro HMR）。

仅当需要修改 OTA 专用标识、文案或 upload 独有逻辑时，才编辑本目录下的 OTA 包装页。

## 不要做什么

- ❌ 不要让 `index.js`、`src/features/`、`screens/remote/` 在 runtime import 本目录（除共享 components 被 OTA 包装 import 外）
- ❌ 不要改完这里只跑 Metro 就以为已生效

## 更多信息

- [docs/dynamic-multi-bundle.md](../../docs/dynamic-multi-bundle.md) — Remote 双路径架构
- OpenSpec change: `ota-screens-build-scope-guard` — 目录 colocate + ESLint/Metro/verify 护栏
