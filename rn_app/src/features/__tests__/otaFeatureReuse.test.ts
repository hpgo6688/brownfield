import type { CachedFeatureMetadata } from '../bundleCache';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
} from '../bundleCache';
import { shouldBustOtaComponentCache } from '../registerFeature';
import {
  wasMetroFeatureLoadedThisSession,
  wasOtaFeatureLoadedThisSession,
} from '../otaSessionLoad';
import { probeOtaFastPath, tryInstantOtaReentry } from '../otaFeatureReuse';

jest.mock('../bundleCache', () => ({
  readCachedMetadata: jest.fn(),
  cachedBundleFileExists: jest.fn(),
  isCachedBundleUsable: jest.fn(),
}));

jest.mock('../otaSessionLoad', () => ({
  wasOtaFeatureLoadedThisSession: jest.fn(),
  wasMetroFeatureLoadedThisSession: jest.fn(),
}));

const mockComponent = function MockOrderScreen() {
  return null;
};

jest.mock('../registerFeature', () => ({
  shouldBustOtaComponentCache: jest.fn(),
  getFeatureComponent: jest.fn(),
  getFeatureSource: jest.fn(),
  syncOtaRegistrationFromCache: jest.fn(),
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
const mockWasOtaSession = wasOtaFeatureLoadedThisSession as jest.MockedFunction<
  typeof wasOtaFeatureLoadedThisSession
>;
const mockWasMetroSession = wasMetroFeatureLoadedThisSession as jest.MockedFunction<
  typeof wasMetroFeatureLoadedThisSession
>;

const { getFeatureComponent, getFeatureSource, syncOtaRegistrationFromCache } =
  jest.requireMock('../registerFeature') as {
    getFeatureComponent: jest.Mock;
    getFeatureSource: jest.Mock;
    syncOtaRegistrationFromCache: jest.Mock;
  };

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

describe('tryInstantOtaReentry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWasOtaSession.mockReturnValue(true);
    mockWasMetroSession.mockReturnValue(false);
    getFeatureSource.mockReturnValue('ota');
    getFeatureComponent.mockReturnValue(null);
  });

  it('returns live registry without disk probe', async () => {
    getFeatureComponent.mockReturnValue(mockComponent);

    const result = await tryInstantOtaReentry('order');

    expect(result).toBe(mockComponent);
    expect(mockReadCachedMetadata).not.toHaveBeenCalled();
    expect(syncOtaRegistrationFromCache).not.toHaveBeenCalled();
  });

  it('returns null when session mark is missing', async () => {
    mockWasOtaSession.mockReturnValue(false);

    await expect(tryInstantOtaReentry('order')).resolves.toBeNull();
  });

  it('returns null after Metro was used in this session', async () => {
    mockWasMetroSession.mockReturnValue(true);

    await expect(tryInstantOtaReentry('order')).resolves.toBeNull();
  });

  it('returns null when live registry source is not ota', async () => {
    getFeatureSource.mockReturnValue('main');
    getFeatureComponent.mockReturnValue(mockComponent);

    await expect(tryInstantOtaReentry('order')).resolves.toBeNull();
  });

  it('returns null when registry is empty (cache restore is bundleLoader job)', async () => {
    getFeatureComponent.mockReturnValue(null);

    await expect(tryInstantOtaReentry('order')).resolves.toBeNull();
    expect(syncOtaRegistrationFromCache).not.toHaveBeenCalled();
  });
});
