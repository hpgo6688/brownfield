import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { OrderBackRow } from '../components/OrderBackRow';
import { OrderPageShell } from '../components/OrderPageShell';
import { getOrderById } from '../fixtures';
import type { OrderStackParamList } from '../types';

type OrderTrackingRouteProp = RouteProp<OrderStackParamList, 'OrderTracking'>;
type OrderTrackingNavigationProp = NativeStackNavigationProp<
  OrderStackParamList,
  'OrderTracking'
>;

const TRACKING_STEPS = [
  { time: '07-08 14:20', event: '包裹已揽收' },
  { time: '07-08 18:05', event: '到达区域转运中心' },
  { time: '07-09 09:30', event: '派送中' },
];

export function OrderTrackingScreen() {
  const navigation = useNavigation<OrderTrackingNavigationProp>();
  const route = useRoute<OrderTrackingRouteProp>();
  const { orderId } = route.params;
  const order = getOrderById(orderId);

  return (
    <OrderPageShell>
      <OrderBackRow title="物流追踪" onBack={() => navigation.goBack()} />

      {order ? (
        <Text style={styles.subtitle}>
          {order.title} · #{order.id}
        </Text>
      ) : (
        <Text style={styles.subtitle}>#{orderId}</Text>
      )}

      <View style={styles.card}>
        {TRACKING_STEPS.map((step, index) => (
          <View key={step.time}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.stepRow}>
              <Text style={styles.stepTime}>{step.time}</Text>
              <Text style={styles.stepEvent}>{step.event}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.hint}>子页请使用「← 返回」回到上一级；列表页点「← 菜单」退出订单功能。</Text>
    </OrderPageShell>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  stepRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepTime: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  stepEvent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
  hint: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
