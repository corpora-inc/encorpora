import GoogleMobileAds
import Tauri
import UIKit

class AdmobPlugin: Plugin {
    private var interstitialAd: GADInterstitialAd?
    private var rewardedAd: GADRewardedAd?
    private var isInitialized = false

    // Default test ad unit IDs (Google's official test ads)
    private let testInterstitialId = "ca-app-pub-3940256099942544/4411468910"
    private let testRewardedId = "ca-app-pub-3940256099942544/1712485313"

    override init() {
        super.init()
    }

    // MARK: - Plugin Commands

    @objc func initAdmob(_ invoke: Invoke) throws {
        if isInitialized {
            invoke.resolve()
            return
        }

        DispatchQueue.main.async { [weak self] in
            GADMobileAds.sharedInstance().start { status in
                print("[ADMOB] SDK initialized: \(status.adapterStatusesByClassName)")
                self?.isInitialized = true

                // Pre-load ads after init
                self?.preloadInterstitial(adUnitId: nil)
                self?.preloadRewarded(adUnitId: nil)

                invoke.resolve()
            }
        }
    }

    @objc func loadInterstitial(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(AdUnitArgs.self)
        preloadInterstitial(adUnitId: args.adUnitId)
        invoke.resolve()
    }

    @objc func showInterstitial(_ invoke: Invoke) throws {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                invoke.resolve(["shown": false, "rewarded": false, "error": "plugin deallocated"])
                return
            }

            guard let ad = self.interstitialAd else {
                // No ad loaded — try loading one for next time
                self.preloadInterstitial(adUnitId: nil)
                invoke.resolve(["shown": false, "rewarded": false, "error": "no interstitial loaded"])
                return
            }

            guard let rootVC = self.getRootViewController() else {
                invoke.resolve(["shown": false, "rewarded": false, "error": "no root view controller"])
                return
            }

            let delegate = InterstitialDelegate { [weak self] in
                // Ad dismissed — preload next one
                self?.interstitialAd = nil
                self?.preloadInterstitial(adUnitId: nil)
                invoke.resolve(["shown": true, "rewarded": false])
            }

            // Store delegate to prevent deallocation
            objc_setAssociatedObject(ad, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            ad.fullScreenContentDelegate = delegate

            ad.present(fromRootViewController: rootVC)
        }
    }

    @objc func loadRewarded(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(AdUnitArgs.self)
        preloadRewarded(adUnitId: args.adUnitId)
        invoke.resolve()
    }

    @objc func showRewarded(_ invoke: Invoke) throws {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                invoke.resolve(["shown": false, "rewarded": false, "error": "plugin deallocated"])
                return
            }

            guard let ad = self.rewardedAd else {
                self.preloadRewarded(adUnitId: nil)
                invoke.resolve(["shown": false, "rewarded": false, "error": "no rewarded ad loaded"])
                return
            }

            guard let rootVC = self.getRootViewController() else {
                invoke.resolve(["shown": false, "rewarded": false, "error": "no root view controller"])
                return
            }

            var userEarnedReward = false

            let delegate = RewardedDelegate { [weak self] in
                self?.rewardedAd = nil
                self?.preloadRewarded(adUnitId: nil)
                invoke.resolve(["shown": true, "rewarded": userEarnedReward])
            }

            objc_setAssociatedObject(ad, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            ad.fullScreenContentDelegate = delegate

            ad.present(fromRootViewController: rootVC) {
                userEarnedReward = true
                print("[ADMOB] User earned reward: \(ad.adReward.amount) \(ad.adReward.type)")
            }
        }
    }

    // MARK: - Private

    private func preloadInterstitial(adUnitId: String?) {
        let unitId = adUnitId ?? testInterstitialId
        GADInterstitialAd.load(withAdUnitID: unitId, request: GADRequest()) { [weak self] ad, error in
            if let error = error {
                print("[ADMOB] Interstitial load failed: \(error.localizedDescription)")
                return
            }
            self?.interstitialAd = ad
            print("[ADMOB] Interstitial loaded")
        }
    }

    private func preloadRewarded(adUnitId: String?) {
        let unitId = adUnitId ?? testRewardedId
        GADRewardedAd.load(withAdUnitID: unitId, request: GADRequest()) { [weak self] ad, error in
            if let error = error {
                print("[ADMOB] Rewarded load failed: \(error.localizedDescription)")
                return
            }
            self?.rewardedAd = ad
            print("[ADMOB] Rewarded loaded")
        }
    }

    private func getRootViewController() -> UIViewController? {
        if #available(iOS 15.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }?
                .rootViewController
        } else {
            return UIApplication.shared.windows.first { $0.isKeyWindow }?.rootViewController
        }
    }
}

// MARK: - Delegates

private class InterstitialDelegate: NSObject, GADFullScreenContentDelegate {
    let onDismiss: () -> Void

    init(onDismiss: @escaping () -> Void) {
        self.onDismiss = onDismiss
    }

    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        onDismiss()
    }

    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[ADMOB] Failed to present: \(error.localizedDescription)")
        onDismiss()
    }
}

private class RewardedDelegate: NSObject, GADFullScreenContentDelegate {
    let onDismiss: () -> Void

    init(onDismiss: @escaping () -> Void) {
        self.onDismiss = onDismiss
    }

    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        onDismiss()
    }

    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[ADMOB] Failed to present rewarded: \(error.localizedDescription)")
        onDismiss()
    }
}

// MARK: - Argument Types

struct AdUnitArgs: Decodable {
    let adUnitId: String?
}

@_cdecl("init_plugin_admob")
func initPlugin() -> Plugin {
    return AdmobPlugin()
}
