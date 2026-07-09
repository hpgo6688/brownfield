//
//  ReactNativeScreenView.swift
//  ios_native
//

import SwiftUI
import BrownfieldLib

/// Embeds RN; Remote entries use fullscreen chrome (no native navigation bar).
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
    @EnvironmentObject private var devOtaMode: DevOtaModeModel

    let moduleName: String
    let title: String
    let initialProperties: [String: Any]
    let passesDevOtaMode: Bool
    let hidesNativeNavigationBar: Bool

    @State private var reloadToken = UUID()

    var body: some View {
        EmbeddedReactNativeView(
            moduleName: moduleName,
            initialProperties: currentInitialProperties
        )
        .id(reloadToken)
        .modifier(
            NativeNavigationChromeModifier(
                title: title,
                hidesNativeNavigationBar: hidesNativeNavigationBar
            )
        )
        .onChange(of: devOtaMode.isOtaMode) { _, _ in
            reloadToken = UUID()
        }
        .onReceive(NotificationCenter.default.publisher(for: .popToNative)) { _ in
            dismiss()
        }
    }

    private var currentInitialProperties: [String: Any] {
        var props = initialProperties
        #if DEBUG
        if passesDevOtaMode {
            props["devOtaMode"] = devOtaMode.isOtaMode
        }
        #endif
        return props
    }
}

private struct NativeNavigationChromeModifier: ViewModifier {
    let title: String
    let hidesNativeNavigationBar: Bool

    func body(content: Content) -> some View {
        if hidesNativeNavigationBar {
            content
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
        } else {
            content
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(.bar, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
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
            initialProperties: [:],
            passesDevOtaMode: false,
            hidesNativeNavigationBar: false
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
            ],
            passesDevOtaMode: true,
            hidesNativeNavigationBar: true
        )
    }
}

@available(*, deprecated, renamed: "RemoteReactNativeScreenView")
typealias DynamicReactNativeScreenView = RemoteReactNativeScreenView
