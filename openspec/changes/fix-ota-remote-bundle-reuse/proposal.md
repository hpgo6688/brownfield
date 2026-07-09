## Why

In OTA mode, every time the user opens a Remote business page (e.g. Order, Promo), `FeatureHost` resets UI to a loading state and re-runs the full bundle bootstrap — clearing in-memory registration, invalidating loaded-bundle tracking, and forcing split-bundle reload — even when the active cached version already matches the remote manifest. This makes repeat visits feel slow and unnecessary; users expect instant re-entry when nothing has changed on the server.

## What Changes

- Add an **in-session fast path** in `useFeatureHost` / OTA load flow: when active disk cache version+hash matches remote and the OTA component is already registered (or rehydratable from `__OTA_COMPONENT_CACHE__`), render immediately without showing the loading shell
- **Stop clearing** feature registration and loaded-bundle keys on every page entry when the active cached version is unchanged
- **Skip forced split-bundle reload** (`loadFeatureBundle` with `force: true`) when native segment is already loaded for the same bundle path/version
- Keep full bootstrap path for first load, version mismatch, pending apply, deferred apply, and `otaBundleRevision` bump (user tapped **立即更新**)
- Background manifest check / pending staging (`stageRemoteFeatureUpdate`, poller) continues without blocking instant re-entry
- **Enforce bundle integrity on version mismatch**: download → verify (sha256 + OTA content) → write file → only then update metadata; incomplete, truncated, or hash-mismatched bundles MUST NOT update active/pending version and MUST NOT be loaded; keep serving last good active cache on failure

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `bundle-ota-client`: (1) `FeatureHost` reuses in-memory and on-disk OTA bundle when active cache matches remote version; (2) version-mismatch downloads are atomic — metadata/version promotion only after verified complete bundle

## Impact

- **`rn_app/src/features/useFeatureHost.ts`**: fast-path logic before reset/clear; conditional skip of loading state
- **`rn_app/src/features/bundleLoader.ts`**: avoid `force` reload when OTA segment already loaded for same path
- **`rn_app/src/features/registerFeature.ts`**: reuse existing `syncOtaRegistrationFromCache` / `shouldBustOtaComponentCache` (no API break)
- **`rn_app/src/features/bundleUpdater.ts`**: optional lightweight cache-only check before network on fast path; harden verify-before-metadata for active/pending/apply paths
- **`rn_app/src/features/bundleCache.ts`**: reject unusable partial files via existing `isCachedBundleUsable` / cleanup helpers
- **Tests**: unit tests for fast-path guards and incomplete-download rejection (hash fail, truncated body, apply blocked)
- **No server / manifest schema changes**
