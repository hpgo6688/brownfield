//
//  SettingsView.swift
//  ios_native
//

import SwiftUI

struct SettingsView: View {
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    @AppStorage("darkModeEnabled") private var darkModeEnabled = false

    var body: some View {
        Form {
            Section("通用") {
                Toggle("推送通知", isOn: $notificationsEnabled)
                Toggle("深色模式", isOn: $darkModeEnabled)
            }

            Section("关于") {
                LabeledContent("版本", value: "1.0.0")
                LabeledContent("构建", value: "Debug")
            }
        }
        .navigationTitle("设置")
    }
}
