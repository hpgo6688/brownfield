## 1. OTA screen and bundle entry structure

- [x] 1.1 Add `screens/ota/OrderScreen.tsx` and `screens/ota/PromoScreen.tsx` with OTA-specific labels (distinct from Metro `screens/remote/` copies)
- [x] 1.2 Add `screens/ota/index.ts` exports and update `remoteConfig.ts` comments to match implemented paths
- [x] 1.3 Create `bundles/ota_order/index.js` registering `ota_OrderScreen` with `{ source: 'ota' }`
- [x] 1.4 Create `bundles/ota_promo/index.js` registering `ota_PromoScreen` with `{ source: 'ota' }`
- [x] 1.5 Remove or deprecate old `bundles/order/` and `bundles/promo/` entry re-exports from `screens/remote/`

## 2. Build pipeline prefix

- [x] 2.1 Update `scripts/build-bundles.js` bundle config: entries `bundles/ota_order/index.js`, output `ota_order.<version>.ios.jsbundle` (same for promo)
- [x] 2.2 Update `isFeatureOwnedBySplit` regex to match `bundles/ota_*` and `screens/ota/` paths
- [x] 2.3 Verify `build-manifest.json` records prefixed `file` names and correct hashes
- [x] 2.4 Update `bundle-server/scripts/upload-bundle.sh` usage comment and any npm scripts referencing bundle filenames

## 3. Runtime isolation (FeatureHost)

- [x] 3.1 Remove DEBUG cross-fallback in `FeatureHost.tsx`: Metro mode errors without OTA fallback; OTA mode errors without Metro/main fallback
- [x] 3.2 Ensure mode switch clears `clearFeatureRegistration(featureId)` and `clearLoadedBundlesForFeature(featureId)` before reload
- [x] 3.3 Confirm `metroDevFeatures.ts` only imports from `screens/remote/` with unprefixed module names and `source: 'main'`
- [x] 3.4 Verify OTA split load resolves component via `otaOnly: true` after bundle registers `ota_*` module names

## 4. Upload, cache, and verification

- [x] 4.1 Run `npm run build:bundles` and upload `ota_order.*` / `ota_promo.*` to bundle-server
- [x] 4.2 Clear app sandbox bundle cache (or reinstall) to drop unprefixed cached bundles
- [x] 4.3 Manual verify: Metro mode shows `screens/remote/` content with HMR; OTA mode shows `screens/ota/` markers from remote bundle
- [x] 4.4 Manual verify: toggling OTA ↔ Metro on same Remote page reloads without stale registration bleed
- [x] 4.5 Update `docs/dynamic-multi-bundle.md` with `ota_` naming convention and strict mode isolation notes
