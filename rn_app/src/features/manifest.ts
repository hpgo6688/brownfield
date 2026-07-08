import { getFeatureSegmentId, hasFeatureSegmentId } from './segmentRegistry';

export type RemoteFeature = {
  id: string;
  title: string;
  icon: string;
  moduleName: string;
  bundleUrl: string;
  version: string;
  hash: string;
  minAppVersion: string;
  /** Metro split-bundle segment id — must match config/feature-segments.json */
  segmentId?: number;
};

export type BundleManifest = {
  version: number;
  updatedAt: string;
  mode: 'metro' | 'static';
  manifestUrl: string;
  features: RemoteFeature[];
};

export const DEFAULT_MANIFEST_URL = 'http://127.0.0.1:3001/api/manifest';

let cachedManifest: BundleManifest | null = null;

export function enrichRemoteFeature(feature: RemoteFeature): RemoteFeature {
  if (feature.segmentId != null || !hasFeatureSegmentId(feature.id)) {
    return feature;
  }

  return {
    ...feature,
    segmentId: getFeatureSegmentId(feature.id),
  };
}

export async function fetchManifest(
  manifestUrl: string = DEFAULT_MANIFEST_URL,
  options?: { appVersion?: string; forceRefresh?: boolean },
): Promise<BundleManifest> {
  const url = new URL(manifestUrl);
  if (options?.appVersion) {
    url.searchParams.set('appVersion', options.appVersion);
  }
  if (options?.forceRefresh !== false) {
    url.searchParams.set('_ts', String(Date.now()));
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`Manifest request failed (${response.status})`);
  }

  const manifest = (await response.json()) as BundleManifest;
  cachedManifest = {
    ...manifest,
    features: manifest.features.map(enrichRemoteFeature),
  };
  return cachedManifest;
}

export async function fetchFeatureById(
  featureId: string,
  manifestUrl: string = DEFAULT_MANIFEST_URL,
  options?: { forceRefresh?: boolean },
): Promise<RemoteFeature> {
  const manifest =
    options?.forceRefresh === true || cachedManifest === null
      ? await fetchManifest(manifestUrl, { forceRefresh: true })
      : cachedManifest;
  const feature = manifest.features.find(item => item.id === featureId);

  if (!feature) {
    throw new Error(`Feature "${featureId}" is disabled or missing in manifest`);
  }

  return enrichRemoteFeature(feature);
}

export function clearManifestCache() {
  cachedManifest = null;
}
