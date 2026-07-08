## ADDED Requirements

### Requirement: Upload bundle artifact via HTTP

The bundle-server SHALL expose `POST /api/bundles/upload` accepting multipart form fields: `featureId`, `version`, and `file` (`.jsbundle` binary).

#### Scenario: Successful upload updates manifest

- **WHEN** client posts a valid bundle file for an existing `featureId`
- **THEN** server stores the file under `dist/bundles/`
- **AND** computes sha256 hash of the file
- **AND** updates persisted manifest with new `version`, `hash`, and `bundleUrl`
- **AND** responds with HTTP 200 and the updated feature entry

#### Scenario: Unknown feature rejected

- **WHEN** client posts upload with unknown `featureId`
- **THEN** server responds with HTTP 404

#### Scenario: Invalid semver rejected

- **WHEN** client posts upload with malformed `version`
- **THEN** server responds with HTTP 400

### Requirement: Build script emits upload metadata

The `npm run build:bundles` script SHALL produce `dist/bundles/build-manifest.json` listing each feature's `featureId`, `version`, `hash`, and `filename`.

#### Scenario: CI reads build manifest after bundle

- **WHEN** build completes successfully
- **THEN** `build-manifest.json` exists and contains one entry per feature bundle
