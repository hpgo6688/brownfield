import type { ComponentType } from 'react';
import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  readCachedMetadata,
  type CachedFeatureMetadata,
} from './bundleCache';
import type { RemoteFeature } from './manifest';
import { wasMetroFeatureLoadedThisSession, wasOtaFeatureLoadedThisSession } from './otaSessionLoad';
import {
  getFeatureComponent,
  getFeatureSource,
  shouldBustOtaComponentCache,
  syncOtaRegistrationFromCache,
} from './registerFeature';

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
 * Probe verified disk cache for same-session OTA re-entry.
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

/**
 * Same-session OTA re-entry: render immediately when live OTA registry survives
 * remount (segment modules remain from the prior OTA visit). Never skips native
 * load — cache-only restore is handled in bundleLoader after segment eval.
 */
export async function tryInstantOtaReentry(
  featureId: string,
): Promise<ComponentType | null> {
  if (!wasOtaFeatureLoadedThisSession(featureId)) {
    return null;
  }

  if (wasMetroFeatureLoadedThisSession(featureId)) {
    return null;
  }

  if (getFeatureSource(featureId) !== 'ota') {
    return null;
  }

  const live = getFeatureComponent(featureId, { otaOnly: true });
  if (live) {
    if (__DEV__) {
      console.log(`[OTA] instant re-entry feature=${featureId} (live registry)`);
    }
    return live;
  }

  return null;
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
