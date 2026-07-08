//
//  ios_nativeApp.swift
//  ios_native
//
//  Created by wrong on 2026/7/8.
//

import SwiftUI
import BrownfieldLib

@main
struct ios_nativeApp: App {
    init() {
        ReactNativeBrownfield.shared.bundle = ReactNativeBundle
        ReactNativeBrownfield.shared.preferEmbeddedBundleInDebug = false
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
