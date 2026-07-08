//
//  ContentView.swift
//  ios_native
//
//  Created by wrong on 2026/7/8.
//

import SwiftUI

private struct LocalRNEntry: Identifiable {
    let id: String
    let title: String
    let moduleName: String
    let icon: String
}

struct ContentView: View {
    @StateObject private var manifestService = BundleManifestService()
    @StateObject private var devOtaMode = DevOtaModeModel()

    private let localEntries: [LocalRNEntry] = [
        LocalRNEntry(id: "home", title: "首页", moduleName: "HomeScreen", icon: "house"),
        LocalRNEntry(id: "profile", title: "个人中心", moduleName: "ProfileScreen", icon: "person"),
        LocalRNEntry(id: "settings", title: "设置", moduleName: "SettingsScreen", icon: "gearshape"),
    ]

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

                Section("React Native · 方案1（单 Bundle）") {
                    ForEach(localEntries) { entry in
                        NavigationLink {
                            LocalReactNativeScreenView(
                                moduleName: entry.moduleName,
                                title: entry.title
                            )
                        } label: {
                            Label(entry.title, systemImage: entry.icon)
                        }
                    }
                }

                Section("React Native · 远程业务（Remote）") {
                    if manifestService.isLoading {
                        HStack {
                            ProgressView()
                            Text("加载 Remote 入口…")
                                .foregroundStyle(.secondary)
                        }
                    } else if let errorMessage = manifestService.errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.secondary)
                            .font(.footnote)
                    } else if manifestService.features.isEmpty {
                        Text("服务端未返回 Remote 入口")
                            .foregroundStyle(.secondary)
                            .font(.footnote)
                    } else {
                        ForEach(manifestService.features) { feature in
                            NavigationLink {
                                RemoteReactNativeScreenView(
                                    featureId: feature.id,
                                    title: feature.title
                                )
                            } label: {
                                Label(feature.title, systemImage: feature.icon)
                            }
                        }
                    }
                }

                #if DEBUG
                Section("开发") {
                    HStack {
                        Text("Remote 加载模式")
                        Spacer()
                        Text(devOtaMode.isOtaMode ? "OTA" : "Metro")
                            .font(.caption.bold())
                            .foregroundStyle(devOtaMode.isOtaMode ? .green : .blue)
                    }
                    Text("在导航栏右上角切换 Metro / OTA，作用于全部 Remote 页面。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                #endif
            }
            .navigationTitle("Native Shell")
            .toolbar {
                #if DEBUG
                ToolbarItem(placement: .topBarTrailing) {
                    DevOtaModeToolbarButton()
                }
                #endif
            }
            .refreshable {
                await manifestService.load()
            }
            .task {
                await manifestService.load()
            }
        }
        .environmentObject(devOtaMode)
    }
}
