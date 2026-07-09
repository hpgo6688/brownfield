# rn-remote-nav-polish Specification

## Purpose
TBD - created by archiving change rn-remote-nav-polish. Update Purpose after archive.
## Requirements
### Requirement: Remote features use React Navigation native-stack header

Remote RN screens SHALL use React Navigation native-stack navigation chrome (`headerShown: true`) with shared screen options instead of ad-hoc in-content back/exit rows.

Root routes SHALL show a native-style header back control labeled **菜单** that invokes `popToNative()`.

Stack sub-routes SHALL use the native-stack system back control (labeled **返回**) and `goBack()` semantics.

#### Scenario: Order list root header exits to native

- **WHEN** user is on `OrderList`
- **THEN** the React Navigation header shows the order feature title
- **AND** the header back control shows **菜单**
- **AND** tapping it invokes `popToNative()` and returns to Native Shell menu

#### Scenario: Order detail header pops stack

- **WHEN** user is on `OrderDetail`
- **THEN** the React Navigation header shows **返回** and the page title
- **AND** tapping back calls React Navigation `goBack()` to `OrderList`
- **AND** `popToNative()` is NOT invoked

### Requirement: Native stack enables iOS gesture back on sub-routes

Remote multi-level navigators using `@react-navigation/native-stack` SHALL enable gesture-based back navigation on stack sub-routes (`gestureEnabled: true`, `fullScreenGestureEnabled: true` where appropriate).

Sub-route swipe-back SHALL be equivalent to tapping the header back control (pop one RN level).

Root list routes MAY disable full-screen gestures to avoid conflict with scroll views.

#### Scenario: Swipe back from order detail

- **WHEN** user is on `OrderDetail`
- **AND** user performs the platform swipe-back gesture
- **THEN** the stack returns to `OrderList`
- **AND** the Remote feature remains open

### Requirement: Promo root uses the same header pattern

The promo Remote root screen SHALL use React Navigation native-stack header with **菜单** exit-to-native, matching order list behavior.

#### Scenario: Promo root exit

- **WHEN** user is on promo root screen
- **AND** user taps header **菜单**
- **THEN** `popToNative()` dismisses the Remote screen

### Requirement: Shared remote stack screen options

Remote navigators SHALL use a shared native-stack screen options module for consistent header styling (tint color, title alignment, animation, content background).

#### Scenario: Order and promo headers look consistent

- **WHEN** user opens order or promo Remote features
- **THEN** both use the same header styling conventions from shared screen options

