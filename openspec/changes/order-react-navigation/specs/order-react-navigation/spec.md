## ADDED Requirements

### Requirement: Order feature uses React Navigation native stack

The order Remote feature SHALL use `@react-navigation/native` with `@react-navigation/native-stack` (`createNativeStackNavigator`) as its internal navigation implementation, mounted via `OrderNavigator` inside `OrderScreen`.

The navigator SHALL NOT use a custom JavaScript-only stack (`useState` route array + manual `Animated` transitions) as the primary navigation mechanism after this change.

All stack screens SHALL use `headerShown: false` so the native shell navigation bar remains the feature-level chrome.

#### Scenario: Native stack renders on order entry

- **WHEN** user opens the order Remote entry from the native shell (Metro or OTA mode)
- **THEN** `OrderNavigator` renders a React Navigation native stack with `OrderList` as the initial route
- **AND** screen transitions use native-stack animations (e.g. horizontal push/pop)

#### Scenario: Stack screens do not render RN stack headers

- **WHEN** any order stack screen is visible
- **THEN** React Navigation native stack headers are hidden
- **AND** no second system-level navigation bar is rendered inside the RN view

### Requirement: Brownfield shell links navigation native dependencies

The Brownfield iOS runtime (`BrownfieldLib`) SHALL include native modules required by React Navigation native-stack:

- `react-native-screens`
- `react-native-gesture-handler`

The RN app entry (`rn_app/index.js`) SHALL import `react-native-gesture-handler` before other application imports, per React Navigation setup requirements.

#### Scenario: Metro dev in Brownfield does not crash on order navigation

- **WHEN** user opens order in Metro dev mode inside the Brownfield iOS shell after rebuilding BrownfieldLib
- **THEN** the app does not throw `RNSScreenStack` unimplemented or `RNGestureHandlerModule not found`
- **AND** navigating list → detail succeeds with native-stack transition

#### Scenario: BrownfieldLib rebuild documented

- **WHEN** a developer adds navigation native dependencies
- **THEN** project documentation describes running `pod install` and `npm run brownfield:package:ios:debug:sim` before testing in the native shell

### Requirement: Three-level order navigation behavior preserved

The order stack SHALL define routes `OrderList`, `OrderDetail`, and `OrderTracking` with the same user-visible flow as the prior multi-level implementation:

- List row tap → `OrderDetail` with `{ orderId }`
- Detail action → `OrderTracking` with `{ orderId }`
- Sub-screens provide in-content back via `OrderBackRow` that pops one level

#### Scenario: List to detail navigation

- **WHEN** user taps an order row on `OrderList`
- **THEN** the stack navigates to `OrderDetail` with that row's `orderId`
- **AND** the detail screen displays information for that `orderId`

#### Scenario: Detail to tracking navigation

- **WHEN** user triggers the tracking action on `OrderDetail`
- **THEN** the stack navigates to `OrderTracking` with the current `orderId`
- **AND** the tracking screen displays logistics-style content for that order

#### Scenario: In-content back pops one level

- **WHEN** user is on `OrderTracking` and taps the in-content back control
- **THEN** the stack returns to `OrderDetail`
- **WHEN** user is on `OrderDetail` and taps the in-content back control
- **THEN** the stack returns to `OrderList`

### Requirement: Shared navigation works on Metro and OTA paths

Order navigation sources SHALL live under `screens/remote/order/` and SHALL be imported by both Metro `screens/remote/OrderScreen.tsx` and OTA `bundles/ota_order/screens/OrderScreen.tsx`.

React Navigation and `react-native-screens` modules reachable from the order OTA entry SHALL be included in the `ota_order` split bundle output (via `build:bundles` split ownership rules).

Shared navigation modules SHALL NOT import from `bundles/ota_*`.

#### Scenario: Metro dev uses React Navigation navigator

- **WHEN** FeatureHost runs in Metro dev mode with `featureId === 'order'`
- **THEN** `screens/remote/OrderScreen.tsx` renders `OrderNavigator` backed by React Navigation
- **AND** list → detail → tracking navigation works with HMR

#### Scenario: OTA bundle includes React Navigation modules

- **WHEN** `npm run build:bundles` builds `ota_order`
- **THEN** the output `ota_order.*.ios.jsbundle` includes `OrderNavigator`, `@react-navigation/*`, and `react-native-screens` modules required at runtime
- **AND** OTA-loaded order entry supports the same three-level navigation without missing-module errors

### Requirement: Custom stack navigator removed

The order feature SHALL remove the custom navigation implementation files that duplicate React Navigation responsibilities, including at minimum:

- `OrderPageStack.tsx`
- `OrderNavigationContext.tsx`

Screens SHALL use React Navigation hooks (`useNavigation`, `useRoute`) instead of `useOrderNavigation`.

#### Scenario: No custom stack in order module

- **WHEN** inspecting `screens/remote/order/` after migration
- **THEN** `OrderPageStack.tsx` and `OrderNavigationContext.tsx` are absent
- **AND** `OrderNavigator.tsx` imports from `@react-navigation/native` and `@react-navigation/native-stack`
