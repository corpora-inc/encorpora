import UIKit
import Foundation
import Tauri

final class IOSSharePlugin: Plugin {
    @objc public func shareFile(_ invoke: Invoke) throws {
        let filePath = try invoke.parseArgs(String.self)
        let fileURL = URL(fileURLWithPath: filePath)

        // Verify file exists
        guard FileManager.default.fileExists(atPath: filePath) else {
            invoke.reject("File not found at: \(filePath)")
            return
        }

        // Log for debugging
        if let attrs = try? FileManager.default.attributesOfItem(atPath: filePath),
           let size = attrs[.size] as? Int64 {
            print("[IOSSharePlugin] Sharing file: \(filePath)")
            print("[IOSSharePlugin] File size: \(size) bytes")
        }

        // Present share sheet on main thread
        DispatchQueue.main.async {
            self.presentShareSheet(with: fileURL, invoke: invoke)
        }
    }

    private func presentShareSheet(with fileURL: URL, invoke: Invoke) {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes
            .first(where: { $0 is UIWindowScene }) as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootViewController = window.rootViewController else {
            print("[IOSSharePlugin] ERROR: Could not find root view controller")
            invoke.reject("Could not find root view controller")
            return
        }

        // Create activity view controller
        let activityViewController = UIActivityViewController(
            activityItems: [fileURL],
            applicationActivities: nil
        )

        // iPad requires popover configuration
        if let popoverController = activityViewController.popoverPresentationController {
            popoverController.sourceView = rootViewController.view
            popoverController.sourceRect = CGRect(
                x: rootViewController.view.bounds.midX,
                y: rootViewController.view.bounds.midY,
                width: 0,
                height: 0
            )
            popoverController.permittedArrowDirections = []
        }

        // Present the share sheet
        rootViewController.present(activityViewController, animated: true) {
            print("[IOSSharePlugin] Share sheet presented successfully")
            invoke.resolve()
        }
    }
}

@_cdecl("init_plugin_ios_share")
func initPlugin() -> Plugin {
    return IOSSharePlugin()
}
