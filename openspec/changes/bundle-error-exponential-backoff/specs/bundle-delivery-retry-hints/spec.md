## ADDED Requirements

### Requirement: Manifest omits hash when active bundle file is missing

When building the manifest, bundle-server SHALL verify that the active release bundle file exists on disk under `config.bundlesDir`. If the file is missing, the manifest entry for that feature SHALL expose `hash: sha256:unset` while retaining the DB version string, and SHALL log a warning.

#### Scenario: Release in DB but file deleted

- **WHEN** admin requests `/api/manifest`
- **AND** feature `promo` has active release `0.0.2` in SQLite
- **AND** `data/bundles/ota_promo.0.0.2.ios.jsbundle` does not exist
- **THEN** manifest feature entry includes `version: 0.0.2` and `hash: sha256:unset`
- **AND** server logs a missing-file warning

#### Scenario: File present advertises real hash

- **WHEN** active release file exists on disk
- **THEN** manifest includes the computed `sha256:` hash from the database
- **AND** `bundleUrl` points to the existing filename

### Requirement: Missing bundle static requests return retryable 503

For requests to `/bundles/*` where the target file does not exist, bundle-server SHALL respond with HTTP **503**, a JSON body `{ "error": "bundle_file_missing", "retryable": true }`, and a **`Retry-After`** header (default 5 seconds unless configured otherwise).

#### Scenario: Client requests deleted bundle file

- **WHEN** client `GET /bundles/ota_order.0.0.3.ios.jsbundle`
- **AND** the file is not on disk
- **THEN** response status is 503
- **AND** `Retry-After` header is present
- **AND** body includes `"retryable": true`

#### Scenario: Existing file served normally

- **WHEN** client `GET /bundles/<existing-file>`
- **THEN** static file content is returned with HTTP 200
- **AND** no custom 503 handler interferes

### Requirement: Delivery failures are observable

bundle-server SHALL log bundle file missing events (manifest build and static 503) with feature id or filename to support debugging retry storms vs permanent misconfiguration.

#### Scenario: Static 503 is logged

- **WHEN** a `/bundles/*` request returns 503 for missing file
- **THEN** server logs include the requested path
- **AND** log level is warning or error
