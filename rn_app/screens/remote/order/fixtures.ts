import type { OrderItem } from '../components/OrderList';

export const ORDER_FIXTURES: OrderItem[] = [
  { id: '20260708001', title: '春季限定礼盒', status: '待发货', amount: '¥128.00' },
  { id: '20260707002', title: '会员续费 · 年度', status: '已完成', amount: '¥99.00' },
  { id: '20260706003', title: '活动周边 · 帆布袋', status: '配送中', amount: '¥39.00' },
];

export function getOrderById(orderId: string): OrderItem | undefined {
  return ORDER_FIXTURES.find(order => order.id === orderId);
}
