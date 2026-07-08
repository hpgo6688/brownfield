// BUILD/UPLOAD ONLY — not used by Metro dev. Changes require build:bundles + upload.
import { StyleSheet, View } from 'react-native';
import { OrderList, RemoteHero } from '../../../screens/remote/components';
import { RemoteScreenShell } from '../../../screens/remote/RemoteScreenShell';

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <RemoteHero
          badge="OTA · 远程 Bundle"
          badgeColor="#059669"
          heroBackground="#ECFDF5"
          title="订单"
          subtitle="v0.0.2 · OTA 远程 — 订单 bundle 已发布，检查更新后生效"
        />
        <OrderList statusColor="#059669" />
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
});
