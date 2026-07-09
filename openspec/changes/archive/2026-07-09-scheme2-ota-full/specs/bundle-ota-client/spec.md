## ADDED Requirements

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

The client SHALL render Remote pages using last successful cache if available; otherwise SHALL use main-bundle registered Remote component via `registerFeature` registry.

Scheme 1 pages remain available via direct `moduleName` and do not use this fallback path.

#### Scenario: Network failure uses cache

- **WHEN** manifest fetch or download fails
- **AND** a valid cached bundle exists for the Remote entry
- **THEN** client loads cached bundle via split loader

#### Scenario: No cache uses built-in fallback

- **WHEN** OTA fails
- **AND** no valid cache exists
- **THEN** client renders component from main bundle `registerFeature` registry for that Remote entry

### Requirement: Dev mode uses Metro split bundles

In `__DEV__` when `bundleUrl` points to Metro (port 8081), the client SHALL load via `loadBundleFromServer` with `modulesOnly=true` and SHALL NOT eval full standalone bundles.

#### Scenario: Metro split load in development

- **WHEN** `bundleUrl` host is Metro dev server
- **THEN** client appends or preserves `modulesOnly=true`
- **AND** uses incremental split bundle load path
