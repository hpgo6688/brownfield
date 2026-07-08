import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureFeatureCached, formatRemoteBundleError } from './bundleUpdater';
import { isBundleCacheAvailable } from './bundleCache';
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
  const [error, setError] = useState<string | null>(null);
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
        setError('Missing featureId');
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
            setError(message);
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

        const updateResult = await ensureFeatureCached(featureId, {
          manifestUrl,
        });

        if (!updateResult.bundlePath) {
          if (!cancelled) {
            setError(
              updateResult.error ??
                formatRemoteBundleError(featureId),
            );
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
          setError(formatRemoteBundleError(featureId, raw));
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
            <Text style={styles.errorBody}>{error}</Text>
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
