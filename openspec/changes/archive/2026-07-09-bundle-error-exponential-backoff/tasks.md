## 1. bundle-server — delivery retry hints

- [x] 1.1 Add `config.bundleRetryAfterSeconds` (default 5) in `bundle-server/src/config.ts`
- [x] 1.2 In `manifest.service.ts`, `fs.access` active release file; emit `hash: sha256:unset` + warn when missing
- [x] 1.3 Add pre-static route/hook for `GET /bundles/*`: missing file → 503 JSON `{ error, retryable }` + `Retry-After` header
- [x] 1.4 Verify existing files still served via `@fastify/static` at 200
- [x] 1.5 Add server unit/integration test or smoke curl for 503 + `Retry-After` on missing bundle

## 2. rn_app — retry helper

- [x] 2.1 Create `rn_app/src/features/retryWithBackoff.ts` with `maxAttempts: 10`, exponential delay, jitter, `Retry-After` parsing
- [x] 2.2 Implement `isRetryableHttpError(status, body?)` per design (408/429/5xx yes; 404 no)
- [x] 2.3 Add `fetchWithRetry(input, init?, options?)` wrapping `fetch` with attempt logging in `__DEV__`
- [x] 2.4 Add unit tests for delay schedule, max 10 cap, 404 no-retry, Retry-After honor

## 3. rn_app — wire OTA fetch paths

- [x] 3.1 Use `fetchWithRetry` in `manifest.ts` for manifest GET
- [x] 3.2 Use `fetchWithRetry` in `bundleUpdater.ts` for active + pending bundle body download
- [x] 3.3 Ensure `stageRemoteFeatureUpdate` inherits retry via shared download helper (best-effort unchanged)
- [x] 3.4 Ensure `otaUpdatePoller` poll download uses same helper; poll error after 10 failures only
- [x] 3.5 Confirm hash mismatch / invalid bundle do not trigger HTTP retry

## 4. UX & observability

- [x] 4.1 DEV poll overlay: show last retry attempt count when poll error (optional `retries: n/10`)
- [x] 4.2 After 10 failures, preserve existing `FeatureHost` error UI with server/local version labels

## 5. Docs & verification

- [x] 5.1 Update `docs/dynamic-multi-bundle.md` — retry policy (10 attempts, backoff, server 503)
- [x] 5.2 Update `docs/sop.md` — troubleshooting transient bundle 503 vs permanent 404
- [x] 5.3 Extend `bundle-server/scripts/e2e-ota-smoke.sh`: rename bundle briefly, expect client recovery after restore (optional)
- [x] 5.4 Manual: stop bundle file → manifest shows unset hash → restore file → OTA page loads within retries
