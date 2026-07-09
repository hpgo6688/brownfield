import type { RemoteFeature } from './manifest';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  normalizeLocalPath,
  readCachedMetadata,
} from './bundleCache';
import { getForceOtaInDev } from './remoteConfig';
import {
  clearFeatureRegistration,
  clearOtaComponentCache,
  isFeatureLoaded,
  isFeatureLoadedFromOta,
  shouldBustOtaComponentCache,
  stampOtaComponentCacheVersion,
  syncOtaRegistrationFromCache,
  waitForFeatureComponent,
} from './registerFeature';
import { getFeatureSegmentId } from './segmentRegistry';
import { clearMetroFeatureSessionMark, wasMetroFeatureLoadedThisSession, wasOtaFeatureLoadedThisSession } from './otaSessionLoad';
import { executeSplitBundleEntry } from './splitBundleEntry';
import { preloadOtaSplitHostModules } from './otaSplitHostPreload';
import { isSplitBundleLoaderAvailable, SplitBundleLoader } from './splitBundleLoader';

const loadedBundleKeys = new Set<string>();
const loadedBundlePaths = new Map<string, string>();

function ensureModulesOnlyQuery(bundleUrl: string): string {
  const url = new URL(bundleUrl);
  if (!url.searchParams.has('modulesOnly')) {
    url.searchParams.set('modulesOnly', 'true');
  }
  return url.toString();
}

async function loadFromMetroDevServer(bundleUrl: string): Promise<void> {
  const loadBundleFromServer =
    require('react-native/Libraries/Core/Devtools/loadBundleFromServer').default;

  const splitBundleUrl = ensureModulesOnlyQuery(bundleUrl);
  const url = new URL(splitBundleUrl);
  const bundlePathAndQuery = `${url.pathname.replace(/^\//, '')}${url.search}`;

  await loadBundleFromServer(bundlePathAndQuery);
}

function isMetroDevUrl(bundleUrl: string): boolean {
  return __DEV__ && bundleUrl.includes(':8081/');
}

function isLocalFileUrl(bundleUrl: string): boolean {
  return bundleUrl.startsWith('file://') || bundleUrl.startsWith('/');
}

async function loadFromNativeSplitBundle(
  feature: RemoteFeature,
  localPath: string,
  options?: { ensureSegment?: boolean; warmReentry?: boolean },
): Promise<void> {
  if (!isSplitBundleLoaderAvailable()) {
    throw new Error(
      'SplitBundleLoader native module is unavailable. Rebuild BrownfieldLib after adding SplitBundleLoader.',
    );
  }

  const path = normalizeLocalPath(localPath);
  if (!(await cachedBundleFileExists(path))) {
    throw new Error('Cached bundle file not found');
  }

  if (!(await isCachedBundleUsable(path, feature.id))) {
    throw new Error('not a valid OTA split bundle');
  }

  const activeMeta = await readCachedMetadata(feature.id);
  const previousPath = loadedBundlePaths.get(feature.id);
  const pathChanged =
    previousPath !== undefined && normalizeLocalPath(previousPath) !== path;
  const needsRegistration = !isFeatureLoadedFromOta(feature.id);

  const trySyncFromCache = () => {
    if (!activeMeta) {
      return;
    }

    syncOtaRegistrationFromCache(feature.id, {
      expectedVersion: activeMeta.version,
      expectedHash: activeMeta.hash,
      expectedLocalPath: activeMeta.localPath,
    });
  };

  const otaReentry =
    options?.ensureSegment === true && wasOtaFeatureLoadedThisSession(feature.id);
  const afterMetro =
    options?.ensureSegment === true && wasMetroFeatureLoadedThisSession(feature.id);
  const restoreRegistry = otaReentry || afterMetro;
  const liveOtaRegistration = isFeatureLoadedFromOta(feature.id);

  if (
    options?.warmReentry &&
    restoreRegistry &&
    liveOtaRegistration
  ) {
    loadedBundlePaths.set(feature.id, path);
    if (activeMeta) {
      stampOtaComponentCacheVersion(
        feature.id,
        activeMeta.version,
        activeMeta.hash,
        activeMeta.localPath,
      );
    }
    if (__DEV__) {
      console.log(
        `[SplitBundleLoader] warm re-entry skip native load feature=${feature.id}`,
      );
    }
    return;
  }

  if (options?.ensureSegment) {
    clearFeatureRegistration(feature.id);
    if (!restoreRegistry) {
      clearOtaComponentCache(feature.id);
    }
  } else if (!isFeatureLoadedFromOta(feature.id)) {
    trySyncFromCache();
  }

  if (
    activeMeta &&
    shouldBustOtaComponentCache(feature.id, activeMeta.version, activeMeta.localPath)
  ) {
    clearOtaComponentCache(feature.id);
  }

  const segmentId = feature.segmentId ?? getFeatureSegmentId(feature.id);

  if (__DEV__) {
    console.log(
      `[SplitBundleLoader] load feature=${feature.id} segmentId=${segmentId} path=${path} pathChanged=${pathChanged} needsRegistration=${needsRegistration} ensureSegment=${Boolean(options?.ensureSegment)} otaReentry=${otaReentry} afterMetro=${afterMetro}`,
    );
  }

  if (__DEV__) {
    preloadOtaSplitHostModules();
  }

  await SplitBundleLoader!.load(path, segmentId);

  if (restoreRegistry) {
    trySyncFromCache();
  }

  if (!isFeatureLoadedFromOta(feature.id) && !restoreRegistry) {
    await waitForFeatureComponent(feature.id, {
      otaOnly: true,
      timeoutMs: 1000,
      intervalMs: 8,
    });
  }

  if (!isFeatureLoadedFromOta(feature.id)) {
    const requireRegistration = options?.ensureSegment === true && !restoreRegistry;
    const entryOk = await executeSplitBundleEntry(path, {
      featureId: feature.id,
      requireRegistration,
    });
    if (!entryOk && options?.ensureSegment && !restoreRegistry) {
      throw new Error(`split bundle entry failed for "${feature.id}"`);
    }
  }

  if (!isFeatureLoadedFromOta(feature.id) && !options?.ensureSegment) {
    trySyncFromCache();
  }

  if (!isFeatureLoadedFromOta(feature.id) && restoreRegistry) {
    trySyncFromCache();
  }

  if (!isFeatureLoadedFromOta(feature.id)) {
    throw new Error(
      `OTA feature "${feature.id}" not registered after split bundle load`,
    );
  }

  loadedBundlePaths.set(feature.id, path);

  if (activeMeta) {
    stampOtaComponentCacheVersion(
      feature.id,
      activeMeta.version,
      activeMeta.hash,
      activeMeta.localPath,
    );
  }

  if (afterMetro) {
    clearMetroFeatureSessionMark(feature.id);
  }
}

