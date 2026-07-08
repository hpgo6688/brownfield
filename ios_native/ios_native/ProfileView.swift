//
//  ProfileView.swift
//  ios_native
//

import SwiftUI

struct ProfileView: View {
    var body: some View {
        List {
            Section {
                Label("用户名", systemImage: "person.circle.fill")
                Label("账号 ID: 10001", systemImage: "number")
            }

            Section("账号") {
                Label("消息通知", systemImage: "bell")
                Label("隐私与安全", systemImage: "lock")
            }
        }
        .navigationTitle("个人中心")
    }
}
