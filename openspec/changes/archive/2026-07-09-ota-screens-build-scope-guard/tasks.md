## 1. Shared components extraction

- [x] 1.1 Create `screens/remote/components/` with shared `OrderList`, `PromoList` (or equivalent) extracted from current remote/ota screens
- [x] 1.2 Refactor `screens/remote/OrderScreen.tsx` and `PromoScreen.tsx` to compose shared components + Metro badge/copy
- [x] 1.3 Ensure shared components have no imports from `bundles/ota_*` or OTA-only modules

## 2. Colocate OTA screens under bundles

- [x] 2.1 Move `screens/ota/OrderScreen.tsx` → `bundles/ota_order/screens/OrderScreen.tsx` (OTA wrapper + shared components)
- [x] 2.2 Move `screens/ota/PromoScreen.tsx` → `bundles/ota_promo/screens/PromoScreen.tsx`
- [x] 2.3 Update `bundles/ota_order/index.js` and `bundles/ota_promo/index.js` to import from `./screens/`
- [x] 2.4 Delete `screens/ota/` directory and update any remaining references (`remoteConfig.ts` comments, docs)
- [x] 2.5 Update `build-bundles.js` `isFeatureOwnedBySplit` to match `bundles/ota_*/screens/` instead of `screens/ota/`

## 3. Dev guardrails (lint, Metro, verify)

- [x] 3.1 Add ESLint `no-restricted-imports` rules blocking `bundles/ota_*` from runtime paths (`src/`, `index.js`, `screens/remote/` except shared components path)
- [x] 3.2 Add ESLint override exempting `bundles/ota_*/**`
- [x] 3.3 Add Metro `resolver.blockList` for `bundles/ota_*` in `metro.config.js`
- [x] 3.4 Implement `scripts/verify-ota-scope.js` + `npm run verify:ota-scope` in `package.json`
- [x] 3.5 Add file-header comment to OTA screen files: build/upload only

## 4. Documentation and verification

- [x] 4.1 Add `screens/remote/README.md` and `bundles/README.md` with edit workflow
- [x] 4.2 Update `docs/dynamic-multi-bundle.md` “where to edit” table (Metro vs OTA upload)
- [x] 4.3 Run `npm run verify:ota-scope` and `npm run build:bundles` — confirm main graph clean and OTA bundles build
- [x] 4.4 Upload rebuilt `ota_*` bundles and smoke-test Metro HMR vs OTA load still show distinct badges
