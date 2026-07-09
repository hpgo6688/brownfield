// BUILD/UPLOAD ONLY — not used by Metro dev. Changes require build:bundles + upload.
import { StyleSheet, View } from 'react-native';
import { PromoNavigator } from '../../../screens/remote/PromoNavigator';
import { RemoteScreenShell } from '../../../screens/remote/RemoteScreenShell';
import { OTA_RELEASE_VERSION } from '../../otaReleaseVersion';

export default function PromoScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <PromoNavigator
          contentProps={{
            badge: 'OTA · 远程 Bundle',
            badgeColor: '#059669',
            heroBackground: '#ECFDF5',
            subtitle: `v${OTA_RELEASE_VERSION} · OTA 远程 — 活动 polling 测试，Banner 点「立即更新」`,
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
