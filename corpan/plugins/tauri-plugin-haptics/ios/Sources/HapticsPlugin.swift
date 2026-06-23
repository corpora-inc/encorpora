import Tauri
import UIKit
import WebKit

/// Native haptic feedback plugin for iOS.
///
/// Fire-and-forget. `impact(style:)` maps:
///   light/medium/heavy → UIImpactFeedbackGenerator
///   success/warning     → UINotificationFeedbackGenerator
/// All generator work happens on the main thread (UIKit requirement).
class HapticsPlugin: Plugin {
    @objc func impact(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ImpactArgs.self)
        let style = args.style

        // Resolve off the main thread (cheap), fire on the main thread.
        DispatchQueue.main.async {
            switch style {
            case "light":
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.prepare()
                gen.impactOccurred()
            case "heavy":
                let gen = UIImpactFeedbackGenerator(style: .heavy)
                gen.prepare()
                gen.impactOccurred()
            case "success":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.success)
            case "warning":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.warning)
            case "medium":
                fallthrough
            default:
                let gen = UIImpactFeedbackGenerator(style: .medium)
                gen.prepare()
                gen.impactOccurred()
            }
        }

        // Fire-and-forget — resolve immediately, never block on the haptic.
        invoke.resolve()
    }
}

// MARK: - Argument Types

struct ImpactArgs: Decodable {
    let style: String
}

@_cdecl("init_plugin_haptics")
func initPlugin() -> Plugin {
    return HapticsPlugin()
}
