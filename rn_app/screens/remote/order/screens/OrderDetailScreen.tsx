import { useLayoutEffect } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OrderPageShell } from '../components/OrderPageShell';
import { getOrderById } from '../fixtures';
import type { OrderStackParamList } from '../types';

type OrderDetailRouteProp = RouteProp<OrderStackParamList, 'OrderDetail'>;
type OrderDetailNavigationProp = NativeStackNavigationProp<
  OrderStackParamList,
  'OrderDetail'
>;

export function OrderDetailScreen() {
  const navigation = useNavigation<OrderDetailNavigationProp>();
  const route = useRoute<OrderDetailRouteProp>();
  const { orderId } = route.params;
  const order = getOrderById(orderId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: order ? '订单详情' : '订单不存在',
    });
  }, [navigation, order]);

  if (!order) {
    return (
      <OrderPageShell>
        <Text style={styles.missing}>未找到订单 #{orderId}</Text>
      </OrderPageShell>
    );
  }

  return (
    <OrderPageShell>
      <View style={styles.card}>
        <Text style={styles.label}>商品</Text>
        <Text style={styles.value}>{order.title}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>订单号</Text>
        <Text style={styles.value}>#{order.id}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>金额</Text>
        <Text style={styles.value}>{order.amount}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>状态</Text>
        <Text style={styles.value}>{order.status}</Text>
      </View>

      <Pressable
        style={styles.actionButton}
        onPress={() =>
          navigation.navigate('OrderTracking', { orderId: order.id })
        }>
        <Text style={styles.actionLabel}>查看物流追踪</Text>
      </Pressable>
    </OrderPageShell>
  );
}

const styles = StyleSheet.create({
  missing: {
    fontSize: 15,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
