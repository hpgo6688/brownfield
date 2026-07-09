import semver from 'semver';
import { sha256 } from 'js-sha256';
import {
  cachedBundleFileExists,
  clearPendingMetadata,
  clearStaleActiveMetadata,
  clearStalePendingRelease,
  clearUnusableActiveMetadata,
  deleteCachedBundle,
  deletePendingBundleByPath,
  isBundleCacheAvailable,
  isCachedBundleUsable,
  normalizeLocalPath,
  pruneOldVersions,
  readCachedMetadata,
  readPendingMetadata,
  markPendingDeferredApply,
  reconcileActiveBundleCache,
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
  enrichRemoteFeature,
  fetchFeatureById,
  fetchManifest,
  type RemoteFeature,
} from './manifest';
import { wasOtaFeatureLoadedThisSession } from './otaSessionLoad';
import { clearOtaComponentCache } from './registerFeature';
import { fetchWithRetry } from './retryWithBackoff';

export type UpdateCheckResult = {
  featureId: string;
  feature: RemoteFeature;
  updated: boolean;
  bundlePath: string | null;
  cachedVersion: string | null;
  error?: string;
  /** Deferred pending was applied — JS runtime must reload before loading the page. */
  runtimeReloadRequired?: boolean;
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

  return base;
}

function isOtaCacheOrDownloadError(cause: string): boolean {
  return (
    /Download failed \(404\)/i.test(cause) ||
    /Download failed \(5\d\d\)/i.test(cause) ||
    /not a valid OTA/i.test(cause) ||
    /Hash mismatch/i.test(cause) ||
    /Cached bundle file not found/i.test(cause) ||
    /Manifest unavailable/i.test(cause) ||
    /RNFS 未链接/i.test(cause)
  );
}

