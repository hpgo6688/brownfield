import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="OrderList" component={OrderListScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </OrderFeatureProvider>
  );
}
