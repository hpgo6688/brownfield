## Context

Remote OTA pages load through `FeatureHost` → `useFeatureHost`. On every mount (user navigates away and back, or native shell re-opens the RN view), the effect:

1. Sets `Screen = null` → `loading: true` (spinner / blank)
2. Calls `clearFeatureRegistration(featureId)` and `clearLoadedBundlesForFeature(featureId)`
3. Runs `ensureFeatureCached` (manifest fetch + optional staging download)
4. Calls `loadFeatureBundle(..., { force: true })` even when split segment was already loaded

Disk cache reuse already works: `ensureFeatureCached` skips re-download when version matches. The problem is **in-memory** state is wiped and split bundle is re-evaluated on every entry, so users always see loading even with identical versions.

Existing building blocks:
- `__OTA_COMPONENT_CACHE__` + `syncOtaRegistrationFromCache` — rehydrate JS registry after native segment stays loaded
- `loadFromNativeSplitBundle` — early return when `isFeatureLoadedFromOta(feature.id)` is true
- `shouldBustOtaComponentCache` — invalidate when version/path changes
- `otaBundleRevision` — intentional full reload after user applies pending update

Constraints:
- OTA-only; Metro dev path unchanged
- Pending update flow (poll banner, deferred apply) must still work
- Native split segments persist across RN view remounts in Brownfield

## Goals / Non-Goals

**Goals:**

- Instant re-entry to Remote OTA pages when active cache version+hash matches remote (no loading flash)
- Reuse in-memory OTA registration and native split segment when safe
- Preserve full bootstrap for cold start, version change, pending apply, and explicit revision bump
- **Never promote or load an incomplete bundle** when remote version differs — active version stays on last verified release until download fully passes hash + content validation
- Add test coverage for fast-path vs full-path guards and download integrity failures

**Non-Goals:**

- Cross-session persistence without disk cache (app process kill still needs disk bootstrap)
- Skipping background poll / staging download on re-entry (non-blocking only)
- Caching across different `featureId` values
- Changing manifest server or upload pipeline

## Decisions

### 1. Fast path in `useFeatureHost` before destructive reset

**Choice:** At the start of OTA load, read active metadata from disk. If file is usable and `syncOtaRegistrationFromCache` succeeds (matching version/path), set `Screen` immediately and mark `screenReady` without clearing registration or showing loading.

Then run `ensureFeatureCached` asynchronously for staging/poll side effects; only fall back to full load if cache is stale, version differs, or component missing.

**Rationale:** Users perceive "loading" from `Screen === null`. Avoid resetting state when we can render from cache synchronously.

**Alternative:** Always reset then load — current behavior; rejected (bad UX).

**Alternative:** Keep previous `Screen` in state across unmount — rejected (stale screen if version changed while away).

### 2. Conditional clear of registration / loaded-bundle keys

**Choice:** Only call `clearFeatureRegistration` + `clearLoadedBundlesForFeature` when:
- `otaBundleRevision` changed (explicit reload)
- Active cache version/path differs from in-memory stamp
- `shouldBustOtaComponentCache` returns true
- Fast path probe fails (no component after sync)

**Rationale:** Clearing on every entry defeats `loadFromNativeSplitBundle` early return and forces `force: true` reload.

### 3. Remove unconditional `force: true` on repeat load

**Choice:** Pass `force: false` (default) when active metadata matches remote and OTA component is already registered. Reserve `force: true` for first load, version change, and post-apply reload.

**Rationale:** `loadFeatureBundle` already skips when `isFeatureLoadedFromOta` and loadKey present; `force` bypasses that guard today.

### 4. Lightweight remote check on fast path

**Choice:** Fast path uses **disk active metadata** as source of truth for version. Remote manifest compare still runs via existing `ensureFeatureCached` / `stageRemoteFeatureUpdate` in background after screen is shown.

If background check finds version mismatch, existing pending-update banner flow applies; do not auto-reload without user action (unchanged from polling design).

**Rationale:** Avoid blocking UI on network for re-entry. Disk cache was already validated on first load.

**Alternative:** Block on manifest fetch before render — rejected (reintroduces loading on slow network).

### 5. Helper: `tryReuseOtaFeature(featureId)`

**Choice:** Extract a small pure-ish helper (in `useFeatureHost.ts` or `bundleLoader.ts`) that:
1. Reads active metadata + verifies file usable
2. Calls `syncOtaRegistrationFromCache` with expected version/path
3. Returns component if `getFeatureComponent(featureId, { otaOnly: true })` is non-null

**Rationale:** Single place for fast-path logic; unit-testable without React.

### 6. Atomic verify-before-metadata on version mismatch

**Choice:** Keep and enforce two-phase persistence for all download/apply paths:

1. Download full body to memory (or pending file path)
2. Verify sha256 against manifest `hash` AND `validateOtaBundleContent`
3. Only on success: write bundle file, then write `metadata.json` / `pending.json`
4. On any failure: delete partial bundle file; do NOT write or update metadata version

For `applyPendingFeature`: re-run hash + content validation on pending file before promoting to active metadata (defense in depth if file was corrupted after download).

Fast path and repeat entry MUST NOT switch to a newer version until active metadata points to a verified bundle. Background pending download failures leave active cache unchanged.

**Rationale:** User explicitly requires that incomplete downloads must not bump version or be used. Prevents broken half-files from replacing a working screen.

**Alternative:** Write metadata first then download — rejected (would expose wrong version to loaders).

**Alternative:** Trust pending metadata without re-verify on apply — rejected; add lightweight re-verify on apply.

## Risks / Trade-offs

- **[Risk] Stale in-memory component after silent hash-only server change** → Mitigation: polling still downloads pending; same-version hash-only changes are intentionally deferred to user apply per existing OTA model. Full reload on `otaBundleRevision` bump.
- **[Risk] Fast path renders old UI while disk metadata drifted** → Mitigation: `reconcileActiveBundleCache` runs in `ensureFeatureCached`; if file missing, background path triggers error UI update.
- **[Risk] Native segment loaded but JS registry empty after RN reload** → Mitigation: `syncOtaRegistrationFromCache` + `loadFromNativeSplitBundle` fallback without `force` re-eval only if registration still missing.
- **[Trade-off] Brief moment showing cached screen before background staging completes** → Acceptable; matches "instant re-entry" goal.
- **[Risk] Partial file on disk after crash mid-write** → Mitigation: `isCachedBundleUsable` + `clearUnusableActiveMetadata` / pending cleanup; metadata written only after verified write; orphan files without metadata are ignored.
- **[Risk] Fast path blocked from new version while background download in progress** → Mitigation: intentional — user keeps last good version until pending is verified and explicitly applied (or bootstrap completes for first load).

## Migration Plan

1. Implement fast path + conditional clears behind existing OTA mode gate
2. Add unit tests for helper and `useFeatureHost` decision matrix
3. Manual smoke: OTA Order/Promo — open → back → re-open (no loading); upload new version → banner → apply → reload
4. No server migration; no cache format change

## Open Questions

- (none) — fast path gated on active metadata match; remote verify stays async via existing poller
