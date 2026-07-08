## ADDED Requirements

### Requirement: Manifest includes OTA metadata per feature

The bundle-server manifest response SHALL include, for each enabled feature: `version` (semver string), `hash` (sha256 hex digest prefixed with `sha256:`), `bundleUrl` (absolute URL), and optional `minAppVersion` (semver string).

#### Scenario: Client fetches manifest with OTA fields

- **WHEN** client sends `GET /api/manifest`
- **THEN** each feature object includes `version`, `hash`, and `bundleUrl`
- **AND** top-level response includes `updatedAt` ISO timestamp

#### Scenario: Feature below minimum app version is omitted

- **WHEN** client sends `GET /api/manifest?appVersion=1.0.0`
- **AND** a feature has `minAppVersion` greater than `1.0.0`
- **THEN** that feature SHALL NOT appear in the `features` array

### Requirement: Manifest store persists across uploads

The server SHALL persist manifest OTA metadata to durable storage (`manifest.store.json`) and serve merged results with static config defaults (icons, titles, metro entries).

#### Scenario: Server restart preserves versions

- **WHEN** a bundle is uploaded and the server restarts
- **THEN** subsequent `GET /api/manifest` returns the same `version` and `hash` as before restart
