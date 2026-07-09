# bundle-manifest-ota Specification

## Purpose
TBD - created by archiving change scheme2-ota-full. Update Purpose after archive.
## Requirements
### Requirement: Manifest includes OTA metadata per Remote entry

The bundle-server manifest response SHALL include, for each **enabled Remote entry** (not Scheme 1 core pages): `id`, `title`, `icon`, `moduleName`, `version` (semver), `hash` (`sha256:` + hex), `bundleUrl` (absolute URL), and `minAppVersion` (semver).

Remote entries represent **server-configured RN business pages** (e.g. `order`, `promo`). They SHALL NOT be required to mirror Scheme 1 core tab ids (`home`, `profile`, `settings`).

#### Scenario: Client fetches manifest with OTA fields

- **WHEN** client sends `GET /api/manifest`
- **THEN** each feature object includes `version`, `hash`, and `bundleUrl`
- **AND** top-level response includes `version: 2` and `updatedAt` ISO timestamp

#### Scenario: Feature below minimum app version is omitted

- **WHEN** client sends `GET /api/manifest?appVersion=1.0.0`
- **AND** a Remote entry has `minAppVersion` greater than `1.0.0`
- **THEN** that entry SHALL NOT appear in the `features` array

#### Scenario: Disabled Remote entry hidden from manifest

- **WHEN** operator disables a Remote entry in Admin
- **THEN** `GET /api/manifest` omits that entry from `features`
- **AND** Scheme 1 core RN menu is unaffected

### Requirement: Remote entry registry persists across uploads and restarts

The server SHALL persist Remote entry metadata and release history in durable storage (Prisma DB: `Feature`, `BundleRelease`).

#### Scenario: Server restart preserves versions

- **WHEN** a bundle is uploaded and the server restarts
- **THEN** subsequent `GET /api/manifest` returns the same `version` and `hash` for that entry as before restart

### Requirement: Operator can register new Remote entries

The server SHALL allow creating a new Remote entry (id, title, icon, moduleName, metroEntry) via Admin UI or `POST /api/features` before the first bundle upload.

#### Scenario: Create entry then upload first bundle

- **WHEN** operator creates Remote entry `order` with moduleName `OrderScreen`
- **AND** uploads `order.1.0.0.ios.jsbundle`
- **THEN** manifest includes `order` with version `1.0.0` and computed hash
- **AND** native Remote menu shows the new entry after refresh

#### Scenario: Duplicate entry id rejected

- **WHEN** operator attempts to create an entry with an existing `id`
- **THEN** server responds with HTTP 409

### Requirement: Manifest exposes shared OTA bundle metadata

The bundle-server manifest response (`GET /api/manifest`) SHALL include a `sharedBundle` object when shared-bundle mode is active for the release train.

`sharedBundle` SHALL include: `version` (semver), `hash` (`sha256:` + hex), `bundleUrl` (absolute URL), `segmentId` (integer, default `0`), and `sizeBytes` (integer, optional).

Shared bundle version SHALL match the Remote release train version for v1 (same `npm run build:bundles` version bump).

The `shared` feature id SHALL NOT appear in the `features` array when exposed via top-level `sharedBundle`.

#### Scenario: Client fetches manifest with shared bundle

- **WHEN** client sends `GET /api/manifest`
- **AND** shared bundle is published for the current release
- **THEN** response includes `sharedBundle` with `version`, `hash`, `bundleUrl`, and `segmentId`
- **AND** per-feature entries continue to include their own `version`, `hash`, and `bundleUrl`

#### Scenario: Manifest without shared bundle (legacy)

- **WHEN** server has not published a shared bundle for the release
- **THEN** `sharedBundle` MAY be omitted or null
- **AND** client falls back to monolithic per-feature split behavior (backward compatible during migration)

