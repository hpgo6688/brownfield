import { NativeModules } from 'react-native';
import {
  clearBundleUsabilityForPath,
  isCachedBundleUsable,
  markBundleUsable,
  writeCachedBundle,
} from '../bundleCache';

const mockReadFile = jest.fn();
const mockExists = jest.fn();
const mockStat = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/docs',
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    exists: (...args: unknown[]) => mockExists(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    stat: (...args: unknown[]) => mockStat(...args),
    unlink: jest.fn(),
    readDir: jest.fn(),
  },
}));

const BUNDLE_PATH = '/docs/rn-bundles/order/0.0.7.jsbundle';
const VALID_BODY =
  'x'.repeat(2000) +
  "registerFeature('order', 'ota_OrderScreen', X, { source: 'ota' });" +
  'AppRegistry.registerComponent("ota_OrderScreen", () => X);' +
  '__r(1);';

beforeAll(() => {
  NativeModules.RNFSManager = {};
});

beforeEach(() => {
  jest.clearAllMocks();
  clearBundleUsabilityForPath(BUNDLE_PATH);
  mockExists.mockResolvedValue(true);
  mockStat.mockResolvedValue({ size: VALID_BODY.length });
  mockReadFile.mockResolvedValue(VALID_BODY);
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

describe('isCachedBundleUsable session cache', () => {
  it('second call does not read full bundle file', async () => {
    await expect(isCachedBundleUsable(BUNDLE_PATH, 'order')).resolves.toBe(true);
    expect(mockReadFile).toHaveBeenCalledTimes(1);

    await expect(isCachedBundleUsable(BUNDLE_PATH, 'order')).resolves.toBe(true);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('markBundleUsable allows short-circuit without prior readFile', async () => {
    markBundleUsable(BUNDLE_PATH, VALID_BODY.length);

    await expect(isCachedBundleUsable(BUNDLE_PATH, 'order')).resolves.toBe(true);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe('writeCachedBundle cache invalidation', () => {
  it('clears session usability so next check reads file again', async () => {
    markBundleUsable(BUNDLE_PATH, VALID_BODY.length);
    await expect(isCachedBundleUsable(BUNDLE_PATH, 'order')).resolves.toBe(true);
    expect(mockReadFile).not.toHaveBeenCalled();

    await writeCachedBundle('order', '0.0.7', VALID_BODY);
    mockReadFile.mockClear();

    await expect(isCachedBundleUsable(BUNDLE_PATH, 'order')).resolves.toBe(true);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});
