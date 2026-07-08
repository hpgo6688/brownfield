// BUILD/UPLOAD ONLY — not used by Metro dev. Changes require build:bundles + upload.
import { StyleSheet, View } from 'react-native';
import { PromoList, RemoteHero } from '../../../screens/remote/components';
import { RemoteScreenShell } from '../../../screens/remote/RemoteScreenShell';

export default function PromoScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <RemoteHero
          badge="OTA · 远程 Bundle"
          badgeColor="#059669"
          heroBackground="#ECFDF5"
          title="活动"
          subtitle="v0.0.2 · OTA 远程 — 活动 bundle 已发布，检查更新后生效"
        />
        <View style={styles.card}>
          <PromoList tagColor="#059669" />
        </View>
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
});
