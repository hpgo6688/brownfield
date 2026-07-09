import { isBundleCacheAvailable } from './bundleCache';

const MARKER_FILE = 'ota-reentry-reload.json';
const RELOAD_GRACE_MS = 15_000;

type RNFSModule = {
  DocumentDirectoryPath: string;
  exists: (path: string) => Promise<boolean>;
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  writeFile: (path: string, contents: string, encoding: 'utf8') => Promise<void>;
  unlink: (path: string) => Promise<void>;
};

type ReloadMarkers = Record<string, number>;

function getRNFS(): RNFSModule | null {
  if (!isBundleCacheAvailable()) {
    return null;
  }

  const loaded = require('react-native-fs') as RNFSModule & { default?: RNFSModule };
  return loaded.default ?? loaded;
}

function markerFilePath(RNFS: RNFSModule): string {
  return `${RNFS.DocumentDirectoryPath}/${MARKER_FILE}`;
}

function markerKey(featureId: string, version: string): string {
  return `${featureId}@${version}`;
}

async function readMarkers(): Promise<ReloadMarkers> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return {};
  }

  const path = markerFilePath(RNFS);
  if (!(await RNFS.exists(path))) {
    return {};
  }

  try {
    return JSON.parse(await RNFS.readFile(path, 'utf8')) as ReloadMarkers;
  } catch {
    return {};
  }
}

async function writeMarkers(markers: ReloadMarkers): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  await RNFS.writeFile(markerFilePath(RNFS), JSON.stringify(markers), 'utf8');
}

/**
 * DEV OTA re-entry: native registerSegmentWithId skips re-eval on the second load
 * in the same RN runtime. One DevSettings.reload() per page visit restores the
 * split module registry. Marker survives reload but is cleared on page unmount.
 */
export async function shouldDevOtaReentryReload(
  featureId: string,
  version: string,
): Promise<boolean> {
  if (!__DEV__) {
    return false;
  }

  const markers = await readMarkers();
  const ts = markers[markerKey(featureId, version)];
  if (ts == null) {
    return true;
  }

  return Date.now() - ts > RELOAD_GRACE_MS;
}

export async function markDevOtaReentryReload(
  featureId: string,
  version: string,
): Promise<void> {
  const markers = await readMarkers();
  markers[markerKey(featureId, version)] = Date.now();
  await writeMarkers(markers);
}

export async function clearDevOtaReentryMarker(
  featureId: string,
  version: string,
): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const markers = await readMarkers();
  delete markers[markerKey(featureId, version)];

  const path = markerFilePath(RNFS);
  if (Object.keys(markers).length === 0) {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
    return;
  }

  await writeMarkers(markers);
}
