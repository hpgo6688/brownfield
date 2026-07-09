import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RemoteRootHeaderBack } from '../navigation/RemoteRootHeaderBack';
import { remoteStackScreenOptions } from '../navigation/remoteStackScreenOptions';
import { OrderFeatureProvider, type OrderHeroConfig } from './OrderFeatureContext';
import { OrderDetailScreen } from './screens/OrderDetailScreen';
import { OrderListScreen } from './screens/OrderListScreen';
import { OrderTrackingScreen } from './screens/OrderTrackingScreen';
import type { OrderStackParamList } from './types';

const Stack = createNativeStackNavigator<OrderStackParamList>();

type OrderNavigatorProps = {
  statusColor?: string;
  hero: OrderHeroConfig;
};

export function OrderNavigator({
  statusColor = '#EA580C',
  hero,
}: OrderNavigatorProps) {
  return (
    <OrderFeatureProvider statusColor={statusColor} hero={hero}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={remoteStackScreenOptions}>
          <Stack.Screen
            name="OrderList"
            component={OrderListScreen}
            options={{
              title: hero.title,
              headerBackVisible: false,
              headerLeft: () => <RemoteRootHeaderBack />,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: '订单详情' }}
          />
          <Stack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ title: '物流追踪' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </OrderFeatureProvider>
  );
}
