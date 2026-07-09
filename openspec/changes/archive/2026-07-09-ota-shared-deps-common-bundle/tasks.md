## 1. Spike & build graph

- [x] 1.1 Add `bundles/ota_shared/index.js` entry (warm React Navigation stack, no feature registration)
- [x] 1.2 Add `"shared": 0` to `config/feature-segments.json` and document segment id map
- [x] 1.3 Refactor `build-bundles.js`: `isSharedOwnedBySplit` vs `isFeatureOwnedBySplit`; build `ota_shared` target
- [x] 1.4 Post-build size report + split-audit cross-bundle (feature deps satisfied by shared segment)
- [x] 1.5 Verify `ota_order` / `ota_promo` size drop vs current ~2MB baseline

## 2. Bundle server & manifest

- [x] 2.1 Extend manifest schema with `sharedBundle` (version, hash, bundleUrl, segmentId, sizeBytes)
- [x] 2.2 Support upload/persist of `ota_shared.<version>.ios.jsbundle` (shared feature row or dedicated handler)
- [x] 2.3 Admin UI: show shared bundle size in manifest summary or dedicated row
- [x] 2.4 Update `upload-bundle.sh` / README publish flow for shared + features lockstep

## 3. OTA client load path

- [x] 3.1 Add shared bundle cache paths and metadata (`rn-bundles/shared/`)
- [x] 3.2 Implement `ensureSharedBundleCached` + `loadSharedBundle` (segment 0) before feature load
- [x] 3.3 Session marks: `wasSharedBundleLoadedThisSession`, version/hash invalidation
- [x] 3.4 Integrate with instant re-entry / warmReentry / session usability cache
- [x] 3.5 Fallback when `sharedBundle` absent (legacy monolithic splits)

## 4. Tests & verification

- [x] 4.1 Unit tests: load order (shared before feature), legacy fallback
- [x] 4.2 `npm run build:bundles:dev` — manifest lists shared + features; size thresholds logged
- [x] 4.3 Manual: cold OTA order → promo → back → re-entry; no `unknown module`
- [x] 4.4 Manual: upload shared + features vNext together; Admin shows sizes

## 5. Documentation

- [x] 5.1 Update `docs/dynamic-multi-bundle.md` or case study with shared-bundle architecture diagram
- [x] 5.2 Add fix/ADR note on why 2MB happened and target sizes after split
