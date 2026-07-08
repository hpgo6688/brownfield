import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureFeatureCached, formatRemoteBundleError, type UpdateCheckResult } from './bundleUpdater';
import { getCachedFeatureVersion, isBundleCacheAvailable } from './bundleCache';
import {
  clearLoadedBundlesForFeature,
  loadFeatureBundle,
} from './bundleLoader';
import { getPersistedDevOtaMode } from './devOtaModeStore';
import OtaUpdateBanner from './OtaUpdateBanner';
import { useOtaUpdatePoller } from './otaUpdatePoller';
import {
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
import { fetchFeatureById } from './manifest';

type FeatureLoadError = {
  message: string;
  remoteVersion?: string | null;
  localVersion?: string | null;
};

function formatVersionLabel(version: string | null | undefined): string {
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

type FeatureHostProps = {
  featureId?: string;
  manifestUrl?: string;
  /** Passed from native shell toolbar toggle (DEBUG). */
  devOtaMode?: boolean;
};

async function resolveUseOtaMode(devOtaMode?: boolean): Promise<boolean> {
  if (!__DEV__) {
    return true;
  }

  if (typeof devOtaMode === 'boolean') {
    return devOtaMode;
  }

  return getPersistedDevOtaMode();
}

export default function FeatureHost({
  featureId,
  manifestUrl,
  devOtaMode,
}: FeatureHostProps) {
  const otaBundleRevision = useOtaBundleRevision();
  const [Screen, setScreen] = useState<ComponentType | null>(null);
  const [error, setError] = useState<FeatureLoadError | null>(null);
  const [otaModeActive, setOtaModeActive] = useState(false);
  const [screenReady, setScreenReady] = useState(false);

  const pollState = useOtaUpdatePoller({
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

        if (!updateResult.bundlePath) {
          if (!cancelled) {
            const versions = versionContextFromUpdateResult(updateResult);
            setError({
              message:
                updateResult.error ??
                formatRemoteBundleError(featureId),
              ...versions,
            });
            setScreen(null);
            setScreenReady(false);
          }
          return;
        }

        await loadFeatureBundle(updateResult.feature, {
          localPath: updateResult.bundlePath,
          force: true,
          otaMode: true,
        });

        let component = await waitForFeatureComponent(featureId, {
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
    pollState.pendingUpdate !== null &&
    !pollState.dismissed;

  const showDevPollStatus =
    __DEV__ && otaModeActive && screenReady && !showBanner && !error;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>页面加载失败</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
            {otaModeActive ? (
              <View style={styles.errorVersionBox}>
                <Text style={styles.errorVersionRow}>
                  服务端版本：{formatVersionLabel(error.remoteVersion)}
                </Text>
                <Text style={styles.errorVersionRow}>
                  本地版本：{formatVersionLabel(error.localVersion)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : !Screen ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中…</Text>
          </View>
        ) : (
          <View style={styles.screen}>
            <Screen />
            {showBanner ? (
              <OtaUpdateBanner
                pendingUpdate={pollState.pendingUpdate!}
                activeVersion={pollState.activeVersion}
                applying={pollState.applying}
                downloading={pollState.downloading}
                onApply={() => {
                  pollState.applyUpdate().catch(() => {});
                }}
                onDismiss={pollState.dismissPrompt}
              />
            ) : null}
            {showDevPollStatus ? (
              <Pressable
                style={styles.devPollStatus}
                onPress={() => {
                  pollState.pollNow().catch(() => {});
                }}>
                <Text style={styles.devPollText}>
                  {featureId} · active v{pollState.activeVersion ?? '?'} · remote v
                  {pollState.remoteVersion ?? '?'}
                  {pollState.downloading ? ' · 下载中' : ''}
                  {pollState.error ? ` · ${pollState.error}` : ''}
                </Text>
                <Text style={styles.devPollHint}>
                  {manifestUrl ?? 'default manifest'} · 点此立即检查 · 每 20s poll
                </Text>
              </Pressable>
            ) : null}
            {pollState.error && showBanner ? (
              <Text style={styles.pollError}>{pollState.error}</Text>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorVersionBox: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  errorVersionRow: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  pollError: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
    zIndex: 9998,
  },
  devPollStatus: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9998,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  devPollText: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  devPollHint: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 10,
  },
});
