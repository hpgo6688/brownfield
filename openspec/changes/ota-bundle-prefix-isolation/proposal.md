## Why

Remote feature pages currently share the same screen source (`screens/remote/`) and module names (`OrderScreen`, `PromoScreen`) between Metro dev and OTA split bundles. When developers toggle OTA/Metro mode in the DEBUG shell, registrations and bundle paths can collide—Metro hot-reload changes may appear in OTA bundles, or stale OTA registrations may leak into Metro sessions. We need explicit naming and loading isolation so each mode uses a distinct artifact with no cross-fallback.

## What Changes

- Add `ota_` prefix to Remote split-bundle outputs when building for upload (e.g. `ota_order.1.0.0.ios.jsbundle`, `ota_promo.1.0.0.ios.jsbundle`)
- Introduce OTA-specific bundle entry points under `bundles/ota_<featureId>/` that register components as `ota_<ModuleName>` (e.g. `ota_OrderScreen`)
- Add OTA screen sources under `screens/ota/` (or equivalent) so OTA bundles do not re-export Metro dev screens
- Enforce strict runtime routing in `FeatureHost`:
  - **OTA mode** → download/load only from bundle-server manifest; `otaOnly` registry lookup; no Metro dev import and no main-bundle fallback
  - **Metro mode** → load only from `screens/remote/` via Metro dynamic import; no OTA cache or split-bundle load
- Update upload scripts, build manifest, and docs to reflect `ota_`-prefixed artifact names
- **BREAKING**: Existing uploaded bundles named `order.*.ios.jsbundle` must be re-built and re-uploaded with `ota_` prefix; cached sandbox bundles from old names should be invalidated on first OTA load

## Capabilities

### New Capabilities

- `ota-bundle-build-prefix`: Build pipeline outputs `ota_`-prefixed split bundles and build-manifest entries for Remote upload
- `ota-metro-runtime-isolation`: FeatureHost and registry enforce mode-specific load paths with no cross-fallback between OTA remote bundles and Metro dev screens

### Modified Capabilities

- _(none — no specs in `openspec/specs/` yet; this change introduces new capability specs only)_

## Impact

- **rn_app**: `scripts/build-bundles.js`, `bundles/ota_*`, `screens/ota/`, `FeatureHost.tsx`, `metroDevFeatures.ts`, `registerFeature.ts`, `remoteConfig.ts`
- **bundle-server**: upload script examples, optional manifest/build-manifest field docs (featureId unchanged; file naming convention changes)
- **ios_native**: no native API changes; existing `DevOtaMode` toolbar toggle continues to drive mode switch
- **Docs**: `docs/dynamic-multi-bundle.md`, fix notes for re-upload after prefix migration
