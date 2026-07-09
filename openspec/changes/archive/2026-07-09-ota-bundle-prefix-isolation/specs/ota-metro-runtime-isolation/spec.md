## ADDED Requirements

### Requirement: OTA mode loads only remote split bundles

When runtime is in OTA mode (`useOta === true`, including Release builds), FeatureHost SHALL load Remote entries exclusively via manifest → `checkAndUpdateFeature` → sandbox cache → split bundle load.

FeatureHost SHALL resolve the rendered component via `getFeatureComponent(featureId, { otaOnly: true })` or equivalent wait helper.

FeatureHost SHALL NOT dynamically import `screens/remote/` or invoke `loadMetroDevFeature` in OTA mode.

#### Scenario: DEBUG OTA toggle loads cached remote bundle

- **WHEN** user enables OTA mode on the native toolbar
- **AND** navigates to Remote entry `order`
- **THEN** FeatureHost downloads or reads cached bundle from manifest
- **AND** split-loads the bundle
- **AND** renders the component registered with `source: 'ota'`

#### Scenario: OTA mode fails without silent Metro fallback

- **WHEN** OTA mode is active
- **AND** no valid remote bundle is available
- **THEN** FeatureHost displays an error state
- **AND** does not fall back to Metro dev import or main-bundle Remote registration

### Requirement: Metro mode loads only Metro dev screens

When runtime is in Metro mode (`useOta === false`, DEBUG only), FeatureHost SHALL load Remote entries exclusively via `loadMetroDevFeature` importing from `screens/remote/`.

FeatureHost SHALL NOT call `checkAndUpdateFeature`, split bundle load, or read OTA sandbox cache in Metro mode.

#### Scenario: DEBUG Metro toggle uses hot-reload path

- **WHEN** user enables Metro mode on the native toolbar
- **AND** navigates to Remote entry `order`
- **THEN** FeatureHost imports `screens/remote/OrderScreen` via Metro
- **AND** does not contact bundle-server for that navigation

#### Scenario: Metro mode fails without silent OTA fallback

- **WHEN** Metro mode is active
- **AND** Metro dev import fails
- **THEN** FeatureHost displays an error state
- **AND** does not fall back to cached OTA bundle or OTA registration

### Requirement: Mode switch clears conflicting feature state

When `devOtaMode` changes or native posts `reloadFeatureRuntime`, FeatureHost SHALL clear prior registration and loaded bundle state for the active `featureId` before loading via the new mode path.

#### Scenario: Toggle from Metro to OTA clears main registration

- **WHEN** user switches from Metro to OTA while viewing Remote entry `order`
- **THEN** prior `source: 'main'` registration for `order` is cleared
- **AND** FeatureHost reloads using OTA path only

#### Scenario: Toggle from OTA to Metro clears OTA registration

- **WHEN** user switches from OTA to Metro while viewing Remote entry `order`
- **THEN** prior `source: 'ota'` registration and split-loaded modules for `order` are cleared
- **AND** FeatureHost reloads using Metro dev path only

### Requirement: Release builds always use OTA path

In non-DEBUG builds (`!__DEV__`), FeatureHost SHALL always behave as OTA mode regardless of persisted dev preference.

#### Scenario: Release app ignores dev OTA preference file

- **WHEN** app runs a Release build
- **THEN** Remote entries load via manifest and split bundle only
- **AND** Metro dev import path is never used
