## MODIFIED Requirements

### Requirement: OTA split bundles use ota_ filename prefix

The build pipeline SHALL emit Remote split bundle files with an `ota_` prefix before the feature id: `ota_<featureId>.<version>.ios.jsbundle` (e.g. `ota_order.1.0.0.ios.jsbundle`).

The build pipeline SHALL also emit a shared split bundle `ota_shared.<version>.ios.jsbundle` for cross-feature dependencies.

The build manifest (`build-manifest.json`) SHALL record the prefixed `file` name for each Remote split bundle entry and the shared bundle entry.

Main/bootstrap bundle (`main.ios.jsbundle`) SHALL NOT receive the `ota_` prefix.

#### Scenario: Release build produces prefixed artifacts

- **WHEN** `npm run build:bundles` completes for Remote features `order` and `promo`
- **THEN** output directory contains `ota_shared.<version>.ios.jsbundle`, `ota_order.<version>.ios.jsbundle`, and `ota_promo.<version>.ios.jsbundle`
- **AND** `build-manifest.json` lists those prefixed filenames with matching sha256 hashes

#### Scenario: Upload script accepts prefixed file

- **WHEN** CI runs `upload-bundle.sh order <version> dist/bundles/ota_order.<version>.ios.jsbundle`
- **THEN** bundle-server stores the file and associates it with manifest featureId `order`

#### Scenario: Shared bundle upload

- **WHEN** CI uploads `ota_shared.<version>.ios.jsbundle`
- **THEN** bundle-server stores the file and exposes it via manifest `sharedBundle.bundleUrl`
