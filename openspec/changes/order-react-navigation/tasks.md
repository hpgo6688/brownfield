## 1. Dependencies & Native Linking

- [x] 1.1 Add `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-gesture-handler` to `rn_app/package.json` (versions compatible with RN 0.86)
- [x] 1.2 Run `npm install` in `rn_app/`
- [x] 1.3 Add `import 'react-native-gesture-handler'` as the first import in `rn_app/index.js`
- [x] 1.4 Run `pod install` in `rn_app/ios/`
- [ ] 1.5 Rebuild BrownfieldLib: `npm run brownfield:package:ios:debug:sim` — **in progress / 需 Xcode 重新链接 BrownfieldLib**
- [ ] 1.6 Verify Brownfield iOS shell loads without `RNSScreenStack` / `RNGestureHandlerModule` errors — **模拟器手动验证**

## 2. React Navigation Navigator

- [x] 2.1 Rewrite `OrderNavigator.tsx` with `NavigationContainer` (independent) + `createNativeStackNavigator`, `headerShown: false`, routes `OrderList` / `OrderDetail` / `OrderTracking`
- [x] 2.2 Update `types.ts` — `OrderStackParamList` for React Navigation generics
- [x] 2.3 Update `OrderListScreen` — use `useNavigation()` to `navigate('OrderDetail', { orderId })`
- [x] 2.4 Update `OrderDetailScreen` — use `useNavigation()` + `useRoute()` for params and tracking navigation
- [x] 2.5 Update `OrderTrackingScreen` — use `useNavigation()` + `useRoute()`; `goBack()` via navigation
- [x] 2.6 Remove `OrderPageStack.tsx` and `OrderNavigationContext.tsx`
- [x] 2.7 Update `screens/remote/order/index.ts` exports if needed

## 3. OTA Build Scope

- [x] 3.1 Extend `build-bundles.js` `isFeatureOwnedBySplit()` to include `@react-navigation/` and `react-native-screens/` (and gesture-handler if required by graph)
- [x] 3.2 Run `npm run build:bundles` — confirm `ota_order.*.ios.jsbundle` includes navigation modules (not ~5KB stub) — **0.0.5 ≈ 276KB**
- [x] 3.3 Run `npm run verify:ota-scope`

## 4. Verification

- [ ] 4.1 Metro + Brownfield simulator smoke: list → detail → tracking → in-content back ×2 — **需模拟器手动验证**（先完成 1.5 BrownfieldLib 重建）
- [ ] 4.2 Upload `ota_order` bundle and OTA simulator smoke: same navigation flow
- [ ] 4.3 Confirm native toolbar back still exits entire order feature (v1 expected behavior)

## 5. Documentation

- [x] 5.1 Update `screens/remote/README.md` — order uses React Navigation native-stack; Brownfield rebuild required
- [x] 5.2 Update `docs/sop.md` or brownfield doc with navigation native dependency + rebuild steps
- [x] 5.3 Note in `order-rn-multi-level-pages` or archive comment that implementation migrated to `order-react-navigation`
