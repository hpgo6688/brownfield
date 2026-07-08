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
- [x] 5.5 Add "检查更新" on a Remote settings/demo page via `bundleUpdater`

## 6. iOS native — SplitBundleLoader

- [x] 6.1 Create `SplitBundleLoader` in `rn_app/ios/BrownfieldLib`
- [x] 6.2 Wire `NativeModules.SplitBundleLoader.load(fileUrl)` in `bundleLoader.ts`
- [ ] 6.3 Verify module included in BrownfieldLib package build (`pod install` + package)
- [ ] 6.4 Rebuild `brownfield:package:ios:debug` and verify host app

## 7. Native shell — Remote menu

- [ ] 7.1 Document JS-only preload option (or optional startup hook); manifest refresh stays Swift
- [ ] 7.2 Rename menu section: **「远程业务 / Remote」**; verify Scheme 1 section unchanged
- [ ] 7.3 Verify Remote menu still driven by `BundleManifestService`

## 8. Verification and docs

- [ ] 8.1 E2E: build Remote bundle → upload → manifest version bump → app downloads → page renders
- [ ] 8.2 Fallback: server down → cached or built-in Remote page still loads
- [ ] 8.3 Dev: `USE_METRO_BUNDLES=true` + Metro split load
- [x] 8.4 Update `docs/dynamic-multi-bundle.md` OTA table and terminology (Remote vs Scheme 1 vs Scheme 2 tech)

## 9. Remote entry model — terminology & demo restructure

- [ ] 9.1 Reseed bundle-server with Remote-only entries (`order`, `promo`) — remove mirror of Scheme 1 tabs
- [ ] 9.2 Add `screens/remote/` pages + `bundles/order/`, `bundles/promo/` entries (deprecate `screens/dynamic/Dynamic*Screen` demo)
- [ ] 9.3 Update `index.js` `registerFeature` to register Remote pages only (not Scheme 1 duplicates)
- [ ] 9.4 Add `POST /api/features` (or Admin UI) to **create new Remote entry** before first upload
- [ ] 9.5 Align OpenSpec specs + README with Remote / Scheme 1 / Scheme 2 (tech) glossary — docs done; code migration pending
