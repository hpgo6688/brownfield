import { NativeModules } from 'react-native';

type SplitBundleLoaderModule = {
  load: (fileUrl: string, segmentId: number) => Promise<void>;
};

export const SplitBundleLoader = NativeModules
  .SplitBundleLoader as SplitBundleLoaderModule | undefined;

export function isSplitBundleLoaderAvailable(): boolean {
  return Boolean(SplitBundleLoader?.load);
}
