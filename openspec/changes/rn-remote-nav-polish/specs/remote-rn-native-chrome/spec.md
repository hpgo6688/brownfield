## MODIFIED Requirements

### Requirement: Internal RN navigation remains RN-owned

Remote features with multi-level pages SHALL use React Navigation native-stack for in-feature routes with unified `RemoteNavHeader` chrome and gesture-enabled sub-route back navigation.

Native navigation chrome SHALL NOT reappear for in-feature sub-routes.

#### Scenario: Order three-level flow without native bar

- **WHEN** user navigates OrderList → OrderDetail → OrderTracking
- **THEN** native navigation bar stays hidden on all three screens
- **AND** `RemoteNavHeader` provides back/exit on each screen appropriate to stack depth
- **AND** swipe-back on sub-routes pops the RN stack between routes
