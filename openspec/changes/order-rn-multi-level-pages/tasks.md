## 1. Dependencies and native linking

- [x] 1.1 Add `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, and required peer deps to `rn_app/package.json`
- [x] 1.2 Run `npm install` in `rn_app/` and `pod install` under `rn_app/ios/`
- [ ] 1.3 Rebuild BrownfieldLib — **可选**（已改用 JS Stack，不依赖 `react-native-screens`；仅当新增其他 native 模块时再执行 `brownfield:package:ios:debug:sim`）

## 2. Shared order navigation module

- [x] 2.1 Create `screens/remote/order/types.ts` with `OrderStackParamList` (`OrderList`, `OrderDetail`, `OrderTracking`)
- [x] 2.2 Create `screens/remote/order/OrderNavigator.tsx` with `NavigationContainer` + `createNativeStackNavigator`, all screens `headerShown: false`, initial route `OrderList`
- [x] 2.3 Create `screens/remote/order/screens/OrderListScreen.tsx` — composes `RemoteHero` area content + `OrderList` with `onPressOrder` → `navigate('OrderDetail', { orderId })`
- [x] 2.4 Create `screens/remote/order/screens/OrderDetailScreen.tsx` — shows order by `orderId`, in-content back row, action to open `OrderTracking`
- [x] 2.5 Create `screens/remote/order/screens/OrderTrackingScreen.tsx` — logistics demo UI, in-content back to detail
- [x] 2.6 Export shared fixtures helper (`getOrderById` or export `ORDER_FIXTURES`) from `OrderList.tsx` or `order/fixtures.ts`
- [x] 2.7 Add `screens/remote/order/index.ts` barrel exports

## 3. Shared component and screen wrappers

- [x] 3.1 Extend `OrderList` with optional `onPressOrder?: (order: OrderItem) => void`; wrap rows in `Pressable` when provided
- [x] 3.2 Refactor `screens/remote/OrderScreen.tsx` to render `RemoteScreenShell` + Metro `RemoteHero` + `OrderNavigator` (remove inline flat `OrderList`)
- [x] 3.3 Refactor `bundles/ota_order/screens/OrderScreen.tsx` to same structure with OTA `RemoteHero` badge/subtitle
- [x] 3.4 Confirm no shared file imports from `bundles/ota_*`

## 4. Verification

- [ ] 4.1 Metro smoke: open order → tap row → detail → tracking → in-content back twice → list; confirm HMR on shared screens — **需模拟器手动验证**（先完成 1.3 + `npm start`）
- [x] 4.2 Run `npm run verify:ota-scope` — main graph clean
- [x] 4.3 Run `npm run build:bundles` — `ota_order.*.ios.jsbundle` builds with navigation modules
- [ ] 4.4 OTA smoke: upload rebuilt `ota_order`, switch to OTA mode → repeat three-level navigation — upload 已完成（`order@0.0.5`）；**模拟器 OTA 模式导航待验证**

## 5. Documentation

- [x] 5.1 Update `screens/remote/README.md` with order multi-level navigation dev notes
- [x] 5.2 Update `docs/dynamic-multi-bundle.md` — order 多级页与 Metro/OTA 验证步骤；注明 v1 原生返回仍退出整个功能
