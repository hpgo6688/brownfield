## Context

`bundle-server` already persists Remote entry metadata (features, releases, active version) in SQLite at `data/bundle-server.db`. Upload handler `createReleaseFromUpload` writes `.jsbundle` bytes via `fs.writeFile` to `config.distDir`, currently resolved as `bundle-server/dist/bundles/`.

That path is misleading: `dist/` suggests build output, is not gitignored as a whole, and operators may delete it during `npm run build` or manual cleanup. SQLite survives in `data/`; bundle files do not — manifest URLs still point at missing files after restart.

Constraints:
- Keep public URL shape unchanged: `GET /bundles/<filename>` (no client manifest change)
- Colocate runtime artifacts under existing gitignored `data/` directory (same as DB)
- OTA client must never take down the native shell — errors stay inside `FeatureHost`
- Minimal diff: config path + mkdir + static root + targeted client guards

## Goals / Non-Goals

**Goals:**
- Store uploaded `.jsbundle` files under `bundle-server/data/bundles/`
- Ensure directory is created on startup before accepting uploads or serving static files
- Serve uploaded bundles from the same directory via existing `/bundles/` prefix
- Update operator docs to reflect server storage location
- When bundle is unavailable (server 404, empty server storage, deleted sandbox file, split load failure), show **「页面加载失败」** error UI inside `FeatureHost` and allow user to navigate back via native shell
- Updater APIs (`ensureFeatureCached`, `checkAndUpdateFeature`) return `{ bundlePath: null, error }` instead of throwing when no usable cache exists
- Remove stale active metadata when `localPath` file is missing

**Non-Goals:**
- Changing RN build output path (`rn_app/dist/bundles/` stays the CI upload **source**)
- Migrating/copying legacy files from `dist/bundles/` automatically
- Object storage (S3), CDN, or multi-instance shared storage
- Changing manifest schema, hash algorithm, or upload API contract
- Auto-retry with exponential backoff (manual re-entry / poll is enough for demo)
- Rendering a placeholder Remote screen without any bundle (error UI is acceptable)

## Decisions

### 1. Storage path: `data/bundles/`

**Choice:** Replace `config.distDir` with `config.bundlesDir = path.join(process.cwd(), 'data', 'bundles')` (or equivalent resolved from `bundle-server/` cwd).

**Rationale:** Matches SQLite location (`data/bundle-server.db`), already gitignored, clearly runtime state.

**Alternative:** Keep `dist/bundles/` and document "do not delete" — rejected; easy to violate and inconsistent with DB placement.

**Alternative:** `data/uploads/` — rejected; `bundles/` aligns with URL prefix `/bundles/`.

### 2. Config key naming

**Choice:** Rename `distDir` → `bundlesDir` in `config.ts` to avoid confusion with RN/build `dist/`.

**Rationale:** Self-documenting; grep for `distDir` in server code becomes unambiguous.

### 3. Startup initialization

**Choice:** Reuse `ensureDistDir()` pattern renamed to `ensureBundlesDir()`; call from `index.ts` alongside existing `fs.mkdirSync(..., 'data')`.

**Rationale:** Upload and static serving both depend on directory existing; fail early at boot.

### 4. Static file serving

**Choice:** Point `@fastify/static` `root` at `config.bundlesDir` (unchanged `prefix: '/bundles/'`).

**Rationale:** Zero client impact; same HTTP paths.

### 5. Legacy `dist/bundles/` on server

**Choice:** No auto-migration. Document that operators re-upload if files only existed under old path.

**Rationale:** Dev/demo environments; avoids silent partial migrations when DB references old filenames.

### 6. Client: non-throwing updater on total failure

**Choice:** Align `ensureFeatureCached` with `preloadFeatures` — catch download/manifest errors and return `UpdateCheckResult` with `bundlePath: null` and `error` message instead of rethrowing when no usable local file exists.

**Rationale:** `FeatureHost` already branches on `!bundlePath`; throwing bypasses structured handling and can surface as RedBox/unhandled rejection in edge paths.

**Alternative:** Global ErrorBoundary at app root — rejected; error should stay scoped to Remote page, native tabs must remain usable.

### 7. Client: stale cache metadata cleanup

**Choice:** When `readCachedMetadata` points to a path where `cachedBundleFileExists` is false, clear active metadata (and pending if same path) before attempting remote download.

**Rationale:** Avoids retry loops on ghost paths; matches user expectation after server wipe or manual sandbox delete.

### 8. Client: split load errors stay in JS

**Choice:** `loadFromNativeSplitBundle` already rejects via promise; ensure `FeatureHost` catch block handles all load paths. `executeSplitBundleEntry` failures become thrown `Error` with readable message, not silent native crash.

**Rationale:** Native `SplitBundleLoader` rejects on missing file (`ENOENT`); JS must not let that escape the OTA load `try/catch`.

### 9. Client: polling must not crash running screen

**Choice:** `otaUpdatePoller` already catches poll/download errors into `error` state; verify `downloadPendingFeature` 404 does not trigger apply or unhandled promise on background poll.

**Rationale:** User may stay on a working cached screen while server bundle is gone; poll failure is informational only until apply.

## Risks / Trade-offs

- **[Risk] Existing deployments have files only in `dist/bundles/`** → Document re-upload; smoke test verifies post-restart file still served from `data/bundles/`
- **[Risk] `process.cwd()` differs between dev (tsx) and production (`node dist/index.js`)** → Resolve `bundlesDir` relative to `bundle-server/` root consistently (same approach as `db-url.ts` / startup `data/` mkdir)
- **[Trade-off] `data/` grows with every uploaded version** → Acceptable for demo/small team; prune old release files is out of scope (DB keeps history; disk may retain superseded files until manual cleanup)
- **[Risk] Corrupt bundle bytes cause native registerSegment failure** → Pre-check file exists + minimum size; catch reject; show error UI; do not retry load in a tight loop
- **[Risk] User sees error screen instead of Remote page when bundle missing** → Acceptable trade-off vs crash; message guides re-upload / check server

## Migration Plan

1. Ship code change (config + service + static root)
2. Restart bundle-server
3. Re-upload active Remote bundles via Admin or `upload-bundle.sh`
4. Verify: `curl /api/manifest` → download `bundleUrl` → 200 after restart
5. Optional: delete stale `bundle-server/dist/bundles/*.jsbundle` locally

**Rollback:** Revert config to `dist/bundles/`; re-upload bundles to old path.

## Open Questions

- (none — server path + client graceful degradation scope are clear)
