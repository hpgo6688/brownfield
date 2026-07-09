## 1. Dependencies & Native Linking

- [ ] 1.1 Add `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-gesture-handler` to `rn_app/package.json` (versions compatible with RN 0.86)
- [ ] 1.2 Run `npm install` in `rn_app/`
- [ ] 1.3 Add `import 'react-native-gesture-handler'` as the first import in `rn_app/index.js`
- [ ] 1.4 Run `pod install` in `rn_app/ios/`
- [ ] 1.5 Rebuild BrownfieldLib: `npm run brownfield:package:ios:debug:sim`
- [ ] 1.6 Verify Brownfield iOS shell loads without `RNSScreenStack` / `RNGestureHandlerModule` errors

## 2. React Navigation Navigator

- [ ] 2.1 Rewrite `OrderNavigator.tsx` with `NavigationContainer` (independent) + `createNativeStackNavigator`, `headerShown: false`, routes `OrderList` / `OrderDetail` / `OrderTracking`
- [ ] 2.2 Update `types.ts` — `OrderStackParamList` for React Navigation generics
- [ ] 2.3 Update `OrderListScreen` — use `useNavigation()` to `navigate('OrderDetail', { orderId })`
- [ ] 2.4 Update `OrderDetailScreen` — use `useNavigation()` + `useRoute()` for params and tracking navigation
- [ ] 2.5 Update `OrderTrackingScreen` — use `useNavigation()` + `useRoute()`; `goBack()` via navigation
- [ ] 2.6 Remove `OrderPageStack.tsx` and `OrderNavigationContext.tsx`
- [ ] 2.7 Update `screens/remote/order/index.ts` exports if needed

## 3. OTA Build Scope

- [ ] 3.1 Extend `build-bundles.js` `isFeatureOwnedBySplit()` to include `@react-navigation/` and `react-native-screens/` (and gesture-handler if required by graph)
- [ ] 3.2 Run `npm run build:bundles` — confirm `ota_order.*.ios.jsbundle` includes navigation modules (not ~5KB stub)
- [ ] 3.3 Run `npm run verify:ota-scope`

## 4. Verification

- [ ] 4.1 Metro + Brownfield simulator smoke: list → detail → tracking → in-content back ×2
- [ ] 4.2 Upload `ota_order` bundle and OTA simulator smoke: same navigation flow
- [ ] 4.3 Confirm native toolbar back still exits entire order feature (v1 expected behavior)

## 5. Documentation

- [ ] 5.1 Update `screens/remote/README.md` — order uses React Navigation native-stack; Brownfield rebuild required
- [ ] 5.2 Update `docs/sop.md` or brownfield doc with navigation native dependency + rebuild steps
- [ ] 5.3 Note in `order-rn-multi-level-pages` or archive comment that implementation migrated to `order-react-navigation`
