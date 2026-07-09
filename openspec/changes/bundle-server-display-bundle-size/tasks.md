## 1. Data model

- [x] 1.1 Add `sizeBytes Int?` to `BundleRelease` in `prisma/schema.prisma`
- [x] 1.2 Run `npm run db:migrate` (or project Prisma migrate command) in `bundle-server`

## 2. Upload & API

- [x] 2.1 Set `sizeBytes: buffer.byteLength` in `createReleaseFromUpload` (`bundle.service.ts`)
- [x] 2.2 Add `resolveReleaseSizeBytes(release)` helper: use DB value or `fs.stat` fallback
- [x] 2.3 Map `sizeBytes` in `listFeaturesAdmin` / feature detail responses before JSON serialize
- [x] 2.4 Ensure upload response `release` object includes `sizeBytes`

## 3. Build manifest

- [x] 3.1 Add `sizeBytes` to each entry in `rn_app/scripts/build-bundles.js` `buildManifest.bundles`

## 4. Admin UI

- [x] 4.1 Add `formatBytes(sizeBytes)` utility in `admin/index.html`
- [x] 4.2 Add **大小** column to release history table (`renderDetail`)
- [x] 4.3 Show active release size in sidebar (`renderSidebar` meta next to version)
- [x] 4.4 Tooltip with raw bytes on size cell

## 5. Verification

- [x] 5.1 Upload a bundle via Admin or `upload-bundle.sh` — confirm `sizeBytes` in API JSON
- [x] 5.2 Open `/admin` — release row shows expected KB/MB (e.g. order ~2MB after nav split fix)
- [x] 5.3 Legacy release with null `sizeBytes` but file on disk — UI still shows size via stat fallback
- [x] 5.4 `npm run build:bundles:dev` — `build-manifest.json` includes `sizeBytes`
