import { clearLoadedBundles, loadFeatureBundle } from '../bundleLoader';
import { SplitBundleLoader } from '../splitBundleLoader';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
} from '../bundleCache';
import { ensureSharedSegmentLoaded } from '../sharedBundleUpdater';

jest.mock('../bundleCache', () => ({
  readCachedMetadata: jest.fn(),
  cachedBundleFileExists: jest.fn(),
  isCachedBundleUsable: jest.fn(),
  normalizeLocalPath: (path: string) => path,
}));

jest.mock('../registerFeature', () => ({
  clearFeatureRegistration: jest.fn(),
  clearOtaComponentCache: jest.fn(),
  isFeatureLoaded: jest.fn(() => false),
  isFeatureLoadedFromOta: jest.fn(() => true),
  shouldBustOtaComponentCache: jest.fn(() => false),
  stampOtaComponentCacheVersion: jest.fn(),
  syncOtaRegistrationFromCache: jest.fn(),
  waitForFeatureComponent: jest.fn(),
}));

jest.mock('../otaSessionLoad', () => ({
  wasOtaFeatureLoadedThisSession: jest.fn(() => false),
  wasMetroFeatureLoadedThisSession: jest.fn(() => false),
  clearMetroFeatureSessionMark: jest.fn(),
}));

jest.mock('../splitBundleLoader', () => ({
  isSplitBundleLoaderAvailable: jest.fn(() => true),
  SplitBundleLoader: {
    load: jest.fn(),
  },
}));

jest.mock('../splitBundleEntry', () => ({
  executeSplitBundleEntry: jest.fn(() => true),
}));

jest.mock('../sharedBundleUpdater', () => ({
  ensureSharedSegmentLoaded: jest.fn(),
}));

const mockSharedLoad = ensureSharedSegmentLoaded as jest.Mock;
const mockSplitLoad = SplitBundleLoader!.load as jest.Mock;

const orderFeature = {
  id: 'order',
  title: '订单',
  icon: 'cart',
  moduleName: 'ota_OrderScreen',
  bundleUrl: 'http://test/bundles/ota_order.0.0.8.ios.jsbundle',
  version: '0.0.8',
  hash: 'sha256:def',
  minAppVersion: '1.0.0',
  segmentId: 1,
};

describe('shared bundle load order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLoadedBundles();
    (readCachedMetadata as jest.Mock).mockResolvedValue({
      featureId: 'order',
      version: '0.0.8',
      hash: 'sha256:def',
      localPath: '/tmp/order/0.0.8.jsbundle',
    });
    (cachedBundleFileExists as jest.Mock).mockResolvedValue(true);
    (isCachedBundleUsable as jest.Mock).mockResolvedValue(true);
  });

  it('loads shared segment before feature segment', async () => {
    const calls: string[] = [];
    mockSharedLoad.mockImplementation(async () => {
      calls.push('shared');
    });
    mockSplitLoad.mockImplementation(async () => {
      calls.push('feature');
    });

    await loadFeatureBundle(orderFeature, {
      localPath: '/tmp/order/0.0.8.jsbundle',
      otaMode: true,
      manifestUrl: 'http://test/manifest',
    });

    expect(mockSharedLoad).toHaveBeenCalled();
    expect(calls.indexOf('shared')).toBeLessThan(calls.indexOf('feature'));
  });

  it('invokes shared loader even for legacy manifests (no-op inside)', async () => {
    mockSharedLoad.mockResolvedValue(undefined);

    await loadFeatureBundle(orderFeature, {
      localPath: '/tmp/order/0.0.8.jsbundle',
      otaMode: true,
    });

    expect(mockSharedLoad).toHaveBeenCalled();
  });
});
