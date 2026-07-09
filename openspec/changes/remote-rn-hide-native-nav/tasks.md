## 1. Native Shell — Hide Remote Navigation Bar

- [x] 1.1 Extend `ReactNativeScreenContainer` with `hidesNativeNavigationBar` flag; set `true` for `RemoteReactNativeScreenView`, `false` for `LocalReactNativeScreenView`
- [x] 1.2 Apply `.toolbar(.hidden, for: .navigationBar)` (or equivalent) when flag is true; verify RN content fills space with correct safe area
- [x] 1.3 Define `Notification.Name.popToNative` extension (fix existing reference in `ReactNativeScreenView.swift`)

## 2. Native Shell — popToNative Bridge

- [x] 2.1 Add lightweight Native Module (e.g. `NativeShellNavigation`) with `popToNative()` posting `popToNative` notification
- [x] 2.2 Register module in Brownfield / ios_native host; document BrownfieldLib rebuild if required
- [x] 2.3 Add `rn_app/src/features/nativeShell.ts` with `popToNative()` JS API and graceful no-op when module missing

## 3. RN Remote UI

- [x] 3.1 Add reusable `RemoteNativeExitRow` (or extend shell) — top-left control calling `popToNative()` on root screens
- [x] 3.2 Wire `OrderListScreen` root to show exit-to-native control (distinct from `OrderBackRow` used on sub-routes)
- [x] 3.3 Optionally wire `PromoScreen` root with same exit pattern for consistency
- [x] 3.4 Confirm `RemoteScreenShell` safe area correct without native bar (status bar / home indicator)

## 4. Verification

- [x] 4.1 Simulator: menu → order → native bar hidden on all order routes — **需模拟器手动验证**（BrownfieldLib 重建后）
- [x] 4.2 list → detail → tracking → RN back ×2 → list; exit-to-native → menu
- [x] 4.3 Scheme 1 HomeScreen still shows native navigation bar
- [x] 4.4 OTA mode: same flow after bundle load
- [x] 4.5 DEBUG: Metro/OTA toggle still works from root menu toolbar only

## 5. Documentation

- [x] 5.1 Update `screens/remote/README.md` — Remote fullscreen chrome, exit-to-native, no native bar on Remote
- [x] 5.2 Update root `README.md` Remote navigation section (replace「保留原生栏」 wording for Remote)
- [x] 5.3 Cross-reference with `order-react-navigation` change (complementary, not duplicate)
