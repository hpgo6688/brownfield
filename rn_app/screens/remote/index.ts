import OrderScreen from './OrderScreen';
import PromoScreen from './PromoScreen';

export const remoteFeatures = {
  order: {
    moduleName: 'OrderScreen',
    component: OrderScreen,
  },
  promo: {
    moduleName: 'PromoScreen',
    component: PromoScreen,
  },
} as const;

export type RemoteFeatureId = keyof typeof remoteFeatures;
