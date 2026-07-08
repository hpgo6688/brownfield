import { NativeModules } from 'react-native';

export type CachedFeatureMetadata = {
  featureId: string;
  version: string;
  hash: string;
  localPath: string;
  installedAt: string;
};

/** Downloaded but not yet applied — sibling pending.json per feature. */
export type PendingFeatureMetadata = {
  featureId: string;
  version: string;
  hash: string;
  localPath: string;
  downloadedAt: string;
};

type RNFSModule = {
  DocumentDirectoryPath: string;
  mkdir: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  writeFile: (path: string, contents: string, encoding: 'utf8') => Promise<void>;
  unlink: (path: string) => Promise<void>;
  readDir: (path: string) => Promise<
    Array<{
      name: string;
      path: string;
      isFile: () => boolean;
      isDirectory: () => boolean;
      mtime?: Date | null;
    }>
  >;
};

const MAX_VERSIONS_PER_FEATURE = 2;

let rnfsModule: RNFSModule | null | undefined;

/** RNFSManager must be linked in BrownfieldLib; absent until brownfield package rebuild. */
export function isBundleCacheAvailable(): boolean {
  return Boolean(NativeModules.RNFSManager);
}

function getRNFS(): RNFSModule | null {
  if (rnfsModule !== undefined) {
    return rnfsModule;
  }

  if (!isBundleCacheAvailable()) {
    rnfsModule = null;
    return null;
  }

  // Only require JS after native module exists — avoids NativeEventEmitter crash.
  const loaded = require('react-native-fs') as RNFSModule & { default?: RNFSModule };
  rnfsModule = loaded.default ?? loaded;
  return rnfsModule;
}

function cacheRoot() {
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('RNFS unavailable');
  }
  return `${RNFS.DocumentDirectoryPath}/rn-bundles`;
}

export function normalizeLocalPath(localPath: string): string {
  if (localPath.startsWith('file://')) {
    try {
      return decodeURIComponent(localPath.replace(/^file:\/\//, ''));
    } catch {
      return localPath.replace(/^file:\/\//, '');
    }
  }

  return localPath;
}

async function ensureCacheRoot() {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const root = cacheRoot();
  if (!(await RNFS.exists(root))) {
    await RNFS.mkdir(root);
  }
}

async function ensureFeatureDir(featureId: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  await ensureCacheRoot();
  const dir = featureDir(featureId);
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
}

function featureDir(featureId: string) {
  return `${cacheRoot()}/${featureId}`;
}

function metadataPath(featureId: string) {
  return `${featureDir(featureId)}/metadata.json`;
}

function pendingMetadataPath(featureId: string) {
  return `${featureDir(featureId)}/pending.json`;
}

function bundlePath(featureId: string, version: string) {
  return `${featureDir(featureId)}/${version}.jsbundle`;
}

export async function cachedBundleFileExists(localPath: string): Promise<boolean> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return false;
  }

  const path = normalizeLocalPath(localPath);
  if (!path) {
    return false;
  }

  return RNFS.exists(path);
}

const MIN_USABLE_BUNDLE_BYTES = 1500;

export async function isCachedBundleUsable(localPath: string): Promise<boolean> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return false;
  }

  const path = normalizeLocalPath(localPath);
  if (!(await RNFS.exists(path))) {
    return false;
  }

  type RNFSStatModule = RNFSModule & {
    stat: (path: string) => Promise<{ size: number }>;
  };
  const stat = await (RNFS as RNFSStatModule).stat(path);
  if (stat.size < MIN_USABLE_BUNDLE_BYTES) {
    return false;
  }

  const code = await RNFS.readFile(path, 'utf8');
  return code.includes('registerFeature') && /__r\(\d+\);/.test(code);
}

export async function readCachedMetadata(
  featureId: string,
): Promise<CachedFeatureMetadata | null> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return null;
  }

  const path = metadataPath(featureId);
  if (!(await RNFS.exists(path))) {
    return null;
  }

  const raw = await RNFS.readFile(path, 'utf8');
  return JSON.parse(raw) as CachedFeatureMetadata;
}

export async function writeCachedMetadata(metadata: CachedFeatureMetadata) {
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('Bundle cache unavailable (RNFS native module missing)');
  }

  await ensureFeatureDir(metadata.featureId);
  await RNFS.writeFile(metadataPath(metadata.featureId), JSON.stringify(metadata), 'utf8');
}

export async function readPendingMetadata(
  featureId: string,
): Promise<PendingFeatureMetadata | null> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return null;
  }

  const path = pendingMetadataPath(featureId);
  if (!(await RNFS.exists(path))) {
    return null;
  }

  const raw = await RNFS.readFile(path, 'utf8');
  return JSON.parse(raw) as PendingFeatureMetadata;
}

export async function writePendingMetadata(metadata: PendingFeatureMetadata) {
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('Bundle cache unavailable (RNFS native module missing)');
  }

  await ensureFeatureDir(metadata.featureId);
  await RNFS.writeFile(
    pendingMetadataPath(metadata.featureId),
    JSON.stringify(metadata),
    'utf8',
  );
}

export async function clearPendingMetadata(featureId: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const path = pendingMetadataPath(featureId);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function writeCachedBundle(
  featureId: string,
  version: string,
  contents: string,
): Promise<string> {
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('Bundle cache unavailable (RNFS native module missing)');
  }

  await ensureFeatureDir(featureId);
  const path = bundlePath(featureId, version);
  await RNFS.writeFile(path, contents, 'utf8');
  return path;
}

export async function deleteCachedBundle(featureId: string, version: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const path = bundlePath(featureId, version);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function pruneOldVersions(featureId: string, keepVersion: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const dir = featureDir(featureId);
  if (!(await RNFS.exists(dir))) {
    return;
  }

  const entries = await RNFS.readDir(dir);
  const bundleFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.jsbundle'))
    .sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0));

  const keepPath = bundlePath(featureId, keepVersion);
  let kept = 0;

  for (const file of bundleFiles) {
    if (file.path === keepPath) {
      kept += 1;
      continue;
    }

    if (kept >= MAX_VERSIONS_PER_FEATURE) {
      await RNFS.unlink(file.path);
      continue;
    }

    kept += 1;
  }
}

export function getCachedBundlePath(featureId: string, version: string) {
  return bundlePath(featureId, version);
}

export async function listCachedFeatureIds(): Promise<string[]> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return [];
  }

  const root = cacheRoot();
  if (!(await RNFS.exists(root))) {
    return [];
  }

  const entries = await RNFS.readDir(root);
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}

export async function getCachedFeatureVersion(featureId: string): Promise<string | null> {
  const metadata = await readCachedMetadata(featureId);
  return metadata?.version ?? null;
}
