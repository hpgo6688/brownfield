import { StyleSheet, View } from 'react-native';
import { OrderList, RemoteHero } from './components';
import { RemoteScreenShell } from './RemoteScreenShell';

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <RemoteHero
          badge="Metro · 本地开发"
          badgeColor="#EA580C"
          heroBackground="#FFF7ED"
          title="订单"
          subtitle="v0.0.5 · Metro 本地 — 订单页 HMR 测试，无需 upload"
        />
        <OrderList statusColor="#EA580C" />
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
