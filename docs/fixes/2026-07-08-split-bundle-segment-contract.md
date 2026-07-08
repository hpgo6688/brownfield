# Split bundle segment contract — registerSegmentWithId + segmentId from JS

**Date**: 2026-07-08

## Problem

OTA split bundle loading failed with `React Native runtime is not ready` or hung silently.

## Root cause

Two cross-layer contract bugs in `SplitBundleLoader.mm`:

1. **Wrong API on legacy path** — `executeApplicationScript:url:async:` runs a bundle as the main app entry, not as an incremental segment. It can destabilize the JS runtime.

2. **Wrong segment id** — Native used `[path hash]` instead of Metro/build-time segment ids. JS `require.requireAsync(id)` and native `registerSegmentWithId:` must share the same integer id.

## Solution

- Native: always call `registerSegmentWithId:path:` (legacy `RCTCxxBridge` and bridgeless proxy).
- Native API: `load(fileUrl, segmentId)` — segment id passed from JS.
- Single source of truth: `rn_app/config/feature-segments.json` (`order: 1`, `promo: 2`).
- JS: `bundleLoader` → `SplitBundleLoader.load(path, feature.segmentId)`.
- Server manifest includes `segmentId` from the same JSON file.
- Build manifest (`build-bundles.js`) records `segmentId` per bundle.

## Files changed

- `rn_app/ios/BrownfieldLib/SplitBundleLoader.mm`
- `rn_app/config/feature-segments.json`
- `rn_app/src/features/segmentRegistry.ts`
- `rn_app/src/features/splitBundleLoader.ts`
- `rn_app/src/features/bundleLoader.ts`
- `rn_app/src/features/manifest.ts`
- `rn_app/scripts/build-bundles.js`
- `bundle-server/src/services/manifest.service.ts`

## Verification

1. Rebuild BrownfieldLib: `npm run brownfield:package:ios:debug:sim`
2. Rebuild + upload OTA bundles if segment contract changed
3. Restart bundle-server (manifest now includes `segmentId`)
4. OTA toggle → check update → open Order/Promo
