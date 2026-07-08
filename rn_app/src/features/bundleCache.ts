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

function pendingBundlePath(featureId: string, version: string) {
  return `${featureDir(featureId)}/${version}.pending.jsbundle`;
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

/** Sync validation of downloaded / cached OTA split bundle text. */
export function validateOtaBundleContent(featureId: string, code: string): boolean {
  if (code.length < MIN_USABLE_BUNDLE_BYTES) {
    return false;
  }

  if (!code.includes('registerFeature')) {
    return false;
  }

  if (!code.includes('AppRegistry.registerComponent')) {
    return false;
  }

  if (!code.includes('ota_')) {
    return false;
  }

  const hasFeatureId =
    code.includes(`'${featureId}'`) || code.includes(`"${featureId}"`);
  if (!hasFeatureId) {
    return false;
  }

  return /__r\(\d+\);/.test(code);
}

export async function isCachedBundleUsable(
  localPath: string,
  featureId?: string,
): Promise<boolean> {
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
  if (!featureId) {
    return (
      code.includes('registerFeature') &&
      code.includes('AppRegistry.registerComponent') &&
      code.includes('ota_') &&
      /__r\(\d+\);/.test(code)
    );
  }

  return validateOtaBundleContent(featureId, code);
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

/** Drop pending metadata and its dedicated pending bundle file. */
export async function clearStalePendingRelease(
  featureId: string,
  pending: PendingFeatureMetadata,
): Promise<void> {
  await clearPendingMetadata(featureId);
  await deletePendingBundleByPath(pending.localPath);
}

export async function deletePendingBundleByPath(localPath: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const path = normalizeLocalPath(localPath);
  if (path && (await RNFS.exists(path))) {
    await RNFS.unlink(path);
  }
}

export async function clearActiveMetadata(featureId: string) {
  const RNFS = getRNFS();
  if (!RNFS) {
    return;
  }

  const path = metadataPath(featureId);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

/** Remove active (and matching pending) metadata when the cached file is gone. */
export async function clearStaleActiveMetadata(featureId: string): Promise<boolean> {
  const active = await readCachedMetadata(featureId);
  if (!active) {
    return false;
  }

  if (await cachedBundleFileExists(active.localPath)) {
    return false;
  }

  await clearActiveMetadata(featureId);

  const pending = await readPendingMetadata(featureId);
  if (
    pending &&
    normalizeLocalPath(pending.localPath) === normalizeLocalPath(active.localPath)
  ) {
    await clearPendingMetadata(featureId);
  }

  return true;
}

/** Drop active/pending metadata and bundle files that fail OTA validation. */
export async function clearUnusableActiveMetadata(featureId: string): Promise<boolean> {
  let cleared = false;
  const active = await readCachedMetadata(featureId);

  if (active) {
    const usable = await isCachedBundleUsable(active.localPath, featureId);
    if (!usable) {
      await deleteCachedBundle(featureId, active.version);
      await clearActiveMetadata(featureId);
      cleared = true;
    }
  }

  const pending = await readPendingMetadata(featureId);
  if (pending) {
    const usable = await isCachedBundleUsable(pending.localPath, featureId);
    if (!usable) {
      await clearPendingMetadata(featureId);
      await deletePendingBundleByPath(pending.localPath);
      cleared = true;
    }
  }

  return cleared;
}

export async function writePendingBundle(
  featureId: string,
  version: string,
  contents: string,
): Promise<string> {
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('Bundle cache unavailable (RNFS native module missing)');
  }

  await ensureFeatureDir(featureId);
  const path = pendingBundlePath(featureId, version);
  await RNFS.writeFile(path, contents, 'utf8');
  return path;
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
    .filter(
      entry =>
        entry.isFile() &&
        entry.name.endsWith('.jsbundle') &&
        !entry.name.includes('.pending.'),
    )
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

export function getPendingBundlePath(featureId: string, version: string) {
  return pendingBundlePath(featureId, version);
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
