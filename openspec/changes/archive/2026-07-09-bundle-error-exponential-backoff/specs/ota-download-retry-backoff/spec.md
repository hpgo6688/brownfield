## ADDED Requirements

### Requirement: OTA HTTP operations retry with exponential backoff

The RN OTA client SHALL retry retryable manifest and bundle download HTTP failures using exponential backoff with a **maximum of 10 attempts** per single logical fetch operation.

Retryable failures SHALL include network errors, HTTP 408, HTTP 429, HTTP 500–599, and HTTP 503 when the server marks the response as retryable.

Non-retryable failures SHALL include HTTP 400, 401, 403, 404, hash mismatch after a successful response body download, and invalid OTA bundle content validation failures.

#### Scenario: Transient 503 succeeds on retry

- **WHEN** `ensureFeatureCached` downloads a bundle
- **AND** the first `GET bundleUrl` returns HTTP 503 with `Retry-After`
- **AND** a subsequent attempt within 10 tries returns HTTP 200 with valid body
- **THEN** the client caches the bundle and loads the Remote page normally
- **AND** no error UI is shown

#### Scenario: Permanent 404 fails without retry loop

- **WHEN** `GET bundleUrl` returns HTTP 404
- **THEN** the client performs exactly one attempt (no retry)
- **AND** returns structured failure or falls back to valid local cache if available

#### Scenario: Ten failures exhaust backoff

- **WHEN** a retryable error persists for 10 consecutive attempts
- **THEN** the client stops retrying
- **AND** surfaces the existing graceful error UI or non-fatal poll error state
- **AND** does not crash the native shell

#### Scenario: Backoff delay increases exponentially

- **WHEN** attempt `n` fails with a retryable error (1 ≤ n < 10)
- **THEN** the client waits before attempt `n+1`
- **AND** the base delay follows exponential growth `baseDelayMs * 2^(n-1)` capped by `maxDelayMs`
- **AND** optional jitter is applied

### Requirement: Server Retry-After is honored

When a bundle-server response includes a `Retry-After` header (seconds), the client retry helper SHALL wait at least that duration before the next attempt, in addition to respecting the exponential backoff schedule.

#### Scenario: Server suggests 5 second wait

- **WHEN** bundle download receives HTTP 503 with `Retry-After: 5`
- **THEN** the next attempt is not started before 5 seconds elapse
- **AND** total attempts still do not exceed 10

### Requirement: Bootstrap and staging share retry policy

Manifest fetch (`fetchManifest`, `fetchFeatureById`), active bundle download (`downloadAndCacheFeature`), and pending bundle download (`downloadPendingFeature`) SHALL use the same retry helper and classification rules.

#### Scenario: Pre-entry staging retries download

- **WHEN** `stageRemoteFeatureUpdate` triggers a pending download
- **AND** the server returns retryable errors then succeeds
- **THEN** pending bundle is written to sandbox without blocking active cache load on unrelated paths

#### Scenario: Poll download uses shared retry

- **WHEN** `otaUpdatePoller` downloads a pending update
- **AND** transient failures occur
- **THEN** the poller retries up to 10 times before recording a poll error
- **AND** the currently displayed screen is not force-reloaded

### Requirement: Native split load is not retried

The client SHALL NOT apply HTTP exponential backoff to native `SplitBundleLoader.load`, `executeSplitBundleEntry`, or bundle content validation. Those failures SHALL continue to use existing cache-sync and error UI behavior.

#### Scenario: Invalid bundle bytes after successful HTTP

- **WHEN** download succeeds but hash or OTA content validation fails
- **THEN** no HTTP retry is attempted
- **AND** the invalid bytes are not promoted to active cache
