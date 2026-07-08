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
    let showsDevOtaModeToggle: Bool

    @State private var reloadToken = UUID()
    @State private var isOtaMode = DevOtaModeStore.isOtaMode

    var body: some View {
        EmbeddedReactNativeView(
            moduleName: moduleName,
            initialProperties: currentInitialProperties
        )
        .id(reloadToken)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.bar, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            #if DEBUG
            if showsDevOtaModeToggle {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        handleDevOtaModeToggle()
                    } label: {
                        Text(isOtaMode ? "OTA" : "Metro")
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(isOtaMode ? Color.green.opacity(0.15) : Color.blue.opacity(0.15))
                            .foregroundStyle(isOtaMode ? Color.green : Color.blue)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .accessibilityLabel(isOtaMode ? "OTA 模式，点击切换为 Metro" : "Metro 模式，点击切换为 OTA")
                }
            }
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .popToNative)) { _ in
            dismiss()
        }
    }

    private var currentInitialProperties: [String: Any] {
        var props = initialProperties
        #if DEBUG
        if showsDevOtaModeToggle {
            props["devOtaMode"] = isOtaMode
        }
        #endif
        return props
    }

    private func handleDevOtaModeToggle() {
        let nextOta = DevOtaModeStore.toggle()
        isOtaMode = nextOta
        reloadToken = UUID()

        let payload = "{\"type\":\"reloadFeatureRuntime\",\"devOtaMode\":\(nextOta ? "true" : "false")}"
        ReactNativeBrownfield.shared.postMessage(payload)
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
            showsDevOtaModeToggle: false
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
            showsDevOtaModeToggle: true
        )
    }
}

@available(*, deprecated, renamed: "RemoteReactNativeScreenView")
typealias DynamicReactNativeScreenView = RemoteReactNativeScreenView
