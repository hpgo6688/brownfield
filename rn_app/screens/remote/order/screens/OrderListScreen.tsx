import { ScrollView, StyleSheet } from 'react-native';
import { OrderList, RemoteHero } from '../../components';
import { useOrderFeatureConfig } from '../OrderFeatureContext';
import { useOrderNavigation } from '../OrderNavigationContext';

export function OrderListScreen() {
  const { statusColor, hero } = useOrderFeatureConfig();
  const { navigate } = useOrderNavigation();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled">
      <RemoteHero {...hero} />
      <OrderList
        statusColor={statusColor}
        onPressOrder={order =>
          navigate({ name: 'OrderDetail', params: { orderId: order.id } })
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
