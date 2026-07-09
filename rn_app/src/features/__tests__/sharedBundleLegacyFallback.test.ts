jest.mock('../splitBundleLoader', () => ({
  isSplitBundleLoaderAvailable: jest.fn(() => true),
  SplitBundleLoader: {
    load: jest.fn(),
  },
}));

jest.mock('../manifest', () => ({
  clearManifestCache: jest.fn(),
  DEFAULT_MANIFEST_URL: 'http://test/manifest',
  fetchManifest: jest.fn(),
}));

jest.mock('../bundleCache', () => ({
  readCachedMetadata: jest.fn(() => null),
  cachedBundleFileExists: jest.fn(),
  isCachedBundleUsable: jest.fn(),
  validateSharedBundleContent: jest.fn(() => true),
  markBundleUsable: jest.fn(),
  writeCachedBundle: jest.fn(() => '/tmp/shared/0.0.8.jsbundle'),
  writeCachedMetadata: jest.fn(),
}));

jest.mock('../retryWithBackoff', () => ({
  fetchWithRetry: jest.fn(),
}));

import { fetchManifest } from '../manifest';
import { ensureSharedBundleCached } from '../sharedBundleUpdater';

const mockFetchManifest = fetchManifest as jest.Mock;

describe('ensureSharedBundleCached legacy fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null bundlePath when manifest omits sharedBundle', async () => {
    mockFetchManifest.mockResolvedValue({
      features: [],
      sharedBundle: null,
    });

    const result = await ensureSharedBundleCached({ manifestUrl: 'http://test/manifest' });
    expect(result.bundlePath).toBeNull();
    expect(result.shared).toBeNull();
  });
});
