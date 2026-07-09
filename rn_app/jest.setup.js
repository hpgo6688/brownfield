global.__DEV__ = true;

jest.mock('react-native', () => ({
  NativeModules: {
    RNFSManager: {},
  },
  DevSettings: {
    reload: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock-documents',
  mkdir: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  readFile: jest.fn(),
  writeFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  readDir: jest.fn(async () => []),
  stat: jest.fn(async () => ({ size: 9999 })),
}));
