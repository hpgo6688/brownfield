## ADDED Requirements

### Requirement: Native split bundle loader for Release

The iOS app SHALL provide a native module `SplitBundleLoader` exposing `loadBundle(fileUrl: string): Promise<void>` that loads an incremental JS bundle into the existing Brownfield React Native runtime without creating a second React instance.

#### Scenario: Load cached bundle in Release

- **WHEN** `bundleUpdater` calls `SplitBundleLoader.load` with a `file://` URL to a verified cached bundle in Release build
- **THEN** native runtime executes the split bundle
- **AND** newly registered feature modules become available to JS

#### Scenario: Full bundle eval is not used in Release

- **WHEN** running a Release build
- **THEN** client `bundleLoader` SHALL NOT eval complete standalone bundles fetched over the network

### Requirement: Native module integrated with BrownfieldLib build

The SplitBundleLoader native module SHALL be compiled into the RN producer project and included when packaging `brownfield:package:ios` / `brownfield:package:ios:debug`.

#### Scenario: Brownfield package includes loader

- **WHEN** developer runs `npm run brownfield:package:ios:debug`
- **THEN** resulting BrownfieldLib exposes SplitBundleLoader to the host app

### Requirement: Load failure surfaces error to JS

When native split load fails, the module SHALL reject the promise with an error message consumable by `bundleUpdater` fallback logic.

#### Scenario: Invalid bundle file rejected

- **WHEN** `loadBundle` is called with a missing or corrupt file path
- **THEN** native module rejects with descriptive error
- **AND** JS layer triggers fallback path
