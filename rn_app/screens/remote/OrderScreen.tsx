import { StyleSheet, Text, View } from 'react-native';
import { RemoteScreenShell } from './RemoteScreenShell';

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>Remote · 远程业务</Text>
          <Text style={styles.title}>订单</Text>
          <Text style={styles.subtitle}>
            独立 Remote 入口，由 manifest 控制可见性与 OTA 更新
          </Text>
        </View>
      </View>
    </RemoteScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  hero: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EA580C',
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
});
