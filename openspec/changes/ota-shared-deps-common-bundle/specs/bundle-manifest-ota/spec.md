## ADDED Requirements

### Requirement: Manifest exposes shared OTA bundle metadata

The bundle-server manifest response (`GET /api/manifest`) SHALL include a `sharedBundle` object when shared-bundle mode is active for the release train.

`sharedBundle` SHALL include: `version` (semver), `hash` (`sha256:` + hex), `bundleUrl` (absolute URL), `segmentId` (integer, default `0`), and `sizeBytes` (integer, optional).

Shared bundle version SHALL match the Remote release train version for v1 (same `npm run build:bundles` version bump).

#### Scenario: Client fetches manifest with shared bundle

- **WHEN** client sends `GET /api/manifest`
- **AND** shared bundle is published for the current release
- **THEN** response includes `sharedBundle` with `version`, `hash`, `bundleUrl`, and `segmentId`
- **AND** per-feature entries continue to include their own `version`, `hash`, and `bundleUrl`

#### Scenario: Manifest without shared bundle (legacy)

- **WHEN** server has not published a shared bundle for the release
- **THEN** `sharedBundle` MAY be omitted or null
- **AND** client falls back to monolithic per-feature split behavior (backward compatible during migration)
