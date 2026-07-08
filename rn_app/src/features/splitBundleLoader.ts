import NativeSplitBundleLoader from '../specs/NativeSplitBundleLoader';

export const SplitBundleLoader = NativeSplitBundleLoader;

export function isSplitBundleLoaderAvailable(): boolean {
  return Boolean(NativeSplitBundleLoader?.load);
}
