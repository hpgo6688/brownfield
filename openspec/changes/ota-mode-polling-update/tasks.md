## 1. Staged updater APIs

- [x] 1.1 Extend `bundleCache` metadata with pending fields (`pendingVersion`, `pendingPath`, `pendingHash`) or sibling `pending.json` per feature
- [x] 1.2 Add `checkRemoteFeature(featureId)` — manifest compare against **active** cached version only (no download)
- [x] 1.3 Add `downloadPendingFeature(feature)` — verify hash, write bundle, set pending metadata without changing active load path
- [x] 1.4 Add `applyPendingFeature(featureId)` — promote pending → active, integrate with `loadFeatureBundle` + registration clear
- [x] 1.5 Keep `checkAndUpdateFeature` for bootstrap; document when to use staged vs all-in-one

## 2. OTA polling provider

- [x] 2.1 Create `otaUpdatePoller.ts` (or hook) with configurable interval (default 20s), in-flight guard, AppState pause/resume
- [x] 2.2 Poll only when OTA mode active (`getForceOtaInDev()` or release OTA path); scope to current `featureId`
- [x] 2.3 On update detected: call download pending; expose `{ pendingUpdate, downloading, error }` state

## 3. Update prompt UI

- [x] 3.1 Create `OtaUpdateBanner` component — pending version label, **「立即更新」**, dismiss **「稍后」**
- [x] 3.2 Wire banner into `FeatureHost` overlay when OTA mode + pending update exists
- [x] 3.3 **「立即更新」** calls `applyPendingFeature` + `bumpOtaBundleRevision`; show loading during apply

## 4. Integrate existing screens

- [x] 4.1 Refactor `FeatureHost` initial load: bootstrap without prompt when no cache; start polling after first render in OTA mode
- [x] 4.2 Refactor `PromoScreen` manual **「检查 Remote 更新」** to use staged check + download (trigger poll-now, not auto-reload)
- [x] 4.3 Add poll interval constant to `remoteConfig.ts` (or env override for dev)

## 5. Documentation and verification

- [x] 5.1 Update `docs/dynamic-multi-bundle.md` with OTA polling + user apply flow
- [x] 5.2 Smoke test: stay on OTA Order 0.0.2 → upload 0.0.3 → banner appears → tap **立即更新** → UI shows 0.0.3
- [x] 5.3 Verify Metro mode: no polling, no banner, HMR unchanged
