## Context

OTA delivery spans **bundle-server** (manifest API + `/bundles/` static files) and **rn_app** (`manifest.ts`, `bundleUpdater.ts`, `useFeatureHost` / `otaUpdatePoller`). Failures today are single-shot: one 404/5xx or network error immediately surfaces「远程 bundle 不可用」or aborts staging, even though the prior change `persist-bundle-uploads-to-data` explicitly deferred auto-retry to manual re-entry / poll.

Recent production-like issues (same-version load failure, missing file after server restart) show that **transient** unavailability is common. The client already has `exponential-backoff` as a transitive npm dependency, but no OTA-specific retry policy. The server serves bundles via `@fastify/static` with no `Retry-After` and manifest may advertise a release whose file is absent on disk.

## Goals / Non-Goals

**Goals:**

- Retry **retryable** OTA fetch failures with **exponential backoff**, **maximum 10 attempts** per logical operation (manifest fetch, bundle download)
- Classify errors: retry 408, 429, 5xx, network timeout; **do not retry** 401/403/404 (except 408), hash mismatch, invalid bundle bytes
- **bundle-server** validates active release file on disk when building manifest; missing file → `hash: sha256:unset` and optional admin warning
- **bundle-server** returns **`Retry-After`** (seconds) on custom 503 handler for missing bundle file requests under `/bundles/`
- Client honors server `Retry-After` when present, capped within backoff schedule
- After 10 failed attempts, preserve existing graceful error UI (no crash, show server/local version when available)

**Non-Goals:**

- Infinite retry or background retry hours after initial failure
- Retrying split-bundle **native load** / `registerFeature` failures (JS registration issues remain single-shot + cache sync)
- CDN, multi-region, or queue-based delivery
- Changing manifest schema version or upload API
- Admin UI for retry metrics (logging only in v1)

## Decisions

### 1. Shared client helper: `fetchWithRetry` / `retryWithBackoff`

**Choice:** Add `rn_app/src/features/retryWithBackoff.ts` with:

```typescript
type RetryOptions = {
  maxAttempts: 10;           // fixed cap
  baseDelayMs: 500;          // first wait after attempt 1 fails
  maxDelayMs: 30_000;        // ceiling per wait
  jitterRatio: 0.2;          // ±20% jitter
  isRetryable: (error) => boolean;
  getRetryAfterMs?: (response) => number | null;
};
```

Delay formula for attempt `n` (1-based, after failure):  
`wait = min(maxDelayMs, baseDelayMs * 2^(n-1))` with jitter.

**Rationale:** Simple, testable, matches user requirement (指数退避, max 10). Inline implementation avoids adding a direct dependency; can wrap `exponential-backoff` later if desired.

**Alternative:** Retry only in poller — rejected; bootstrap `ensureFeatureCached` needs it most.

### 2. Where to apply retries (client)

| Operation | File | Retry? |
|-----------|------|--------|
| `fetchManifest` / `fetchFeatureById` | `manifest.ts` | Yes (GET manifest) |
| `downloadAndCacheFeature` / `downloadPendingFeature` body fetch | `bundleUpdater.ts` | Yes (GET bundleUrl) |
| `stageRemoteFeatureUpdate` pre-entry download | `bundleUpdater.ts` | Yes (via download helper) |
| `otaUpdatePoller` poll download | `otaUpdatePoller.ts` | Yes (same download helper) |
| `loadFeatureBundle` / native split load | `bundleLoader.ts` | **No** |
| Hash verify / `validateOtaBundleContent` | `bundleCache.ts` | **No** |

**Rationale:** Retries target **HTTP transport** to server; local validation failures are permanent.

### 3. Retryable error classification

**Retryable:**

- `TypeError` / network failure (no response)
- HTTP 408, 429, 500–599
- HTTP 503 with `Retry-After` from bundle-server

**Not retryable:**

- HTTP 400, 401, 403, 404 (bundle genuinely missing or wrong URL)
- Hash mismatch after successful download
- Invalid OTA bundle content
- RNFS / native module missing

**Rationale:** 404 after 10 retries still fails; avoids hammering server when release deleted.

### 4. Server: manifest file presence check

**Choice:** In `buildManifest`, before emitting `hash` and `bundleUrl`, `fs.access` the expected file under `config.bundlesDir`. If missing:

- Set `hash: 'sha256:unset'`
- Keep `version` from DB (admin visibility)
- Log warning with `featureId`, `filename`

**Rationale:** Client already treats `sha256:unset` as no download; prevents advertising undeliverable bundles as ready.

**Alternative:** Remove feature from manifest — rejected; hides problem from admin/dev overlay.

### 5. Server: `/bundles/` missing file handler

**Choice:** Register a custom `onRequest` or route before `@fastify/static` that matches `/bundles/*`, checks file existence, and if missing returns:

```json
{ "error": "bundle_file_missing", "retryable": true }
```

with HTTP **503** and `Retry-After: 5` (configurable default, exponential not on server — client owns backoff).

**Rationale:** Gives client a machine-readable retry signal aligned with backoff helper.

**Alternative:** Return 404 — rejected; client would not retry.

### 6. Interaction with existing graceful degradation

**Choice:** After retries exhausted:

- Bootstrap: return `{ bundlePath: null, error }` or fall back to **valid local cache** if exists (unchanged)
- Poll/staging: log error, keep running screen (unchanged non-fatal poll behavior)

**Rationale:** Backoff is additive; does not weaken crash containment from prior fixes.

## Risks / Trade-offs

- **[Risk] 10 retries lengthen time-to-error on permanent 404** → Mitigation: 404 is non-retryable; only transient errors loop
- **[Risk] Total wait up to ~60s+ on bad network** → Mitigation: `maxDelayMs` cap; DEV log per attempt
- **[Risk] Poll + bootstrap double-retry storm** → Mitigation: share one download function; poller still respects `inFlightRef`
- **[Risk] Server `Retry-After` ignored by raw fetch** → Mitigation: parse header in retry helper, use `max(serverHint, computedBackoff)`
- **[Risk] Manifest lists unset hash while file appears later** → Mitigation: next poll/entry retries; admin upload restores hash

## Migration Plan

1. Ship bundle-server manifest validation + 503 handler first (backward compatible)
2. Ship client `retryWithBackoff` + wire manifest/download
3. Extend e2e smoke: temporarily rename bundle file, expect client recovery within 10 attempts after restore
4. Rollback: remove retry wrapper (single-shot fetch), revert server hook (static only)

## Open Questions

- Should attempt count / last error be exposed in DEV poll overlay? (Recommended: yes, `retries: 3/10`)
- Default `baseDelayMs`: 500ms vs 1000ms? (Proposal: 500ms, ~30s total worst case with cap)
