## Why

After the instant re-entry fast path renders (`[OTA] instant re-entry … (live registry)`), CPU spikes for hundreds of milliseconds to several seconds even though segment reload is skipped. Root cause: `isCachedBundleUsable` reads the full ~2MB bundle into JS 3–5 times in parallel (background `ensureFeatureCached`, poller `checkRemoteFeature`, `getPendingUpdate`), while the OTA poller starts immediately when `screenReady` becomes true. Users perceive lag and device heat on repeat OTA visits despite correct instant rendering.

## What Changes

- Add **session-level bundle usability cache** in `bundleCache`: once a path passes `isCachedBundleUsable` in the current JS runtime, subsequent checks for the same normalized path return true without `readFile` (optional `stat` size guard)
- Add **lightweight cache probe** for same-session OTA re-entry: when `wasOtaFeatureLoadedThisSession` and live registry exist, `ensureFeatureCached` / `reconcileActiveBundleCache` skip full-file validation and use metadata + `exists` + `stat.size` only
- **Defer OTA poller initial cycle** after instant re-entry (e.g. 1.5–2s) so first paint and navigation mount are not competing with manifest fetch + bundle reads; interval polling unchanged
- **Skip redundant background work** on instant path: `refreshOtaEntryInBackground` uses light probe when version unchanged; no `hashBundleFileAtPath` on session re-entry
- Add unit tests for session cache short-circuit and deferred poll behavior
- Update fix doc status after implementation

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `bundle-ota-client`: (1) bundle usability checks SHALL short-circuit on same-session validated paths; (2) instant re-entry background reconcile and poller SHALL not trigger redundant full-bundle reads; (3) OTA poller MAY defer its first cycle after instant re-entry

## Impact

- **`rn_app/src/features/bundleCache.ts`**: session usability cache; light probe helper
- **`rn_app/src/features/bundleUpdater.ts`**: session re-entry fast path in `ensureFeatureCached`; optional hash skip on re-entry
- **`rn_app/src/features/otaUpdatePoller.ts`**: `deferInitialPollMs` option
- **`rn_app/src/features/useFeatureHost.ts`**: pass defer flag on instant branch; light background refresh
- **Tests**: `bundleCache` session cache, poller defer, `ensureFeatureCached` light path
- **Docs**: `docs/fixes/2026-07-09-ota-instant-reentry-cpu-spike.md` status → Fixed
- **No server / manifest / native changes**
