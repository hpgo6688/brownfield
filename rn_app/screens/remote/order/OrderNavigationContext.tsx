import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { OrderRoute } from './types';

type OrderNavigationContextValue = {
  navigate: (route: Exclude<OrderRoute, { name: 'OrderList' }>) => void;
  goBack: () => void;
};

const OrderNavigationContext = createContext<OrderNavigationContextValue | null>(
  null,
);

type OrderNavigationProviderProps = {
  value: OrderNavigationContextValue;
  children: ReactNode;
};

export function OrderNavigationProvider({
  value,
  children,
}: OrderNavigationProviderProps) {
  const memoized = useMemo(() => value, [value]);
  return (
    <OrderNavigationContext.Provider value={memoized}>
      {children}
    </OrderNavigationContext.Provider>
  );
}

export function useOrderNavigation(): OrderNavigationContextValue {
  const context = useContext(OrderNavigationContext);
  if (!context) {
    throw new Error('useOrderNavigation must be used within OrderNavigationProvider');
  }
  return context;
}
