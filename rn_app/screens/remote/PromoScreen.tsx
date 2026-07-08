import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  checkAndUpdateFeature,
  getCachedFeatureVersion,
} from '../../src/features/bundleUpdater';
import { applyRemoteFeatureUpdates } from '../../src/features/featureReload';
import { getForceOtaInDev } from '../../src/features/remoteConfig';
import { PromoList, RemoteHero } from './components';
import { remoteFeatureIds } from './featureMeta';
import { RemoteScreenShell } from './RemoteScreenShell';

export default function PromoScreen() {
  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [cachedPromoVersion, setCachedPromoVersion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    getCachedFeatureVersion('promo').then(setCachedPromoVersion);
  }, [checking, updateMessage]);

  async function handleCheckUpdates() {
    setChecking(true);
    setUpdateMessage(null);

    try {
      const featureIds = [...remoteFeatureIds];
      const results = await Promise.all(
        featureIds.map(featureId => checkAndUpdateFeature(featureId)),
      );

      const updated = results.filter(result => result.updated);
      if (updated.length > 0) {
        const ids = updated.map(item => item.featureId).join(', ');
        applyRemoteFeatureUpdates(updated.map(item => item.featureId));
        if (getForceOtaInDev()) {
          setUpdateMessage(`已更新 ${ids}，正在重载…`);
          return;
        }
        setUpdateMessage(`已更新 ${ids}。切换到 OTA 模式后生效`);
        return;
      }

      setUpdateMessage('已是最新版本');
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      setUpdateMessage(message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <RemoteHero
          badge="Metro · 本地开发"
          badgeColor="#16A34A"
          heroBackground="#F0FDF4"
          title="活动"
          subtitle="v0.0.3 · Metro 本地 — 活动页 HMR 测试，无需 upload"
        />

        <View style={styles.card}>
          <PromoList tagColor="#16A34A" />
          <View style={styles.divider} />
          <Pressable
            style={styles.row}
            onPress={handleCheckUpdates}
            disabled={checking}>
            <Text style={styles.label}>检查 Remote 更新</Text>
            {checking ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.action}>立即检查</Text>
            )}
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>promo 缓存版本</Text>
            <Text style={styles.value}>{cachedPromoVersion ?? '无'}</Text>
          </View>
        </View>

        {updateMessage ? (
          <Text style={styles.updateMessage}>{updateMessage}</Text>
        ) : null}
      </View>
    </RemoteScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 15,
    color: '#64748B',
  },
  action: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
  updateMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#334155',
  },
});
