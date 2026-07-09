# remote-rn-native-chrome Specification

## Purpose
TBD - created by archiving change remote-rn-hide-native-nav. Update Purpose after archive.
## Requirements
### Requirement: Remote RN entries hide the native navigation bar

When the native shell presents a **Remote** RN feature (`RemoteReactNativeScreenView` / `FeatureHost`), the SwiftUI navigation bar (title + toolbar) SHALL be hidden for that pushed destination.

Scheme 1 local RN entries (`LocalReactNativeScreenView`) SHALL continue to show the native navigation bar unchanged.

#### Scenario: Remote order entry is fullscreen

- **WHEN** user navigates from Native Shell menu to a Remote feature (e.g. order)
- **THEN** the SwiftUI navigation bar is not visible on the Remote RN screen
- **AND** RN content uses the full area below the status bar (safe area handled in RN)

#### Scenario: Scheme 1 local RN keeps native bar

- **WHEN** user opens a Scheme 1 RN page (e.g. HomeScreen) from the menu
- **THEN** the native navigation bar remains visible with title and system back

### Requirement: RN root screen can exit to the native shell

Remote RN features with internal stack navigation SHALL provide a user-visible control on the **root RN route** to exit the entire Remote feature and return to the Native Shell menu.

Invoking exit SHALL dismiss the Remote `NavigationStack` destination (native pop), not merely pop an internal RN route.

#### Scenario: Exit from order list root

- **WHEN** user is on `OrderList` (RN stack root)
- **AND** user taps the exit-to-native control
- **THEN** the Remote RN screen is dismissed
- **AND** user sees the Native Shell menu

#### Scenario: RN sub-route does not exit native on back

- **WHEN** user is on `OrderDetail` or `OrderTracking`
- **AND** user taps the in-content RN back control
- **THEN** the RN stack pops one level
- **AND** the user remains inside the Remote feature (not returned to Native Shell menu)

### Requirement: Native shell exposes popToNative bridge for RN

The iOS native shell SHALL expose a callable API from RN JavaScript that triggers dismissal of the current Remote RN screen (equivalent to popping the `NavigationStack` destination).

The implementation SHALL use the existing `popToNative` notification handler in `ReactNativeScreenView` (or equivalent) to call SwiftUI `dismiss()`.

#### Scenario: JS popToNative dismisses Remote screen

- **WHEN** RN JavaScript calls `popToNative()` from the root screen
- **THEN** native shell receives the request
- **AND** the Remote RN view controller destination is dismissed
- **AND** no unhandled native error is thrown

### Requirement: Internal RN navigation remains RN-owned

Remote features with multi-level pages SHALL continue to use React Navigation (or equivalent in-feature stack) for routes below the root.

Native navigation chrome SHALL NOT reappear for in-feature sub-routes in v1.

#### Scenario: Order three-level flow without native bar

- **WHEN** user navigates OrderList → OrderDetail → OrderTracking
- **THEN** native navigation bar stays hidden on all three screens
- **AND** RN back controls pop the RN stack between sub-routes
- **AND** exit-to-native is available on OrderList root only (or after popping to root)

