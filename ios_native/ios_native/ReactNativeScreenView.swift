//
//  ReactNativeScreenView.swift
//  ios_native
//

import SwiftUI
import BrownfieldLib

/// Embeds RN without ignoring safe area, so content stays below the native navigation bar.
private struct EmbeddedReactNativeView: UIViewControllerRepresentable {
    let moduleName: String

    func makeUIViewController(context: Context) -> UIViewController {
        ReactNativeViewController(moduleName: moduleName)
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct ReactNativeScreenView: View {
    @Environment(\.dismiss) private var dismiss

    let moduleName: String
    let title: String

    var body: some View {
        EmbeddedReactNativeView(moduleName: moduleName)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.bar, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .onReceive(NotificationCenter.default.publisher(for: .popToNative)) { _ in
                dismiss()
            }
    }
}
