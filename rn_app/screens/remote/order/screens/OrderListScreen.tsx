import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import { OrderList, RemoteHero } from '../../components';
import { useOrderFeatureConfig } from '../OrderFeatureContext';
import type { OrderStackParamList } from '../types';

type OrderListNavigationProp = NativeStackNavigationProp<
  OrderStackParamList,
  'OrderList'
>;

export function OrderListScreen() {
  const { statusColor, hero } = useOrderFeatureConfig();
  const navigation = useNavigation<OrderListNavigationProp>();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled">
      <RemoteHero {...hero} showTitle={false} />
      <OrderList
        statusColor={statusColor}
        onPressOrder={order =>
          navigation.navigate('OrderDetail', { orderId: order.id })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageContent: {
    flexGrow: 1,
    padding: 20,
  },
});
