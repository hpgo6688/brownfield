## Why

OTA bundle delivery can fail transiently — network blips, bundle-server restart before `data/bundles/` is repopulated, or momentary 5xx — yet the client currently fails on the first error and surfaces「远程 bundle 不可用」even when a retry would succeed. There is no coordinated retry policy between bundle-server responses and the RN updater/downloader. Adding capped exponential backoff (max 10 attempts) on both sides reduces false-negative load failures and aligns server retry hints with client behavior.

## What Changes

- Add a **shared client retry helper** with exponential backoff (base delay configurable, **max 10 attempts**) for manifest fetch, bundle download, and bootstrap cache refresh paths in `bundleUpdater` / `useFeatureHost` load flow
- **Do not retry** non-retryable errors (HTTP 4xx except 408/429, hash mismatch, invalid bundle content, programmer errors)
- **bundle-server**: when manifest references a release whose file is missing on disk, return `hash: sha256:unset` (existing pattern) and serve bundle static routes with **`Retry-After`** + structured JSON error for missing files; log delivery failures for observability
- **Persist retry state** per feature in memory during a single load/staging attempt; reset on success or after 10 failures
- Surface final failure only after retries exhausted; intermediate failures logged in DEV
- Update e2e smoke script to cover transient-failure simulation (optional stub)

## Capabilities

### New Capabilities

- `ota-download-retry-backoff`: RN client exponential backoff for manifest/bundle OTA fetch failures (max 10 attempts, retryable vs fatal classification)
- `bundle-delivery-retry-hints`: bundle-server signals retryable bundle delivery failures (`Retry-After`, missing-file handling aligned with manifest)

### Modified Capabilities

- (none — no archived specs in `openspec/specs/`; extends existing `bundleUpdater` / bundle-server static delivery patterns from scheme2 and persist-bundle-uploads)

## Impact

- **`rn_app/src/features/`**: new `retryWithBackoff.ts` (or similar), integrate into `bundleUpdater.ts`, `manifest.ts`, optionally `otaUpdatePoller.ts` staging path
- **`bundle-server/src/`**: static bundle route wrapper or manifest builder validation for on-disk file presence; `Retry-After` on retryable 503 responses
- **`bundle-server/scripts/e2e-ota-smoke.sh`**: optional retry scenario
- **Docs**: `docs/dynamic-multi-bundle.md`, `docs/sop.md` — retry policy summary
- **Dependencies**: may reuse `exponential-backoff` already in RN transitive deps, or implement minimal inline helper to avoid new direct dependency
