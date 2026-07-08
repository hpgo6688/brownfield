## ADDED Requirements

### Requirement: Upload Remote entry bundle artifact via HTTP

The bundle-server SHALL expose `POST /api/bundles/upload` accepting multipart form fields: `featureId`, `version`, and `file` (`.jsbundle` binary).

`featureId` MUST refer to an existing **Remote entry** registered in the server database, not a Scheme 1 core page.

#### Scenario: Successful upload updates manifest

- **WHEN** client posts a valid bundle file for an existing Remote `featureId`
- **THEN** server stores the file under `dist/bundles/`
- **AND** computes sha256 hash of the file
- **AND** updates active release (version, hash, bundleUrl) in persistent storage
- **AND** responds with HTTP 200 and updated manifest snapshot

#### Scenario: Unknown feature rejected

- **WHEN** client posts upload with unknown `featureId`
- **THEN** server responds with HTTP 404

#### Scenario: Invalid semver rejected

- **WHEN** client posts upload with malformed `version`
- **THEN** server responds with HTTP 400

### Requirement: Build script emits upload metadata for Remote bundles

The `npm run build:bundles` script SHALL produce `dist/bundles/build-manifest.json` listing each **Remote sub-bundle**'s `featureId`, `version`, `hash`, and `filename`.

Main bundle (`main.ios.jsbundle`) MAY be listed with `featureId: null` for packaging only; it is not OTA-updated via manifest.

#### Scenario: CI reads build manifest after bundle

- **WHEN** build completes successfully
- **THEN** `build-manifest.json` exists and contains one entry per Remote sub-bundle (e.g. `order`, `promo`)
