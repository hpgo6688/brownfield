import { DevSettings } from 'react-native';
import { clearLoadedBundles, clearLoadedBundlesForFeature } from './bundleLoader';
import { setPersistedDevOtaMode } from './devOtaModeStore';
import {
  clearOtaFeatureSessionMark,
  clearMetroFeatureSessionMark,
} from './otaSessionLoad';
import { clearFeatureRegistration, clearOtaComponentCache } from './registerFeature';
import { bumpOtaBundleRevision, getForceOtaInDev, setForceOtaInDev } from './remoteConfig';

export async function applyRemoteFeatureUpdates(
  featureIds: string[],
  options?: { reloadInOtaMode?: boolean },
): Promise<void> {
  const reloadInOtaMode = options?.reloadInOtaMode ?? true;

  for (const featureId of featureIds) {
    clearFeatureRegistration(featureId);
    clearLoadedBundlesForFeature(featureId);
    clearOtaFeatureSessionMark(featureId);
    clearMetroFeatureSessionMark(featureId);
  }

  bumpOtaBundleRevision();

  if (reloadInOtaMode && getForceOtaInDev()) {
    DevSettings.reload();
  }
}

export function reloadFeatureRuntime(): void {
  clearLoadedBundles();
  clearFeatureRegistration();
  clearOtaComponentCache();
  global.__OTA_LOADED_THIS_SESSION__ = new Set();
  global.__METRO_LOADED_THIS_SESSION__ = new Set();
  DevSettings.reload();
}

export async function applyDevOtaModeFromNative(ota: boolean): Promise<void> {
  await setPersistedDevOtaMode(ota);
  setForceOtaInDev(ota);
  reloadFeatureRuntime();
}
