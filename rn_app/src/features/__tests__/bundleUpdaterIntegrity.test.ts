import { sha256 } from 'js-sha256';
import {
  applyPendingFeature,
  downloadAndCacheFeature,
  formatFeatureLoadError,
  matchesRemoteRelease,
  normalizeHash,
  verifyOtaBundleBody,
} from '../bundleUpdater';
import {
  clearStalePendingRelease,
  deleteCachedBundle,
  deletePendingBundleByPath,
  getPendingBundlePath,
  readCachedMetadata,
  readPendingMetadata,
  writeCachedBundle,
  writeCachedMetadata,
  writePendingMetadata,
} from '../bundleCache';
import { clearOtaComponentCache } from '../registerFeature';
import { fetchWithRetry } from '../retryWithBackoff';
import { makeValidOtaBundleBody } from './otaTestFixtures';

jest.mock('../retryWithBackoff', () => ({
  fetchWithRetry: jest.fn(),
}));

jest.mock('../bundleCache', () => {
  const actual = jest.requireActual('../bundleCache');
  return {
    ...actual,
    deleteCachedBundle: jest.fn(),
    deletePendingBundleByPath: jest.fn(),
    writeCachedBundle: jest.fn(),
    writeCachedMetadata: jest.fn(),
    writePendingBundle: jest.fn(),
    writePendingMetadata: jest.fn(),
    clearStalePendingRelease: jest.fn(),
    readCachedMetadata: jest.fn(),
    readPendingMetadata: jest.fn(),
    clearPendingMetadata: jest.fn(),
    pruneOldVersions: jest.fn(),
    cachedBundleFileExists: jest.fn(),
    isCachedBundleUsable: jest.fn(),
  };
});

jest.mock('../registerFeature', () => ({
  clearOtaComponentCache: jest.fn(),
}));

jest.mock('../sharedBundleUpdater', () => ({
  ensureSharedBundleCached: jest.fn(),
}));

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;
const mockDeleteCachedBundle = deleteCachedBundle as jest.MockedFunction<
  typeof deleteCachedBundle
>;
const mockWriteCachedBundle = writeCachedBundle as jest.MockedFunction<
  typeof writeCachedBundle
>;
const mockWriteCachedMetadata = writeCachedMetadata as jest.MockedFunction<
  typeof writeCachedMetadata
>;
const mockWritePendingMetadata = writePendingMetadata as jest.MockedFunction<
  typeof writePendingMetadata
>;
const mockClearStalePendingRelease = clearStalePendingRelease as jest.MockedFunction<
  typeof clearStalePendingRelease
>;
const mockReadCachedMetadata = readCachedMetadata as jest.MockedFunction<
  typeof readCachedMetadata
>;
const mockReadPendingMetadata = readPendingMetadata as jest.MockedFunction<
  typeof readPendingMetadata
>;
const mockCachedBundleFileExists = require('../bundleCache')
  .cachedBundleFileExists as jest.MockedFunction<
  typeof import('../bundleCache').cachedBundleFileExists
>;
const mockIsCachedBundleUsable = require('../bundleCache')
  .isCachedBundleUsable as jest.MockedFunction<
  typeof import('../bundleCache').isCachedBundleUsable
>;

const RNFS = require('react-native-fs') as { readFile: jest.Mock };

describe('verifyOtaBundleBody', () => {
  const featureId = 'order';
  const body = makeValidOtaBundleBody(featureId);
  const hash = `sha256:${sha256(body)}`;

  it('accepts valid body with matching hash', () => {
    expect(() => verifyOtaBundleBody(featureId, body, hash)).not.toThrow();
  });

  it('rejects hash mismatch', () => {
    expect(() => verifyOtaBundleBody(featureId, body, 'sha256:deadbeef')).toThrow(
      /Hash mismatch/,
    );
  });

  it('rejects truncated invalid OTA content', () => {
    expect(() => verifyOtaBundleBody(featureId, 'short', 'sha256:unset')).toThrow(
      /not a valid OTA split bundle/,
    );
  });
});

describe('downloadAndCacheFeature integrity', () => {
  const feature = {
    id: 'order',
    title: 'order',
    icon: '',
    moduleName: '',
    bundleUrl: 'https://example.com/order.jsbundle',
    version: '0.0.7',
    hash: 'sha256:unset',
    minAppVersion: '0.0.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteCachedBundle.mockResolvedValue('/docs/rn-bundles/order/0.0.7.jsbundle');
    mockWriteCachedMetadata.mockResolvedValue(undefined);
  });

  it('writes metadata only after verification succeeds', async () => {
    const body = makeValidOtaBundleBody(feature.id);
    feature.hash = `sha256:${sha256(body)}`;
    mockFetchWithRetry.mockResolvedValue({
      text: async () => body,
    } as Response);

    const metadata = await downloadAndCacheFeature(feature);

    expect(mockWriteCachedBundle).toHaveBeenCalledWith(feature.id, feature.version, body);
    expect(mockWriteCachedMetadata).toHaveBeenCalled();
    expect(metadata.version).toBe('0.0.7');
  });

  it('deletes partial file and skips metadata on hash mismatch', async () => {
    const body = makeValidOtaBundleBody(feature.id);
    feature.hash = 'sha256:deadbeef';
    mockFetchWithRetry.mockResolvedValue({
      text: async () => body,
    } as Response);

    await expect(downloadAndCacheFeature(feature)).rejects.toThrow(/Hash mismatch/);
    expect(mockDeleteCachedBundle).toHaveBeenCalledWith(feature.id, feature.version);
    expect(mockWriteCachedMetadata).not.toHaveBeenCalled();
  });
});

