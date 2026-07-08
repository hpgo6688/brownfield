export const remoteFeatureIds = ['order', 'promo'] as const;

export type RemoteFeatureId = (typeof remoteFeatureIds)[number];

export const remoteFeatureMeta: Record<
  RemoteFeatureId,
  { moduleName: string; title: string }
> = {
  order: { moduleName: 'OrderScreen', title: '订单' },
  promo: { moduleName: 'PromoScreen', title: '活动' },
};
