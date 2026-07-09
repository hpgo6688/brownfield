# ota-shared-deps-bundle Specification

## Purpose

Cross-feature OTA shared split (`ota_shared`) for React Navigation and common Remote UI dependencies, loaded as segment 0 before feature splits.

## Requirements

### Requirement: Shared OTA split bundle for cross-feature dependencies

The build pipeline SHALL produce a dedicated **shared** OTA split bundle `ota_shared.<version>.ios.jsbundle` containing cross-feature React Native dependencies (including `@react-navigation/*`, `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`, `screens/remote/navigation/*`, `screens/remote/components/*`, and their transitive split-graph dependencies required by Remote navigators).

The shared entry (`bundles/ota_shared/index.js`) SHALL warm-import all shared-owned modules so feature splits reference shared-defined module ids (not main-only ids).

Feature-specific split bundles (`ota_order`, `ota_promo`) SHALL NOT include modules that are owned by the shared split graph when the shared bundle is enabled for that release.

#### Scenario: Shared bundle built alongside feature bundles

- **WHEN** `npm run build:bundles` completes
- **THEN** output includes `ota_shared.<version>.ios.jsbundle` in addition to feature splits
- **AND** `build-manifest.json` lists a shared entry with `featureId: "shared"` (or equivalent), `segmentId`, `hash`, and `sizeBytes`

#### Scenario: Feature bundle size reduced

- **WHEN** shared split is enabled
- **THEN** `ota_order.<version>.ios.jsbundle` byte size is materially smaller than the monolithic per-feature split that inlined React Navigation (target order of magnitude: under 600KB for current simple pages)

#### Scenario: Split audit references shared segment

- **WHEN** post-build split audit runs for a feature bundle
- **THEN** modules owned by the shared graph are not required to be defined inside the feature bundle file
- **AND** audit documents external deps that must be satisfied by the shared segment (not main-only react core)

### Requirement: Shared segment loads before feature segments

The OTA client SHALL load the shared split bundle into **segment id 0** (or manifest-declared `sharedBundle.segmentId`) before loading any Remote feature split bundle (segment ids 1+).

The client SHALL track shared bundle version/hash in cache and reload shared segment when manifest shared version or hash changes.

#### Scenario: First OTA feature entry loads shared then feature

- **WHEN** user opens a Remote entry in OTA mode and shared bundle is not yet loaded for the active shared version
- **THEN** client downloads/caches shared bundle if needed
- **AND** invokes native split load for shared segment before feature segment
- **AND** feature screen renders without `unknown module` errors

#### Scenario: Second feature in same session reuses shared segment

- **WHEN** user opens `order` then `promo` in the same JS runtime session
- **AND** shared version unchanged
- **THEN** client does not reload shared segment
- **AND** loads only the feature-specific segment for the second feature

#### Scenario: Shared version mismatch blocks feature load

- **WHEN** cached shared bundle version/hash does not match manifest `sharedBundle`
- **THEN** client refreshes shared bundle before feature load
- **AND** surfaces a structured error if shared download fails (not a fatal native crash)