describe('applyPendingFeature integrity', () => {
  const pending = {
    featureId: 'order',
    version: '0.0.8',
    hash: 'sha256:unset',
    localPath: '/docs/rn-bundles/order/0.0.8.pending.jsbundle',
    downloadedAt: '2026-07-09T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCachedBundleFileExists.mockResolvedValue(true);
    mockIsCachedBundleUsable.mockResolvedValue(true);
    mockReadPendingMetadata.mockResolvedValue(pending);
    mockReadCachedMetadata.mockResolvedValue({
      featureId: 'order',
      version: '0.0.6',
      hash: 'sha256:old',
      localPath: '/docs/rn-bundles/order/0.0.6.jsbundle',
      installedAt: '2026-07-09T00:00:00.000Z',
    });
    mockWriteCachedBundle.mockResolvedValue('/docs/rn-bundles/order/0.0.8.jsbundle');
    mockWriteCachedMetadata.mockResolvedValue(undefined);
    require('../bundleCache').clearPendingMetadata.mockResolvedValue(undefined);
    require('../bundleCache').pruneOldVersions.mockResolvedValue(undefined);
  });

  it('promotes pending to active after re-verification', async () => {
    const body = makeValidOtaBundleBody(pending.featureId);
    pending.hash = `sha256:${sha256(body)}`;
    RNFS.readFile.mockResolvedValue(body);

    const active = await applyPendingFeature('order');

    expect(clearOtaComponentCache).toHaveBeenCalledWith('order');
    expect(mockWriteCachedMetadata).toHaveBeenCalled();
    expect(active?.version).toBe('0.0.8');
  });

  it('clears corrupted pending and keeps active version unchanged', async () => {
    pending.hash = 'sha256:deadbeef';
    RNFS.readFile.mockResolvedValue(makeValidOtaBundleBody(pending.featureId));

    const active = await applyPendingFeature('order');

    expect(active).toBeNull();
    expect(mockClearStalePendingRelease).toHaveBeenCalledWith('order', pending);
    expect(mockWriteCachedMetadata).not.toHaveBeenCalled();
  });
});

describe('downloadPendingFeature integrity', () => {
  it('does not write pending metadata when body is invalid', async () => {
    const { downloadPendingFeature } = require('../bundleUpdater');
    const feature = {
      id: 'order',
      title: 'order',
      icon: '',
      moduleName: '',
      bundleUrl: 'https://example.com/order.jsbundle',
      version: '0.0.9',
      hash: 'sha256:deadbeef',
      minAppVersion: '0.0.0',
    };

    mockFetchWithRetry.mockResolvedValue({
      text: async () => makeValidOtaBundleBody(feature.id),
    } as Response);

    await expect(downloadPendingFeature(feature)).rejects.toThrow(/Hash mismatch/);
    expect(mockWritePendingMetadata).not.toHaveBeenCalled();
    expect(deletePendingBundleByPath).toHaveBeenCalledWith(
      getPendingBundlePath(feature.id, feature.version),
    );
  });
});

describe('matchesRemoteRelease bootstrap', () => {
  it('detects same-version hash drift as stale active', () => {
    expect(
      matchesRemoteRelease(
        { version: '0.0.6', hash: 'sha256:old' },
        { version: '0.0.6', hash: 'sha256:new' },
      ),
    ).toBe(false);
  });

  it('normalizes hash prefixes for comparison', () => {
    expect(
      matchesRemoteRelease(
        { version: '0.0.6', hash: 'sha256:abc' },
        { version: '0.0.6', hash: 'abc' },
      ),
    ).toBe(true);
    expect(normalizeHash('sha256:abc')).toBe('abc');
  });
});

describe('formatFeatureLoadError', () => {
  it('surfaces load/register failure when versions match', () => {
    const message = formatFeatureLoadError('order', 'split bundle entry failed for "order"', {
      remoteVersion: '0.0.6',
      localVersion: '0.0.6',
    });

    expect(message).toContain('v0.0.6');
    expect(message).toContain('缓存文件正常');
    expect(message).toContain('split bundle entry failed');
  });

  it('uses generic upload message for cache/download errors', () => {
    const message = formatFeatureLoadError('order', 'Download failed (404)', {
      remoteVersion: '0.0.6',
      localVersion: null,
    });

    expect(message).toContain('远程 bundle 不可用');
    expect(message).toContain('ota_order');
  });
});
