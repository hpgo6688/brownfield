import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { checkAndUpdateFeature } from './bundleUpdater';
import { loadFeatureBundle } from './bundleLoader';
import { getFeatureComponent } from './registerFeature';

type FeatureHostProps = {
  featureId?: string;
  manifestUrl?: string;
};

export default function FeatureHost({
  featureId,
  manifestUrl,
}: FeatureHostProps) {
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

      try {
        const updateResult = await checkAndUpdateFeature(featureId, {
          manifestUrl,
        });

        if (updateResult.bundlePath) {
          try {
            await loadFeatureBundle(updateResult.feature, {
              localPath: updateResult.bundlePath,
            });
          } catch (loadError) {
            if (!getFeatureComponent(featureId)) {
              throw loadError;
            }
          }
        }

        const component = getFeatureComponent(featureId);
        if (!component) {
          throw new Error(`Feature "${featureId}" is not available`);
        }

        if (!cancelled) {
          setScreen(() => component);
        }
      } catch (loadError) {
        const fallback = featureId ? getFeatureComponent(featureId) : null;
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
  }, [featureId, manifestUrl]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>页面加载失败</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!Screen) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>加载中…</Text>
      </View>
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
