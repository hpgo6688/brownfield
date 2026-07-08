//
//  DevOtaModeModel.swift
//  ios_native
//

import BrownfieldLib
import Combine
import SwiftUI

@MainActor
final class DevOtaModeModel: ObservableObject {
    @Published private(set) var isOtaMode: Bool

    init() {
        isOtaMode = DevOtaModeStore.isOtaMode
    }

    func toggle() {
        isOtaMode = DevOtaModeStore.toggle()
        notifyReactNative()
    }

    private func notifyReactNative() {
        let payload =
            "{\"type\":\"reloadFeatureRuntime\",\"devOtaMode\":\(isOtaMode ? "true" : "false")}"
        ReactNativeBrownfield.shared.postMessage(payload)
    }
}

struct DevOtaModeToolbarButton: View {
    @EnvironmentObject private var devOtaMode: DevOtaModeModel

    var body: some View {
        Button {
            devOtaMode.toggle()
        } label: {
            Text(devOtaMode.isOtaMode ? "OTA" : "Metro")
                .font(.caption.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(devOtaMode.isOtaMode ? Color.green.opacity(0.15) : Color.blue.opacity(0.15))
                .foregroundStyle(devOtaMode.isOtaMode ? Color.green : Color.blue)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .accessibilityLabel(
            devOtaMode.isOtaMode ? "OTA 模式，点击切换为 Metro" : "Metro 模式，点击切换为 OTA"
        )
    }
}
