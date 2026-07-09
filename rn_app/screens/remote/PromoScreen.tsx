import { StyleSheet, View } from 'react-native';
import { PromoNavigator } from './PromoNavigator';
import { RemoteScreenShell } from './RemoteScreenShell';

export default function PromoScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <PromoNavigator />
      </View>
    </RemoteScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
