## 1. Config and storage path

- [x] 1.1 Rename `config.distDir` to `config.bundlesDir` pointing at `path.join(process.cwd(), 'data', 'bundles')`
- [x] 1.2 Rename `ensureDistDir()` to `ensureBundlesDir()` and update all imports/call sites
- [x] 1.3 Update `createReleaseFromUpload` to write files under `config.bundlesDir`

## 2. Server startup and static serving

- [x] 2.1 Ensure `data/bundles/` is created on startup in `index.ts` (before static register and listen)
- [x] 2.2 Point `@fastify/static` root at `config.bundlesDir` (keep prefix `/bundles/`)

## 3. Documentation

- [x] 3.1 Update `bundle-server/README.md` — server storage path is `data/bundles/`
- [x] 3.2 Update `docs/sop.md` and `docs/dynamic-multi-bundle.md` where they describe server-side bundle location
- [x] 3.3 Update `rn_app/bundles/README.md` server artifact path (RN build output path unchanged)

## 4. Verification

- [x] 4.1 Extend or add smoke test: upload bundle → restart server → `GET /bundles/<filename>` returns 200
- [x] 4.2 Manual check: manifest `bundleUrl` downloadable after `npm run dev` restart

## 5. Client fault tolerance (missing bundle)

- [x] 5.1 Add `clearStaleActiveMetadata(featureId)` in `bundleCache` — remove metadata when `localPath` file missing
- [x] 5.2 Update `ensureFeatureCached` / `checkAndUpdateFeature` to return `{ bundlePath: null, error }` instead of throw when no usable cache and download fails
- [x] 5.3 Ensure `FeatureHost` handles null `bundlePath` via error UI only (no `loadFeatureBundle` call); verify catch covers split-load rejections
- [x] 5.4 Verify `otaUpdatePoller` poll/download 404 does not crash or unhandled-reject while cached screen is showing

## 6. Client verification

- [x] 6.1 Manual: server running, no bundle uploaded → open OTA Remote page → error UI, app stays alive, native back works
- [x] 6.2 Manual: upload bundle → use app → delete server `data/bundles/*` → restart server → re-open OTA page with empty sandbox → error UI, no crash
- [x] 6.3 Manual: cached screen running → delete server bundles → poll runs → screen stays up, error in poll state only
