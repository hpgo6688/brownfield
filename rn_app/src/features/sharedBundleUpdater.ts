import { sha256 } from 'js-sha256';
import type { SharedBundle } from './manifest';
import {
  clearManifestCache,
  DEFAULT_MANIFEST_URL,
  fetchManifest,
} from './manifest';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  markBundleUsable,
  normalizeLocalPath,
  readCachedMetadata,
  validateSharedBundleContent,
  writeCachedBundle,
  writeCachedMetadata,
  type CachedFeatureMetadata,
} from './bundleCache';
import {
  markSharedBundleLoadedThisSession,
  wasSharedBundleLoadedThisSession,
} from './otaSessionLoad';
import {
  isSplitBundleLoaderAvailable,
  SplitBundleLoader,
} from './splitBundleLoader';
import { getFeatureSegmentId } from './segmentRegistry';
import { fetchWithRetry } from './retryWithBackoff';

export const SHARED_FEATURE_ID = 'shared';

const loadedSharedKeys = new Set<string>();

function normalizeHash(hash: string): string {
  return hash.startsWith('sha256:') ? hash.slice('sha256:'.length) : hash;
}

function sharedCacheNeedsUpdate(
  remote: Pick<SharedBundle, 'version' | 'hash'>,
  local: Pick<CachedFeatureMetadata, 'version' | 'hash'>,
): boolean {
  return (
    remote.version !== local.version ||
    normalizeHash(remote.hash) !== normalizeHash(local.hash)
  );
}

export function sharedBundleToRemoteFeature(shared: SharedBundle): {
  id: string;
  bundleUrl: string;
  version: string;
  hash: string;
  segmentId: number;
} {
  return {
    id: SHARED_FEATURE_ID,
    bundleUrl: shared.bundleUrl,
    version: shared.version,
    hash: shared.hash,
    segmentId: shared.segmentId ?? getFeatureSegmentId(SHARED_FEATURE_ID),
  };
}

async function downloadSharedBody(shared: SharedBundle): Promise<string> {
  const response = await fetchWithRetry(shared.bundleUrl, undefined, {
    label: 'bundle:shared',
  });
  return response.text();
}

async function verifyAndPersistShared(
  shared: SharedBundle,
  body: string,
): Promise<CachedFeatureMetadata> {
  if (!validateSharedBundleContent(body)) {
    throw new Error('Downloaded shared bundle is not a valid OTA split bundle');
  }

  const digest = sha256(body);
  const expected = normalizeHash(shared.hash);
  if (expected !== 'unset' && digest !== expected) {
    throw new Error('Hash mismatch for shared bundle');
  }

  const localPath = await writeCachedBundle(SHARED_FEATURE_ID, shared.version, body);
  markBundleUsable(localPath, body.length);
  const metadata: CachedFeatureMetadata = {
    featureId: SHARED_FEATURE_ID,
    version: shared.version,
    hash: shared.hash,
    localPath,
    installedAt: new Date().toISOString(),
  };
  await writeCachedMetadata(metadata);
  return metadata;
}

export type SharedBundleCacheResult = {
  shared: SharedBundle | null;
  bundlePath: string | null;
  updated: boolean;
  cachedVersion: string | null;
};

/** Download and cache shared bundle when manifest exposes sharedBundle. */
export async function ensureSharedBundleCached(
  options?: { manifestUrl?: string },
): Promise<SharedBundleCacheResult> {
  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;
  clearManifestCache();
  const manifest = await fetchManifest(manifestUrl, { forceRefresh: true });
  const shared = manifest.sharedBundle ?? null;

  if (!shared || shared.hash === 'sha256:unset') {
    return {
      shared: null,
      bundlePath: null,
      updated: false,
      cachedVersion: null,
    };
  }

  const cached = await readCachedMetadata(SHARED_FEATURE_ID);
  const cachedReady =
    cached !== null &&
    (await cachedBundleFileExists(cached.localPath)) &&
    (await isCachedBundleUsable(cached.localPath, SHARED_FEATURE_ID));

  if (cachedReady && cached && !sharedCacheNeedsUpdate(shared, cached)) {
    return {
      shared,
      bundlePath: cached.localPath,
      updated: false,
      cachedVersion: cached.version,
    };
  }

  const body = await downloadSharedBody(shared);
  const metadata = await verifyAndPersistShared(shared, body);
  return {
    shared,
    bundlePath: metadata.localPath,
    updated: true,
    cachedVersion: metadata.version,
  };
}

/** Native-load shared segment before feature split (no-op when manifest omits sharedBundle). */
export async function ensureSharedSegmentLoaded(
  options?: { manifestUrl?: string; warmReentry?: boolean },
): Promise<void> {
  if (!isSplitBundleLoaderAvailable()) {
    return;
  }

  const manifestUrl = options?.manifestUrl ?? DEFAULT_MANIFEST_URL;
  const cacheResult = await ensureSharedBundleCached({ manifestUrl });
  const shared = cacheResult.shared;

  if (!shared || !cacheResult.bundlePath) {
    return;
  }

  const path = normalizeLocalPath(cacheResult.bundlePath);
  const loadKey = `${shared.version}:${path}`;
  const segmentId = shared.segmentId ?? getFeatureSegmentId(SHARED_FEATURE_ID);

  if (
    options?.warmReentry &&
    wasSharedBundleLoadedThisSession(shared.version) &&
    loadedSharedKeys.has(loadKey)
  ) {
    if (__DEV__) {
      console.log(
        `[SplitBundleLoader] warm re-entry skip shared load v=${shared.version}`,
      );
    }
    return;
  }

  if (loadedSharedKeys.has(loadKey)) {
    return;
  }

  if (__DEV__) {
    console.log(
      `[SplitBundleLoader] load shared segmentId=${segmentId} path=${path} v=${shared.version}`,
    );
  }

  await SplitBundleLoader!.load(path, segmentId);
  loadedSharedKeys.add(loadKey);
  markSharedBundleLoadedThisSession(shared.version);
}

export function clearLoadedSharedBundles(): void {
  loadedSharedKeys.clear();
}
