## ADDED Requirements

### Requirement: FeatureHost reuses OTA bundle on repeat entry when version unchanged

When the user re-opens a Remote entry in OTA mode and the active disk cache version and hash match the last successfully loaded release, `FeatureHost` SHALL render the OTA screen immediately without showing the loading state and SHALL NOT force reload the split bundle or clear in-memory OTA registration unless a full reload is required (version change, pending apply, or explicit revision bump).

#### Scenario: Instant re-entry with matching active cache

- **WHEN** user navigates to a Remote entry in OTA mode
- **AND** active cached metadata exists with a usable bundle file
- **AND** in-memory OTA registration can be restored via `syncOtaRegistrationFromCache` for that version and path
- **THEN** `FeatureHost` renders the OTA screen without intermediate loading UI
- **AND** does not call `loadFeatureBundle` with `force: true`

#### Scenario: Full bootstrap when no active cache

- **WHEN** user navigates to a Remote entry in OTA mode
- **AND** no usable active cached bundle exists on disk
- **THEN** `FeatureHost` shows loading state during bootstrap
- **AND** downloads or loads bundle via existing `ensureFeatureCached` flow

#### Scenario: Full reload when active version changes

- **WHEN** user navigates to a Remote entry in OTA mode
- **AND** active cached version or path differs from in-memory OTA component cache stamp
- **THEN** client clears stale registration
- **AND** loads the new active bundle via split loader

#### Scenario: Full reload after user applies pending update

- **WHEN** user taps **立即更新** on an OTA update prompt
- **AND** `otaBundleRevision` is bumped
- **THEN** `FeatureHost` performs full OTA reload for the new active version
- **AND** does not take the instant re-entry fast path

#### Scenario: Background remote check does not block instant re-entry

- **WHEN** instant re-entry fast path renders the OTA screen
- **THEN** background manifest check and pending staging MAY continue asynchronously
- **AND** the currently displayed screen remains visible until user confirms an available update

### Requirement: Incomplete remote bundle must not update version or load

When remote version differs from active cache and the client downloads a new bundle, the client SHALL treat the download as atomic: active or pending metadata version MUST NOT be updated and the incomplete bundle MUST NOT be loaded until the full payload passes sha256 verification and OTA content validation.

#### Scenario: Hash mismatch leaves active version unchanged

- **WHEN** remote version is newer than active cache
- **AND** downloaded bundle bytes fail sha256 check against manifest `hash`
- **THEN** client deletes the partial bundle file for that version
- **AND** does not write or update active `metadata.json` or pending `pending.json` with the new version
- **AND** continues using the last verified active cache if available

#### Scenario: Truncated or invalid OTA content rejected

- **WHEN** download completes but bundle body fails `validateOtaBundleContent` (too small, missing registerFeature, etc.)
- **THEN** client rejects the file
- **AND** does not promote the new version to active or pending metadata
- **AND** does not load the bundle via split loader

#### Scenario: Pending apply re-verifies before active promotion

- **WHEN** user applies a staged pending update (**立即更新** or deferred apply)
- **AND** pending bundle file exists on disk
- **THEN** client re-verifies hash and OTA content before writing active `metadata.json`
- **AND** if verification fails, clears invalid pending metadata and file
- **AND** keeps previous active version and screen running

#### Scenario: Version mismatch bootstrap does not use unverified file

- **WHEN** no usable active cache exists and client downloads remote bundle for first load
- **AND** download or verification fails
- **THEN** client shows error UI
- **AND** does not record a successful version in active metadata
