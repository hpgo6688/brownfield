# ota-bundle-build-prefix Specification

## Purpose
TBD - created by archiving change ota-bundle-prefix-isolation. Update Purpose after archive.
## Requirements
### Requirement: OTA split bundles use ota_ filename prefix

The build pipeline SHALL emit Remote split bundle files with an `ota_` prefix before the feature id: `ota_<featureId>.<version>.ios.jsbundle` (e.g. `ota_order.1.0.0.ios.jsbundle`).

The build manifest (`build-manifest.json`) SHALL record the prefixed `file` name for each Remote split bundle entry.

Main/bootstrap bundle (`main.ios.jsbundle`) SHALL NOT receive the `ota_` prefix.

#### Scenario: Release build produces prefixed artifacts

- **WHEN** `npm run build:bundles` completes for Remote features `order` and `promo`
- **THEN** output directory contains `ota_order.<version>.ios.jsbundle` and `ota_promo.<version>.ios.jsbundle`
- **AND** `build-manifest.json` lists those prefixed filenames with matching sha256 hashes

#### Scenario: Upload script accepts prefixed file

- **WHEN** CI runs `upload-bundle.sh order <version> dist/bundles/ota_order.<version>.ios.jsbundle`
- **THEN** bundle-server stores the file and associates it with manifest featureId `order`

### Requirement: OTA bundle entries register ota_ module names

Each OTA split bundle entry (`bundles/ota_<featureId>/index.js`) SHALL register its root component with `AppRegistry` and `registerFeature` using module name `ota_<ScreenName>` (e.g. `ota_OrderScreen`).

OTA bundle entries SHALL NOT import screen modules from `screens/remote/`.

#### Scenario: Order OTA bundle self-registers

- **WHEN** the `ota_order` split bundle executes after split load
- **THEN** `registerFeature('order', 'ota_OrderScreen', …, { source: 'ota' })` is invoked
- **AND** `AppRegistry.registerComponent('ota_OrderScreen', …)` is invoked

### Requirement: Metro dev bundles exclude OTA bundle graph

The Metro dev loader (`metroDevFeatures`) SHALL import screens only from `screens/remote/`.

Metro dev registration SHALL use unprefixed module names (e.g. `OrderScreen`) with `{ source: 'main' }`.

#### Scenario: Metro mode loads remote dev screen

- **WHEN** FeatureHost runs with `useOta === false` and `featureId === 'order'`
- **THEN** client dynamically imports `screens/remote/OrderScreen`
- **AND** registers `OrderScreen` with `source: 'main'`
- **AND** does not download or split-load any OTA bundle

#### Scenario: Metro registration ignored by otaOnly lookup

- **WHEN** `getFeatureComponent('order', { otaOnly: true })` is called after Metro registration
- **THEN** result is `null`

