//
//  ContentView.swift
//  ios_native
//
//  Created by wrong on 2026/7/8.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("原生页面") {
                    NavigationLink {
                        HomeView()
                    } label: {
                        Label("首页", systemImage: "house")
                    }

                    NavigationLink {
                        ProfileView()
                    } label: {
                        Label("个人中心", systemImage: "person")
                    }

                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("设置", systemImage: "gearshape")
                    }
                }

                Section("混合页面") {
                    NavigationLink {
                        ReactNativeScreenView()
                    } label: {
                        Label("React Native", systemImage: "bolt.horizontal")
                    }
                }
            }
            .navigationTitle("Native Shell")
        }
    }
}
