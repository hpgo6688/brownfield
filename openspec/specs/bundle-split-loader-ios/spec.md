# bundle-split-loader-ios Specification

## Purpose
TBD - created by archiving change scheme2-ota-full. Update Purpose after archive.
## Requirements
### Requirement: Native split bundle loader for Release Remote OTA

The iOS app SHALL provide a native module `SplitBundleLoader` exposing `load(fileUrl: string): Promise<void>` that loads an incremental JS bundle into the existing Brownfield React Native runtime without creating a second React instance.

Used exclusively for **Remote entry** sub-bundles after OTA download or local cache load—not for Scheme 1 core pages loaded from the main bundle.

#### Scenario: Load cached Remote bundle in Release

- **WHEN** `bundleUpdater` calls `SplitBundleLoader.load` with a `file://` URL to a verified cached Remote sub-bundle in Release build
- **THEN** native runtime executes the split bundle
- **AND** Remote entry modules registered in that bundle become available to JS

#### Scenario: Full bundle eval is not used in Release

- **WHEN** running a Release build
- **THEN** client `bundleLoader` SHALL NOT eval complete standalone bundles fetched over the network

### Requirement: Native module integrated with BrownfieldLib build

The SplitBundleLoader native module SHALL be compiled into the RN producer BrownfieldLib target and included when packaging `brownfield:package:ios` / `brownfield:package:ios:debug`.

#### Scenario: Brownfield package includes loader

- **WHEN** developer runs `npm run brownfield:package:ios:debug`
- **THEN** resulting BrownfieldLib exposes SplitBundleLoader to the host app

### Requirement: Load failure surfaces error to JS

When native split load fails, the module SHALL reject the promise with an error message consumable by `bundleUpdater` fallback logic (cache retry → main-bundle Remote registry).

#### Scenario: Invalid bundle file rejected

- **WHEN** `load` is called with a missing or corrupt file path
- **THEN** native module rejects with descriptive error
- **AND** JS layer triggers fallback path

