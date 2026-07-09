## 1. Fast-path helper

- [x] 1.1 Add `tryReuseOtaFeature(featureId)` helper that reads active metadata, verifies bundle file usable, calls `syncOtaRegistrationFromCache`, and returns OTA component or null
- [x] 1.2 Add unit tests for helper: usable cache + restored component, missing file, version/path mismatch bust

## 2. useFeatureHost fast path

- [x] 2.1 Before clearing registration/loaded keys, probe fast path when OTA mode is active and `otaBundleRevision` unchanged
- [x] 2.2 On fast-path hit: set `Screen` + `screenReady` immediately (no loading flash); skip `clearFeatureRegistration` / `clearLoadedBundlesForFeature`
- [x] 2.3 Run `ensureFeatureCached` in background after fast render; on failure or missing component fall back to full load + error UI
- [x] 2.4 Keep full bootstrap path for: no cache, `runtimeReloadRequired`, fast-path miss, version/path bust via `shouldBustOtaComponentCache`

## 3. bundleLoader guard

- [x] 3.1 Stop passing unconditional `force: true` from `useFeatureHost` when OTA component already registered for same path
- [x] 3.2 Verify `loadFromNativeSplitBundle` early return works when registration cleared but native segment + `__OTA_COMPONENT_CACHE__` remain

## 4. Download integrity (version mismatch)

- [x] 4.1 Audit `verifyAndPersistActive` / `verifyAndPersistPending`: metadata written only after hash + `validateOtaBundleContent` pass; partial files deleted on failure
- [x] 4.2 Harden `applyPendingFeature`: re-verify pending file hash + content before promoting to active metadata; on failure clear pending and keep active version
- [x] 4.3 Ensure fast path / background staging never loads or switches to a bundle whose metadata was not fully verified
- [x] 4.4 Add unit tests: hash mismatch, truncated body, invalid OTA content, apply with corrupted pending — active version unchanged, partial file cleaned

## 5. Verification

- [ ] 5.1 Manual smoke OTA: open Order → native back → re-open (no loading spinner, same version)
- [ ] 5.2 Manual smoke: upload newer bundle → banner appears → **立即更新** triggers full reload
- [ ] 5.3 Manual smoke: simulate failed/incomplete download (e.g. bad hash) — app stays on previous version, no crash
- [x] 5.4 Run existing feature tests (`retryWithBackoff`, any `useFeatureHost` / bundle tests)
