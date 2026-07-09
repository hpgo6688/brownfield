## Why

After fixing `unknown module 745032085`, each Remote OTA split bundle (order, promo) grew from ~280KB to **~2MB** because React Navigation, `react-native-screens`, `react-native-gesture-handler`, and transitive deps are **bundled into every feature split**. A handful of simple pages should not cost 2MB per feature — download, disk cache, and session validation all scale with bundle size. We need a **shared common split** loaded once per app session so feature bundles carry only feature-specific UI and logic.

## What Changes

- Add **`ota_shared` common split bundle** build target: React Navigation stack, screens, gesture-handler, and other cross-feature RN dependencies
- Shrink **`ota_order` / `ota_promo`** splits to feature-owned code only (`bundles/ota_*`, `screens/remote/order|promo`, shared UI components used by one feature)
- Define **load order contract**: shared segment MUST load before any feature segment; client tracks shared version/hash
- Extend **manifest / bundle-server** with optional `sharedBundle` metadata (url, version, hash, segmentId) or a dedicated `shared` pseudo-feature
- Update **`build-bundles.js`** exclusion graph: move `@react-navigation/*`, `react-native-screens`, `react-native-gesture-handler` from per-feature split to shared split
- Update **OTA client** (`bundleLoader`, `bundleUpdater`) to ensure shared bundle cached and loaded before feature split
- Add **size regression guard** in build: feature split target &lt; 500KB (order of magnitude); shared bundle documented separately in admin/manifest
- **Breaking (OTA)**: feature bundle hash changes; requires coordinated upload of `ota_shared` + feature bundles at same release version

## Capabilities

### New Capabilities

- `ota-shared-deps-bundle`: Common split artifact, build scope, segment id, load-before-feature contract, and versioning

### Modified Capabilities

- `ota-bundle-build-prefix`: Add `ota_shared.<version>.ios.jsbundle` output and manifest entry
- `bundle-split-loader-ios`: Document multi-segment load ordering (shared segment before feature segment)
- `bundle-upload-service`: Upload/persist shared bundle; `build-manifest.json` includes shared entry
- `bundle-manifest-ota`: Manifest exposes shared bundle url/hash for client bootstrap
- `bundle-ota-client`: Download, cache, and load shared bundle before feature split; session marks for shared re-entry

## Impact

- **`rn_app/scripts/build-bundles.js`**: New shared entry, revised `isFeatureOwnedBySplit` / exclusion rules, size audit
- **`rn_app/bundles/ota_shared/`**: New minimal entry (warm shared deps, no feature registration)
- **`rn_app/config/feature-segments.json`**: New shared segment id (e.g. `0`)
- **`rn_app/src/features/bundleLoader.ts`**, **`bundleUpdater.ts`**, **`manifest.ts`**: Shared-first load path
- **`bundle-server`**: Optional shared release row or manifest field; admin shows shared + feature sizes
- **`ios/BrownfieldLib/SplitBundleLoader`**: Verify segment 0 / ordering (likely no API change)
- **Docs / CI**: Upload order, version lockstep, rollback if shared/feature mismatch
- **Risk**: Reintroducing `unknown module` if shared not loaded — mitigated by mandatory shared bootstrap + audit
