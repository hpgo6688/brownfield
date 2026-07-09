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

