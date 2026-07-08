## Why

Scheme 2 (dynamic multi-bundle) already supports server-controlled RN entry points via `bundle-server` manifest and `FeatureHost`, but bundle updates still require manual rebuild/copy and Release cannot safely hot-load remote bundles. We need a complete OTA pipeline—upload packaged bundles to Node.js, compare versions on device, cache locally, and load split bundles without duplicating React—so dynamic RN pages can update without a native App Store release.

## What Changes

- Extend `bundle-server` manifest with per-feature `version`, `hash`, `minAppVersion`, and versioned `bundleUrl`
- Add `POST /api/bundles/upload` to accept built `.jsbundle` files and auto-update manifest metadata
- Enhance `npm run build:bundles` to emit sha256 hashes alongside bundle artifacts
- Add RN modules: `bundleCache.ts`, `bundleUpdater.ts` (shared by native triggers, `FeatureHost`, and any RN page)
- Refactor `FeatureHost` / `bundleLoader` to compare local vs remote version, download, verify hash, cache to sandbox, and load split bundles
- Add iOS Native Module `SplitBundleLoader` wrapping `loadAndExecuteSplitBundleURL` for Release OTA (no full-bundle `eval`)
- Support OTA triggers from native shell (startup, pull-to-refresh) and from inside RN pages (check update button, silent preload)
- Implement fallback: use last good cache or main-bundle built-in dynamic features when download/verify/load fails
- Update documentation to reflect implemented OTA behavior (not just target design)

## Capabilities

### New Capabilities

- `bundle-manifest-ota`: Manifest schema and API responses include version/hash/minAppVersion; server persists and serves OTA metadata per feature
- `bundle-upload-service`: Upload endpoint, file storage, manifest auto-update after bundle publish
- `bundle-ota-client`: JS-side version compare, download, hash verify, sandbox cache, `bundleUpdater` API callable from FeatureHost and any RN screen
- `bundle-split-loader-ios`: iOS native module to load incremental split bundles in Release without React duplication

### Modified Capabilities

- _(none — no existing specs in `openspec/specs/` yet)_

## Impact

- **bundle-server**: `server.js`, `manifest.config.js`, new upload storage layout, possibly `manifest.json` persistence
- **rn_app**: `src/features/*`, `scripts/build-bundles.js`, `screens/dynamic/*` (optional update UI), new native module under `ios/`
- **ios_native**: optional startup pre-check hook; no breaking changes to Scheme 1
- **BrownfieldLib / brownfield package**: may need rebuild after native module added
- **Dependencies**: likely `@react-native-async-storage/async-storage`, `react-native-fs` or equivalent for file cache (evaluate in design)
- **Docs**: `docs/dynamic-multi-bundle.md` OTA section moves from "target" to "implemented"
