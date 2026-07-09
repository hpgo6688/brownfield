import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ORDER_FIXTURES } from '../order/fixtures';

export type OrderItem = {
  id: string;
  title: string;
  status: string;
  amount: string;
};

type OrderListProps = {
  statusColor?: string;
  onPressOrder?: (order: OrderItem) => void;
};

export function OrderList({
  statusColor = '#EA580C',
  onPressOrder,
}: OrderListProps) {
  return (
    <View style={styles.card}>
      {ORDER_FIXTURES.map((order, index) => {
        const row = (
          <View style={styles.row}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>{order.title}</Text>
              <Text style={styles.orderId}>#{order.id}</Text>
            </View>
            <View style={styles.orderMeta}>
              <Text style={styles.amount}>{order.amount}</Text>
              <Text style={[styles.status, { color: statusColor }]}>
                {order.status}
              </Text>
            </View>
          </View>
        );

        return (
          <View key={order.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {onPressOrder ? (
              <Pressable onPress={() => onPressOrder(order)}>{row}</Pressable>
            ) : (
              row
            )}
          </View>
        );
      })}
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
