## Why

Today OTA Remote pages either auto-download on entry (`FeatureHost`) or require the user to manually tap **「检查 Remote 更新」** on PromoScreen — there is no background polling, and downloaded updates apply immediately without explicit user consent. In OTA mode, users should be notified when a newer bundle is available on the server, choose when to apply it, and complete the update with a clear **「立即更新」** action.

## What Changes

- Add **background polling** in OTA mode on Remote OTA pages: periodically fetch manifest and compare version/hash against local cache
- When an update is available, **download bundle to sandbox in the background** (reuse `bundleUpdater` verify/cache path) without reloading the running screen
- Show a **non-blocking update prompt** (banner or bottom sheet) on the OTA page: new version label, short message, **「立即更新」** and dismiss/snooze
- On **「立即更新」**, apply cached bundle: clear registration, reload split bundle via existing loader, refresh UI (reuse `applyRemoteFeatureUpdates` / `bumpOtaBundleRevision` pattern)
- Split updater API into **check-only**, **download-only**, and **apply** phases so polling does not auto-reload
- Gate polling to **OTA mode only** (`FeatureHost` OTA path / `getForceOtaInDev()`); Metro dev pages unchanged
- Configurable poll interval and pause when app backgrounded (defaults documented in design)
- Remove or demote manual-only update UX on PromoScreen in favor of polling + prompt (keep manual check as fallback optional)

## Capabilities

### New Capabilities

- `ota-polling-update`: Background manifest polling, staged download, and user-confirmed apply flow for OTA Remote pages

### Modified Capabilities

- (none — no archived specs in `openspec/specs/`; behavior extends existing `bundleUpdater` / `FeatureHost` client patterns from scheme2)

## Impact

- **`rn_app/src/features/`**: new `otaUpdatePoller.ts` (or similar), extend `bundleUpdater.ts` with staged update APIs, `featureReload.ts` apply hook
- **`rn_app/src/features/FeatureHost.tsx`**: mount polling + update prompt wrapper in OTA mode
- **`rn_app/bundles/ota_*/screens/`** or shared **`OtaUpdatePrompt`** component**: UI for pending update
- **`rn_app/screens/remote/PromoScreen.tsx`**: align manual check with new staged flow (optional fallback)
- **Docs**: `docs/dynamic-multi-bundle.md` — OTA polling + user apply workflow
- **No server changes** — uses existing manifest and upload pipeline
