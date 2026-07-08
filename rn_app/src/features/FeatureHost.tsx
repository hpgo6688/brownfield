import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createOfflinePlaceholder,
  remoteFeatureMeta,
  type RemoteFeatureId,
} from '../../screens/remote';
import { checkAndUpdateFeature } from './bundleUpdater';
import { loadFeatureBundle } from './bundleLoader';
import { OtaModeToggle } from './OtaModeToggle';
import {
  allowsMainBundleFallback,
  useForceOtaInDev,
} from './remoteConfig';
import { getFeatureComponent, waitForFeatureComponent } from './registerFeature';

type FeatureHostProps = {
  featureId?: string;
  manifestUrl?: string;
};

function resolveMainFeatureComponent(featureId: string): ComponentType | null {
  const registered = getFeatureComponent(featureId, { otaOnly: false });
  if (registered) {
    return registered;
  }

  const meta = remoteFeatureMeta[featureId as RemoteFeatureId];
  return meta ? createOfflinePlaceholder(meta.title) : null;
}

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
        setScreen(null);
        return;
      }

      setError(null);

      if (!forceOtaInDev) {
        const mainComponent = resolveMainFeatureComponent(featureId);
        if (mainComponent) {
          if (!cancelled) {
            setScreen(() => mainComponent);
          }
          return;
        }
      }

      if (!cancelled) {
        setScreen(null);
      }

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
            if (forceOtaInDev || !resolveMainFeatureComponent(featureId)) {
              throw loadError;
            }
          }
        } else if (forceOtaInDev) {
          throw new Error(`OTA 模式：feature "${featureId}" 没有可加载的 bundle。`);
        }

        const component =
          updateResult.bundlePath
            ? await waitForFeatureComponent(featureId, {
                otaOnly: forceOtaInDev,
              })
            : null;

        const resolvedComponent =
          component ??
          getFeatureComponent(featureId, { otaOnly }) ??
          (!otaOnly ? resolveMainFeatureComponent(featureId) : null);

        if (!resolvedComponent) {
          throw new Error(
            forceOtaInDev
              ? `OTA 模式：feature "${featureId}" 的 bundle 已加载，但组件未注册。请确认 bundle 内调用了 registerFeature。`
              : `Feature "${featureId}" is not available`,
          );
        }

        if (!cancelled) {
          setScreen(() => resolvedComponent);
        }
      } catch (loadError) {
        const fallback =
          allowsMainBundleFallback() && featureId
            ? resolveMainFeatureComponent(featureId)
            : null;

        if (fallback && !cancelled) {
          setScreen(() => fallback);
          return;
        }

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
  }, [featureId, manifestUrl, forceOtaInDev]);

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
            {__DEV__ ? (
              <Text style={styles.modeHint}>
                {forceOtaInDev ? 'OTA 模式 · 走本地缓存 + native' : 'Metro 模式 · 走主 bundle'}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.screen, __DEV__ && styles.screenWithToggle]}>
            <Screen />
          </View>
        )}
        <OtaModeToggle />
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
  screenWithToggle: {
    paddingTop: 40,
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
  modeHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
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
