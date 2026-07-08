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

                Section("React Native") {
                    NavigationLink {
                        ReactNativeScreenView(moduleName: "HomeScreen", title: "首页")
                    } label: {
                        Label("首页", systemImage: "house")
                    }

                    NavigationLink {
                        ReactNativeScreenView(moduleName: "ProfileScreen", title: "个人中心")
                    } label: {
                        Label("个人中心", systemImage: "person")
                    }

                    NavigationLink {
                        ReactNativeScreenView(moduleName: "SettingsScreen", title: "设置")
                    } label: {
                        Label("设置", systemImage: "gearshape")
                    }
                }
            }
            .navigationTitle("Native Shell")
        }
    }
}
