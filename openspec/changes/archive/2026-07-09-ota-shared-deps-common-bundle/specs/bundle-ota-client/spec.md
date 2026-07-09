## ADDED Requirements

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
