import { StyleSheet, View } from 'react-native';
import { OrderNavigator } from './order';
import { RemoteScreenShell } from './RemoteScreenShell';

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <OrderNavigator
          statusColor="#EA580C"
          hero={{
            badge: 'Metro · 本地开发',
            badgeColor: '#EA580C',
            heroBackground: '#FFF7ED',
            title: '订单',
            subtitle: 'v0.0.5 · Metro 本地 — 订单多级页 HMR 测试，无需 upload',
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
