import { DeviceEventEmitter } from 'react-native';
import {
  applyDevOtaModeFromNative,
  reloadFeatureRuntime,
} from './featureReload';

type BrownfieldReloadMessage = {
  type: 'reloadFeatureRuntime';
  devOtaMode?: boolean;
};

export function installDevOtaModeBridge(): void {
  if (!__DEV__) {
    return;
  }

  DeviceEventEmitter.addListener('brownfieldMessage', (message: string) => {
    try {
      const payload = JSON.parse(message) as BrownfieldReloadMessage;
      if (payload.type !== 'reloadFeatureRuntime') {
        return;
      }

      if (typeof payload.devOtaMode === 'boolean') {
        void applyDevOtaModeFromNative(payload.devOtaMode);
        return;
      }

      reloadFeatureRuntime();
    } catch {
      // Ignore malformed native messages.
    }
  });
}
