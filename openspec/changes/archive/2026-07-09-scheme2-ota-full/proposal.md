## Why

The brownfield app needs a **server-driven Remote RN business block**: new RN pages (e.g. order, promo) that can be **added, hidden, versioned, and OTA-updated** via `bundle-server` manifest—without an App Store release and **without duplicating Scheme 1 core pages**.

Today the demo conflates **「方案 2」** (a split-bundle *technique*) with **Remote entries** (a *product* concept), and seeds `home/profile/settings` as mirror copies of Scheme 1. That misleads implementation: Remote entries should be **additional business pages**, not a second implementation of core tabs.

Release OTA is also incomplete: no reliable client cache, no native split load in Release, and unsafe full-bundle `eval`.

## Terminology (read this first)

| Term | Layer | Meaning |
|------|-------|---------|
| **Scheme 1** | Product + tech | **Core RN** — fixed local entries (`HomeScreen`, `ProfileScreen`, `SettingsScreen`). Single main bundle, direct `moduleName`. **Not** manifest/OTA. |
| **Remote entry** | Product | **Remote RN business block** — server-configured menu items (`order`, `promo`, …). Visibility, version, and bundle URL come from manifest. Can be **added after ship** via Admin. |
| **Scheme 2** | Tech only | **Split Bundle + manifest + FeatureHost + OTA** — the implementation pattern used to deliver Remote entries inside one Brownfield Runtime. |
| **Scheme 3 (multi-bundle.md)** | Tech | **Re.Pack + Module Federation** — multi-team micro-frontend. **Out of scope** for this change. |
| **Scheme 4 (multi-bundle.md)** | Tech | **Multiple XCFrameworks / RN projects** — full isolation. **Out of scope** unless Remote business needs a different RN version. |

**Key rule:** OTA and manifest apply to **Remote entries only**, not Scheme 1 core pages.

**Demo debt:** Current `DynamicHomeScreen` / `DynamicProfileScreen` / `DynamicSettingsScreen` mirror Scheme 1 for comparison. Target state replaces them with **Remote-only** pages under `screens/remote/` (e.g. `OrderScreen`, `PromoScreen`).

## What Changes

- Clarify docs, native menu labels, and seed data: **「远程业务 / Remote entries」** vs **「核心 RN / Scheme 1」**
- Replace demo mirror features (`home/profile/settings` dynamic copies) with **Remote business** features (`order`, `promo`, …)
- Add Admin/API to **create new Remote entries** (not only toggle/upload existing)
- Extend `bundle-server` manifest with per-entry `version`, `hash`, `minAppVersion`, `bundleUrl` (Prisma persistence)
- Upload pipeline: `POST /api/bundles/upload`, sha256, rollback
- RN client: `bundleCache`, `bundleUpdater`, `FeatureHost` OTA flow, fallback chain
- iOS `SplitBundleLoader` for Release split load (no full-bundle `eval`)
- Build pipeline: `build-manifest.json` for CI upload
- Update `docs/dynamic-multi-bundle.md` terminology and OTA status

## Capabilities

### New Capabilities

- `bundle-manifest-ota`: Manifest schema + API for Remote entry OTA metadata; persist entries and releases
- `bundle-upload-service`: Upload endpoint, storage, manifest/release update after publish
- `bundle-ota-client`: Version compare, download, hash verify, sandbox cache, shared `bundleUpdater` API
- `bundle-split-loader-ios`: iOS native module for incremental split bundle load in Release

### Modified Capabilities

- _(none — no existing specs in `openspec/specs/` yet)_

## Impact

- **bundle-server**: Prisma `Feature` / `BundleRelease`; Admin create-entry; upload + rollback APIs
- **rn_app**: `screens/remote/`, `bundles/<remoteId>/`, `src/features/*`, `SplitBundleLoader` in BrownfieldLib
- **ios_native**: Menu section **「Remote · 远程业务」** (manifest-driven); Scheme 1 section unchanged
- **BrownfieldLib**: rebuild after native module
- **Docs**: `dynamic-multi-bundle.md`, `multi-bundle.md` cross-links — disambiguate Scheme 2 (tech) vs Remote (product)

## Non-Goals

- OTA for Scheme 1 core pages or main/bootstrap bundle
- Re.Pack / Module Federation (multi-bundle.md 方案三)
- Separate RN project / second XCFramework for Remote block (unless explicitly decided later)
- Android split loader in this change
