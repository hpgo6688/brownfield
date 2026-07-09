# bundle-ota-client Specification

## Purpose
TBD - created by archiving change scheme2-ota-full. Update Purpose after archive.
## Requirements
### Requirement: Compare remote and local Remote entry version

The client `bundleUpdater` module SHALL compare remote manifest `version` and `hash` against locally cached metadata for each **Remote entry** and determine whether an update is required.

Scheme 1 core pages (`HomeScreen`, etc.) SHALL NOT participate in this compare/download flow.

#### Scenario: Update required when remote version is newer

- **WHEN** remote `version` is greater than cached local `version`
- **THEN** `checkAndUpdateFeature` downloads and caches the new bundle

#### Scenario: No update when version and hash match

- **WHEN** remote `version` equals local `version`
- **AND** remote `hash` equals local `hash`
- **THEN** `checkAndUpdateFeature` skips download

#### Scenario: Re-download when version matches but hash differs

- **WHEN** remote `version` equals local `version`
- **AND** remote `hash` differs from local `hash`
- **THEN** client SHALL treat as update required

### Requirement: Download verify and cache bundle

The client SHALL download bundle bytes from `bundleUrl`, verify sha256 against manifest `hash`, write to sandbox path `DocumentDirectory/rn-bundles/<entryId>/<version>.jsbundle`, and persist metadata JSON alongside.

#### Scenario: Successful download and cache

- **WHEN** download completes and hash matches
- **THEN** bundle file is written to sandbox
- **AND** metadata records `featureId`, `version`, `hash`, `localPath`, `installedAt`

#### Scenario: Hash mismatch rejects file

- **WHEN** downloaded file hash does not match manifest `hash`
- **THEN** client deletes partial file
- **AND** falls back without updating local metadata

### Requirement: Shared updater API for multiple trigger points

The client SHALL expose `checkAndUpdateFeature(entryId, options?)` and `preloadFeatures(entryIds)` callable from `FeatureHost` and any RN screen.

#### Scenario: Remote page triggers update check

- **WHEN** user taps "检查更新" on a Remote business page
- **THEN** app calls `checkAndUpdateFeature` for Remote entry ids
- **AND** UI reflects loading, success, or error state

#### Scenario: FeatureHost checks on Remote page entry

- **WHEN** user navigates to a Remote entry via native shell (`FeatureHost` + `featureId`)
- **THEN** `FeatureHost` invokes `checkAndUpdateFeature` before rendering

### Requirement: Fallback when OTA fails

The client SHALL render Remote pages using last successful cache if available. When OTA fails and no valid cache exists, the client SHALL show a non-fatal in-app error state inside `FeatureHost` and MUST NOT terminate or crash the native application shell.

Scheme 1 pages remain available via direct `moduleName` and do not use this fallback path.

#### Scenario: Network failure uses cache

- **WHEN** manifest fetch or download fails
- **AND** a valid cached bundle exists for the Remote entry
- **THEN** client loads cached bundle via split loader

#### Scenario: Server bundle missing with no cache shows error UI

- **WHEN** manifest references a Remote entry with valid `bundleUrl`
- **AND** `GET bundleUrl` returns HTTP 404 or 5xx (e.g. server file lost after restart)
- **AND** no usable local cached bundle file exists
- **THEN** `FeatureHost` renders an error screen (e.g. 「页面加载失败」) with a readable message
- **AND** the native shell navigation remains functional (user can leave the Remote page)
- **AND** the app process does not crash

#### Scenario: Stale local cache metadata is cleared

- **WHEN** active cache metadata references a `localPath` that no longer exists on disk
- **THEN** client clears stale active (and matching pending) metadata
- **AND** attempts remote download if manifest is reachable
- **AND** if download also fails, shows non-fatal error UI instead of crashing

#### Scenario: Split bundle load failure is contained

- **WHEN** native split bundle load rejects (missing file, invalid segment, loader unavailable)
- **THEN** error is caught in the OTA load path
- **AND** `FeatureHost` shows error UI
- **AND** no unhandled promise rejection or fatal error escapes to crash the app

### Requirement: Dev mode uses Metro split bundles

In `__DEV__` when `bundleUrl` points to Metro (port 8081), the client SHALL load via `loadBundleFromServer` with `modulesOnly=true` and SHALL NOT eval full standalone bundles.

#### Scenario: Metro split load in development

- **WHEN** `bundleUrl` host is Metro dev server
- **THEN** client appends or preserves `modulesOnly=true`
- **AND** uses incremental split bundle load path

### Requirement: Updater APIs return structured failure without throwing

When no usable local bundle exists, `ensureFeatureCached` and `checkAndUpdateFeature` SHALL return an `UpdateCheckResult` with `bundlePath: null` and an `error` message instead of throwing, except for programmer errors (invalid arguments).

#### Scenario: Download 404 returns result not throw

- **WHEN** `ensureFeatureCached` is called for a Remote entry
- **AND** remote download fails with HTTP 404
- **AND** no valid local cache file exists
- **THEN** function resolves with `{ bundlePath: null, error: "<message>" }`
- **AND** does not throw an uncaught exception

#### Scenario: FeatureHost handles null bundlePath

- **WHEN** `ensureFeatureCached` returns `bundlePath: null`
- **THEN** `FeatureHost` sets error state and renders error UI
- **AND** does not attempt `loadFeatureBundle` with a missing path

### Requirement: Background OTA polling failures are non-fatal

Background manifest polling and pending download (`otaUpdatePoller`, `downloadPendingFeature`) SHALL NOT crash or force-reload the currently displayed Remote screen when the server bundle is missing.

#### Scenario: Poll download 404 while on cached screen

