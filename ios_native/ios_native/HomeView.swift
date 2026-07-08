//
//  HomeView.swift
//  ios_native
//

import SwiftUI

struct HomeView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "house.fill")
                .font(.system(size: 48))
                .foregroundStyle(.tint)

            Text("首页")
                .font(.title.bold())

            Text("这是原生 SwiftUI 页面，不依赖 React Native。")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("首页")
    }
}
