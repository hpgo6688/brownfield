## ADDED Requirements

### Requirement: Admin API exposes bundle size per release

The bundle-server admin feature list API (`GET /api/features` and related admin detail responses) SHALL include `sizeBytes` (integer, bytes) on each `BundleRelease` object in the JSON payload.

When `sizeBytes` is null in the database but the bundle file exists on disk under `data/bundles/`, the server SHALL compute size via filesystem `stat` and return that value in the API response for display purposes (without requiring a database write).

#### Scenario: New upload returns size in admin API

- **WHEN** admin uploads a bundle via `POST /api/bundles/upload`
- **AND** admin fetches `GET /api/features`
- **THEN** the corresponding release entry includes `sizeBytes` equal to the uploaded file byte length

#### Scenario: Legacy release without stored size

- **WHEN** a release row has `sizeBytes` null
- **AND** `data/bundles/<filename>` exists
- **THEN** `GET /api/features` returns `sizeBytes` from filesystem stat for that release

#### Scenario: Missing file yields null size

- **WHEN** a release row has `sizeBytes` null
- **AND** the bundle file is missing on disk
- **THEN** the API returns `sizeBytes: null` for that release

### Requirement: Admin UI displays human-readable bundle size

The bundle-server Admin UI (`/admin`) SHALL display each release's bundle size in a dedicated table column.

Sizes SHALL be formatted for humans (KB or MB with one decimal place). The raw byte count MAY appear in a tooltip (`title` attribute).

The sidebar entry for each feature MAY show the active release size next to the version label when an active release exists.

#### Scenario: Release history table shows size column

- **WHEN** admin opens a feature detail with one or more releases
- **THEN** the release history table includes a **大小** (or **Size**) column
- **AND** each row shows formatted size when `sizeBytes` is available

#### Scenario: Active release size in sidebar

- **WHEN** a feature has an active release with `sizeBytes` set
- **THEN** the sidebar shows version and formatted size (e.g. `v0.0.7 · 2.0 MB`)