/** User-facing load error: cache/download vs split load/register (versions may still match). */
export function formatFeatureLoadError(
  featureId: string,
  cause: string,
  options?: { remoteVersion?: string | null; localVersion?: string | null },
): string {
  if (isOtaCacheOrDownloadError(cause)) {
    return formatRemoteBundleError(featureId, cause);
  }

  const remote = options?.remoteVersion;
  const local = options?.localVersion;
  const versionsMatch =
    remote != null && local != null && remote !== '0.0.0' && remote === local;

  if (versionsMatch) {
    if (/unknown module/i.test(cause)) {
      return (
        `OTA split 与主包 module 表不一致（常见于 Metro --reset-cache 后未 rebuild/upload）。\n\n` +
        `请执行: cd rn_app && npm run build:bundles:dev，然后 upload。\n` +
        `或 DEV 下使用 USE_METRO_BUNDLES=true。\n\n${cause}`
      );
    }

    return `OTA bundle 加载失败（本地与服务端均为 v${local}，缓存文件正常）。\n\n${cause}`;
  }

  return `OTA bundle 加载失败。\n\n${cause}`;
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

/** SHA-256 hex digest of bundle bytes on disk (no sha256: prefix). */
export async function hashBundleFileAtPath(localPath: string): Promise<string | null> {
  try {
    const RNFS = require('react-native-fs') as {
      readFile: (path: string, encoding: 'utf8') => Promise<string>;
    };
    const body = await RNFS.readFile(normalizeLocalPath(localPath), 'utf8');
    return sha256(body);
  } catch {
    return null;
  }
}

export async function activeBundleFileMatchesRemote(
  cached: CachedFeatureMetadata,
  remote: Pick<RemoteFeature, 'hash'>,
): Promise<boolean> {
  if (remote.hash === 'sha256:unset') {
    return false;
  }

  const digest = await hashBundleFileAtPath(cached.localPath);
  if (!digest) {
    return false;
  }

  return normalizeHash(remote.hash) === digest;
}

/** Verify downloaded bundle bytes before writing metadata or promoting pending → active. */
export function verifyOtaBundleBody(
  featureId: string,
  body: string,
  expectedHash: string,
): void {
  const digest = sha256(body);
  const expected = normalizeHash(expectedHash);

  if (expected !== 'unset' && digest !== expected) {
    throw new Error(`Hash mismatch for feature "${featureId}"`);
  }

  if (!validateOtaBundleContent(featureId, body)) {
    throw new Error(`Downloaded bundle for "${featureId}" is not a valid OTA split bundle`);
  }
}

async function verifyAndPersistActive(
  feature: RemoteFeature,
  body: string,
): Promise<CachedFeatureMetadata> {
  verifyOtaBundleBody(feature.id, body, feature.hash);

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
  verifyOtaBundleBody(feature.id, body, feature.hash);

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

async function downloadBundleBody(feature: RemoteFeature): Promise<string> {
  const response = await fetchWithRetry(feature.bundleUrl, undefined, {
    label: `bundle:${feature.id}`,
  });
  return response.text();
}

export async function downloadAndCacheFeature(
  feature: RemoteFeature,
): Promise<CachedFeatureMetadata> {
  const body = await downloadBundleBody(feature);

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
  const body = await downloadBundleBody(feature);

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
    await clearStalePendingRelease(featureId, pending);
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

  let body: string;
  try {
    body = await RNFS.readFile(pendingPath, 'utf8');
    verifyOtaBundleBody(pending.featureId, body, pending.hash);
  } catch (error) {
    await clearStalePendingRelease(featureId, pending);
    if (__DEV__) {
      console.warn(`[OTA] pending apply verify failed for ${featureId}`, error);
    }
    return null;
  }

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

/** User chose 稍后 — promote deferred pending on next entry before loading the page. */
export async function applyDeferredPendingIfNeeded(
  featureId: string,
): Promise<CachedFeatureMetadata | null> {
  const pending = await readPendingMetadata(featureId);
  if (!pending?.deferredApply) {
    return null;
  }

  try {
    const valid = await getPendingUpdate(featureId);
    if (!valid) {
      await clearPendingMetadata(featureId);
      return null;
    }

    if (__DEV__) {
      console.log(
        `[OTA] auto-applying deferred pending ${featureId}@${pending.version}`,
      );
    }

    return await applyPendingFeature(featureId);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[OTA] deferred apply failed for ${featureId}`, error);
    }
    return null;
  }
}

/**
 * Pre-entry staging: detect remote diff and download pending bundle (no apply).
 * Called before loading active cache so the page can show a prompt after entry.
 */
export async function stageRemoteFeatureUpdate(
  featureId: string,
  options?: { manifestUrl?: string },
): Promise<PendingFeatureMetadata | null> {
  try {
    const check = await checkRemoteFeature(featureId, options);
    const existing = await getPendingUpdate(featureId);

    if (existing && matchesRemoteRelease(existing, check.remoteFeature)) {
      if (__DEV__) {
        console.log(
          `[OTA] staged pending ${featureId}@${existing.version} (already downloaded)`,
        );
      }
      return existing;
    }

    if (existing) {
      await clearStalePendingRelease(featureId, existing);
    }

    if (!check.updateAvailable || check.remoteFeature.hash === 'sha256:unset') {
      return null;
    }

    try {
      const pending = await downloadPendingFeature(check.remoteFeature);
      if (__DEV__) {
        console.log(
          `[OTA] staged pending ${featureId}@${pending.version} (pre-entry download)`,
        );
      }
      return pending;
    } catch (downloadError) {
      if (__DEV__) {
        console.warn(
          `[OTA] pre-entry pending download failed for ${featureId}`,
          downloadError,
        );
      }
      return null;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`[OTA] pre-entry staging failed for ${featureId}`, error);
    }
    return null;
  }
}

export { markPendingDeferredApply } from './bundleCache';

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

  await reconcileActiveBundleCache(featureId);

  const deferredApplied = await applyDeferredPendingIfNeeded(featureId);

  const cached = await readCachedMetadata(featureId);
  const cachedFileReady =
    cached !== null &&
    (await cachedBundleFileExists(cached.localPath)) &&
    (await isCachedBundleUsable(cached.localPath, featureId));

  const sessionReentry =
    wasOtaFeatureLoadedThisSession(featureId) && deferredApplied === null;

  if (cachedFileReady && cached && sessionReentry) {
    return {
      featureId,
      feature: enrichRemoteFeature(
        fallbackFeature(featureId, {
          version: cached.version,
          hash: cached.hash,
        }),
      ),
      updated: false,
      bundlePath: cached.localPath,
      cachedVersion: cached.version,
    };
  }

  await stageRemoteFeatureUpdate(featureId, { manifestUrl });

  if (cachedFileReady && cached) {
    try {
      clearManifestCache();
      const feature = await fetchFeatureById(featureId, manifestUrl, {
        forceRefresh: true,
      });

      const activeFileOk = await activeBundleFileMatchesRemote(cached, feature);
      const metaOk = matchesRemoteRelease(cached, feature);

      if (!activeFileOk || !metaOk) {
        const pending = await getPendingUpdate(featureId);
        if (pending && matchesRemoteRelease(pending, feature)) {
          if (__DEV__) {
            console.log(
              `[OTA] applying pending ${featureId}@${pending.version} (active stale: fileOk=${activeFileOk} metaOk=${metaOk})`,
            );
          }
          const applied = await applyPendingFeature(featureId);
          if (applied) {
            return {
              featureId,
              feature,
              updated: true,
              bundlePath: applied.localPath,
              cachedVersion: applied.version,
            };
          }
        }

        return checkAndUpdateFeature(featureId, options);
      }

      if (needsUpdate(feature, cached)) {
        return checkAndUpdateFeature(featureId, options);
      }

      return {
        featureId,
        feature,
        updated: false,
        bundlePath: cached.localPath,
        cachedVersion: cached.version,
        runtimeReloadRequired: deferredApplied !== null,
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
        runtimeReloadRequired: deferredApplied !== null,
      };
    }
  }

  const result = await checkAndUpdateFeature(featureId, options);
  if (deferredApplied !== null) {
    result.runtimeReloadRequired = true;
  }
  return result;
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
