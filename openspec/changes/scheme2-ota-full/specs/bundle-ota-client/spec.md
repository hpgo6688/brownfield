## ADDED Requirements

### Requirement: Compare remote and local feature version

The client `bundleUpdater` module SHALL compare remote manifest `version` and `hash` against locally cached metadata for each feature and determine whether an update is required.

#### Scenario: Update required when remote version is newer

- **WHEN** remote `version` is greater than cached local `version`
- **THEN** `checkAndUpdateFeature` reports update required

#### Scenario: No update when version and hash match

- **WHEN** remote `version` equals local `version`
- **AND** remote `hash` equals local `hash`
- **THEN** `checkAndUpdateFeature` skips download

#### Scenario: Re-download when version matches but hash differs

- **WHEN** remote `version` equals local `version`
- **AND** remote `hash` differs from local `hash`
- **THEN** client SHALL treat as update required

### Requirement: Download verify and cache bundle

The client SHALL download bundle bytes from `bundleUrl`, verify sha256 against manifest `hash`, write to sandbox path `DocumentDirectory/rn-bundles/<featureId>/<version>.jsbundle`, and persist metadata JSON alongside.

#### Scenario: Successful download and cache

- **WHEN** download completes and hash matches
- **THEN** bundle file is written to sandbox
- **AND** metadata records `featureId`, `version`, `hash`, `localPath`, `installedAt`

#### Scenario: Hash mismatch rejects file

- **WHEN** downloaded file hash does not match manifest `hash`
- **THEN** client deletes partial file
- **AND** falls back without updating local metadata

### Requirement: Shared updater API for multiple trigger points

The client SHALL expose `checkAndUpdateFeature(featureId, options?)` and `preloadFeatures(featureIds)` callable from `FeatureHost` and any RN screen (Scheme 1 or Scheme 2).

#### Scenario: RN settings page triggers update check

- **WHEN** user taps "检查更新" in `DynamicSettingsScreen`
- **THEN** app calls `checkAndUpdateFeature` for the current or selected feature
- **AND** UI reflects loading, success, or error state

#### Scenario: FeatureHost checks on page entry

- **WHEN** user navigates to a Scheme 2 dynamic page
- **THEN** `FeatureHost` invokes `checkAndUpdateFeature` before rendering

### Requirement: Fallback when OTA fails

The client SHALL render using last successful cache if available; otherwise SHALL use main-bundle registered dynamic feature component.

#### Scenario: Network failure uses cache

- **WHEN** manifest fetch or download fails
- **AND** a valid cached bundle exists
- **THEN** client loads cached bundle

#### Scenario: No cache uses built-in fallback

- **WHEN** OTA fails
- **AND** no valid cache exists
- **THEN** client renders component from main bundle `registerFeature` registry

### Requirement: Dev mode uses Metro split bundles

In `__DEV__` when `bundleUrl` points to Metro (port 8081), the client SHALL load via `loadBundleFromServer` with `modulesOnly=true` and SHALL NOT eval full standalone bundles.

#### Scenario: Metro split load in development

- **WHEN** `bundleUrl` host is Metro dev server
- **THEN** client appends or preserves `modulesOnly=true`
- **AND** uses incremental split bundle load path
