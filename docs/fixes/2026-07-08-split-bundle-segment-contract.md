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

## Follow-up (2026-07-08): TurboModule crash on `self.bridge`

**Symptom**: `-[SplitBundleLoader bridge]: unrecognized selector sent to instance` under New Architecture (`fabric: true`).

**Cause**: Refactor removed explicit `@synthesize bridge = _bridge`. TurboModule `NSInvocation` calls the getter; protocol-only `@property` does not guarantee an implementation.

**Fix**: Restore `__weak RCTBridge *_bridge` + `@synthesize bridge`, `IsBridgelessProxy` logging, and `ActiveBridge()` helper. Keep `registerSegmentWithId:path:` + JS-provided `segmentId`.

## Follow-up (2026-07-08): `NO_LOADER` on bridgeless proxy

**Symptom**: `Split bundle loading is unavailable for this React Native runtime` while RN host is running.

**Cause**: `RCTBridgeProxy` is an `NSProxy`. `respondsToSelector:@selector(registerSegmentWithId:path:)` returns **NO** (signature lookup forwards to empty `RCTCxxBridge`), even though the method is implemented on the proxy. Code rejected before calling the real API.

**Fix**:
- Detect bridgeless via `respondsToSelector:@selector(object)` and call `registerSegmentWithId:` directly (no `respondsToSelector` gate).
- Legacy path uses `[RCTCxxBridge registerSegmentWithId:path:]` (not `executeApplicationScript`).
- Added TurboModule + Codegen: `src/specs/NativeSplitBundleLoader.ts`, `codegenConfig`, `getTurboModule` → `NativeSplitBundleLoaderSpecJSI`.
