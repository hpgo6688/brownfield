//
//  BundleManifestService.swift
//  ios_native
//

import Combine
import Foundation

enum BundleManifestConfig {
    static let defaultManifestURL = URL(string: "http://127.0.0.1:3001/api/manifest")!
}

struct RemoteFeature: Identifiable, Decodable {
    let id: String
    let title: String
    let icon: String
    let moduleName: String
    let bundleUrl: String
}

struct BundleManifest: Decodable {
    let version: Int
    let updatedAt: String
    let mode: String
    let manifestUrl: String
    let features: [RemoteFeature]
}

@MainActor
final class BundleManifestService: ObservableObject {
    @Published private(set) var features: [RemoteFeature] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    func load(manifestURL: URL = BundleManifestConfig.defaultManifestURL) async {
        isLoading = true
        errorMessage = nil

        do {
            let (data, response) = try await URLSession.shared.data(from: manifestURL)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }

            let manifest = try JSONDecoder().decode(BundleManifest.self, from: data)
            features = manifest.features
        } catch {
            features = []
            errorMessage = "无法加载服务端入口配置，请确认 bundle-server 已启动。"
        }

        isLoading = false
    }
}
