import RNFS from 'react-native-fs';

export type CachedFeatureMetadata = {
  featureId: string;
  version: string;
  hash: string;
  localPath: string;
  installedAt: string;
};

const CACHE_ROOT = `${RNFS.DocumentDirectoryPath}/rn-bundles`;
const MAX_VERSIONS_PER_FEATURE = 2;

function featureDir(featureId: string) {
  return `${CACHE_ROOT}/${featureId}`;
}

function metadataPath(featureId: string) {
  return `${featureDir(featureId)}/metadata.json`;
}

function bundlePath(featureId: string, version: string) {
  return `${featureDir(featureId)}/${version}.jsbundle`;
}

async function ensureFeatureDir(featureId: string) {
  await RNFS.mkdir(featureDir(featureId));
}

export async function readCachedMetadata(
  featureId: string,
): Promise<CachedFeatureMetadata | null> {
  const path = metadataPath(featureId);
  if (!(await RNFS.exists(path))) {
    return null;
  }

  const raw = await RNFS.readFile(path, 'utf8');
  return JSON.parse(raw) as CachedFeatureMetadata;
}

export async function writeCachedMetadata(metadata: CachedFeatureMetadata) {
  await ensureFeatureDir(metadata.featureId);
  await RNFS.writeFile(metadataPath(metadata.featureId), JSON.stringify(metadata), 'utf8');
}

export async function writeCachedBundle(
  featureId: string,
  version: string,
  contents: string,
): Promise<string> {
  await ensureFeatureDir(featureId);
  const path = bundlePath(featureId, version);
  await RNFS.writeFile(path, contents, 'utf8');
  return path;
}

export async function deleteCachedBundle(featureId: string, version: string) {
  const path = bundlePath(featureId, version);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function pruneOldVersions(featureId: string, keepVersion: string) {
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
  if (!(await RNFS.exists(CACHE_ROOT))) {
    return [];
  }

  const entries = await RNFS.readDir(CACHE_ROOT);
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}

export async function getCachedFeatureVersion(featureId: string): Promise<string | null> {
  const metadata = await readCachedMetadata(featureId);
  return metadata?.version ?? null;
}
