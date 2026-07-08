import semver from 'semver';
import { sha256 } from 'js-sha256';
import {
  deleteCachedBundle,
  getCachedBundlePath,
  pruneOldVersions,
  readCachedMetadata,
  writeCachedBundle,
  writeCachedMetadata,
  type CachedFeatureMetadata,
} from './bundleCache';
import {
  DEFAULT_MANIFEST_URL,
  fetchFeatureById,
  fetchManifest,
  type RemoteFeature,
} from './manifest';

export type UpdateCheckResult = {
  featureId: string;
  feature: RemoteFeature;
  updated: boolean;
  bundlePath: string | null;
  cachedVersion: string | null;
  error?: string;
};

export function normalizeHash(hash: string): string {
  return hash.startsWith('sha256:') ? hash.slice('sha256:'.length) : hash;
}

export function needsUpdate(
  remote: Pick<RemoteFeature, 'version' | 'hash'>,
  local: Pick<CachedFeatureMetadata, 'version' | 'hash'> | null,
): boolean {
  if (!local) {
    return true;
  }

  if (normalizeHash(remote.hash) !== normalizeHash(local.hash)) {
    return true;
  }

  if (semver.valid(remote.version) && semver.valid(local.version)) {
    return semver.gt(remote.version, local.version);
  }

  return remote.version !== local.version;
}

async function verifyAndPersist(
  feature: RemoteFeature,
  body: string,
): Promise<CachedFeatureMetadata> {
  const digest = sha256(body);
  const expected = normalizeHash(feature.hash);

  if (expected !== 'unset' && digest !== expected) {
    throw new Error(`Hash mismatch for feature "${feature.id}"`);
  }

  const localPath = await writeCachedBundle(feature.id, feature.version, body);
  const metadata: CachedFeatureMetadata = {
    featureId: feature.id,
    version: feature.version,
    hash: feature.hash,
    localPath,
    installedAt: new Date().toISOString(),
  };

  await writeCachedMetadata(metadata);
  await pruneOldVersions(feature.id, feature.version);
  return metadata;
}

export async function downloadAndCacheFeature(
  feature: RemoteFeature,
): Promise<CachedFeatureMetadata> {
  const response = await fetch(feature.bundleUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${feature.id}`);
  }

  const body = await response.text();

  try {
    return await verifyAndPersist(feature, body);
  } catch (error) {
    await deleteCachedBundle(feature.id, feature.version);
    throw error;
  }
}

export async function checkAndUpdateFeature(
  featureId: string,
  options?: { manifestUrl?: string; force?: boolean },
): Promise<UpdateCheckResult> {
  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;

  try {
    await fetchManifest(manifestUrl);
    const feature = await fetchFeatureById(featureId, manifestUrl);
    const cached = await readCachedMetadata(featureId);
    const shouldUpdate =
      options?.force === true || needsUpdate(feature, cached);

    if (!shouldUpdate && cached) {
      return {
        featureId,
        feature,
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
      };
    }

    if (feature.hash === 'sha256:unset') {
      return {
        featureId,
        feature,
        updated: false,
        bundlePath: cached?.localPath ?? null,
        cachedVersion: cached?.version ?? null,
      };
    }

    const metadata = await downloadAndCacheFeature(feature);
    return {
      featureId,
      feature,
      updated: true,
      bundlePath: metadata.localPath,
      cachedVersion: metadata.version,
    };
  } catch (error) {
    const cached = await readCachedMetadata(featureId);
    const message = error instanceof Error ? error.message : 'Update failed';

    if (cached) {
      return {
        featureId,
        feature: {
          id: featureId,
          title: featureId,
          icon: '',
          moduleName: '',
          bundleUrl: '',
          version: cached.version,
          hash: cached.hash,
          minAppVersion: '0.0.0',
        },
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
        error: message,
      };
    }

    throw error;
  }
}

export async function preloadFeatures(
  featureIds: string[],
  options?: { manifestUrl?: string },
): Promise<UpdateCheckResult[]> {
  const results: UpdateCheckResult[] = [];

  for (const featureId of featureIds) {
    try {
      results.push(await checkAndUpdateFeature(featureId, options));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preload failed';
      results.push({
        featureId,
        feature: {
          id: featureId,
          title: featureId,
          icon: '',
          moduleName: '',
          bundleUrl: '',
          version: '0.0.0',
          hash: 'sha256:unset',
          minAppVersion: '0.0.0',
        },
        updated: false,
        bundlePath: null,
        cachedVersion: null,
        error: message,
      });
    }
  }

  return results;
}

export async function getCachedFeatureVersion(featureId: string): Promise<string | null> {
  const metadata = await readCachedMetadata(featureId);
  return metadata?.version ?? null;
}

export function toFileUrl(localPath: string): string {
  return localPath.startsWith('file://') ? localPath : `file://${localPath}`;
}

export { getCachedBundlePath };
