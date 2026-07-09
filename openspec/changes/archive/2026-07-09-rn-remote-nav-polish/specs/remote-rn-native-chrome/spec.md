## MODIFIED Requirements

### Requirement: RN root screen can exit to the native shell

Remote RN features with internal stack navigation SHALL provide a user-visible control on the **root RN route** to exit the entire Remote feature and return to the Native Shell menu.

The exit control SHALL be implemented via the React Navigation header back control (**菜单**) on root routes, not a separate one-off in-content exit row.

Invoking exit SHALL dismiss the Remote `NavigationStack` destination (native pop), not merely pop an internal RN route.

#### Scenario: Exit from order list root

- **WHEN** user is on `OrderList` (RN stack root)
- **AND** user taps the header **菜单** control
- **THEN** the Remote RN screen is dismissed
- **AND** user sees the Native Shell menu

#### Scenario: RN sub-route does not exit native on back

- **WHEN** user is on `OrderDetail` or `OrderTracking`
- **AND** user taps the header **返回** control or swipe-back gesture
- **THEN** the RN stack pops one level
- **AND** the user remains inside the Remote feature (not returned to Native Shell menu)

### Requirement: Internal RN navigation remains RN-owned

Remote features with multi-level pages SHALL use React Navigation native-stack for in-feature routes with native-stack header chrome (`headerShown: true`) and gesture-enabled sub-route back navigation.

Native SwiftUI navigation chrome SHALL NOT reappear for in-feature sub-routes.

#### Scenario: Order three-level flow without native bar

- **WHEN** user navigates OrderList → OrderDetail → OrderTracking
- **THEN** SwiftUI navigation bar stays hidden on all three screens
- **AND** React Navigation header provides **菜单** / **返回** on each screen appropriate to stack depth
- **AND** swipe-back on sub-routes pops the RN stack between routes
