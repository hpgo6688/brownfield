export type RemoteFeature = {
  id: string;
  title: string;
  icon: string;
  moduleName: string;
  bundleUrl: string;
  version: string;
  hash: string;
  minAppVersion: string;
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
  cachedManifest = manifest;
  return manifest;
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

  return feature;
}

export function clearManifestCache() {
  cachedManifest = null;
}