/**
 * Load an incremental split bundle. Full standalone bundles must not be
 * eval'd into the same runtime — they duplicate React and break hooks.
 */
export async function loadFeatureBundle(
  feature: RemoteFeature,
  options?: {
    localPath?: string | null;
    force?: boolean;
    otaMode?: boolean;
    /** Re-register native split segment even when JS registration exists (OTA re-entry). */
    ensureSegment?: boolean;
    /** Same-session re-entry: skip native load when OTA registration is already live. */
    warmReentry?: boolean;
  },
): Promise<void> {
  const localPath = options?.localPath ?? null;
  const useOta = options?.otaMode ?? getForceOtaInDev();
  const loadKey = localPath
    ? `${feature.id}:${normalizeLocalPath(localPath)}`
    : `${feature.id}:${feature.bundleUrl}`;

  const alreadyLoaded = useOta
    ? isFeatureLoadedFromOta(feature.id)
    : isFeatureLoaded(feature.id);

  if (
    !options?.force &&
    !options?.ensureSegment &&
    alreadyLoaded &&
    loadedBundleKeys.has(loadKey)
  ) {
    return;
  }

  if (useOta && (localPath || isLocalFileUrl(feature.bundleUrl))) {
    const path = localPath ?? feature.bundleUrl;
    await loadFromNativeSplitBundle(feature, path, {
      ensureSegment: options?.ensureSegment,
      warmReentry: options?.warmReentry,
    });
    loadedBundleKeys.add(loadKey);
    return;
  }

  if (!useOta && isMetroDevUrl(feature.bundleUrl)) {
    if (__DEV__) {
      console.log(
        `[SplitBundleLoader] metro dev load feature=${feature.id} url=${feature.bundleUrl}`,
      );
    }
    await loadFromMetroDevServer(feature.bundleUrl);
    loadedBundleKeys.add(loadKey);
    return;
  }

  if (localPath || isLocalFileUrl(feature.bundleUrl)) {
    const path = localPath ?? feature.bundleUrl;
    await loadFromNativeSplitBundle(feature, path, {
      ensureSegment: options?.ensureSegment,
      warmReentry: options?.warmReentry,
    });
    loadedBundleKeys.add(loadKey);
    return;
  }

  if (__DEV__) {
    throw new Error(
      'Remote static bundles cannot be eval-loaded in-app. Use built-in features from the main bundle, or start bundle-server with USE_METRO_BUNDLES=true while Metro is running.',
    );
  }

  throw new Error(
    `Feature "${feature.id}" has no cached OTA bundle. Download via bundleUpdater first.`,
  );
}

export function clearLoadedBundles() {
  loadedBundleKeys.clear();
  loadedBundlePaths.clear();
}

export function clearLoadedBundlesForFeature(featureId: string) {
  for (const key of loadedBundleKeys) {
    if (key.startsWith(`${featureId}:`)) {
      loadedBundleKeys.delete(key);
    }
  }
  loadedBundlePaths.delete(featureId);
}
