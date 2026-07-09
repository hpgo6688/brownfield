## Context

Current OTA split build (`build-bundles.js`) treats these as **feature-owned** and packs them into **each** `ota_order` / `ota_promo` bundle:

- `@react-navigation/*`
- `react-native-screens`
- `react-native-gesture-handler`
- Transitive deps (`use-latest-callback`, safe-area overlap where needed, etc.)

This fixed cold-start `unknown module 745032085` when shared deps lived only in the main bundle graph. Trade-off: **duplicate ~1.5MB navigation stack per feature**.

Brownfield already uses **native segment ids** (`config/feature-segments.json`: order=1, promo=2) via `SplitBundleLoader.load(path, segmentId)`. Segments share one Hermes runtime and one module registry — incremental splits can register modules if loaded in correct order.

## Goals / Non-Goals

**Goals:**

- Feature OTA bundles (order, promo) **&lt; ~500KB** target for simple pages (order of magnitude; exact budget TBD in implementation)
- **One shared bundle** per app release version, downloaded once, loaded before first Remote OTA feature
- Preserve instant re-entry, warmReentry, and session usability optimizations
- `split-audit` passes: feature split references shared-defined module ids, not main-only ids (except react/rn core)
- Admin/manifest shows **shared size + feature size** separately

**Non-Goals:**

- Shipping React/React Native core in OTA shared bundle (stays in app main / host)
- Per-feature different navigation library versions
- Metro dev path changes (still `screens/remote/` single graph)
- Dynamic shared bundle updates independent of app shell (v1: shared version locked to manifest release train)

## Decisions

### 1. Artifact: `ota_shared.<version>.ios.jsbundle`

**Choice:** New build target `bundles/ota_shared/index.js` — entry imports/warms navigation stack only (no `registerFeature`). Output `ota_shared.<version>.ios.jsbundle` with **segmentId `0`** in `feature-segments.json` (`"shared": 0`).

**Rationale:** Reuses existing split pipeline; segment 0 loads before feature segments 1/2.

**Alternative:** Embed shared in main app binary — rejected (no OTA update of nav without app release).

**Alternative:** Keep duplicating in each feature — rejected (2MB × N features).

### 2. Build graph split

**Choice:**

- `isSharedOwnedBySplit(modulePath)` — navigation, screens, gesture-handler, shared navigational utilities
- `isFeatureOwnedBySplit` — only feature-specific paths (`bundles/ota_order`, `screens/remote/order`, etc.)
- Feature split `processModuleFilter` **excludes** shared-owned modules (expect them in shared segment)
- Shared split includes shared-owned + minimal entry

**Rationale:** Metro `modulesOnly` bundles declare deps by module id; shared segment must define ids that feature segments reference.

### 3. Load order in client

**Choice:** `ensureSharedBundleLoaded()` before `loadFeatureBundle` for any OTA feature:

1. Resolve shared metadata from manifest (or `build-manifest` lockstep version)
2. Cache/download `ota_shared` like a feature (dedicated cache dir or `rn-bundles/shared/<version>.jsbundle`)
3. `SplitBundleLoader.load(sharedPath, segmentId: 0)` once per session (or when shared version changes)
4. Then load feature segment as today

Track `wasSharedBundleLoadedThisSession()` separate from feature session marks.

**Rationale:** Feature eval assumes shared modules already registered in runtime.

### 4. Manifest shape (v1)

**Choice:** Add top-level `sharedBundle` on manifest response:

```json
{
  "sharedBundle": {
    "version": "0.0.8",
    "hash": "sha256:…",
    "bundleUrl": "/bundles/ota_shared.0.0.8.ios.jsbundle",
    "segmentId": 0,
    "sizeBytes": 1234567
  },
  "features": [ … ]
}
```

Shared version **equals** Remote release train version for simplicity (same `npm run build:bundles` version bump).

**Alternative:** Separate shared feature row `featureId: "shared"` — acceptable fallback if schema change is heavy.

### 5. Version mismatch handling

**Choice:** If feature bundle's `minSharedVersion` (optional) or manifest shared hash ≠ cached shared → re-download shared before feature load. Mismatch fails closed with readable error (not `unknown module`).

### 6. Size validation

**Choice:** Post-build script asserts:

- `ota_shared.*` &gt; 0 (non-empty)
- `ota_order.*` and `ota_promo.*` below configurable threshold (e.g. 600KB) — warn in CI, fail in release build optional

## Risks / Trade-offs

- **[Risk] `unknown module` if shared load skipped** → Mitigation: mandatory `ensureSharedBundleLoaded`; integration test; split-audit cross-bundle
- **[Risk] Shared/feature version skew on server** → Mitigation: single `build:bundles` uploads all three; manifest atomic snapshot
- **[Risk] Segment id collision** → Mitigation: reserve `0` for shared, document in `feature-segments.json`
- **[Trade-off] Extra download on first OTA visit** → One-time ~1.5MB shared + small feature vs 2MB per feature every time
- **[Trade-off] More complex bootstrap** → Acceptable; aligns with true multi-bundle architecture

## Migration Plan

1. Implement shared build + segment 0 + client load order behind feature flag or version gate
2. Build all three bundles; verify sizes and split-audit
3. Upload `ota_shared` + features together; bump version (e.g. 0.0.8)
4. Manual: cold OTA, instant re-entry, Metro→OTA, order↔promo switch
5. Rollback: revert to monolithic per-feature split (previous `isFeatureOwnedBySplit` includes nav)

## Open Questions

- Exact shared entry: empty warm-import vs registering a no-op `AppRegistry` component (implementation spike)
- Whether `shared` needs its own bundle-server DB row or manifest-only artifact for v1
- Promo/order-only shared UI (`RemoteScreenShell`) — shared bundle vs duplicated thin wrapper (lean toward shared if both use it)
