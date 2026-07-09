import { createContext, useContext, type ReactNode } from 'react';

export type OrderHeroConfig = {
  badge: string;
  badgeColor: string;
  heroBackground: string;
  title: string;
  subtitle: string;
};

type OrderFeatureConfig = {
  statusColor: string;
  hero: OrderHeroConfig;
};

const OrderFeatureContext = createContext<OrderFeatureConfig | null>(null);

type OrderFeatureProviderProps = {
  statusColor: string;
  hero: OrderHeroConfig;
  children: ReactNode;
};

export function OrderFeatureProvider({
  statusColor,
  hero,
  children,
}: OrderFeatureProviderProps) {
  return (
    <OrderFeatureContext.Provider value={{ statusColor, hero }}>
      {children}
    </OrderFeatureContext.Provider>
  );
}

export function useOrderFeatureConfig(): OrderFeatureConfig {
  const context = useContext(OrderFeatureContext);
  if (!context) {
    throw new Error('useOrderFeatureConfig must be used within OrderFeatureProvider');
  }
  return context;
}
