import { useEffect, useState } from 'react';
import { DevSettings } from 'react-native';
import type { ComponentType } from 'react';
import {
  ensureFeatureCached,
  formatFeatureLoadError,
  formatRemoteBundleError,
  type UpdateCheckResult,
} from './bundleUpdater';
import { getCachedFeatureVersion, isBundleCacheAvailable, clearBundleUsabilityForFeature } from './bundleCache';
import { clearLoadedBundlesForFeature, loadFeatureBundle } from './bundleLoader';
import { getPersistedDevOtaMode } from './devOtaModeStore';
import {
  clearOtaFeatureSessionMark,
  markMetroFeatureLoadedThisSession,
  markOtaFeatureLoadedThisSession,
  wasOtaFeatureLoadedThisSession,
} from './otaSessionLoad';
import { peekInstantOtaReentry, tryInstantOtaReentry } from './otaFeatureReuse';
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

async function loadOtaFeatureScreen(
  featureId: string,
  manifestUrl: string | undefined,
): Promise<{
  component: ComponentType;
  updateResult: UpdateCheckResult;
}> {
  const updateResult = await ensureFeatureCached(featureId, {
    manifestUrl,
  });

  if (updateResult.runtimeReloadRequired) {
    bumpOtaBundleRevision();
    if (__DEV__ && getForceOtaInDev()) {
      DevSettings.reload();
    }
    throw new Error('OTA runtime reload required');
  }

  if (!updateResult.bundlePath) {
    const versions = versionContextFromUpdateResult(updateResult);
    throw Object.assign(
      new Error(updateResult.error ?? formatRemoteBundleError(featureId)),
      { versions },
    );
  }

  await loadFeatureBundle(updateResult.feature, {
    localPath: updateResult.bundlePath,
    otaMode: true,
    ensureSegment: true,
    manifestUrl,
  });

  let component = getFeatureComponent(featureId, { otaOnly: true });

  if (!component) {
    component = await waitForFeatureComponent(featureId, {
      otaOnly: true,
      timeoutMs: 500,
      intervalMs: 8,
    });
  }

  if (!component) {
    const source = getFeatureSource(featureId);
    throw new Error(
      `OTA 模式：feature "${featureId}" bundle 已加载但未注册 ota_* 组件（source=${source ?? 'none'}，version=${updateResult.cachedVersion ?? '?'}）。请重新 upload ota_${featureId} bundle。`,
    );
  }

  return { component, updateResult };
}

/** Background reconcile after instant re-entry (update check, no UI reset). */
async function refreshOtaEntryInBackground(
  featureId: string,
  manifestUrl: string | undefined,
  isCancelled: () => boolean,
): Promise<void> {
  try {
    const updateResult = await ensureFeatureCached(featureId, { manifestUrl });
    if (isCancelled() || !updateResult.bundlePath) {
      return;
    }

    if (!updateResult.updated) {
      return;
    }

    await loadFeatureBundle(updateResult.feature, {
      localPath: updateResult.bundlePath,
      otaMode: true,
      ensureSegment: true,
      warmReentry: true,
      manifestUrl,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(`[OTA] background re-entry refresh failed for ${featureId}`, error);
    }
  }
}

function initialOtaScreen(
  featureId: string | undefined,
  devOtaMode: boolean | undefined,
): ComponentType | null {
  if (!featureId || (__DEV__ && devOtaMode === false)) {
    return null;
  }

  return peekInstantOtaReentry(featureId);
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
  const [Screen, setScreen] = useState<ComponentType | null>(() =>
    initialOtaScreen(featureId, devOtaMode),
  );
  const [error, setError] = useState<FeatureLoadError | null>(null);
  const [otaModeActive, setOtaModeActive] = useState(
    () => !__DEV__ || devOtaMode !== false,
  );
  const [screenReady, setScreenReady] = useState(
    () => initialOtaScreen(featureId, devOtaMode) !== null,
  );

  const instantReentryOnMount =
    initialOtaScreen(featureId, devOtaMode) !== null;

  const poll = useOtaUpdatePoller({
    featureId: featureId ?? '',
    manifestUrl,
    enabled: otaModeActive && Boolean(featureId) && screenReady,
    deferInitialPollMs: instantReentryOnMount ? 1500 : 0,
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

      const useOta = await resolveUseOtaMode(devOtaMode);
      setOtaModeActive(useOta);

      if (getForceOtaInDev() !== useOta) {
        setForceOtaInDev(useOta);
      }

      if (!useOta) {
        setScreen(null);
        setScreenReady(false);

        try {
          clearOtaFeatureSessionMark(featureId);
          markMetroFeatureLoadedThisSession(featureId);
          clearLoadedBundlesForFeature(featureId);
          clearFeatureRegistration(featureId);

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

      let updateResult: UpdateCheckResult | null = null;

      try {
        if (!isBundleCacheAvailable()) {
          throw new Error(
            'OTA 模式：RNFS 未链接到 BrownfieldLib。请执行 npm run brownfield:package:ios:debug:sim 并 Clean Build。',
          );
        }

        const sessionReentry = wasOtaFeatureLoadedThisSession(featureId);

        if (sessionReentry) {
          const instant = await tryInstantOtaReentry(featureId);
          if (instant && !cancelled) {
            markOtaFeatureLoadedThisSession(featureId);
            setScreen(() => instant);
            setScreenReady(true);
            void refreshOtaEntryInBackground(featureId, manifestUrl, () => cancelled);
            return;
          }
        }

        setScreen(null);
        setScreenReady(false);
        clearFeatureRegistration(featureId);
        clearLoadedBundlesForFeature(featureId);
        clearBundleUsabilityForFeature(featureId);

        const loaded = await loadOtaFeatureScreen(featureId, manifestUrl);
        updateResult = loaded.updateResult;

        if (!cancelled) {
          markOtaFeatureLoadedThisSession(featureId);
          setScreen(() => loaded.component);
          setScreenReady(true);
        }
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === 'OTA runtime reload required') {
          return;
        }

        if (!cancelled) {
          const raw =
            loadError instanceof Error ? loadError.message : 'Unknown load error';
          const hints =
            loadError instanceof Error &&
            'versions' in loadError &&
            typeof loadError.versions === 'object'
              ? (loadError.versions as Pick<
                  FeatureLoadError,
                  'remoteVersion' | 'localVersion'
                >)
              : versionContextFromUpdateResult(updateResult);
          const versions = await resolveOtaVersionContext(featureId, manifestUrl, hints);
          setError({
            message: formatFeatureLoadError(featureId, raw, versions),
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
