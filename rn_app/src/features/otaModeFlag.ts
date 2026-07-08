import { NativeModules } from 'react-native';
import { isBundleCacheAvailable } from './bundleCache';

const OTA_MODE_FLAG = 'ota-mode-on-next-launch.flag';

type RNFSModule = {
  DocumentDirectoryPath: string;
  exists: (path: string) => Promise<boolean>;
  writeFile: (path: string, contents: string, encoding: 'utf8') => Promise<void>;
  unlink: (path: string) => Promise<void>;
};

function getRNFS(): RNFSModule | null {
  if (!isBundleCacheAvailable()) {
    return null;
  }

  const loaded = require('react-native-fs') as RNFSModule & { default?: RNFSModule };
  return loaded.default ?? loaded;
}

function flagPath(RNFS: RNFSModule): string {
  return `${RNFS.DocumentDirectoryPath}/${OTA_MODE_FLAG}`;
}

export async function persistOtaModeOnNextLaunch(): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  await RNFS.writeFile(flagPath(RNFS), '1', 'utf8');
}

export async function consumeStartupOtaModePreference(): Promise<boolean> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return false;
  }

  const path = flagPath(RNFS);
  if (!(await RNFS.exists(path))) {
    return false;
  }

  await RNFS.unlink(path);
  return true;
}
