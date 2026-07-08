import semver from 'semver';
import { sha256 } from 'js-sha256';
import {
  cachedBundleFileExists,
  clearPendingMetadata,
  clearStaleActiveMetadata,
  clearUnusableActiveMetadata,
  deleteCachedBundle,
  deletePendingBundleByPath,
  isBundleCacheAvailable,
  isCachedBundleUsable,
  normalizeLocalPath,
  pruneOldVersions,
  readCachedMetadata,
  readPendingMetadata,
  validateOtaBundleContent,
  writeCachedBundle,
  writeCachedMetadata,
  writePendingBundle,
  writePendingMetadata,
  getCachedBundlePath,
  getPendingBundlePath,
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
import { clearOtaComponentCache } from './registerFeature';

export type UpdateCheckResult = {
  featureId: string;
  feature: RemoteFeature;
  updated: boolean;
  bundlePath: string | null;
  cachedVersion: string | null;
  error?: string;
};

function fallbackFeature(featureId: string, partial?: Partial<RemoteFeature>): RemoteFeature {
  return {
    id: featureId,
    title: featureId,
    icon: '',
    moduleName: '',
    bundleUrl: '',
    version: partial?.version ?? '0.0.0',
    hash: partial?.hash ?? 'sha256:unset',
    minAppVersion: partial?.minAppVersion ?? '0.0.0',
    ...partial,
  };
}

function failedUpdateResult(
  featureId: string,
  message: string,
  feature?: RemoteFeature,
  cachedVersion?: string | null,
): UpdateCheckResult {
  return {
    featureId,
    feature: feature ?? fallbackFeature(featureId),
    updated: false,
    bundlePath: null,
    cachedVersion: cachedVersion ?? null,
    error: formatRemoteBundleError(featureId, message),
  };
}

export function formatRemoteBundleError(featureId: string, cause?: string): string {
  const base = `远程 bundle 不可用（服务端 ota_${featureId} 可能已删除或未 upload）。请重新 upload 后再试。`;
  if (!cause) {
    return base;
  }

  if (
    /Download failed \(404\)/i.test(cause) ||
    /Download failed \(5\d\d\)/i.test(cause) ||
    /not a valid OTA/i.test(cause) ||
    /not registered/i.test(cause) ||
    /Hash mismatch/i.test(cause)
  ) {
    return base;
  }

  return base;
}

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

  const bothValid =
    semver.valid(remote.version) && semver.valid(local.version);

  // Bootstrap only: do not auto-downgrade active cache on page entry.
  if (bothValid && semver.lt(remote.version, local.version)) {
    return false;
  }

  // Bootstrap only: same semver — hash-only changes are handled by polling + pending apply.
  if (bothValid && remote.version === local.version) {
    return false;
  }

  if (bothValid && semver.gt(remote.version, local.version)) {
    return true;
  }

  if (normalizeHash(remote.hash) !== normalizeHash(local.hash)) {
    return true;
  }

  return remote.version !== local.version;
}

/** Polling / pending: true when remote active differs from local (upgrade or rollback). */
export function remoteDiffersFromActive(
  remote: Pick<RemoteFeature, 'version' | 'hash'>,
  local: Pick<CachedFeatureMetadata, 'version' | 'hash'> | null,
): boolean {
  if (!local) {
    return true;
  }

  if (normalizeHash(remote.hash) !== normalizeHash(local.hash)) {
    return true;
  }

  return remote.version !== local.version;
}

