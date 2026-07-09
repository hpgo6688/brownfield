// BUILD/UPLOAD ONLY — not used by Metro dev. Changes require build:bundles + upload.
import { StyleSheet, View } from 'react-native';
import { OrderNavigator } from '../../../screens/remote/order';
import { RemoteScreenShell } from '../../../screens/remote/RemoteScreenShell';
import { OTA_RELEASE_VERSION } from '../../otaReleaseVersion';

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <OrderNavigator
          statusColor="#059669"
          hero={{
            badge: 'OTA · 远程 Bundle',
            badgeColor: '#059669',
            heroBackground: '#ECFDF5',
            title: '订单',
            subtitle: `v${OTA_RELEASE_VERSION} · OTA 远程 — 订单多级页，Banner 点「立即更新」`,
          }}
        />
      </View>
    </RemoteScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
