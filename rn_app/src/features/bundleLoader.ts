import type { RemoteFeature } from './manifest';
import { isFeatureLoaded } from './registerFeature';

declare const global: {
  globalEvalWithSourceUrl?: (source: string, sourceUrl: string) => unknown;
};

const loadedBundleUrls = new Set<string>();

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

/**
 * Load an incremental Metro split bundle. Full standalone bundles must not be
 * eval'd into the same runtime — they duplicate React and break hooks.
 */
export async function loadFeatureBundle(feature: RemoteFeature): Promise<void> {
  if (isFeatureLoaded(feature.id) || loadedBundleUrls.has(feature.bundleUrl)) {
    return;
  }

  if (__DEV__ && feature.bundleUrl.includes(':8081/')) {
    await loadFromMetroDevServer(feature.bundleUrl);
    loadedBundleUrls.add(feature.bundleUrl);
    return;
  }

  throw new Error(
    'Static full bundles cannot be eval-loaded in-app. Use built-in features from the main bundle, or start bundle-server with USE_METRO_BUNDLES=true while Metro is running.',
  );
}

export function clearLoadedBundles() {
  loadedBundleUrls.clear();
}
