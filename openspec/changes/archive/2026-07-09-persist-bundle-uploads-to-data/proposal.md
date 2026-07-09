## Why

Today `POST /api/bundles/upload` writes release metadata to SQLite (`bundle-server/data/bundle-server.db`) but stores `.jsbundle` files under `dist/bundles/`. That directory is build-adjacent, not treated as runtime state, and is easy to wipe during rebuilds or dev restarts. After a server restart or clean, manifest still references releases whose files are missing — OTA clients get 404 on download. Uploaded bundles must live alongside the database under **`bundle-server/data/`** so they survive restarts.

Even with server-side persistence, bundles can still be missing (server wiped, first install, stale sandbox metadata). Today the OTA client may throw unhandled errors or leave the native shell in a bad state when download/load fails — users perceive this as an app crash. The client must **degrade gracefully**: show an in-app error screen and keep the native shell alive.

## What Changes

- Move server-side bundle artifact storage from `dist/bundles/` to **`data/bundles/`** (under `bundle-server/data/`, gitignored with the DB)
- Ensure upload writes `.jsbundle` bytes to disk before updating release metadata (already the flow; path changes)
- Point static file serving (`GET /bundles/*`) at the new directory
- Create `data/bundles/` on server startup (same pattern as `data/` for SQLite)
- Update README, SOP, and upload script examples that reference `bundle-server/dist/bundles/` as the **server storage** location (RN build output paths unchanged)
- Optional: one-time note in docs that operators should re-upload if old files only existed under `dist/bundles/`
- **Client fault tolerance**: when remote bundle is missing (404/5xx) or local cache file is gone, OTA load fails **without crashing** the app — `FeatureHost` shows a recoverable error UI; updater APIs return structured errors instead of throwing where possible
- Clear stale sandbox metadata when cached file path no longer exists on disk
- Wrap split-bundle native load failures so errors surface in JS error state, not unhandled rejections

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `bundle-upload-service`: Uploaded bundle files SHALL be stored under `data/bundles/` (not `dist/bundles/`) and remain available after server restart
- `bundle-ota-client`: OTA download/load failures (missing server bundle, missing/corrupt local cache) SHALL NOT crash the app; client shows graceful fallback UI and preserves native shell navigation

## Impact

- **`bundle-server/src/config.ts`**: `distDir` → `data/bundles` path (rename or new `bundlesDir` config key)
- **`bundle-server/src/services/bundle.service.ts`**: write path uses new directory
- **`bundle-server/src/index.ts`**: mkdir + `@fastify/static` root
- **`bundle-server/.gitignore`**: already ignores `data/` — no change expected
- **`rn_app/src/features/bundleUpdater.ts`**: non-throwing error results; stale cache cleanup
- **`rn_app/src/features/FeatureHost.tsx`**: guaranteed error boundary for OTA load path
- **`rn_app/src/features/bundleLoader.ts`**: catch native split-load rejections
- **`rn_app/src/features/otaUpdatePoller.ts`**: poll/download errors must not propagate as unhandled
- **Docs**: `bundle-server/README.md`, `docs/sop.md`, `docs/dynamic-multi-bundle.md`, `rn_app/bundles/README.md`
- **Scripts**: `e2e-ota-smoke.sh` if it asserts server file location
- **No manifest schema changes** — `bundleUrl` shape stays `/bundles/<filename>`
