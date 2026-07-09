## ADDED Requirements

### Requirement: OTA screens live under bundle directories

OTA-specific screen sources SHALL reside under `bundles/ota_<featureId>/screens/`, not under top-level `screens/ota/`.

Each OTA bundle entry (`bundles/ota_<featureId>/index.js`) SHALL import its screen from `./screens/` within the same bundle directory.

The top-level `screens/ota/` directory SHALL NOT exist after migration.

#### Scenario: Order OTA screen colocated with bundle entry

- **WHEN** a developer inspects the order OTA upload bundle layout
- **THEN** `bundles/ota_order/screens/OrderScreen.tsx` exists
- **AND** `bundles/ota_order/index.js` imports from `./screens/OrderScreen`
- **AND** `screens/ota/` does not exist

### Requirement: Shared Remote UI components for dual wrappers

Reusable Remote business UI (lists, cards, layout) SHALL live under `screens/remote/components/` (or documented shared path).

Metro dev screens (`screens/remote/*Screen.tsx`) and OTA bundle screens (`bundles/ota_*/screens/*Screen.tsx`) SHALL compose shared components rather than duplicating full page implementations.

Shared components SHALL NOT import from `bundles/ota_*` or OTA-only modules.

#### Scenario: Metro and OTA screens share order list

- **WHEN** `screens/remote/OrderScreen.tsx` and `bundles/ota_order/screens/OrderScreen.tsx` render order lists
- **THEN** both import the same shared component from `screens/remote/components/`
- **AND** each wrapper applies its own mode badge (Metro vs OTA)

### Requirement: Build pipeline split filter uses bundle-colocated paths

The split bundle build filter (`build-bundles.js` `isFeatureOwnedBySplit`) SHALL treat `bundles/ota_<featureId>/screens/` as OTA-owned modules.

The filter SHALL NOT reference top-level `screens/ota/`.

#### Scenario: Release build includes colocated OTA screens

- **WHEN** `npm run build:bundles` builds `ota_order`
- **THEN** output bundle includes modules from `bundles/ota_order/screens/`
- **AND** does not require `screens/ota/`
