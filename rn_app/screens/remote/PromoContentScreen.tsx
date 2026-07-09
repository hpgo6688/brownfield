import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  checkRemoteFeature,
  downloadPendingFeature,
  getCachedFeatureVersion,
  getPendingUpdate,
} from '../../src/features/bundleUpdater';
import { getForceOtaInDev } from '../../src/features/remoteConfig';
import { PromoList, RemoteHero } from './components';
import { remoteFeatureIds } from './featureMeta';

export type PromoContentScreenProps = {
  badge?: string;
  badgeColor?: string;
  heroBackground?: string;
  subtitle?: string;
};

export function PromoContentScreen({
  badge = 'Metro · 本地开发',
  badgeColor = '#16A34A',
  heroBackground = '#F0FD00',
  subtitle = 'v0.0.4 · Metro 本地 — 活动页 HMR 测试，无需 upload',
}: PromoContentScreenProps) {
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
      const downloaded: string[] = [];
      const alreadyPending: string[] = [];

      for (const featureId of remoteFeatureIds) {
        const pending = await getPendingUpdate(featureId);
        if (pending) {
          alreadyPending.push(`${featureId}@${pending.version}`);
          continue;
        }

        const check = await checkRemoteFeature(featureId);
        if (!check.updateAvailable) {
          continue;
        }

        const result = await downloadPendingFeature(check.remoteFeature);
        downloaded.push(`${featureId}@${result.version}`);
      }

      if (downloaded.length > 0) {
        if (getForceOtaInDev()) {
          setUpdateMessage(
            `已下载 ${downloaded.join(', ')}。页面底部将提示「立即更新」`,
          );
        } else {
          setUpdateMessage(
            `已下载 ${downloaded.join(', ')}。切换到 OTA 模式后点「立即更新」生效`,
          );
        }
        return;
      }

      if (alreadyPending.length > 0) {
        setUpdateMessage(`待更新：${alreadyPending.join(', ')}。请在页面底部点「立即更新」`);
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
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled">
      <RemoteHero
        badge={badge}
        badgeColor={badgeColor}
        heroBackground={heroBackground}
        title="活动"
        subtitle={subtitle}
        showTitle={false}
      />

      <View style={styles.card}>
        <PromoList tagColor={badgeColor} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageContent: {
    flexGrow: 1,
    padding: 20,
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
