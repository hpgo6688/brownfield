import Foundation

extension Notification.Name {
    /// Posted from RN (`NativeShellNavigation.popToNative`) to dismiss Remote stack destination.
    static let popToNative = Notification.Name("PopToNative")
}
