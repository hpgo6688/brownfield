import { useEffect, useState } from 'react';
import { DevSettings } from 'react-native';
import type { ComponentType } from 'react';
import { ensureFeatureCached, formatRemoteBundleError, type UpdateCheckResult } from './bundleUpdater';
import { getCachedFeatureVersion, isBundleCacheAvailable } from './bundleCache';
import { clearLoadedBundlesForFeature, loadFeatureBundle } from './bundleLoader';
import { getPersistedDevOtaMode } from './devOtaModeStore';
import { useOtaUpdatePoller } from './otaUpdatePoller';
import { fetchFeatureById } from './manifest';
import {
  bumpOtaBundleRevision,
  getForceOtaInDev,
  setForceOtaInDev,
  useOtaBundleRevision,
} from './remoteConfig';
import {
  clearFeatureRegistration,
  getFeatureComponent,
  getFeatureSource,
  syncOtaRegistrationFromCache,
  waitForFeatureComponent,
} from './registerFeature';

export type FeatureLoadError = {
  message: string;
  remoteVersion?: string | null;
  localVersion?: string | null;
};

export function formatVersionLabel(version: string | null | undefined): string {
  if (!version || version === '0.0.0') {
    return '无';
  }
  return `v${version}`;
}

async function resolveOtaVersionContext(
  featureId: string,
  manifestUrl: string | undefined,
  hints?: { remoteVersion?: string | null; localVersion?: string | null },
): Promise<Pick<FeatureLoadError, 'remoteVersion' | 'localVersion'>> {
  const localVersion =
    hints?.localVersion ?? (await getCachedFeatureVersion(featureId));

  let remoteVersion = hints?.remoteVersion ?? null;
  if (remoteVersion == null) {
    try {
      const feature = await fetchFeatureById(featureId, manifestUrl, {
        forceRefresh: true,
      });
      remoteVersion = feature.version;
    } catch {
      remoteVersion = null;
    }
  }

  return { remoteVersion, localVersion };
}

function versionContextFromUpdateResult(
  result: UpdateCheckResult | null,
): Pick<FeatureLoadError, 'remoteVersion' | 'localVersion'> {
  return {
    remoteVersion: result?.feature.version ?? null,
    localVersion: result?.cachedVersion ?? null,
  };
}

async function resolveUseOtaMode(devOtaMode?: boolean): Promise<boolean> {
  if (!__DEV__) {
    return true;
  }

  if (typeof devOtaMode === 'boolean') {
    return devOtaMode;
  }

  return getPersistedDevOtaMode();
}

export type UseFeatureHostOptions = {
  featureId?: string;
  manifestUrl?: string;
  /** Passed from native shell toolbar toggle (DEBUG). */
  devOtaMode?: boolean;
};

export function useFeatureHost({
  featureId,
  manifestUrl,
  devOtaMode,
}: UseFeatureHostOptions) {
  const otaBundleRevision = useOtaBundleRevision();
  const [Screen, setScreen] = useState<ComponentType | null>(null);
  const [error, setError] = useState<FeatureLoadError | null>(null);
  const [otaModeActive, setOtaModeActive] = useState(false);
  const [screenReady, setScreenReady] = useState(false);

  const poll = useOtaUpdatePoller({
    featureId: featureId ?? '',
    manifestUrl,
    enabled: otaModeActive && Boolean(featureId) && screenReady,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadFeature() {
      if (!featureId) {
        setError({ message: 'Missing featureId' });
        setScreen(null);
        setScreenReady(false);
        setOtaModeActive(false);
        return;
      }

      setError(null);
      setScreen(null);
      setScreenReady(false);

      clearFeatureRegistration(featureId);
      clearLoadedBundlesForFeature(featureId);

      const useOta = await resolveUseOtaMode(devOtaMode);
      setOtaModeActive(useOta);

      if (getForceOtaInDev() !== useOta) {
        setForceOtaInDev(useOta);
      }

      let updateResult: UpdateCheckResult | null = null;

      if (!useOta) {
        try {
          const { loadMetroDevFeature } = await import('./metroDevFeatures');
          const component = await loadMetroDevFeature(featureId);
          if (!cancelled) {
            setScreen(() => component);
            setScreenReady(true);
          }
        } catch (metroError) {
          if (!cancelled) {
            const message =
              metroError instanceof Error ? metroError.message : 'Unknown load error';
            setError({ message });
            setScreen(null);
            setScreenReady(false);
          }
        }
        return;
      }

      try {
        if (!isBundleCacheAvailable()) {
          throw new Error(
            'OTA 模式：RNFS 未链接到 BrownfieldLib。请执行 npm run brownfield:package:ios:debug:sim 并 Clean Build。',
          );
        }

        updateResult = await ensureFeatureCached(featureId, {
          manifestUrl,
        });

        if (updateResult.runtimeReloadRequired) {
          bumpOtaBundleRevision();
          if (__DEV__ && getForceOtaInDev()) {
            DevSettings.reload();
          }
          return;
        }

        if (!updateResult.bundlePath) {
          if (!cancelled) {
            const versions = versionContextFromUpdateResult(updateResult);
            setError({
              message:
                updateResult.error ?? formatRemoteBundleError(featureId),
              ...versions,
            });
            setScreen(null);
            setScreenReady(false);
          }
          return;
        }

        syncOtaRegistrationFromCache(featureId, {
          expectedVersion: updateResult.cachedVersion,
          expectedLocalPath: updateResult.bundlePath,
        });

        let component = getFeatureComponent(featureId, { otaOnly: true });
        if (component) {
          if (!cancelled) {
            setScreen(() => component);
            setScreenReady(true);
          }
          return;
        }

        await loadFeatureBundle(updateResult.feature, {
          localPath: updateResult.bundlePath,
          force: true,
          otaMode: true,
        });

        component = await waitForFeatureComponent(featureId, {
          otaOnly: true,
          timeoutMs: 3000,
        });

        if (!component) {
          component = getFeatureComponent(featureId, { otaOnly: true });
        }

        if (!component) {
          const source = getFeatureSource(featureId);
          throw new Error(
            `OTA 模式：feature "${featureId}" bundle 已加载但未注册 ota_* 组件（source=${source ?? 'none'}，version=${updateResult.cachedVersion ?? '?'}）。请重新 upload ota_${featureId} bundle。`,
          );
        }

        if (!cancelled) {
          setScreen(() => component);
          setScreenReady(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          const raw =
            loadError instanceof Error ? loadError.message : 'Unknown load error';
          const hints = versionContextFromUpdateResult(updateResult);
          const versions = await resolveOtaVersionContext(featureId, manifestUrl, hints);
          setError({
            message: formatRemoteBundleError(featureId, raw),
            ...versions,
          });
          setScreen(null);
          setScreenReady(false);
        }
      }
    }

    loadFeature();

    return () => {
      cancelled = true;
    };
  }, [featureId, manifestUrl, devOtaMode, otaBundleRevision]);

  const showBanner =
    otaModeActive &&
    screenReady &&
    poll.pendingUpdate !== null &&
    !poll.pendingUpdate.deferredApply;

  const showDevPollStatus =
    __DEV__ && otaModeActive && screenReady && !showBanner && !error;

  return {
    Screen,
    error,
    loading: !Screen && !error,
    otaModeActive,
    screenReady,
    poll,
    showBanner,
    showDevPollStatus,
  };
}
