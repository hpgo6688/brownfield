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
import { remoteFeatureIds } from './featureMeta';
import { RemoteScreenShell } from './RemoteScreenShell';

const PROMOS = [
  { title: '夏日满减', desc: '满 199 减 30', tag: '进行中' },
  { title: '新客礼包', desc: '首单立减 20 元', tag: '限时' },
  { title: '会员日', desc: '积分双倍 · 包邮', tag: '预告' },
];

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
        <View style={styles.hero}>
          <Text style={styles.badge}>Remote · 远程业务</Text>
          <Text style={styles.title}>活动</Text>
          <Text style={styles.subtitle}>v10.0.0· 活动专区已更新，支持 OTA 热更新</Text>
        </View>

        <View style={styles.card}>
          {PROMOS.map((promo, index) => (
            <View key={promo.title}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <Text style={styles.promoDesc}>{promo.desc}</Text>
                </View>
                <Text style={styles.promoTag}>{promo.tag}</Text>
              </View>
            </View>
          ))}
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
  hero: {
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginBottom: 16,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
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
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 14,
    color: '#64748B',
  },
  promoTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
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