export function matchesRemoteRelease(
  meta: Pick<CachedFeatureMetadata | PendingFeatureMetadata, 'version' | 'hash'>,
  remote: Pick<RemoteFeature, 'version' | 'hash'>,
): boolean {
  return (
    meta.version === remote.version &&
    normalizeHash(meta.hash) === normalizeHash(remote.hash)
  );
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

  if (!validateOtaBundleContent(feature.id, body)) {
    throw new Error(`Downloaded bundle for "${feature.id}" is not a valid OTA split bundle`);
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

  if (!validateOtaBundleContent(feature.id, body)) {
    throw new Error(`Downloaded bundle for "${feature.id}" is not a valid OTA split bundle`);
  }

  const localPath = await writePendingBundle(feature.id, feature.version, body);
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
    await deletePendingBundleByPath(
      getPendingBundlePath(feature.id, feature.version),
    );
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
    (await isCachedBundleUsable(active.localPath, featureId));

  const updateAvailable =
    remoteFeature.hash !== 'sha256:unset' &&
    (!activeReady || remoteDiffersFromActive(remoteFeature, active));

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

  if (!(await isCachedBundleUsable(pending.localPath, featureId))) {
    return null;
  }

  const active = await readCachedMetadata(featureId);
  if (!active) {
    return pending;
  }

  // Legacy: pending used to overwrite the active bundle path — drop stale pending only.
  if (
    normalizeLocalPath(pending.localPath) === normalizeLocalPath(active.localPath)
  ) {
    await clearPendingMetadata(featureId);
    return null;
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

  clearOtaComponentCache(featureId);

  const activePath = getCachedBundlePath(pending.featureId, pending.version);
  const pendingPath = normalizeLocalPath(pending.localPath);
  const RNFS = require('react-native-fs') as {
    readFile: (path: string, encoding: 'utf8') => Promise<string>;
  };
  const body = await RNFS.readFile(pendingPath, 'utf8');
  await writeCachedBundle(pending.featureId, pending.version, body);
  await deletePendingBundleByPath(pendingPath);

  const active: CachedFeatureMetadata = {
    featureId: pending.featureId,
    version: pending.version,
    hash: pending.hash,
    localPath: activePath,
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
    try {
      const feature = await fetchFeatureById(featureId, manifestUrl);
      return failedUpdateResult(
        featureId,
        'OTA 模式：RNFS 未链接到 BrownfieldLib。请执行 npm run brownfield:package:ios:debug:sim 并 Clean Build。',
        feature,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manifest unavailable';
      return failedUpdateResult(featureId, message);
    }
  }

  await clearStaleActiveMetadata(featureId);
  await clearUnusableActiveMetadata(featureId);

  const cached = await readCachedMetadata(featureId);
  const cachedFileReady =
    cached !== null &&
    (await cachedBundleFileExists(cached.localPath)) &&
    (await isCachedBundleUsable(cached.localPath, featureId));

  if (cachedFileReady && cached) {
    try {
      clearManifestCache();
      const feature = await fetchFeatureById(featureId, manifestUrl, {
        forceRefresh: true,
      });

      if (needsUpdate(feature, cached)) {
        return checkAndUpdateFeature(featureId, options);
      }

      return {
        featureId,
        feature,
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manifest unavailable';
      return {
        featureId,
        feature: fallbackFeature(featureId, {
          version: cached.version,
          hash: cached.hash,
        }),
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
        error: message,
      };
    }
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
      return failedUpdateResult(
        featureId,
        'OTA 模式：RNFS 未链接到 BrownfieldLib。请执行 npm run brownfield:package:ios:debug:sim 并 Clean Build。',
        feature,
      );
    }

    await clearStaleActiveMetadata(featureId);
    await clearUnusableActiveMetadata(featureId);

    const cached = await readCachedMetadata(featureId);
    const cachedFileExists =
      cached !== null && (await cachedBundleFileExists(cached.localPath));
    const cachedFileReady =
      cachedFileExists && (await isCachedBundleUsable(cached.localPath, featureId));
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
        ...(cachedFileReady
          ? {}
          : {
              error: formatRemoteBundleError(featureId),
            }),
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
    const message = error instanceof Error ? error.message : 'Update failed';
    const cached = await readCachedMetadata(featureId);

    if (
      cached &&
      (await cachedBundleFileExists(cached.localPath)) &&
      (await isCachedBundleUsable(cached.localPath, featureId))
    ) {
      return {
        featureId,
        feature: fallbackFeature(featureId, {
          version: cached.version,
          hash: cached.hash,
        }),
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
        error: formatRemoteBundleError(featureId, message),
      };
    }

    try {
      const feature = await fetchFeatureById(featureId, manifestUrl);
      return failedUpdateResult(featureId, message, feature, cached?.version ?? null);
    } catch {
      return failedUpdateResult(featureId, message, undefined, cached?.version ?? null);
    }
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
