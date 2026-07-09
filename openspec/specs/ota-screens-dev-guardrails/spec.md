# ota-screens-dev-guardrails Specification

## Purpose
TBD - created by archiving change ota-screens-build-scope-guard. Update Purpose after archive.
## Requirements
### Requirement: ESLint blocks runtime imports of OTA bundle trees

The project SHALL configure ESLint `no-restricted-imports` (or equivalent) to forbid importing paths under `bundles/ota_*` from:

- `screens/remote/**` (except documented shared `components/` consumed by OTA via one-way import)
- `src/features/**`
- `index.js`

Imports within `bundles/ota_*` and the verify script itself SHALL be exempt.

#### Scenario: Metro dev file cannot import OTA bundle screen

- **WHEN** a developer adds `import X from '../../bundles/ota_order/screens/OrderScreen'` in `metroDevFeatures.ts`
- **THEN** ESLint reports an error with a message indicating OTA code is build/upload only

#### Scenario: OTA bundle entry can import its own screen

- **WHEN** ESLint runs on `bundles/ota_order/index.js`
- **THEN** no restricted-import violation is reported for `./screens/OrderScreen`

### Requirement: Metro dev server blocklists OTA bundle directories

`metro.config.js` SHALL include a resolver blockList excluding `bundles/ota_*` from the default Metro dev graph.

#### Scenario: Metro does not serve OTA bundle source on require

- **WHEN** dev server runs via `npm start`
- **AND** code accidentally requires a module under `bundles/ota_order/`
- **THEN** Metro resolution fails or excludes the path (OTA sources not hot-reloaded as main-app modules)

### Requirement: verify:ota-scope script guards main bundle graph

The project SHALL provide `npm run verify:ota-scope` that analyzes the main bundle module graph (entry `index.js`) and fails if any module path belongs to `bundles/ota_*` or legacy `screens/ota/`.

#### Scenario: Clean main graph passes verification

- **WHEN** `npm run verify:ota-scope` runs on a correct codebase
- **THEN** exit code is 0

#### Scenario: Accidental main import fails verification

- **WHEN** `index.js` transitively imports a module under `bundles/ota_order/`
- **THEN** `npm run verify:ota-scope` exits non-zero and prints the offending module paths

### Requirement: Developer documentation states edit workflow

The repo SHALL include guard README files:

- `screens/remote/README.md` — Metro dev edit path, points to shared components
- `bundles/README.md` — build/upload-only scope, `build:bundles` + upload steps

`docs/dynamic-multi-bundle.md` SHALL include a “where to edit” table distinguishing Metro dev vs OTA upload paths.

Each OTA screen source file SHALL include a file-header comment: build/upload only, not Metro dev.

#### Scenario: New developer finds edit guidance

- **WHEN** a developer opens `screens/remote/` or `bundles/`
- **THEN** a README explains which directory to edit for Metro HMR vs OTA upload

