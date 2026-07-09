# OTA shared bundle split — why 2MB per feature and target sizes

**Date:** 2026-07-09  
**Change:** `ota-shared-deps-common-bundle`

## Problem

After fixing `unknown module 745032085`, `build-bundles.js` packed `@react-navigation/*`, `react-native-screens`, and `react-native-gesture-handler` into **each** feature split (`ota_order`, `ota_promo`). Simple pages (~3 screens) grew from ~280KB to **~2MB per feature**.

## Root cause

Metro `modulesOnly` splits must define every module id referenced by the feature bundle. Navigation stack deps were marked feature-owned to avoid main-only references at runtime — but that duplicated ~1.5MB per feature.

## Solution

Introduce **`ota_shared.<version>.ios.jsbundle`** (segment **0**):

1. Shared split owns navigation + `RemoteScreenShell` + shared remote components
2. Feature splits own only `bundles/ota_*` + `screens/remote/{order,promo}/`
3. Client loads shared segment **before** any feature segment
4. Manifest exposes top-level `sharedBundle` (version, hash, bundleUrl, segmentId, sizeBytes)

## Target sizes (dev build 0.0.7 — first implementation)

| Artifact | Before | After (measured) |
|----------|--------|------------------|
| `ota_shared` | — | **2.25 MB** |
| `ota_order` | ~2 MB | **1.32 MB** |
| `ota_promo` | ~2 MB | **1.48 MB** |

Second feature entry saves re-downloading shared segment. Further graph tuning needed to hit ~500KB feature target (e.g. exclude `registerFeature` infra from feature splits).

**后续：** 若体积仍不满足弱网 / 成本目标，见 [OTA Bundle 压缩与体积优化路线](../ota-bundle-compression-roadmap.md)（HTTP 传输压缩优先于磁盘压缩）。

## Upload contract

Upload **shared + order + promo** at the same release version:

```bash
./scripts/upload-bundle.sh shared <version> dist/bundles/ota_shared.<version>.ios.jsbundle
./scripts/upload-bundle.sh order <version> dist/bundles/ota_order.<version>.ios.jsbundle
./scripts/upload-bundle.sh promo <version> dist/bundles/ota_promo.<version>.ios.jsbundle
```

## Rollback

Revert `isSharedOwnedBySplit` / client `ensureSharedSegmentLoaded` and restore monolithic per-feature nav deps in `build-bundles.js` (previous behavior — larger bundles, no shared load step).
