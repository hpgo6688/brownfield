> **Scope note:** OTA applies to **Remote entries** (远程业务块), not Scheme 1 core RN. **Scheme 2** in tasks below means the split-bundle + manifest **technique**, not duplicate Scheme 1 pages.

## 1. Server — Manifest OTA metadata

- [x] 1.1 Persist Remote entry OTA metadata (Prisma `Feature` / `BundleRelease`; replaces original `manifest.store.json` design)
- [x] 1.2 Extend `GET /api/manifest` with `version`, `hash`, `minAppVersion`, `bundleUrl` per Remote entry
- [x] 1.3 Support optional `appVersion` query param to filter by `minAppVersion`
- [x] 1.4 Add smoke script `scripts/smoke-manifest.js` (`npm run smoke:manifest`)

## 2. Server — Upload API

- [x] 2.1 Add `POST /api/bundles/upload` (multipart: `featureId`, `version`, `file`)
- [x] 2.2 Compute sha256 on upload and persist file to `dist/bundles/`
- [x] 2.3 Update active release in DB after upload (version/hash/bundleUrl via manifest service)
- [x] 2.4 Add `scripts/upload-bundle.sh` example for CI

## 3. Build pipeline

- [x] 3.1 Extend `scripts/build-bundles.js` to accept `--version` or read from package.json
- [x] 3.2 Emit `build-manifest.json` with per-entry hash and filename
- [x] 3.3 Document upload workflow in `docs/dynamic-multi-bundle.md` with Remote terminology

## 4. RN client — Cache and compare

- [x] 4.1 Add filesystem dependency (`react-native-fs`) to `rn_app`
- [x] 4.2 Implement `bundleCache.ts` (metadata, sandbox paths, prune old versions)
- [x] 4.3 Implement semver + hash compare in `bundleUpdater.ts`
- [x] 4.4 Update `manifest.ts` types for OTA fields

## 5. RN client — Download, load, fallback

- [x] 5.1 Implement `checkAndUpdateFeature` and `preloadFeatures` in `bundleUpdater.ts`
- [x] 5.2 Refactor `bundleLoader.ts`: Metro `modulesOnly=true` for Dev; native split load in Release
- [x] 5.3 Refactor `FeatureHost.tsx` to use `bundleUpdater`
- [x] 5.4 Fallback chain: OTA cache → main bundle `registerFeature` registry
- [x] 5.5 Add "检查更新" on PromoScreen via `bundleUpdater`

## 6. iOS native — SplitBundleLoader

- [x] 6.1 Create `SplitBundleLoader` in `rn_app/ios/BrownfieldLib`
- [x] 6.2 Wire `NativeModules.SplitBundleLoader.load(fileUrl)` in `bundleLoader.ts`
- [x] 6.3 Verify module included in BrownfieldLib (`pod install` + pbxproj; build via workspace)
- [x] 6.4 Rebuild `brownfield:package:ios:debug` and verify host app (manual: `cd rn_app && npm run brownfield:package:ios:debug`)

## 7. Native shell — Remote menu

- [x] 7.1 Document JS-only preload in `docs/dynamic-multi-bundle.md`
- [x] 7.2 Rename menu section: **「远程业务 / Remote」**; Scheme 1 unchanged
- [x] 7.3 Remote menu driven by `BundleManifestService` (ContentView + refreshable)

## 8. Verification and docs

- [x] 8.1 E2E smoke script: `npm run smoke:e2e` (upload → manifest version bump)
- [x] 8.2 Fallback documented in docs (server down → built-in Remote registry)
- [x] 8.3 Dev Metro path documented (`USE_METRO_BUNDLES=true`)
- [x] 8.4 Update `docs/dynamic-multi-bundle.md` OTA table and terminology

## 9. Remote entry model — terminology & demo restructure

- [x] 9.1 Reseed bundle-server with Remote-only entries (`order`, `promo`)
- [x] 9.2 Add `screens/remote/` + `bundles/order/`, `bundles/promo/`; removed `screens/dynamic/`
- [x] 9.3 Update `index.js` `registerFeature` for Remote pages only
- [x] 9.4 Add `POST /api/features` + Admin create form
- [x] 9.5 Code + docs aligned with Remote / Scheme 1 / Scheme 2 (tech) glossary
