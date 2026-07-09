import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
  type CachedFeatureMetadata,
} from './bundleCache';
import type { RemoteFeature } from './manifest';
import { shouldBustOtaComponentCache } from './registerFeature';

export type OtaFastPathCandidate = {
  metadata: CachedFeatureMetadata;
  feature: RemoteFeature;
};

function metadataToFeature(metadata: CachedFeatureMetadata): RemoteFeature {
  return {
    id: metadata.featureId,
    title: metadata.featureId,
    icon: '',
    moduleName: '',
    bundleUrl: '',
    version: metadata.version,
    hash: metadata.hash,
    minAppVersion: '0.0.0',
  };
}

/**
 * Probe verified disk cache for instant OTA re-entry. Caller MUST still run
 * loadFeatureBundle({ ensureSegment: true }) before render — split segment
 * module ids (e.g. __r(745032085)) are not guaranteed to survive remount.
 */
export async function probeOtaFastPath(
  featureId: string,
): Promise<OtaFastPathCandidate | null> {
  const active = await readCachedMetadata(featureId);
  if (!active) {
    return null;
  }

  if (!(await cachedBundleFileExists(active.localPath))) {
    return null;
  }

  if (!(await isCachedBundleUsable(active.localPath, featureId))) {
    return null;
  }

  if (shouldBustOtaComponentCache(featureId, active.version, active.localPath)) {
    return null;
  }

  return {
    metadata: active,
    feature: metadataToFeature(active),
  };
}

/** @deprecated Use probeOtaFastPath + loadFeatureBundle(ensureSegment) instead */
export async function tryReuseOtaFeature(featureId: string) {
  const candidate = await probeOtaFastPath(featureId);
  if (!candidate) {
    return null;
  }

  const { getFeatureComponent, syncOtaRegistrationFromCache, stampOtaComponentCacheVersion } =
    await import('./registerFeature');

  syncOtaRegistrationFromCache(featureId, {
    expectedVersion: candidate.metadata.version,
    expectedHash: candidate.metadata.hash,
    expectedLocalPath: candidate.metadata.localPath,
  });

  const component = getFeatureComponent(featureId, { otaOnly: true });
  if (!component) {
    return null;
  }

  stampOtaComponentCacheVersion(
    featureId,
    candidate.metadata.version,
    candidate.metadata.hash,
    candidate.metadata.localPath,
  );

  return { component, metadata: candidate.metadata };
}
