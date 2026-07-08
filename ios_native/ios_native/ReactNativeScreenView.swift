//
//  ReactNativeScreenView.swift
//  ios_native
//

import SwiftUI
import BrownfieldLib

/// Embeds RN without ignoring safe area, so content stays below the native navigation bar.
private struct EmbeddedReactNativeView: UIViewControllerRepresentable {
    let moduleName: String
    let initialProperties: [String: Any]

    func makeUIViewController(context: Context) -> UIViewController {
        ReactNativeViewController(
            moduleName: moduleName,
            initialProperties: initialProperties
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

private struct ReactNativeScreenContainer: View {
    @Environment(\.dismiss) private var dismiss

    let moduleName: String
    let title: String
    let initialProperties: [String: Any]

    var body: some View {
        EmbeddedReactNativeView(
            moduleName: moduleName,
            initialProperties: initialProperties
        )
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.bar, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onReceive(NotificationCenter.default.publisher(for: .popToNative)) { _ in
            dismiss()
        }
    }
}

/// 方案 1: direct moduleName from the main bundle.
struct LocalReactNativeScreenView: View {
    let moduleName: String
    let title: String

    var body: some View {
        ReactNativeScreenContainer(
            moduleName: moduleName,
            title: title,
            initialProperties: [:]
        )
    }
}

/// Remote entry: FeatureHost loads sub-bundles from server manifest.
struct RemoteReactNativeScreenView: View {
    let featureId: String
    let title: String
    var manifestURL: URL = BundleManifestConfig.defaultManifestURL

    var body: some View {
        ReactNativeScreenContainer(
            moduleName: "FeatureHost",
            title: title,
            initialProperties: [
                "featureId": featureId,
                "manifestUrl": manifestURL.absoluteString,
            ]
        )
    }
}

@available(*, deprecated, renamed: "RemoteReactNativeScreenView")
typealias DynamicReactNativeScreenView = RemoteReactNativeScreenView
