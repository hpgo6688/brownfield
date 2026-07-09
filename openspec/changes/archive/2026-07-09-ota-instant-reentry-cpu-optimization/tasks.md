## 1. Session bundle usability cache

- [x] 1.1 Add in-memory session usability map in `bundleCache.ts` (`markBundleUsable`, `clearBundleUsabilityCache`, stat size guard)
- [x] 1.2 Short-circuit `isCachedBundleUsable` when path already validated this session
- [x] 1.3 Invalidate cache on `writeCachedBundle`, pending promotion, `deleteCachedBundle`, and full reload clear paths

## 2. Lightweight session re-entry probe

- [x] 2.1 Add `probeActiveCacheLight(featureId)` — metadata + exists + stat.size, no `readFile`
- [x] 2.2 Use light probe in `ensureFeatureCached` when `wasOtaFeatureLoadedThisSession` + live OTA registry
- [x] 2.3 Skip `clearUnusableActiveMetadata` full reads on instant background refresh path
- [x] 2.4 Skip `hashBundleFileAtPath` / `activeBundleFileMatchesRemote` full SHA256 on session re-entry light path

## 3. Deferred OTA poller

- [x] 3.1 Add `deferInitialPollMs` option to `useOtaUpdatePoller`
- [x] 3.2 Pass `deferInitialPollMs: 1500` from `useFeatureHost` instant re-entry branch
- [x] 3.3 Keep interval polling and `refreshPending` behavior unchanged after defer

## 4. Tests

- [x] 4.1 Unit test: `isCachedBundleUsable` second call does not invoke `readFile`
- [x] 4.2 Unit test: cache invalidation on bundle write
- [x] 4.3 Unit test: `ensureFeatureCached` light path on session re-entry
- [x] 4.4 Unit test: poller defers first `runPollCycle` when `deferInitialPollMs` set

## 5. Verification & docs

- [x] 5.1 Run `npm test` in `rn_app`
- [x] 5.2 Manual: OTA → back → re-entry; confirm instant log, no `[SplitBundleLoader] load`, CPU peak reduced
- [x] 5.3 Update `docs/fixes/2026-07-09-ota-instant-reentry-cpu-spike.md` status to Fixed
