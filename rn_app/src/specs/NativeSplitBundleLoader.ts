import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  load(fileUrl: string, segmentId: number): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SplitBundleLoader');
