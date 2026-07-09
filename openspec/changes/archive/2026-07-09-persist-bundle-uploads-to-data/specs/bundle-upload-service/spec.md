## MODIFIED Requirements

### Requirement: Upload Remote entry bundle artifact via HTTP

The bundle-server SHALL expose `POST /api/bundles/upload` accepting multipart form fields: `featureId`, `version`, and `file` (`.jsbundle` binary).

`featureId` MUST refer to an existing **Remote entry** registered in the server database, not a Scheme 1 core page.

Uploaded bundle files SHALL be written to disk under `data/bundles/` (relative to `bundle-server/`) before release metadata is updated. Files MUST remain available for `GET /bundles/<filename>` after server restart.

#### Scenario: Successful upload updates manifest

- **WHEN** client posts a valid bundle file for an existing Remote `featureId`
- **THEN** server stores the file under `data/bundles/`
- **AND** computes sha256 hash of the file
- **AND** updates active release (version, hash, bundleUrl) in persistent storage
- **AND** responds with HTTP 200 and updated manifest snapshot

#### Scenario: Unknown feature rejected

- **WHEN** client posts upload with unknown `featureId`
- **THEN** server responds with HTTP 404

#### Scenario: Invalid semver rejected

- **WHEN** client posts upload with malformed `version`
- **THEN** server responds with HTTP 400

#### Scenario: Uploaded bundle survives server restart

- **WHEN** a bundle was successfully uploaded and the server process restarts
- **THEN** `GET /bundles/<filename>` for the active release returns HTTP 200 with the same bytes
- **AND** manifest `hash` still matches the file on disk
