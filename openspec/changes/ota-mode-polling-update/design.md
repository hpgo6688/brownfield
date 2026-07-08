## Context

Remote OTA pages load via `FeatureHost` when native shell is in OTA mode. On mount, `FeatureHost` calls `checkAndUpdateFeature`, which fetches manifest, compares version/hash, downloads if needed, and immediately loads the bundle — no user prompt.

`PromoScreen` exposes a manual **「检查 Remote 更新」** button that calls `checkAndUpdateFeature` for all remote features and, in OTA dev mode, triggers `DevSettings.reload()` via `applyRemoteFeatureUpdates`. There is no periodic polling and no staged “download now, apply later” flow.

Constraints:
- Reuse existing manifest API, `bundleCache`, hash verification, and split loader (`loadFeatureBundle`)
- OTA-only: Metro dev path (`screens/remote/`) must not poll or show update prompts
- Brownfield: updates apply within the current RN view hierarchy without native app restart

## Goals / Non-Goals

**Goals:**
- Poll remote manifest on an interval while user is on an OTA Remote page (or while OTA `FeatureHost` is mounted)
- When remote version/hash differs from **active** (loaded) version, download bundle to sandbox without reloading
- Surface a visible prompt: e.g. “发现新版本 v0.0.3” + **「立即更新」**
- On user tap, apply pending bundle: re-register, reload split bundle, refresh screen
- Expose updater APIs that separate **detect**, **download**, and **apply** from today’s all-in-one `checkAndUpdateFeature`

**Non-Goals:**
- Push notifications or background fetch when app is killed
- Updating while user is on Metro dev pages
- Server-side changes (webhook, delta patches, forced update policy)
- Auto-apply without user confirmation (except first load when no cache exists — keep current `FeatureHost` bootstrap behavior)

## Decisions

### 1. Three-phase update model

**Choice:** Split into:
1. `checkRemoteFeature(featureId)` → `{ updateAvailable, remoteFeature, pendingVersion }` (manifest compare only)
2. `downloadPendingFeature(feature)` → writes to cache, marks as **pending** (not active)
3. `applyPendingFeature(featureId)` → clears registration, loads pending path, bumps revision

**Rationale:** Polling must not reload the running UI. Pending metadata (e.g. `pendingVersion` in memory + cache file already on disk) decouples download from apply.

**Alternative:** Keep single `checkAndUpdateFeature` with `apply: false` flag — rejected because cache metadata today treats downloaded file as “installed”; need explicit pending vs active distinction.

### 2. Pending vs active cache metadata

**Choice:** Extend cached metadata JSON with optional `pendingVersion` / `pendingPath` fields, or store a sibling `pending.json` per feature. Active load continues using current `readCachedMetadata`; prompt reads pending when `pendingVersion !== activeVersion`.

**Rationale:** Minimal change to existing prune/load paths; apply promotes pending → active.

**Alternative:** Download to temp path only in memory — rejected (lost on reload, no offline retry).

### 3. Polling host: `OtaUpdateProvider` in `FeatureHost`

**Choice:** When `useOta === true`, wrap rendered OTA screen with a provider that:
- Starts `setInterval` (default **20s**, configurable via `remoteConfig`)
- Calls check + download for current `featureId` (and optionally sibling features from `remoteFeatureIds`)
- Pauses on `AppState` background; resumes on foreground
- Emits `{ pendingUpdate, applying }` to prompt component

**Rationale:** Centralizes OTA-only logic; every OTA page gets polling without duplicating in each `bundles/ota_*/screens/` file.

**Alternative:** Poll only on PromoScreen — rejected (user asked for OTA pages generally, including Order).

### 4. Update prompt UI

**Choice:** Shared `OtaUpdateBanner` component rendered by `FeatureHost` overlay (bottom fixed banner):
- Shows when `pendingUpdate !== null` and `pendingVersion > activeVersion`
- **「立即更新」** → `applyPendingFeature` + `bumpOtaBundleRevision`
- **「稍后」** → dismiss until next poll cycle or session

**Rationale:** Non-blocking; works on Order and Promo without editing each OTA screen wrapper heavily.

**Alternative:** Modal — acceptable but more intrusive; banner chosen for dev demo clarity.

### 5. First-load bootstrap unchanged

**Choice:** `FeatureHost` initial load still uses `checkAndUpdateFeature` (or equivalent) to ensure a bundle exists before first render. Polling + prompt only applies when user is already running an **older active** version and a newer one is on server.

**Rationale:** Avoid blank screen on cold start; user confirmation only for **in-session** upgrades.

### 6. Manual check on PromoScreen

**Choice:** Refactor button to call same staged APIs: check → download → show banner (or apply immediately if user explicitly tapped check — optional: still show prompt for consistency).

**Rationale:** One code path; manual check becomes “poll now”.

## Risks / Trade-offs

- **[Risk] Poll interval hammers bundle-server** → Default 20s; skip if previous request in flight; pause in background
- **[Risk] User dismisses prompt and never updates** → Acceptable; next poll re-shows banner
- **[Risk] Apply mid-interaction loses form state** → Expected for bundle replace; document in UI copy
- **[Risk] Pending download fails mid-poll** → Keep running active version; log error; retry next interval
- **[Trade-off] Polling only while FeatureHost mounted** → Leaving Remote tab stops poll; acceptable for v1

## Migration Plan

1. Add staged APIs + pending metadata without changing default `checkAndUpdateFeature` behavior
2. Add `OtaUpdateProvider` + banner behind OTA mode only
3. Refactor PromoScreen manual check to use staged flow
4. Document poll interval and user flow in `docs/dynamic-multi-bundle.md`
5. Smoke test: run 0.0.2 → upload 0.0.3 → stay on OTA Order → banner appears → tap apply → see 0.0.3

**Rollback:** Remove provider; revert to immediate `checkAndUpdateFeature` on entry only.

## Open Questions

- Poll interval default: **20s** (configurable via `remoteConfig`)
- Poll all `remoteFeatureIds` or current page only? → **Current page** for v1; Promo can optionally prefetch siblings
- Production release builds: same polling when `!__DEV__`? → **Yes**, OTA mode is primary in release
