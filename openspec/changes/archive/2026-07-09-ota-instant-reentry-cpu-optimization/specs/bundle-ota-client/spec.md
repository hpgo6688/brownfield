## ADDED Requirements

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
