## ADDED Requirements

### Requirement: Order feature hosts an internal RN stack navigator

The order Remote feature SHALL mount a React Navigation native stack (`OrderNavigator`) as the root navigation tree inside `OrderScreen`, below the optional `RemoteHero` wrapper.

The navigator SHALL define at least three routes: `OrderList`, `OrderDetail`, and `OrderTracking`.

The navigator SHALL use `headerShown: false` on all screens so the native shell navigation bar remains the feature-level chrome.

#### Scenario: Navigator is initial route on order entry

- **WHEN** user opens the order Remote entry from the native shell (Metro or OTA mode)
- **THEN** `OrderNavigator` renders with `OrderList` as the initial screen
- **AND** the native navigation bar title remains the order menu label (e.g. 「订单」)

#### Scenario: Stack screens do not render RN stack headers

- **WHEN** any order stack screen is visible
- **THEN** React Navigation native stack headers are hidden
- **AND** no second system-level navigation bar is rendered inside the RN view

### Requirement: Users can navigate three levels within order

The order list screen SHALL allow tapping an order row to navigate to `OrderDetail` with `{ orderId }`.

The order detail screen SHALL allow navigating to `OrderTracking` with the same `orderId`.

Each sub-screen (`OrderDetail`, `OrderTracking`) SHALL provide an in-content back control that pops one level on the RN stack.

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

### Requirement: Shared order navigation works on Metro and OTA paths

Order navigation sources (navigator, stack screens, param types) SHALL live under `screens/remote/order/` and SHALL be imported by both Metro `screens/remote/OrderScreen.tsx` and OTA `bundles/ota_order/screens/OrderScreen.tsx`.

Metro and OTA order wrappers SHALL differ only in mode-specific presentation (e.g. `RemoteHero` badge / subtitle), not in route definitions or screen implementations.

Shared navigation modules SHALL NOT import from `bundles/ota_*`.

#### Scenario: Metro dev uses shared navigator

- **WHEN** FeatureHost runs in Metro dev mode with `featureId === 'order'`
- **THEN** `screens/remote/OrderScreen.tsx` renders `OrderNavigator` from `screens/remote/order/`
- **AND** list → detail → tracking navigation works with HMR

#### Scenario: OTA bundle includes shared navigator

- **WHEN** `npm run build:bundles` builds `ota_order`
- **THEN** the output `ota_order.*.ios.jsbundle` includes modules from `screens/remote/order/` reachable via `bundles/ota_order/screens/OrderScreen.tsx`
- **AND** OTA-loaded order entry supports the same three-level navigation

### Requirement: OrderList supports optional press navigation

The shared `OrderList` component SHALL accept an optional `onPressOrder` callback.

When `onPressOrder` is provided, each order row SHALL be pressable and invoke the callback with the row's `OrderItem`.

When `onPressOrder` is omitted, `OrderList` SHALL render read-only rows (existing behavior for non-navigating callers).

#### Scenario: Order list screen wires navigation

- **WHEN** `OrderListScreen` renders `OrderList` with `onPressOrder`
- **THEN** tapping a row calls `navigation.navigate('OrderDetail', { orderId: order.id })`

#### Scenario: Read-only list without callback

- **WHEN** a consumer renders `OrderList` without `onPressOrder`
- **THEN** rows are not pressable
- **AND** list presentation is unchanged from the prior read-only layout
