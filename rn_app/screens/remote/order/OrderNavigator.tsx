import { OrderFeatureProvider, type OrderHeroConfig } from './OrderFeatureContext';
import { OrderPageStack } from './OrderPageStack';
import { OrderDetailScreen } from './screens/OrderDetailScreen';
import { OrderListScreen } from './screens/OrderListScreen';
import { OrderTrackingScreen } from './screens/OrderTrackingScreen';
import type { OrderRoute } from './types';

type OrderNavigatorProps = {
  statusColor?: string;
  hero: OrderHeroConfig;
};

function renderOrderRoute(route: OrderRoute) {
  switch (route.name) {
    case 'OrderList':
      return <OrderListScreen />;
    case 'OrderDetail':
      return <OrderDetailScreen orderId={route.params.orderId} />;
    case 'OrderTracking':
      return <OrderTrackingScreen orderId={route.params.orderId} />;
    default:
      return null;
  }
}

export function OrderNavigator({
  statusColor = '#EA580C',
  hero,
}: OrderNavigatorProps) {
  return (
    <OrderFeatureProvider statusColor={statusColor} hero={hero}>
      <OrderPageStack renderRoute={renderOrderRoute} />
    </OrderFeatureProvider>
  );
}
