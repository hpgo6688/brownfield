## ADDED Requirements

### Requirement: Remote features use a unified navigation header

Remote RN screens SHALL use a shared `RemoteNavHeader` component for in-app navigation chrome instead of ad-hoc back/exit rows.

The header SHALL support at least two modes:

- **root**: back action exits to Native Shell via `popToNative()`
- **stack**: back action pops one level on the React Navigation stack

The header SHALL display a page or feature title consistent with the current route.

#### Scenario: Order list root header exits to native

- **WHEN** user is on `OrderList`
- **THEN** `RemoteNavHeader` is shown in root mode with the order feature title
- **AND** tapping back invokes `popToNative()` and returns to Native Shell menu

#### Scenario: Order detail header pops stack

- **WHEN** user is on `OrderDetail`
- **THEN** `RemoteNavHeader` is shown in stack mode
- **AND** tapping back calls React Navigation `goBack()` to `OrderList`
- **AND** `popToNative()` is NOT invoked

### Requirement: Native stack enables iOS gesture back on sub-routes

Remote multi-level navigators using `@react-navigation/native-stack` SHALL enable gesture-based back navigation on stack sub-routes (`gestureEnabled: true`).

Sub-route swipe-back SHALL be equivalent to tapping the in-header back control (pop one RN level).

#### Scenario: Swipe back from order detail

- **WHEN** user is on `OrderDetail`
- **AND** user performs the platform swipe-back gesture
- **THEN** the stack returns to `OrderList`
- **AND** the Remote feature remains open

### Requirement: Promo root uses the same header pattern

The promo Remote root screen SHALL use `RemoteNavHeader` in root mode for exit-to-native, matching order list behavior.

#### Scenario: Promo root exit

- **WHEN** user is on promo root screen
- **AND** user taps header back
- **THEN** `popToNative()` dismisses the Remote screen

## MODIFIED Requirements

### Requirement: RN root screen can exit to the native shell

Remote RN features with internal stack navigation SHALL provide a user-visible control on the **root RN route** to exit the entire Remote feature and return to the Native Shell menu.

The exit control SHALL be implemented via the shared `RemoteNavHeader` (root mode), not a separate one-off exit row component.

Invoking exit SHALL dismiss the Remote `NavigationStack` destination (native pop), not merely pop an internal RN route.

#### Scenario: Exit from order list root

- **WHEN** user is on `OrderList` (RN stack root)
- **AND** user taps the root-mode header back control
- **THEN** the Remote RN screen is dismissed
- **AND** user sees the Native Shell menu

#### Scenario: RN sub-route does not exit native on back

- **WHEN** user is on `OrderDetail` or `OrderTracking`
- **AND** user taps the stack-mode header back control or swipe-back gesture
- **THEN** the RN stack pops one level
- **AND** the user remains inside the Remote feature (not returned to Native Shell menu)
