import semver from 'semver';
import { sha256 } from 'js-sha256';
import {
  cachedBundleFileExists,
  clearPendingMetadata,
  deleteCachedBundle,
  isBundleCacheAvailable,
  isCachedBundleUsable,
  normalizeLocalPath,
  pruneOldVersions,
  readCachedMetadata,
  readPendingMetadata,
  writeCachedBundle,
  writeCachedMetadata,
  writePendingMetadata,
  getCachedBundlePath,
  type CachedFeatureMetadata,
  type PendingFeatureMetadata,
} from './bundleCache';
import {
  clearManifestCache,
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

export type RemoteCheckResult = {
  featureId: string;
  remoteFeature: RemoteFeature;
  updateAvailable: boolean;
  activeVersion: string | null;
  pendingVersion: string | null;
};

/**
 * Staged OTA flow (polling / user apply):
 * - `checkRemoteFeature` — manifest compare vs active cache only
 * - `downloadPendingFeature` — download to sandbox + pending.json (no reload)
 * - `applyPendingFeature` — promote pending → active metadata
 *
 * Bootstrap (first load, no usable cache):
 * - `ensureFeatureCached` or `checkAndUpdateFeature` — download and activate immediately
 */
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

async function verifyAndPersistActive(
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
  await clearPendingMetadata(feature.id);
  await pruneOldVersions(feature.id, feature.version);
  return metadata;
}

async function verifyAndPersistPending(
  feature: RemoteFeature,
  body: string,
): Promise<PendingFeatureMetadata> {
  const digest = sha256(body);
  const expected = normalizeHash(feature.hash);

  if (expected !== 'unset' && digest !== expected) {
    throw new Error(`Hash mismatch for feature "${feature.id}"`);
  }

  const localPath = await writeCachedBundle(feature.id, feature.version, body);
  const metadata: PendingFeatureMetadata = {
    featureId: feature.id,
    version: feature.version,
    hash: feature.hash,
    localPath,
    downloadedAt: new Date().toISOString(),
  };

  await writePendingMetadata(metadata);
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
    return await verifyAndPersistActive(feature, body);
  } catch (error) {
    await deleteCachedBundle(feature.id, feature.version);
    throw error;
  }
}

export async function downloadPendingFeature(
  feature: RemoteFeature,
): Promise<PendingFeatureMetadata> {
  const response = await fetch(feature.bundleUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${feature.id}`);
  }

  const body = await response.text();

  try {
    return await verifyAndPersistPending(feature, body);
  } catch (error) {
    await deleteCachedBundle(feature.id, feature.version);
    throw error;
  }
}

export async function checkRemoteFeature(
  featureId: string,
  options?: { manifestUrl?: string },
): Promise<RemoteCheckResult> {
  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;
  clearManifestCache();
  await fetchManifest(manifestUrl, { forceRefresh: true });
  const remoteFeature = await fetchFeatureById(featureId, manifestUrl, {
    forceRefresh: true,
  });
  const active = await readCachedMetadata(featureId);
  const pending = await readPendingMetadata(featureId);

  const activeReady =
    active !== null &&
    (await cachedBundleFileExists(active.localPath)) &&
    (await isCachedBundleUsable(active.localPath));

  const updateAvailable =
    remoteFeature.hash !== 'sha256:unset' &&
    (!activeReady || needsUpdate(remoteFeature, active));

  return {
    featureId,
    remoteFeature,
    updateAvailable,
    activeVersion: active?.version ?? null,
    pendingVersion: pending?.version ?? null,
  };
}

export async function getPendingUpdate(
  featureId: string,
): Promise<PendingFeatureMetadata | null> {
  const pending = await readPendingMetadata(featureId);
  if (!pending) {
    return null;
  }

  if (!(await cachedBundleFileExists(pending.localPath))) {
    await clearPendingMetadata(featureId);
    return null;
  }

  if (!(await isCachedBundleUsable(pending.localPath))) {
    return null;
  }

  const active = await readCachedMetadata(featureId);
  if (!active) {
    return pending;
  }

  if (
    pending.version === active.version &&
    normalizeHash(pending.hash) === normalizeHash(active.hash)
  ) {
    await clearPendingMetadata(featureId);
    return null;
  }

  return pending;
}

export async function applyPendingFeature(
  featureId: string,
): Promise<CachedFeatureMetadata | null> {
  const pending = await getPendingUpdate(featureId);
  if (!pending) {
    return null;
  }

  const active: CachedFeatureMetadata = {
    featureId: pending.featureId,
    version: pending.version,
    hash: pending.hash,
    localPath: pending.localPath,
    installedAt: new Date().toISOString(),
  };

  await writeCachedMetadata(active);
  await clearPendingMetadata(featureId);
  await pruneOldVersions(featureId, pending.version);
  return active;
}

/** Load existing active cache without checking remote — for in-session OTA bootstrap. */
export async function ensureFeatureCached(
  featureId: string,
  options?: { manifestUrl?: string },
): Promise<UpdateCheckResult> {
  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;

  if (!isBundleCacheAvailable()) {
    const feature = await fetchFeatureById(featureId, manifestUrl);
    return {
      featureId,
      feature,
      updated: false,
      bundlePath: null,
      cachedVersion: null,
    };
  }

  const cached = await readCachedMetadata(featureId);
  const cachedFileReady =
    cached !== null &&
    (await cachedBundleFileExists(cached.localPath)) &&
    (await isCachedBundleUsable(cached.localPath));

  if (cachedFileReady && cached) {
    const feature = await fetchFeatureById(featureId, manifestUrl);
    return {
      featureId,
      feature,
      updated: false,
      bundlePath: cached.localPath,
      cachedVersion: cached.version,
    };
  }

  return checkAndUpdateFeature(featureId, options);
}

export async function checkAndUpdateFeature(
  featureId: string,
  options?: { manifestUrl?: string; force?: boolean },
): Promise<UpdateCheckResult> {
  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;

  try {
    await fetchManifest(manifestUrl);
    const feature = await fetchFeatureById(featureId, manifestUrl);

    if (!isBundleCacheAvailable()) {
      return {
        featureId,
        feature,
        updated: false,
        bundlePath: null,
        cachedVersion: null,
      };
    }

    const cached = await readCachedMetadata(featureId);
    const cachedFileExists =
      cached !== null && (await cachedBundleFileExists(cached.localPath));
    const cachedFileReady =
      cachedFileExists && (await isCachedBundleUsable(cached.localPath));
    const shouldUpdate =
      options?.force === true ||
      needsUpdate(feature, cached) ||
      (cached !== null && !cachedFileReady);

    if (!shouldUpdate && cached && cachedFileReady) {
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
        bundlePath: cachedFileReady ? cached?.localPath ?? null : null,
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

    if (cached && (await cachedBundleFileExists(cached.localPath))) {
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
  return normalizeLocalPath(localPath);
}

export { getCachedBundlePath };
