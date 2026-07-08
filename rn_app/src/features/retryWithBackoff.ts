export const OTA_RETRY_MAX_ATTEMPTS = 10;

export const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: OTA_RETRY_MAX_ATTEMPTS,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  jitterRatio: 0.2,
} as const;

export type RetryBackoffOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  label?: string;
  sleep?: (ms: number) => Promise<void>;
};

export class FetchRetryError extends Error {
  readonly attempts: number;
  readonly lastStatus?: number;

  constructor(message: string, attempts: number, lastStatus?: number) {
    super(message);
    this.name = 'FetchRetryError';
    this.attempts = attempts;
    this.lastStatus = lastStatus;
  }
}

export function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }

  return status >= 500 && status <= 599;
}

export function isRetryableHttpError(status: number, _body?: unknown): boolean {
  return isRetryableHttpStatus(status);
}

export function isNetworkFetchError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  return false;
}

export function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (!header) {
    return null;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

export function computeBackoffDelayMs(
  attempt: number,
  options: Pick<RetryBackoffOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterRatio'>,
  retryAfterMs?: number | null,
): number {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const jitterRatio = options.jitterRatio ?? DEFAULT_RETRY_OPTIONS.jitterRatio;

  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const base = retryAfterMs != null ? Math.max(exponential, retryAfterMs) : exponential;
  const jitter = base * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryBackoffOptions,
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts;
  const sleep = options?.sleep ?? defaultSleep;
  const label = options?.label ?? 'fetch';

  let lastStatus: number | undefined;
  let lastMessage = `${label} failed`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);

      if (response.ok) {
        if (__DEV__ && attempt > 1) {
          console.log(`[retry] ${label} succeeded on attempt ${attempt}/${maxAttempts}`);
        }
        return response;
      }

      lastStatus = response.status;
      lastMessage = `${label} failed (${response.status})`;

      if (!isRetryableHttpError(response.status) || attempt >= maxAttempts) {
        throw new FetchRetryError(lastMessage, attempt, response.status);
      }

      const retryAfterMs = parseRetryAfterMs(response);
      const delayMs = computeBackoffDelayMs(attempt, options ?? {}, retryAfterMs);

      if (__DEV__) {
        console.warn(
          `[retry] ${label} attempt ${attempt}/${maxAttempts} → ${response.status}, wait ${delayMs}ms`,
        );
      }

      await sleep(delayMs);
    } catch (error) {
      if (error instanceof FetchRetryError) {
        throw error;
      }

      lastMessage = error instanceof Error ? error.message : `${label} network error`;

      if (!isNetworkFetchError(error) || attempt >= maxAttempts) {
        throw new FetchRetryError(lastMessage, attempt, lastStatus);
      }

      const delayMs = computeBackoffDelayMs(attempt, options ?? {});

      if (__DEV__) {
        console.warn(
          `[retry] ${label} attempt ${attempt}/${maxAttempts} network error, wait ${delayMs}ms`,
        );
      }

      await sleep(delayMs);
    }
  }

  throw new FetchRetryError(lastMessage, maxAttempts, lastStatus);
}
