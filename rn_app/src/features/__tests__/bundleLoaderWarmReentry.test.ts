import type { RemoteFeature } from '../manifest';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
} from '../bundleCache';
import { loadFeatureBundle } from '../bundleLoader';
import {
  clearFeatureRegistration,
  isFeatureLoadedFromOta,
} from '../registerFeature';
import {
  wasMetroFeatureLoadedThisSession,
  wasOtaFeatureLoadedThisSession,
} from '../otaSessionLoad';
import { SplitBundleLoader } from '../splitBundleLoader';

jest.mock('../bundleCache', () => ({
  readCachedMetadata: jest.fn(),
  cachedBundleFileExists: jest.fn(),
  isCachedBundleUsable: jest.fn(),
  normalizeLocalPath: (path: string) => path,
}));

jest.mock('../registerFeature', () => ({
  clearFeatureRegistration: jest.fn(),
  clearOtaComponentCache: jest.fn(),
  isFeatureLoaded: jest.fn(),
  isFeatureLoadedFromOta: jest.fn(),
  shouldBustOtaComponentCache: jest.fn(() => false),
  stampOtaComponentCacheVersion: jest.fn(),
  syncOtaRegistrationFromCache: jest.fn(),
  waitForFeatureComponent: jest.fn(),
}));

jest.mock('../otaSessionLoad', () => ({
  wasOtaFeatureLoadedThisSession: jest.fn(),
  wasMetroFeatureLoadedThisSession: jest.fn(),
  clearMetroFeatureSessionMark: jest.fn(),
}));

jest.mock('../splitBundleLoader', () => ({
  isSplitBundleLoaderAvailable: jest.fn(() => true),
  SplitBundleLoader: {
    load: jest.fn(),
  },
}));

jest.mock('../splitBundleEntry', () => ({
  executeSplitBundleEntry: jest.fn(),
}));

jest.mock('../otaSplitHostPreload', () => ({
  preloadOtaSplitHostModules: jest.fn(),
}));

jest.mock('../segmentRegistry', () => ({
  getFeatureSegmentId: jest.fn(() => 'order-segment'),
}));

jest.mock('../remoteConfig', () => ({
  getForceOtaInDev: jest.fn(() => true),
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
const mockWasOtaSession = wasOtaFeatureLoadedThisSession as jest.MockedFunction<
  typeof wasOtaFeatureLoadedThisSession
>;
const mockWasMetroSession = wasMetroFeatureLoadedThisSession as jest.MockedFunction<
  typeof wasMetroFeatureLoadedThisSession
>;
const mockIsFeatureLoadedFromOta = isFeatureLoadedFromOta as jest.MockedFunction<
  typeof isFeatureLoadedFromOta
>;
const mockClearFeatureRegistration = clearFeatureRegistration as jest.MockedFunction<
  typeof clearFeatureRegistration
>;
const mockSplitLoad = SplitBundleLoader!.load as jest.Mock;

const orderFeature: RemoteFeature = {
  id: 'order',
  title: '订单',
  icon: '',
  moduleName: 'ota_OrderScreen',
  bundleUrl: 'file:///unused',
  version: '0.0.7',
  hash: 'sha256:abc',
  minAppVersion: '0.0.0',
};

describe('loadFeatureBundle warmReentry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadCachedMetadata.mockResolvedValue({
      featureId: 'order',
      version: '0.0.7',
      hash: 'sha256:abc',
      localPath: '/docs/rn-bundles/order/0.0.7.jsbundle',
      installedAt: '2026-07-09T00:00:00.000Z',
    });
    mockCachedBundleFileExists.mockResolvedValue(true);
    mockIsCachedBundleUsable.mockResolvedValue(true);
    mockWasOtaSession.mockReturnValue(true);
    mockWasMetroSession.mockReturnValue(false);
    mockIsFeatureLoadedFromOta.mockReturnValue(true);
    mockSplitLoad.mockResolvedValue(undefined);
  });

  it('skips native load and does not clear registration on warm re-entry', async () => {
    await loadFeatureBundle(orderFeature, {
      localPath: '/docs/rn-bundles/order/0.0.7.jsbundle',
      otaMode: true,
      ensureSegment: true,
      warmReentry: true,
    });

    expect(mockSplitLoad).not.toHaveBeenCalled();
    expect(mockClearFeatureRegistration).not.toHaveBeenCalled();
  });

  it('still loads native segment when warm re-entry is false', async () => {
    await loadFeatureBundle(orderFeature, {
      localPath: '/docs/rn-bundles/order/0.0.7.jsbundle',
      otaMode: true,
      ensureSegment: true,
      warmReentry: false,
    });

    expect(mockSplitLoad).toHaveBeenCalled();
    expect(mockClearFeatureRegistration).toHaveBeenCalledWith('order');
  });
});
