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
  options?: { appVersion?: string },
): Promise<BundleManifest> {
  const url = new URL(manifestUrl);
  if (options?.appVersion) {
    url.searchParams.set('appVersion', options.appVersion);
  }

  const response = await fetch(url.toString());
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
): Promise<RemoteFeature> {
  const manifest = cachedManifest ?? (await fetchManifest(manifestUrl));
  const feature = manifest.features.find(item => item.id === featureId);

  if (!feature) {
    throw new Error(`Feature "${featureId}" is disabled or missing in manifest`);
  }

  return enrichRemoteFeature(feature);
}

export function clearManifestCache() {
  cachedManifest = null;
}
