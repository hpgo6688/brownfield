## 1. Server — Manifest OTA metadata

- [ ] 1.1 Add `manifest.store.json` persistence layer and merge with `manifest.config.js` defaults
- [ ] 1.2 Extend `GET /api/manifest` response with `version`, `hash`, `minAppVersion`, `bundleUrl` per feature
- [ ] 1.3 Support optional `appVersion` query param to filter features by `minAppVersion`
- [ ] 1.4 Add unit/smoke test script for manifest v2 response shape

## 2. Server — Upload API

- [ ] 2.1 Add `POST /api/bundles/upload` (multipart: `featureId`, `version`, `file`)
- [ ] 2.2 Compute sha256 on upload and persist file to `dist/bundles/`
- [ ] 2.3 Auto-update `manifest.store.json` with new version/hash/bundleUrl after upload
- [ ] 2.4 Add `scripts/upload-bundle.sh` example using curl for CI

## 3. Build pipeline

- [ ] 3.1 Extend `scripts/build-bundles.js` to accept `--version` or read from package.json
- [ ] 3.2 Emit `build-manifest.json` with per-feature hash and filename
- [ ] 3.3 Document upload workflow in `docs/dynamic-multi-bundle.md` (target → implemented steps)

## 4. RN client — Cache and compare

- [ ] 4.1 Add filesystem dependency (`react-native-fs` or equivalent) to `rn_app`
- [ ] 4.2 Implement `bundleCache.ts` (read/write metadata, sandbox paths, prune old versions)
- [ ] 4.3 Implement semver + hash compare utilities in `bundleUpdater.ts`
- [ ] 4.4 Update `manifest.ts` types for OTA fields (`version`, `hash`, `minAppVersion`)

## 5. RN client — Download, load, fallback

- [ ] 5.1 Implement `checkAndUpdateFeature` and `preloadFeatures` in `bundleUpdater.ts`
- [ ] 5.2 Refactor `bundleLoader.ts`: Metro `modulesOnly=true` for Dev; no eval in Release
- [ ] 5.3 Refactor `FeatureHost.tsx` to use `bundleUpdater` instead of inline load logic
- [ ] 5.4 Add fallback chain: OTA cache → main bundle `registerFeature` registry
- [ ] 5.5 Add "检查更新" action to `DynamicSettingsScreen` calling `bundleUpdater`

## 6. iOS native — SplitBundleLoader

- [ ] 6.1 Create `SplitBundleLoader` native module in `rn_app/ios` (load split bundle URL)
- [ ] 6.2 Wire JS `NativeModules.SplitBundleLoader.load(fileUrl)` in `bundleLoader.ts` for Release
- [ ] 6.3 Verify module is included in BrownfieldLib package build
- [ ] 6.4 Rebuild `brownfield:package:ios:debug` and verify host app links updated XCFramework

## 7. Native shell — Optional startup hook

- [ ] 7.1 (Optional) Add app-start manifest pre-fetch in `ios_nativeApp` or document JS-only pre-check
- [ ] 7.2 Verify Scheme 1 pages unaffected; Scheme 2 menu refresh still works

## 8. Verification and docs

- [ ] 8.1 End-to-end test: build → upload → manifest shows new version → app downloads → page renders updated dynamic screen
- [ ] 8.2 Test fallback: stop server, confirm cached or built-in dynamic screen still loads
- [ ] 8.3 Test Dev path: `USE_METRO_BUNDLES=true` + Metro split load still works
- [ ] 8.4 Update `docs/dynamic-multi-bundle.md` OTA section status table (待做 → 已有)
