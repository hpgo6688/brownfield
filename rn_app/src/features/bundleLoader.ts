import { isFeatureLoaded } from './registerFeature';
import type { RemoteFeature } from './manifest';

declare const global: {
  globalEvalWithSourceUrl?: (source: string, sourceUrl: string) => unknown;
};

const loadedBundleUrls = new Set<string>();

function evalBundle(source: string, bundleUrl: string) {
  if (global.globalEvalWithSourceUrl) {
    global.globalEvalWithSourceUrl(source, bundleUrl);
    return;
  }

  // eslint-disable-next-line no-eval
  eval(source);
}

async function loadFromMetroDevServer(bundleUrl: string): Promise<void> {
  const loadBundleFromServer =
    require('react-native/Libraries/Core/Devtools/loadBundleFromServer').default;

  const url = new URL(bundleUrl);
  const bundlePathAndQuery = `${url.pathname.replace(/^\//, '')}${url.search}`;

  await loadBundleFromServer(bundlePathAndQuery);
}

export async function loadFeatureBundle(feature: RemoteFeature): Promise<void> {
  if (isFeatureLoaded(feature.id) || loadedBundleUrls.has(feature.bundleUrl)) {
    return;
  }

  if (__DEV__ && feature.bundleUrl.includes(':8081/')) {
    await loadFromMetroDevServer(feature.bundleUrl);
    loadedBundleUrls.add(feature.bundleUrl);
    return;
  }

  const response = await fetch(feature.bundleUrl);
  if (!response.ok) {
    throw new Error(`Bundle download failed (${response.status})`);
  }

  const source = await response.text();
  evalBundle(source, feature.bundleUrl);
  loadedBundleUrls.add(feature.bundleUrl);
}

export function clearLoadedBundles() {
  loadedBundleUrls.clear();
}
