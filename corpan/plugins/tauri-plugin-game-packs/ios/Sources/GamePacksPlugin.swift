import Foundation
import Tauri

private struct PackRequest: Decodable {
    let packId: String
}

private struct PackInfo: Encodable {
    let id: String
    let name: String
    let version: String?
}

final class GamePacksPlugin: Plugin {
    private let knownPacks: [PackInfo] = []

    private var activeRequests: [String: NSBundleResourceRequest] = [:]

    @objc public func listPacks(_ invoke: Invoke) {
        invoke.resolve(knownPacks)
    }

    @objc public func getManifestUrl(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(PackRequest.self)
            ensurePack(packId: args.packId, invoke: invoke)
        } catch {
            invoke.reject("Invalid args: \(error)")
        }
    }

    private func ensurePack(packId: String, invoke: Invoke) {
        let request = NSBundleResourceRequest(tags: Set([packId]))
        activeRequests[packId] = request

        request.beginAccessingResources { [weak self] error in
            if let error = error {
                self?.activeRequests.removeValue(forKey: packId)
                invoke.reject("ODR error: \(error.localizedDescription)")
                return
            }

            do {
                let manifestUrl = try self?.installPack(packId: packId) ?? ""
                self?.activeRequests.removeValue(forKey: packId)
                request.endAccessingResources()
                if manifestUrl.isEmpty {
                    invoke.reject("Manifest url missing")
                } else {
                    invoke.resolve(manifestUrl)
                }
            } catch {
                self?.activeRequests.removeValue(forKey: packId)
                request.endAccessingResources()
                invoke.reject("Install error: \(error)")
            }
        }
    }

    private func installPack(packId: String) throws -> String {
        let fm = FileManager.default
        guard let supportDir = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw NSError(domain: "corpan", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing app support dir"])
        }

        let destDir = supportDir
            .appendingPathComponent("corpan-packs", isDirectory: true)
            .appendingPathComponent(packId, isDirectory: true)

        if !fm.fileExists(atPath: destDir.path) {
            try fm.createDirectory(at: destDir, withIntermediateDirectories: true)
        }

        guard let bundleRoot = Bundle.main.resourceURL?
            .appendingPathComponent("corpan-packs")
            .appendingPathComponent(packId) else {
            throw NSError(domain: "corpan", code: 2, userInfo: [NSLocalizedDescriptionKey: "Missing bundle resources"])
        }

        try copyDirectory(from: bundleRoot, to: destDir)
        return buildManifestUrl(packId: packId)
    }

    private func buildManifestUrl(packId: String) -> String {
        return "corpan-pack://localhost/\(packId)/manifest.json"
    }

    private func copyDirectory(from source: URL, to destination: URL) throws {
        let fm = FileManager.default
        let resourceKeys: [URLResourceKey] = [.isDirectoryKey]
        let enumerator = fm.enumerator(at: source, includingPropertiesForKeys: resourceKeys)

        while let item = enumerator?.nextObject() as? URL {
            let relPath = item.path
                .replacingOccurrences(of: source.path, with: "")
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let target = destination.appendingPathComponent(relPath)
            let values = try item.resourceValues(forKeys: Set(resourceKeys))

            if values.isDirectory == true {
                if !fm.fileExists(atPath: target.path) {
                    try fm.createDirectory(at: target, withIntermediateDirectories: true)
                }
            } else {
                if fm.fileExists(atPath: target.path) {
                    try fm.removeItem(at: target)
                }
                try fm.copyItem(at: item, to: target)
            }
        }
    }
}

@_cdecl("init_plugin_game_packs")
func init_plugin_game_packs() -> Plugin {
    return GamePacksPlugin()
}
