export type OrderRoute =
  | { name: 'OrderList' }
  | { name: 'OrderDetail'; params: { orderId: string } }
  | { name: 'OrderTracking'; params: { orderId: string } };

/** @deprecated Use OrderRoute — kept for docs/spec alignment */
export type OrderStackParamList = {
  OrderList: undefined;
  OrderDetail: { orderId: string };
  OrderTracking: { orderId: string };
};
