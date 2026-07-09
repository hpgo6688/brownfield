import type { CachedFeatureMetadata } from '../bundleCache';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
} from '../bundleCache';
import { shouldBustOtaComponentCache } from '../registerFeature';
import { probeOtaFastPath } from '../otaFeatureReuse';

jest.mock('../bundleCache', () => ({
  readCachedMetadata: jest.fn(),
  cachedBundleFileExists: jest.fn(),
  isCachedBundleUsable: jest.fn(),
}));

jest.mock('../registerFeature', () => ({
  shouldBustOtaComponentCache: jest.fn(),
}));

const mockReadCachedMetadata = readCachedMetadata as jest.MockedFunction<
  typeof readCachedMetadata
>;
const mockCachedBundleFileExists = cachedBundleFileExists as jest.MockedFunction<
  typeof cachedBundleFileExists
>;
const mockIsCachedBundleUsable = isCachedBundleUsable as jest.MockedFunction<
  typeof isCachedBundleUsable
>;
const mockShouldBust = shouldBustOtaComponentCache as jest.MockedFunction<
  typeof shouldBustOtaComponentCache
>;

const activeMeta: CachedFeatureMetadata = {
  featureId: 'order',
  version: '0.0.6',
  hash: 'sha256:abc',
  localPath: '/docs/rn-bundles/order/0.0.6.jsbundle',
  installedAt: '2026-07-09T00:00:00.000Z',
};

describe('probeOtaFastPath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadCachedMetadata.mockResolvedValue(activeMeta);
    mockCachedBundleFileExists.mockResolvedValue(true);
    mockIsCachedBundleUsable.mockResolvedValue(true);
    mockShouldBust.mockReturnValue(false);
  });

  it('returns metadata and feature when active cache is usable', async () => {
    const result = await probeOtaFastPath('order');

    expect(result).toEqual({
      metadata: activeMeta,
      feature: expect.objectContaining({
        id: 'order',
        version: '0.0.6',
        hash: 'sha256:abc',
      }),
    });
  });

  it('returns null when bundle file is missing', async () => {
    mockCachedBundleFileExists.mockResolvedValue(false);

    await expect(probeOtaFastPath('order')).resolves.toBeNull();
  });

  it('returns null when bundle fails usability check', async () => {
    mockIsCachedBundleUsable.mockResolvedValue(false);

    await expect(probeOtaFastPath('order')).resolves.toBeNull();
  });

  it('returns null when version/path bust is required', async () => {
    mockShouldBust.mockReturnValue(true);

    await expect(probeOtaFastPath('order')).resolves.toBeNull();
  });
});
