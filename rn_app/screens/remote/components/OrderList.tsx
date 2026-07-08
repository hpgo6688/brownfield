import { StyleSheet, Text, View } from 'react-native';

export type OrderItem = {
  id: string;
  title: string;
  status: string;
  amount: string;
};

const ORDERS: OrderItem[] = [
  { id: '20260708001', title: '春季限定礼盒', status: '待发货', amount: '¥128.00' },
  { id: '20260707002', title: '会员续费 · 年度', status: '已完成', amount: '¥99.00' },
  { id: '20260706003', title: '活动周边 · 帆布袋', status: '配送中', amount: '¥39.00' },
];

type OrderListProps = {
  statusColor?: string;
};

export function OrderList({ statusColor = '#EA580C' }: OrderListProps) {
  return (
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
              <Text style={[styles.status, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
});
