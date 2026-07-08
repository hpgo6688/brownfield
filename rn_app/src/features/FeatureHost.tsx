import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { loadFeatureBundle } from './bundleLoader';
import { fetchFeatureById } from './manifest';
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
        const cached = getFeatureComponent(featureId);
        if (cached) {
          if (!cancelled) {
            setScreen(() => cached);
          }
          return;
        }

        const feature = await fetchFeatureById(featureId, manifestUrl);
        await loadFeatureBundle(feature);

        const component = getFeatureComponent(featureId);
        if (!component) {
          throw new Error(`Bundle loaded but feature "${featureId}" did not register`);
        }

        if (!cancelled) {
          setScreen(() => component);
        }
      } catch (loadError) {
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
