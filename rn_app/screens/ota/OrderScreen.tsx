import { StyleSheet, Text, View } from 'react-native';
import { RemoteScreenShell } from '../remote/RemoteScreenShell';

const ORDERS = [
  { id: '20260708001', title: '春季限定礼盒', status: '待发货', amount: '¥128.00' },
  { id: '20260707002', title: '会员续费 · 年度', status: '已完成', amount: '¥99.00' },
  { id: '20260706003', title: '活动周边 · 帆布袋', status: '配送中', amount: '¥39.00' },
];

export default function OrderScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>OTA · 远程 Bundle</Text>
          <Text style={styles.title}>订单</Text>
          <Text style={styles.subtitle}>
            ota_order bundle · 来自 bundle-server 的 split bundle，与 Metro dev 隔离
          </Text>
        </View>

        <View style={styles.card}>
          {ORDERS.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{order.title}</Text>
                  <Text style={styles.orderId}>#{order.id}</Text>
                </View>
                <View style={styles.orderMeta}>
                  <Text style={styles.amount}>{order.amount}</Text>
                  <Text style={styles.status}>{order.status}</Text>
                </View>
              </View>
            </View>
          ))}
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
  hero: {
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginBottom: 16,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
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
  orderInfo: {
    flex: 1,
    paddingRight: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 13,
    color: '#94A3B8',
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  status: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
});
