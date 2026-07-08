//
//  DevOtaModeStore.swift
//  ios_native
//
//  Shared with RN via Documents/dev-ota-mode.pref (see rn_app/src/features/devOtaModeStore.ts).
//

import Foundation

enum DevOtaModeStore {
    private static let fileName = "dev-ota-mode.pref"

    private static var fileURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }

    static var isOtaMode: Bool {
        get {
            guard
                let text = try? String(contentsOf: fileURL, encoding: .utf8)
            else {
                return false
            }
            return text.trimmingCharacters(in: .whitespacesAndNewlines) == "ota"
        }
        set {
            let value = newValue ? "ota" : "metro"
            try? value.write(to: fileURL, atomically: true, encoding: .utf8)
        }
    }

    @discardableResult
    static func toggle() -> Bool {
        let next = !isOtaMode
        isOtaMode = next
        return next
    }
}
