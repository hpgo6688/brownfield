## Context

The brownfield project supports two RN integration schemes:

- **Scheme 1**: Single bundle, multiple `moduleName` entries (`HomeScreen`, etc.)
- **Scheme 2**: Dynamic multi-bundle via `bundle-server` manifest, `FeatureHost`, and separate `screens/dynamic/*` pages

Scheme 2 currently delivers server-controlled **entry visibility** and Dev split-bundle loading via Metro `modulesOnly=true`. Release OTA is documented but not implemented: no version/hash in manifest, no upload API, no persistent cache, and full-bundle `eval` breaks React hooks.

Constraints:

- Single Brownfield JS Runtime (`ReactNativeBrownfield.shared` singleton)
- Scheme 1 must remain unchanged
- Scheme 2 pages live in `screens/dynamic/` (not Scheme 1 screens)
- iOS-first; Android out of scope for this change

## Goals / Non-Goals

**Goals:**

- End-to-end OTA for Scheme 2 dynamic features: build → upload → manifest update → client compare → download → verify → cache → split load
- OTA triggers from **native shell** and **any RN page** via shared `bundleUpdater` JS API
- Safe Release loading via iOS native split bundle loader (no duplicate React)
- Fallback to last good cache or main-bundle built-in dynamic features on failure
- Dev workflow preserved: Metro + `USE_METRO_BUNDLES=true`

**Non-Goals:**

- OTA for Scheme 1 pages
- OTA for main/bootstrap bundle (`index.js` / BrownfieldLib) — requires native App update
- Android split bundle loader
- Gray release / A-B rules engine (future P5)
- CodePush / Expo Updates integration
- Hermes bytecode (`.hbc`) pipeline — start with plain `.jsbundle` split loads

## Decisions

### 1. Manifest persistence: JSON file on disk

**Choice:** `bundle-server/manifest.store.json` written by upload API; `manifest.config.js` becomes seed/defaults only.

**Rationale:** Upload API must mutate manifest at runtime without editing source files.

**Alternative:** Keep `manifest.config.js` only — rejected; requires server restart and manual edits per upload.

### 2. Version identity: semver + sha256 hash

**Choice:** Each feature carries `version` (semver string) and `hash` (sha256 hex of bundle file). Client compares semver first; hash confirms file integrity after download.

**Rationale:** semver is human-friendly for CI/logs; hash prevents corrupted or tampered bundles.

**Alternative:** Hash-only — rejected; harder for operators to reason about releases.

### 3. Client cache location: RN filesystem API

**Choice:** Use `react-native-fs` (or RN built-in if sufficient) under `DocumentDirectory/rn-bundles/<featureId>/<version>.jsbundle` plus `metadata.json`.

**Rationale:** Release bundles must persist across app restarts; AsyncStorage alone is insufficient for binary payloads.

**Alternative:** AsyncStorage for small bundles — rejected; size limits and no streaming.

### 4. Release load path: Native SplitBundleLoader module

**Choice:** New iOS TurboModule/NativeModule `SplitBundleLoader.load(url: string)` calling bridge `loadAndExecuteSplitBundleURL` (or RN 0.86 equivalent host API).

**Rationale:** Full-bundle `eval` duplicates React → hooks crash (`useSyncExternalStore of null`). Split load registers modules in existing runtime.

**Alternative:** Keep eval for Release — rejected; proven broken.

### 5. Shared update orchestration: `bundleUpdater.ts`

**Choice:** Single module exporting `checkAndUpdateFeature`, `preloadFeatures`, `getCachedFeatureVersion`. Used by `FeatureHost`, native bridge (optional), and any RN screen.

**Rationale:** Avoid duplicating compare/download/cache logic across trigger points (documented in OTA section).

### 6. Build pipeline emits hash manifest

**Choice:** `scripts/build-bundles.js` writes `bundle-server/dist/bundles/build-manifest.json` with `{ featureId, version, hash, file }` for CI/upload scripts.

**Rationale:** Upload API can validate client-supplied hash against file on disk.

### 7. Main bundle retains built-in dynamic features as fallback

**Choice:** `index.js` continues registering `dynamicFeatures` in main bundle registry.

**Rationale:** Offline / first launch / failed OTA still renders Scheme 2 pages at last shipped native version.

**Trade-off:** Main bundle size includes dynamic screens; true code-splitting only after successful OTA load overrides registry.

### 8. OTA trigger matrix

| Trigger | Implementation |
|---------|----------------|
| Native menu refresh | Existing `BundleManifestService.load()` — menu only |
| App startup pre-check | New optional call from `ios_nativeApp` → RN bridge event or native fetch + pass to RN |
| FeatureHost enter page | `bundleUpdater.checkAndUpdateFeature(featureId)` |
| RN settings button | `DynamicSettingsScreen` calls `bundleUpdater` |
| Silent preload | `bundleUpdater.preloadFeatures([...])` from any RN page |

Native pre-check for **menu** stays Swift; **bundle content** updates stay JS.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Split bundle still includes React if build misconfigured | CI check: reject bundles whose hash matches full standalone build; document Metro `modulesOnly` / shared moduleId factory |
| Native module API differs in RN 0.86 new architecture | Implement against current Brownfield bridge; test on simulator Release build |
| Cache grows unbounded | TTL + max versions per feature (keep latest 2) |
| semver compare edge cases | Use `semver` npm package server-side and client-side |
| Main bundle + OTA bundle module ID collision | Reuse existing deterministic `createModuleIdFactory` in `metro.config.js` |
| Upload API security | Local dev: no auth; document production need for API key / CI token (non-goal for v1) |

## Migration Plan

1. Ship server manifest v2 fields (backward compatible: default version `0.0.0` if missing)
2. Ship client with compare logic — treats missing local cache as "needs update"
3. Add upload API; migrate manual `dist/` copies to upload script
4. Add iOS SplitBundleLoader; gate Release path on module availability
5. Rebuild `brownfield:package:ios:debug` after native module lands
6. Rollback: disable feature in manifest `enabled: false`; client falls back to main bundle registry

## Open Questions

- Use `react-native-fs` vs Expo FileSystem (project is bare RN — likely `react-native-fs` or `@react-native-community/async-storage` + fetch to file via native helper)
- Whether startup pre-check runs in native only or via lightweight RN headless task
- Hermes bytecode support timeline for OTA bundles
