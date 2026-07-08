import { isBundleCacheAvailable } from './bundleCache';

const DEV_OTA_MODE_FILE = 'dev-ota-mode.pref';

type RNFSModule = {
  DocumentDirectoryPath: string;
  exists: (path: string) => Promise<boolean>;
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  writeFile: (path: string, contents: string, encoding: 'utf8') => Promise<void>;
};

function getRNFS(): RNFSModule | null {
  if (!isBundleCacheAvailable()) {
    return null;
  }

  const loaded = require('react-native-fs') as RNFSModule & { default?: RNFSModule };
  return loaded.default ?? loaded;
}

function modeFilePath(RNFS: RNFSModule): string {
  return `${RNFS.DocumentDirectoryPath}/${DEV_OTA_MODE_FILE}`;
}

export async function getPersistedDevOtaMode(): Promise<boolean> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return false;
  }

  const path = modeFilePath(RNFS);
  if (!(await RNFS.exists(path))) {
    return false;
  }

  const text = (await RNFS.readFile(path, 'utf8')).trim();
  return text === 'ota';
}

export async function setPersistedDevOtaMode(ota: boolean): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  await RNFS.writeFile(modeFilePath(RNFS), ota ? 'ota' : 'metro', 'utf8');
}
