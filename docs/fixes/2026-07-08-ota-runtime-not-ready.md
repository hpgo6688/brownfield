# OTA split bundle — React Native runtime is not ready

**Date**: 2026-07-08

## Problem

In OTA mode, remote pages failed to load with:

```
React Native runtime is not ready
```

Native rejected with `NO_RUNTIME` before the split bundle could execute.

## Root cause

Two issues in `SplitBundleLoader.mm` (RN 0.86 bridgeless / `RCTBridgeProxy`):

1. **Runtime detection** — `isKindOfClass:[RCTBridgeProxy class]` fails because `RCTBridgeProxy` subclasses `NSProxy`. `NSProxy` reports `+class` as `NSProxy`, so the kind check never matches and `RuntimeForBridge` returned `nullptr`.

2. **Promise timing** — `resolve(nil)` was called immediately after scheduling `invokeAsync`, before `evaluateJavaScript` finished. JS then called `getFeatureComponent` before `registerFeature` ran in the split bundle.

## Solution

- **Native (`SplitBundleLoader.mm`)**: Stop using `CallInvoker::invokeAsync` + `CurrentBridge()` (runtime was null in that callback). Use `RCTBridgeProxy`'s `dispatchBlock:queue:RCTJSThread` (`dispatchToJSThread`) to run on the JS runtime thread, capture the runtime pointer from the bridge at load time, and call `evaluateJavaScript` synchronously before resolving the promise.
- **JS (`bundleLoader.ts`)**: When OTA toggle is on, load cached file via native `SplitBundleLoader` before any Metro fallback.

## Files changed

- `rn_app/ios/BrownfieldLib/SplitBundleLoader.mm`
- `rn_app/src/features/bundleLoader.ts`

## Verification

1. Rebuild brownfield package: `npm run brownfield:package:ios:debug:sim` → **BUILD SUCCEEDED**
2. Run app from Xcode (or reinstall `ios_native` if it embeds the framework).
3. Toggle **OTA** on a Remote page → check for updates → open Order/Promo.
4. Page should load server bundle content without `NO_RUNTIME` error.

## Notes

- `RCTBridgeProxy.runtime` logs a migration warning; this is expected for split-bundle loading until RN exposes a public RuntimeExecutor API for third-party loaders.
