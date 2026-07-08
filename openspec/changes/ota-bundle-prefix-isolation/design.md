## Context

The brownfield app supports two DEBUG runtime paths for Remote entries (`order`, `promo`):

| Mode | Toggle label | Intended loader | Screen source |
|------|--------------|-----------------|---------------|
| Metro | Metro | Dynamic import via Metro | `screens/remote/` |
| OTA | OTA | bundle-server manifest → cache → split load | Remote split bundles |

Today both paths converge on the same screen files and module names. `bundles/order/screens/OrderScreen.tsx` re-exports `screens/remote/OrderScreen`, and both register `OrderScreen` with `AppRegistry`. The `registerFeature` registry uses `source: 'main' | 'ota'` but module names are identical, so toggling modes can leave stale registrations or cause Metro edits to ship inside OTA bundles unintentionally.

`remoteConfig.ts` already documents the target split (`screens/ota/`, `ota_*` bundles) but it is not implemented.

## Goals / Non-Goals

**Goals:**

- Remote upload bundles are built with an `ota_` filename prefix and distinct entry/module names
- OTA mode loads **only** remote split bundles (manifest → download → split load → `otaOnly` registry)
- Metro mode loads **only** Metro dev screens from `screens/remote/` (dynamic import, `source: 'main'`)
- Mode switch clears conflicting registrations and reloads the feature host
- Build manifest and upload docs reflect the new naming convention

**Non-Goals:**

- Changing manifest `featureId` values (`order`, `promo` stay the same for native shell and Admin)
- OTA for Scheme 1 core pages (`HomeScreen`, etc.)
- Android split loader changes
- Duplicating business UI logic — OTA screens may wrap or copy Metro screens initially, but must live under separate module paths

## Decisions

### 1. Prefix scope: bundle files + module names, not featureId

**Decision:** Apply `ota_` to bundle output filenames and RN module names (`ota_OrderScreen`), keep manifest `featureId` as `order` / `promo`.

**Rationale:** Native shell and bundle-server Admin already key on short feature ids. Prefixing only artifacts and registrations avoids DB/API migration while still isolating runtime.

**Alternative considered:** Prefix featureId (`ota_order`) in manifest — rejected because it breaks existing seed data, native navigation, and upload scripts.

### 2. Separate bundle entry directories

**Decision:** Move OTA split entries from `bundles/order/` → `bundles/ota_order/` (and `ota_promo/`). Each entry registers `ota_<ModuleName>` via `AppRegistry` and `registerFeature(..., { source: 'ota' })`.

**Rationale:** Metro graph exclusion in `build-bundles.js` already keys on bundle paths; distinct directories make split boundaries explicit and prevent accidental Metro inclusion of OTA-only code.

### 3. OTA screen layer under `screens/ota/`

**Decision:** Add `screens/ota/OrderScreen.tsx` (and Promo) that either contain OTA-specific UI markers (version badge, "OTA bundle" label) or thin wrappers around shared presentational components. Metro continues using `screens/remote/`.

**Rationale:** Even if UI is similar, separate files guarantee Metro HMR never mutates OTA bundle contents and allow OTA-only copy/version strings.

**Alternative considered:** Shared component only, different registration — rejected; re-export still ties Metro graph to OTA bundle build unless carefully excluded.

### 4. Strict FeatureHost routing (no cross-fallback in DEBUG)

**Decision:**

- `useOta === false` → `loadMetroDevFeature` only; on failure show error (no OTA cache, no main-bundle OTA registration)
- `useOta === true` → `checkAndUpdateFeature` + split load only; on failure show error (no Metro import, no `allowsMainBundleFallback()` in DEBUG)

Release builds (`!__DEV__`) continue OTA-only path as today.

**Rationale:** Cross-fallback masked isolation bugs during development; strict paths make mode bugs visible immediately.

### 5. Build output naming

**Decision:** `build-bundles.js` emits:

```
ota_order.<version>.ios.jsbundle
ota_promo.<version>.ios.jsbundle
```

`build-manifest.json` records `file` with the prefixed name. Upload script examples updated; server stores file as uploaded (featureId unchanged).

### 6. Registry cleanup on mode switch

**Decision:** On mode change (native toolbar → `reloadFeatureRuntime` / `devOtaMode` prop change), `FeatureHost` effect re-runs, calls `clearFeatureRegistration(featureId)` and `clearLoadedBundlesForFeature(featureId)` before loading via the new path.

**Rationale:** Prevents `source: 'main'` registration from satisfying `otaOnly` lookup and vice versa.

## Risks / Trade-offs

- **[Risk] Duplicate screen maintenance** → Mitigate with shared presentational subcomponents in `screens/remote/components/` imported by both Metro and OTA shells
- **[Risk] Stale sandbox cache from unprefixed bundles** → Mitigate: bump cache key or delete `DocumentDirectory/rn-bundles/<featureId>/` when OTA load detects missing `ota_` module after split load
- **[Risk] build-bundles split filter regex must include `ota_*` paths** → Update `isFeatureOwnedBySplit` and bundle config in same PR
- **[Risk] Developers forget to re-upload after prefix change** → Document in dynamic-multi-bundle.md; smoke test fails if active release file lacks `ota_` prefix

## Migration Plan

1. Implement new bundle dirs, screens, build script prefix
2. `npm run build:bundles` → upload `ota_order.*` / `ota_promo.*` via Admin or `upload-bundle.sh`
3. Clear local app sandbox bundle cache (or reinstall app)
4. Verify Metro mode shows `screens/remote/` content; OTA mode shows `screens/ota/` markers
5. Remove or deprecate old `bundles/order/` and `bundles/promo/` entry dirs after cutover

**Rollback:** Revert build script and client loader; re-upload unprefixed bundles if needed (not recommended once OTA screens diverge).

## Open Questions

- Should OTA screens initially duplicate Metro UI or only change the version badge? → Default: duplicate with clear OTA label for visual confirmation during dev
- Should `USE_METRO_BUNDLES=true` bundle-server mode also serve `ota_`-prefixed paths for parity? → Out of scope unless needed for E2E; Metro dev mode bypasses bundle-server anyway
