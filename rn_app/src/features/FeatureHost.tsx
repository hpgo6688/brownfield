import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { checkAndUpdateFeature } from './bundleUpdater';
import { loadFeatureBundle } from './bundleLoader';
import { OtaModeToggle } from './OtaModeToggle';
import {
  allowsMainBundleFallback,
  useForceOtaInDev,
} from './remoteConfig';
import { getFeatureComponent } from './registerFeature';

type FeatureHostProps = {
  featureId?: string;
  manifestUrl?: string;
};

export default function FeatureHost({
  featureId,
  manifestUrl,
}: FeatureHostProps) {
  const forceOtaInDev = useForceOtaInDev();
  const [Screen, setScreen] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeature() {
      if (!featureId) {
        setError('Missing featureId');
        return;
      }

      setError(null);
      setScreen(null);

      const otaOnly = forceOtaInDev;

      try {
        const updateResult = await checkAndUpdateFeature(featureId, {
          manifestUrl,
        });

        if (forceOtaInDev && !updateResult.bundlePath) {
          throw new Error(
            updateResult.error ??
              'OTA 模式：无缓存 bundle。请先上传到 bundle-server，再在活动页点「检查 Remote 更新」。',
          );
        }

        if (updateResult.bundlePath) {
          try {
            await loadFeatureBundle(updateResult.feature, {
              localPath: updateResult.bundlePath,
            });
          } catch (loadError) {
            if (forceOtaInDev || !getFeatureComponent(featureId)) {
              throw loadError;
            }
          }
        } else if (forceOtaInDev) {
          throw new Error(`OTA 模式：feature "${featureId}" 没有可加载的 bundle。`);
        }

        const component = getFeatureComponent(featureId, { otaOnly });
        if (!component) {
          throw new Error(`Feature "${featureId}" is not available`);
        }

        if (!cancelled) {
          setScreen(() => component);
        }
      } catch (loadError) {
        const fallback =
          allowsMainBundleFallback() && featureId
            ? getFeatureComponent(featureId)
            : null;
        if (fallback && !cancelled) {
          setScreen(() => fallback);
          return;
        }

        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : 'Unknown load error';
          setError(message);
        }
      }
    }

    loadFeature();

    return () => {
      cancelled = true;
    };
  }, [featureId, manifestUrl, forceOtaInDev]);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <OtaModeToggle />
          <Text style={styles.errorTitle}>页面加载失败</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!Screen) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <OtaModeToggle />
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return <Screen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F2F2F7',
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
