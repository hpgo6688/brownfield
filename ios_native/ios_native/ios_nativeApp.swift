//
//  ios_nativeApp.swift
//  ios_native
//
//  Created by wrong on 2026/7/8.
//

import SwiftUI
import BrownfieldLib

/// RN LogBox expects UIApplicationDelegate.window; SwiftUI @main App does not provide it by default.
final class AppDelegate: NSObject, UIApplicationDelegate {
    var window: UIWindow?
}

@main
struct ios_nativeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        ReactNativeBrownfield.shared.bundle = ReactNativeBundle
        // Prefer Metro when running; fall back to embedded main.jsbundle in Debug XCFramework.
        ReactNativeBrownfield.shared.preferEmbeddedBundleInDebug = true
        ReactNativeBrownfield.shared.startReactNative {
            print("React Native bundle loaded")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
