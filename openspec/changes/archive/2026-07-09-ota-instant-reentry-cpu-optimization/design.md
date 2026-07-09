## Context

Instant OTA re-entry (live registry) already skips `SplitBundleLoader.load` and renders on first frame via `peekInstantOtaReentry`. Documented in `docs/fixes/2026-07-09-ota-instant-reentry-cpu-spike.md`, CPU still spikes because:

1. `isCachedBundleUsable` always `readFile`s the full bundle (~2MB utf8) and regex-validates content
2. Multiple callers run in parallel after instant success: `ensureFeatureCached` → `reconcileActiveBundleCache` → `clearUnusableActiveMetadata`, session fast-path check, `checkRemoteFeature`, `getPendingUpdate`
3. `useOtaUpdatePoller` starts `runPollCycle` immediately when `screenReady` is true (now synchronous on instant path)

Existing building blocks:
- `wasOtaFeatureLoadedThisSession` — session mark per feature
- `peekInstantOtaReentry` / `tryInstantOtaReentry` — live registry probe
- `ensureFeatureCached` session reentry branch — skips network when disk cache ready
- `refreshOtaEntryInBackground` — already skips `loadFeatureBundle` when `!updated`

Constraints:
- First load, download, apply pending, hash mismatch bootstrap MUST still full-verify bundle bytes
- OTA polling and update banner flow unchanged in outcome (only timing of first poll on re-entry)
- No native / server changes

## Goals / Non-Goals

**Goals:**

- Reduce JS-thread CPU spike after instant re-entry by eliminating redundant full-bundle `readFile` calls in the same session
- Stagger background work so poller does not compete with first paint
- Preserve integrity guarantees on cold start, download, apply, and version/hash mismatch paths
- Add test coverage for cache short-circuit and deferred poll

**Non-Goals:**

- Navigation tree session caching (`NavigationContainer` hoist) — lower CPU benefit, higher complexity; defer to P4
- Replacing utf8 content validation with native-only checks on first load
- Cross-session disk cache trust without any validation
- Changing poll interval (20s) or manifest schema

## Decisions

### 1. Session-level usability cache in `bundleCache`

**Choice:** Maintain an in-memory `Set<string>` (or `Map<path, { size }>`) of normalized paths that passed `isCachedBundleUsable` in the current JS runtime. On cache hit, return `true` immediately; optionally compare `RNFS.stat(path).size` against cached size to detect external file replacement.

**Rationale:** Same path validated once per session is sufficient when combined with session marks; avoids 3–5× redundant reads on instant re-entry.

**Alternative:** File mtime-based cache — rejected (RNFS mtime support inconsistent across platforms).

**Alternative:** Never re-validate in session — rejected (too risky if user deletes file mid-session without our cleanup running).

### 2. Light probe for session re-entry in `ensureFeatureCached`

**Choice:** When `wasOtaFeatureLoadedThisSession(featureId)` and `peekInstantOtaReentry(featureId)` would succeed (or `getFeatureSource === 'ota'` with usable metadata), `ensureFeatureCached` uses a new `probeActiveCacheLight(featureId)`:

- `readCachedMetadata` + `cachedBundleFileExists` + `stat.size >= MIN_USABLE_BUNDLE_BYTES`
- Skip `reconcileActiveBundleCache` → `clearUnusableActiveMetadata` full read on this path
- Return `{ updated: false, bundlePath }` without network

**Rationale:** Registry alive implies bundle was loaded and validated recently; full re-read adds no safety on same-session re-entry.

**Alternative:** Remove `refreshOtaEntryInBackground` entirely on instant — rejected (still need deferred apply / stale metadata edge cases).

### 3. Defer poller first cycle after instant re-entry

**Choice:** Add `deferInitialPollMs?: number` to `useOtaUpdatePoller`. `useFeatureHost` passes `1500` when instant path is taken. `setTimeout` before first `runPollCycle`; `refreshPending` may still run immediately (metadata JSON only, no bundle read if pending path cached).

**Rationale:** Spreads CPU load; manifest fetch 1.5s later does not affect update UX on re-entry when version unchanged.

**Alternative:** Disable poller until user interaction — rejected (breaks dev status overlay expectations).

### 4. Hash re-verification scope

**Choice:** `activeBundleFileMatchesRemote` and `hashBundleFileAtPath` skip full SHA256 when session re-entry light path is active and metadata hash matches remote manifest hash from last successful load. Full hash still runs on download, apply pending, and non-session bootstrap.

**Rationale:** Hash drift on same version is handled on first entry bootstrap; re-entry within session does not need re-SHA256 of 2MB file.

**Alternative:** Always SHA256 — rejected (CPU cost identical to readFile path).

### 5. Cache invalidation

**Choice:** Clear session usability cache entry when:

- `deleteCachedBundle` / `clearActiveMetadata` / `applyPendingFeature` promotes new version
- `writeCachedBundle` writes new bytes to path
- `clearFeatureRegistration` + `clearLoadedBundlesForFeature` on full reload path

Export `markBundleUsable(path)` / `clearBundleUsabilityCache(featureId?)` for explicit invalidation.

## Risks / Trade-offs

- **[Risk] Corrupted file on disk mid-session without deletion** → Mitigation: `stat.size` guard; full validate still on first load and after download; session mark cleared on load failure
- **[Risk] Deferred poll delays update banner by ~1.5s on re-entry** → Mitigation: acceptable trade-off; user already on working screen; interval poll continues
- **[Risk] Over-aggressive short-circuit masks stale pending** → Mitigation: `getPendingUpdate` still validates pending path once per session via cache; `refreshPending` uses metadata first
- **[Trade-off] Slightly more global state** → Acceptable; mirrors existing `__OTA_LOADED_THIS_SESSION__` pattern

## Migration Plan

1. Implement session cache + light probe + poller defer behind existing code paths
2. Add unit tests
3. Manual: OTA → back → re-entry; confirm instant log, no `[SplitBundleLoader] load`, lower CPU in Instruments
4. Update `docs/fixes/2026-07-09-ota-instant-reentry-cpu-spike.md` to Fixed
5. Rollback: remove session cache checks (behavior reverts to current CPU profile, no data migration)

## Open Questions

- (none for v1) — Navigation session cache deferred to future change if CPU still high after P0–P1
