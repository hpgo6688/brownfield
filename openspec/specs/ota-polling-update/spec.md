# ota-polling-update Specification

## Purpose
TBD - created by archiving change ota-mode-polling-update. Update Purpose after archive.
## Requirements
### Requirement: OTA mode polls remote manifest on an interval

While a Remote entry is displayed in OTA mode via `FeatureHost`, the client SHALL poll the bundle manifest on a configurable interval (default **20 seconds**) and compare remote `version` and `hash` against the **currently active** cached bundle for that entry.

Polling SHALL NOT run when the app is in Metro dev mode for that page.

Polling SHALL pause when the application is backgrounded and resume when foregrounded.

#### Scenario: Poll detects newer remote version

- **WHEN** OTA mode is active for Remote entry `order`
- **AND** remote manifest reports `version` 0.0.3 while active cached version is 0.0.2
- **THEN** the client marks an update as available for `order`

#### Scenario: Poll skipped in Metro mode

- **WHEN** `FeatureHost` loads Remote entry via Metro dev path
- **THEN** no manifest polling interval is started

#### Scenario: Poll paused in background

- **WHEN** the app transitions to `background`
- **THEN** manifest polling stops until the app returns to `active`

### Requirement: Available updates are downloaded without applying

When polling (or manual check) detects an update, the client SHALL download the bundle bytes, verify sha256, and persist to sandbox as a **pending** update without reloading the currently displayed OTA screen.

The active bundle and registration SHALL remain unchanged until the user confirms apply.

#### Scenario: Background download completes

- **WHEN** remote version 0.0.3 is available and active version is 0.0.2
- **AND** download and hash verification succeed
- **THEN** pending metadata records version 0.0.3 and local path
- **AND** the running screen continues to show 0.0.2 content

#### Scenario: Download failure keeps active version

- **WHEN** download or hash verification fails during polling
- **THEN** the active bundle remains loaded
- **AND** no apply prompt is shown until a successful pending download exists

### Requirement: User is prompted before applying a pending update

When a pending update exists for the current Remote entry, the OTA page SHALL display a non-blocking prompt that includes the pending version and a primary action **「立即更新」**.

The prompt SHALL NOT block interaction with the current page until the user chooses to apply.

#### Scenario: Prompt shown after successful pending download

- **WHEN** pending version 0.0.3 is ready for Remote entry `order`
- **AND** active version is 0.0.2
- **THEN** the OTA page shows an update prompt with version 0.0.3 and **「立即更新」**

#### Scenario: User dismisses prompt

- **WHEN** user dismisses the update prompt without applying
- **THEN** the active bundle remains 0.0.2
- **AND** the prompt MAY reappear on a subsequent poll while pending update remains

### Requirement: User apply completes the OTA update

When the user taps **「立即更新」**, the client SHALL promote the pending bundle to active, clear prior registration and loaded split bundles for that entry, load the new bundle via the split loader, and refresh the OTA screen to render the updated Remote component.

#### Scenario: Apply loads new bundle

- **WHEN** user taps **「立即更新」** for pending version 0.0.3
- **THEN** active metadata points to version 0.0.3
- **AND** the OTA screen re-renders with 0.0.3 content
- **AND** the update prompt is dismissed

#### Scenario: Apply clears pending state

- **WHEN** apply completes successfully
- **THEN** no pending update remains for that entry
- **AND** subsequent polls report no update until a newer remote version is published

### Requirement: Initial OTA load may bootstrap without user prompt

On first entry to a Remote page in OTA mode when no usable cached bundle exists, `FeatureHost` SHALL download and load the remote bundle without requiring a user confirmation prompt.

User confirmation SHALL be required only when replacing an already-active older version during an in-session upgrade.

#### Scenario: Cold start with empty cache

- **WHEN** user opens Remote entry `order` in OTA mode
- **AND** no cached bundle exists locally
- **THEN** client downloads and loads the remote bundle immediately
- **AND** no **「立即更新」** prompt is shown for that initial install

#### Scenario: In-session upgrade requires confirmation

- **WHEN** user is already viewing version 0.0.2 in OTA mode
- **AND** version 0.0.3 is downloaded as pending
- **THEN** client SHALL require **「立即更新」** before switching to 0.0.3

### Requirement: Staged updater APIs are shared across triggers

The client SHALL expose staged updater functions separate from the all-in-one `checkAndUpdateFeature` flow, callable from polling, manual check UI, and `FeatureHost`.

#### Scenario: Manual check uses staged download

- **WHEN** user taps manual update check on a Remote OTA page
- **THEN** client runs manifest check and pending download using the same staged APIs as polling
- **AND** shows the update prompt if a pending update is ready

#### Scenario: Polling and manual check do not auto-reload

- **WHEN** polling or manual check completes a pending download
- **THEN** client SHALL NOT call full-app reload or replace the active bundle until user apply

