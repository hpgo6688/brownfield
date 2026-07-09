## 1. Shared Navigation Components

- [x] 1.1 Create `RemoteNavHeader` with `mode: 'root' | 'stack'`, `title`, and `onBack`
- [x] 1.2 Create `useRemoteNavBack(isRoot)` hook wrapping `popToNative()` vs `navigation.goBack()`
- [x] 1.3 Deprecate or remove direct use of `RemoteNativeExitRow` and `OrderBackRow` after migration

## 2. Order Navigator Polish

- [x] 2.1 Update `OrderNavigator` screenOptions: `gestureEnabled: true`, `fullScreenGestureEnabled: true` (evaluate root list conflicts)
- [x] 2.2 Migrate `OrderListScreen` to `RemoteNavHeader` root mode + adjust Hero to avoid duplicate titles
- [x] 2.3 Migrate `OrderDetailScreen` / `OrderTrackingScreen` to `RemoteNavHeader` stack mode
- [x] 2.4 Update tracking hint copy if header labels change

## 3. Promo & OTA Parity

- [x] 3.1 Migrate Metro `PromoScreen` to `RemoteNavHeader` root mode
- [x] 3.2 Migrate `bundles/ota_promo/screens/PromoScreen.tsx` similarly

## 4. Native Back Coordination (Optional v1.1)

- [x] 4.1 Spike: Swift interactive pop / `NativeShellNavigation` callback to prefer RN `goBack` when stack depth > 1 — deferred to v1.1 per design
- [x] 4.2 Document current limitation if native edge pop still dismisses entire Remote on v1

## 5. Verification

- [ ] 5.1 Simulator: order root → detail → tracking; header back + swipe-back on sub-routes
- [ ] 5.2 Root header back → Native Shell menu; Scheme 1 pages unchanged
- [x] 5.3 OTA order/promo after `build:bundles` if OTA wrappers touched

## 6. Documentation

- [x] 6.1 Update `screens/remote/README.md` with `RemoteNavHeader` conventions
- [x] 6.2 Note relationship to archived `remote-rn-hide-native-nav` and `order-react-navigation`
