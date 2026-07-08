//
//  ReactNativeScreenView.swift
//  ios_native
//

import SwiftUI
import BrownfieldLib

struct ReactNativeScreenView: View {
    var body: some View {
        ReactNativeView(moduleName: "rn_app")
            .navigationTitle("React Native")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.bar, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}
