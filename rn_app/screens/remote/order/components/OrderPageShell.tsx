import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type OrderPageShellProps = {
  children: ReactNode;
};

/** Full-page chrome for order sub-routes (detail, tracking). */
export function OrderPageShell({ children }: OrderPageShellProps) {
  return <View style={styles.page}>{children}</View>;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
});
