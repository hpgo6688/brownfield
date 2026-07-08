import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { checkAndUpdateFeature } from './bundleUpdater';
import { isBundleCacheAvailable } from './bundleCache';
import {
  clearLoadedBundlesForFeature,
  loadFeatureBundle,
} from './bundleLoader';
import { getPersistedDevOtaMode } from './devOtaModeStore';
import {
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

  useEffect(() => {
    let cancelled = false;

    async function loadFeature() {
      if (!featureId) {
        setError('Missing featureId');
        setScreen(null);
        return;
      }

      setError(null);
      setScreen(null);

      clearFeatureRegistration(featureId);
      clearLoadedBundlesForFeature(featureId);

      const useOta = await resolveUseOtaMode(devOtaMode);
      if (getForceOtaInDev() !== useOta) {
        setForceOtaInDev(useOta);
      }

      if (!useOta) {
        try {
          const { loadMetroDevFeature } = await import('./metroDevFeatures');
          const component = await loadMetroDevFeature(featureId);
          if (!cancelled) {
            setScreen(() => component);
          }
        } catch (metroError) {
          if (!cancelled) {
            const message =
              metroError instanceof Error ? metroError.message : 'Unknown load error';
            setError(message);
            setScreen(null);
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

        const updateResult = await checkAndUpdateFeature(featureId, {
          manifestUrl,
        });

        if (!updateResult.bundlePath) {
          throw new Error(
            updateResult.error ??
              'OTA 模式：无可用 bundle。请确认 bundle-server 已启动、已 upload ota_* bundle，并在活动页点「检查 Remote 更新」。',
          );
        }

        await loadFeatureBundle(updateResult.feature, {
          localPath: updateResult.bundlePath,
          force: true,
          otaMode: true,
        });

        if (!getFeatureComponent(featureId, { otaOnly: true })) {
          syncOtaRegistrationFromCache(featureId);
        }

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
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : 'Unknown load error';
          setError(message);
          setScreen(null);
        }
      }
    }

    loadFeature();

    return () => {
      cancelled = true;
    };
  }, [featureId, manifestUrl, devOtaMode, otaBundleRevision]);

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
});
