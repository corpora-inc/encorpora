import Foundation
import StoreKit
import Tauri
import UIKit

/// Tauri plugin wrapping StoreKit 2's native subscription-management sheet.
///
/// `AppStore.showManageSubscriptions(in:)` renders the Apple-owned management
/// UI inline over the app with cancel, pricing-change, and billing controls.
/// This is the Apple-recommended surface for guideline 3.1.2 compliance and
/// works identically under TestFlight and production — the StoreKit environment
/// follows the running build.
final class SubscriptionsPlugin: Plugin {

    @objc public func showManageSubscriptions(_ invoke: Invoke) {
        if #available(iOS 15.0, *) {
            Task { @MainActor in
                guard let scene = await firstActiveWindowScene() else {
                    invoke.reject("No active UIWindowScene to present manage-subscriptions sheet")
                    return
                }
                do {
                    try await AppStore.showManageSubscriptions(in: scene)
                    invoke.resolve()
                } catch {
                    invoke.reject("showManageSubscriptions failed: \(error.localizedDescription)")
                }
            }
        } else {
            invoke.reject("Requires iOS 15 or later")
        }
    }

    @MainActor
    private func firstActiveWindowScene() async -> UIWindowScene? {
        // Prefer a foreground-active scene; fall back to any connected scene.
        let scenes = UIApplication.shared.connectedScenes
        if let active = scenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
            return active
        }
        return scenes.first as? UIWindowScene
    }
}

@_cdecl("init_plugin_subscriptions")
func initPlugin() -> Plugin {
    return SubscriptionsPlugin()
}
