import {
  computeBackoffDelayMs,
  FetchRetryError,
  fetchWithRetry,
  isRetryableHttpError,
  isRetryableHttpStatus,
  OTA_RETRY_MAX_ATTEMPTS,
  parseRetryAfterMs,
} from '../retryWithBackoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isRetryableHttpError', () => {
    it('retries 408, 429, and 5xx', () => {
      expect(isRetryableHttpError(408)).toBe(true);
      expect(isRetryableHttpError(429)).toBe(true);
      expect(isRetryableHttpError(503)).toBe(true);
      expect(isRetryableHttpError(500)).toBe(true);
    });

    it('does not retry 404', () => {
      expect(isRetryableHttpError(404)).toBe(false);
      expect(isRetryableHttpStatus(404)).toBe(false);
    });
  });

  describe('computeBackoffDelayMs', () => {
    it('grows exponentially and caps at maxDelayMs', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      expect(
        computeBackoffDelayMs(1, { baseDelayMs: 500, maxDelayMs: 30_000, jitterRatio: 0 }),
      ).toBe(500);
      expect(
        computeBackoffDelayMs(2, { baseDelayMs: 500, maxDelayMs: 30_000, jitterRatio: 0 }),
      ).toBe(1000);
      expect(
        computeBackoffDelayMs(10, { baseDelayMs: 500, maxDelayMs: 30_000, jitterRatio: 0 }),
      ).toBe(30_000);
    });

    it('honors Retry-After when larger than exponential delay', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      expect(
        computeBackoffDelayMs(
          1,
          { baseDelayMs: 500, maxDelayMs: 30_000, jitterRatio: 0 },
          5000,
        ),
      ).toBe(5000);
    });
  });

  describe('parseRetryAfterMs', () => {
    it('parses Retry-After seconds header', () => {
      const response = new Response(null, { headers: { 'Retry-After': '5' } });
      expect(parseRetryAfterMs(response)).toBe(5000);
    });
  });

  describe('fetchWithRetry', () => {
    it('does not retry 404', async () => {
      const fetchMock = jest.fn().mockResolvedValue(new Response('missing', { status: 404 }));
      global.fetch = fetchMock as typeof fetch;

      await expect(
        fetchWithRetry('http://example.test/bundle', undefined, {
          sleep: async () => {},
          label: 'test',
        }),
      ).rejects.toMatchObject({ attempts: 1, lastStatus: 404 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries until success', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(new Response('busy', { status: 503 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));
      global.fetch = fetchMock as typeof fetch;

      const response = await fetchWithRetry('http://example.test/bundle', undefined, {
        sleep: async () => {},
        label: 'test',
      });

      expect(response.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stops after max attempts', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(new Response('busy', { status: 503 }));
      global.fetch = fetchMock as typeof fetch;

      await expect(
        fetchWithRetry('http://example.test/bundle', undefined, {
          maxAttempts: OTA_RETRY_MAX_ATTEMPTS,
          sleep: async () => {},
          label: 'test',
        }),
      ).rejects.toBeInstanceOf(FetchRetryError);

      expect(fetchMock).toHaveBeenCalledTimes(OTA_RETRY_MAX_ATTEMPTS);
    });

    it('waits at least Retry-After before next attempt', async () => {
      jest.useFakeTimers();
      const sleep = jest.fn().mockResolvedValue(undefined);
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ retryable: true }), {
            status: 503,
            headers: { 'Retry-After': '5' },
          }),
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));
      global.fetch = fetchMock as typeof fetch;

      const promise = fetchWithRetry('http://example.test/bundle', undefined, {
        sleep,
        jitterRatio: 0,
        label: 'test',
      });

      await Promise.resolve();
      expect(sleep).toHaveBeenCalledWith(5000);

      await promise;
      jest.useRealTimers();
    });
  });
});