- **WHEN** user is viewing a Remote page loaded from valid local cache
- **AND** background poll detects a newer remote version
- **AND** download of the new bundle fails (404/5xx)
- **THEN** poll state records the error
- **AND** the currently displayed screen continues running
- **AND** the app does not crash

### Requirement: Session bundle usability cache avoids redundant full reads

The client `bundleCache` module SHALL maintain an in-memory record of bundle file paths that passed `isCachedBundleUsable` validation in the current JS runtime. Subsequent `isCachedBundleUsable` calls for the same normalized path SHALL return true without reading the full bundle file, unless the path was invalidated or file size check fails.

#### Scenario: Second usability check in same session short-circuits

- **WHEN** `isCachedBundleUsable` succeeds for path `P` and feature `order`
- **AND** the same path is checked again in the same JS runtime session
- **THEN** the client returns true without `readFile` of the full bundle body

#### Scenario: Usability cache invalidated on bundle write

- **WHEN** a new bundle is written to path `P` via `writeCachedBundle` or pending promotion
- **THEN** any session usability record for `P` is cleared
- **AND** the next `isCachedBundleUsable` performs full content validation

#### Scenario: First load still full-validates

- **WHEN** no session usability record exists for path `P`
- **THEN** `isCachedBundleUsable` reads bundle content and validates OTA split markers as today

### Requirement: Instant re-entry uses lightweight cache reconcile

When `wasOtaFeatureLoadedThisSession(featureId)` is true and live OTA registry is available, `ensureFeatureCached` and background re-entry refresh SHALL use a lightweight probe (metadata + file exists + minimum size) and SHALL NOT invoke full-bundle content validation or full-file SHA256 hash comparison against remote.

#### Scenario: Background refresh after instant re-entry skips full read

- **WHEN** `FeatureHost` takes the instant re-entry fast path for a Remote entry
- **AND** active cached metadata exists with a file on disk
- **THEN** `refreshOtaEntryInBackground` completes without reading the full active bundle file for content validation
- **AND** does not call `hashBundleFileAtPath` for the active bundle

#### Scenario: Cold bootstrap still full-validates

- **WHEN** user opens a Remote entry in OTA mode
- **AND** `wasOtaFeatureLoadedThisSession` is false for that feature
- **THEN** `ensureFeatureCached` performs full bundle usability validation before returning `bundlePath`

#### Scenario: Download and apply paths unchanged

- **WHEN** client downloads a new bundle or applies a pending update
- **THEN** full sha256 and OTA content validation run before metadata promotion
- **AND** session usability cache for affected paths is invalidated

### Requirement: OTA poller defers first cycle after instant re-entry

When `FeatureHost` renders via instant re-entry, the OTA update poller SHALL delay its first `runPollCycle` by a configurable interval (default 1500ms) while continuing periodic polling on the existing interval thereafter.

#### Scenario: Deferred initial poll after instant re-entry

- **WHEN** `FeatureHost` renders a Remote entry via instant re-entry
- **AND** `screenReady` becomes true
- **THEN** the poller does not invoke `runPollCycle` until the defer interval elapses
- **AND** subsequent interval polls run on the normal schedule

#### Scenario: Non-instant entry polls immediately

- **WHEN** `FeatureHost` loads a Remote entry via full OTA bootstrap (loading state shown)
- **THEN** the poller MAY invoke `runPollCycle` immediately when enabled
- **AND** behavior matches pre-change polling semantics

#### Scenario: Deferred poll does not block displayed screen

- **WHEN** instant re-entry has rendered the OTA screen
- **AND** the defer interval has not elapsed
- **THEN** the currently displayed OTA screen remains visible and interactive
- **AND** no loading shell replaces the screen

### Requirement: OTA client loads shared bundle before feature split

When manifest includes `sharedBundle`, the OTA client SHALL download, cache, verify, and native-load the shared split bundle before any Remote feature split bundle load.

Shared bundle cache SHALL use a dedicated path (e.g. `rn-bundles/shared/<version>.jsbundle`) and session marks separate from per-feature caches.

#### Scenario: Bootstrap loads shared then order

- **WHEN** user opens Remote `order` in OTA mode
- **AND** manifest includes `sharedBundle`
- **THEN** client ensures shared bundle is cached and `SplitBundleLoader.load` runs for shared `segmentId` before order segment load
- **AND** order screen renders successfully

#### Scenario: Shared cache reused across features

- **WHEN** user opens `order` then `promo` in OTA mode within the same JS runtime
- **AND** `sharedBundle` version unchanged
- **THEN** client does not re-download or re-load shared segment
- **AND** only feature-specific bundle load runs for the second entry

#### Scenario: Legacy manifest without sharedBundle

- **WHEN** manifest omits `sharedBundle`
- **THEN** client uses existing monolithic per-feature split load path without regression

### Requirement: Shared bundle participates in session usability optimizations

Shared bundle paths SHALL be included in session usability cache and lightweight probe logic where applicable, so instant re-entry does not re-read full shared + feature files unnecessarily.

#### Scenario: Instant re-entry after shared already loaded

- **WHEN** user re-enters a Remote feature via instant re-entry
- **AND** shared segment was loaded earlier in the session
- **THEN** client does not reload shared segment
- **AND** instant re-entry behavior matches pre-shared-bundle semantics for the feature

### Requirement: Apply update pre-caches shared before reload

When user applies a pending OTA update in DEV mode via `DevSettings.reload()`, the client SHALL ensure the manifest `sharedBundle` is cached and clear shared session load marks before reload.

#### Scenario: Immediate update reload with shared version bump

- **WHEN** user taps apply update on a Remote entry
- **AND** manifest `sharedBundle` version differs from cached shared
- **THEN** client downloads/caches shared bundle before reload
- **AND** post-reload feature load succeeds without `unknown module` for shared-owned deps

