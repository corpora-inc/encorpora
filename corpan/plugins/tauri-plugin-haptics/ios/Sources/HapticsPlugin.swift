import Tauri
import UIKit
import WebKit

/// Native haptic feedback plugin for iOS.
///
/// Fire-and-forget. `impact(style:)` maps:
///   light/medium/heavy    → UIImpactFeedbackGenerator
///   selection             → UISelectionFeedbackGenerator
///   success/warning/error → UINotificationFeedbackGenerator
/// All generator work happens on the main thread (UIKit requirement).
///
/// Adding a style is additive by construction: an unknown string already falls
/// back to `.medium`, so a caller that sends one of these to an older build
/// feels a medium impact rather than an error. That is also the trap — a
/// misspelled style is INDISTINGUISHABLE from a working one at runtime, which
/// is why Dynawalla's `haptics.test.ts` parses this file and asserts every
/// style it sends appears here as an explicit case.
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
            case "selection":
                // `UISelectionFeedbackGenerator` is not a small impact — it is
                // the OS's own "a value changed under your finger" cue, tuned
                // to stay crisp when it repeats at speed instead of turning to
                // mush the way a stream of light impacts does.
                let gen = UISelectionFeedbackGenerator()
                gen.prepare()
                gen.selectionChanged()
            case "error":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.error)
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
