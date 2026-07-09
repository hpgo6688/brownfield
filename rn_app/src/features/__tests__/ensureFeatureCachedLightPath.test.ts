import {
  cachedBundleFileExists,
  probeActiveCacheLight,
  readCachedMetadata,
} from '../bundleCache';
import { ensureFeatureCached } from '../bundleUpdater';
import { wasOtaFeatureLoadedThisSession } from '../otaSessionLoad';
import { peekInstantOtaReentry } from '../otaFeatureReuse';

jest.mock('../bundleCache', () => {
  const actual = jest.requireActual('../bundleCache');
  return {
    ...actual,
    readCachedMetadata: jest.fn(),
    cachedBundleFileExists: jest.fn(),
    isCachedBundleUsable: jest.fn(),
    reconcileActiveBundleCache: jest.fn(),
    probeActiveCacheLight: jest.fn(),
  };
});

jest.mock('../otaSessionLoad', () => ({
  wasOtaFeatureLoadedThisSession: jest.fn(),
}));

jest.mock('../otaFeatureReuse', () => ({
  peekInstantOtaReentry: jest.fn(),
}));

jest.mock('../manifest', () => ({
  DEFAULT_MANIFEST_URL: 'http://test/manifest',
  enrichRemoteFeature: (feature: unknown) => feature,
}));

jest.mock('../registerFeature', () => ({
  clearOtaComponentCache: jest.fn(),
}));

const mockReadCachedMetadata = readCachedMetadata as jest.MockedFunction<
  typeof readCachedMetadata
>;
const mockCachedBundleFileExists = cachedBundleFileExists as jest.MockedFunction<
  typeof cachedBundleFileExists
>;
const mockProbeActiveCacheLight = probeActiveCacheLight as jest.MockedFunction<
  typeof probeActiveCacheLight
>;
const mockWasOtaSession = wasOtaFeatureLoadedThisSession as jest.MockedFunction<
  typeof wasOtaFeatureLoadedThisSession
>;
const mockPeekInstant = peekInstantOtaReentry as jest.MockedFunction<
  typeof peekInstantOtaReentry
>;

const { reconcileActiveBundleCache, isCachedBundleUsable } = jest.requireMock(
  '../bundleCache',
) as {
  reconcileActiveBundleCache: jest.Mock;
  isCachedBundleUsable: jest.Mock;
};

const activeMeta = {
  featureId: 'order',
  version: '0.0.7',
  hash: 'sha256:abc',
  localPath: '/docs/rn-bundles/order/0.0.7.jsbundle',
  installedAt: '2026-07-09T00:00:00.000Z',
};

const mockComponent = function MockOrderScreen() {
  return null;
};

describe('ensureFeatureCached session light path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWasOtaSession.mockReturnValue(true);
    mockPeekInstant.mockReturnValue(mockComponent);
    mockProbeActiveCacheLight.mockResolvedValue(activeMeta);
    reconcileActiveBundleCache.mockResolvedValue(false);
    isCachedBundleUsable.mockResolvedValue(true);
  });

  it('returns active cache without reconcile or isCachedBundleUsable', async () => {
    const result = await ensureFeatureCached('order');

    expect(result.updated).toBe(false);
    expect(result.bundlePath).toBe(activeMeta.localPath);
    expect(reconcileActiveBundleCache).not.toHaveBeenCalled();
    expect(isCachedBundleUsable).not.toHaveBeenCalled();
  });
});
