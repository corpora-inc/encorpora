import Tauri
import UIKit
import WebKit
import StoreKit

class GetProductsArgs: Decodable {
    let productIds: [String]
    let productType: String
}

class PurchaseArgs: Decodable {
    let productId: String
    let productType: String?
    let offerToken: String?
    let appAccountToken: String?
}

class RestorePurchasesArgs: Decodable {
    let productType: String?
}

class GetPurchaseHistoryArgs: Decodable {}

class AcknowledgePurchaseArgs: Decodable {
    let purchaseToken: String
}

class GetProductStatusArgs: Decodable {
    let productId: String
    let productType: String?
}

/// Keep in sync with PurchaseState in guest-js/index.ts
enum PurchaseStateValue: Int {
    case purchased = 0
    case canceled = 1
    case pending = 2
}

@available(iOS 15.0, *)
class IapPlugin: Plugin {
    private var updateListenerTask: Task<Void, Error>?

    /// Backoff schedule for transient empty / network failures from
    /// Product.products(for:). iPadOS 26.4.x can return empty on the first
    /// call after install or Apple-ID change for tens of seconds; retrying
    /// punches through.
    private let productFetchDelaysNs: [UInt64] = [
        0,
        500_000_000,
        1_500_000_000,
        3_500_000_000,
    ]

    public override func load(webview: WKWebView) {
        super.load(webview: webview)

        // Drain unfinished transactions on launch — without this, a
        // reviewer's "kill app, relaunch" path can replay an old
        // confirmation. Then keep the listener running forever for live
        // updates (renewals, refunds, Ask-to-Buy approvals, family-sharing
        // changes, promoted/redeemed purchases).
        updateListenerTask = Task {
            for await result in Transaction.unfinished {
                if case .verified(let tx) = result {
                    await tx.finish()
                }
            }
            for await update in Transaction.updates {
                await self.handleTransactionUpdate(update)
            }
        }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    // MARK: - Internal helpers

    /// Retry `Product.products(for:)` with backoff while the result is empty
    /// OR a transient StoreKitError fires. Returns `.success` with whatever
    /// products StoreKit ultimately returned (which may be `[]` if the
    /// catalog truly doesn't have these IDs in this storefront), or
    /// `.failure` if every attempt threw.
    private func fetchProductsWithRetry(ids: [String]) async -> Result<[Product], Error> {
        var lastThrown: Error? = nil
        for (i, delayNs) in productFetchDelaysNs.enumerated() {
            if delayNs > 0 { try? await Task.sleep(nanoseconds: delayNs) }
            do {
                let products = try await Product.products(for: ids)
                if !products.isEmpty {
                    if i > 0 {
                        NSLog("[IapPlugin] products resolved on attempt %d/%d for %@",
                              i + 1, productFetchDelaysNs.count, ids.joined(separator: ","))
                    }
                    return .success(products)
                }
                NSLog("[IapPlugin] Product.products empty attempt %d/%d for %@",
                      i + 1, productFetchDelaysNs.count, ids.joined(separator: ","))
            } catch {
                lastThrown = error
                NSLog("[IapPlugin] Product.products threw on attempt %d/%d: %@",
                      i + 1, productFetchDelaysNs.count, String(describing: error))
            }
        }
        if let err = lastThrown { return .failure(err) }
        return .success([])
    }

    /// True iff the product is currently in the user's entitlements
    /// (verified, not revoked, not expired).
    private func isProductCurrentlyOwned(productId: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == productId,
               tx.revocationDate == nil,
               (tx.expirationDate ?? .distantFuture) > Date() {
                return true
            }
        }
        return false
    }

    /// Map a thrown error to a stable code + message understood by the JS
    /// layer. Covers every case of `Product.PurchaseError` (8 cases on iOS
    /// 26.4) and `StoreKitError` (7 cases). Anything else falls through to
    /// `UNKNOWN`.
    private func errorCodeAndMessage(_ error: Error) -> (String, String) {
        if let purchaseErr = error as? Product.PurchaseError {
            let code: String
            switch purchaseErr {
            case .invalidQuantity: code = "INVALID_QUANTITY"
            case .productUnavailable: code = "PRODUCT_UNAVAILABLE"
            case .purchaseNotAllowed: code = "PURCHASE_NOT_ALLOWED"
            case .ineligibleForOffer: code = "INELIGIBLE_FOR_OFFER"
            case .invalidOfferIdentifier: code = "INVALID_OFFER_ID"
            case .invalidOfferPrice: code = "INVALID_OFFER_PRICE"
            case .invalidOfferSignature: code = "INVALID_OFFER_SIG"
            case .missingOfferParameters: code = "MISSING_OFFER_PARAMS"
            @unknown default: code = "PURCHASE_ERROR_UNKNOWN"
            }
            return (code, purchaseErr.localizedDescription)
        }
        if let skErr = error as? StoreKitError {
            switch skErr {
            case .unknown:
                return ("STOREKIT_UNKNOWN", skErr.localizedDescription)
            case .userCancelled:
                return ("USER_CANCELLED", skErr.localizedDescription)
            case .networkError(let urlErr):
                return ("NETWORK_ERROR:\(urlErr.code.rawValue)", urlErr.localizedDescription)
            case .systemError(let inner):
                return ("SYSTEM_ERROR", String(describing: inner))
            case .notAvailableInStorefront:
                return ("NOT_IN_STOREFRONT", skErr.localizedDescription)
            case .notEntitled:
                return ("NOT_ENTITLED", skErr.localizedDescription)
            @unknown default:
                return ("STOREKIT_UNKNOWN", skErr.localizedDescription)
            }
        }
        return ("UNKNOWN", error.localizedDescription)
    }

    private func reject(_ invoke: Invoke, code: String, message: String) {
        invoke.reject("\(code): \(message)")
    }

    // MARK: - getProducts

    @objc public func getProducts(_ invoke: Invoke) async throws {
        let args = try invoke.parseArgs(GetProductsArgs.self)

        guard !args.productIds.isEmpty else {
            invoke.resolve(["products": [] as [JsonObject]])
            return
        }

        let result = await fetchProductsWithRetry(ids: args.productIds)
        let products: [Product]
        switch result {
        case .success(let ps):
            products = ps
        case .failure(let err):
            let (code, msg) = errorCodeAndMessage(err)
            reject(invoke, code: code, message: "Failed to fetch products: \(msg)")
            return
        }

        var productsArray: [JsonObject] = []

        for product in products {
            var productDict: JsonObject = [
                "productId": product.id,
                "title": product.displayName,
                "description": product.description,
                "productType": product.type.rawValue,
            ]

            // Pricing
            productDict["formattedPrice"] = product.displayPrice
            productDict["priceCurrencyCode"] = getCurrencyCode(for: product)

            // Subscription metadata
            if product.type == .autoRenewable || product.type == .nonRenewable {
                if let subscription = product.subscription {
                    var subscriptionOffers: [JsonObject] = []

                    if let introOffer = subscription.introductoryOffer {
                        // Surface StoreKit's intro-offer payment mode + real
                        // price/period so the app can detect free trials
                        // robustly (issue #16) instead of price-string
                        // heuristics.
                        let introPhase: JsonObject = [
                            "formattedPrice": introOffer.displayPrice,
                            "priceCurrencyCode": getCurrencyCode(for: product),
                            "priceAmountMicros": microsFromDecimal(introOffer.price),
                            "billingPeriod": formatSubscriptionPeriod(introOffer.period),
                            "billingCycleCount": introOffer.periodCount,
                            "recurrenceMode": 0,
                            "paymentMode": paymentModeString(introOffer.paymentMode),
                        ]
                        let offer: JsonObject = [
                            "offerToken": "",
                            "basePlanId": "",
                            "offerId": introOffer.id ?? "",
                            "pricingPhases": [introPhase],
                        ]
                        subscriptionOffers.append(offer)
                    }

                    let regularOffer: JsonObject = [
                        "offerToken": "",
                        "basePlanId": "",
                        "offerId": "",
                        "pricingPhases": [[
                            "formattedPrice": product.displayPrice,
                            "priceCurrencyCode": getCurrencyCode(for: product),
                            "priceAmountMicros": 0,
                            "billingPeriod": formatSubscriptionPeriod(subscription.subscriptionPeriod),
                            "billingCycleCount": 0,
                            "recurrenceMode": 1,
                        ]],
                    ]
                    subscriptionOffers.append(regularOffer)

                    productDict["subscriptionOfferDetails"] = subscriptionOffers
                }
            } else {
                productDict["priceAmountMicros"] = 0
            }

            productsArray.append(productDict)
        }

        invoke.resolve(["products": productsArray])
    }

    // MARK: - purchase

    @objc public func purchase(_ invoke: Invoke) async throws {
        let args = try invoke.parseArgs(PurchaseArgs.self)

        // Two-tier guard against device-level payment restrictions.
        // (1) AppStore.canMakePayments is the SK2 equivalent of
        // SKPaymentQueue.canMakePayments() and surfaces parental-control /
        // MDM / Screen-Time restrictions before we even build a sheet.
        // (2) Even when true, product.purchase() can still throw
        // .purchaseNotAllowed in a race with the user toggling controls;
        // we catch that below.
        guard AppStore.canMakePayments else {
            reject(invoke, code: "PURCHASE_NOT_ALLOWED",
                   message: "Payments are disabled on this device. Check Settings → Screen Time → Content & Privacy Restrictions.")
            return
        }

        let fetchResult = await fetchProductsWithRetry(ids: [args.productId])
        let products: [Product]
        switch fetchResult {
        case .success(let ps):
            products = ps
        case .failure(let err):
            let (code, msg) = errorCodeAndMessage(err)
            reject(invoke, code: code, message: msg)
            return
        }

        guard let product = products.first else {
            // Last-chance: if Product.products(for:) is empty but the user
            // already owns this product (e.g. a dropped network on a
            // restored device), surface ALREADY_OWNED rather than misleading
            // PRODUCT_UNAVAILABLE. JS recognises this via looksLikeAlreadyOwned
            // and resolves the flow as success.
            if await isProductCurrentlyOwned(productId: args.productId) {
                reject(invoke, code: "ALREADY_OWNED",
                       message: "Product is already in entitlements")
                return
            }
            reject(invoke, code: "PRODUCT_UNAVAILABLE",
                   message: "App Store did not return product \(args.productId) after \(productFetchDelaysNs.count) attempts")
            return
        }

        // Build purchase options
        var purchaseOptions: Set<Product.PurchaseOption> = []
        if let appAccountToken = args.appAccountToken {
            guard let uuid = UUID(uuidString: appAccountToken) else {
                reject(invoke, code: "INVALID_APP_ACCOUNT_TOKEN",
                       message: "appAccountToken must be a valid UUID string")
                return
            }
            purchaseOptions.insert(.appAccountToken(uuid))
        }

        do {
            let result = purchaseOptions.isEmpty
                ? try await product.purchase()
                : try await product.purchase(options: purchaseOptions)

            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    if #available(iOS 16.0, *) {
                        NSLog("[IapPlugin] verified purchase productId=%@ env=%@",
                              transaction.productID,
                              String(describing: transaction.environment))
                    }
                    await transaction.finish()
                    let purchase = try await createPurchaseObject(from: verification, product: product)
                    invoke.resolve(purchase)

                case .unverified(_, let verifyError):
                    reject(invoke, code: "VERIFICATION_FAILED",
                           message: String(describing: verifyError))
                }

            case .userCancelled:
                reject(invoke, code: "USER_CANCELLED", message: "Purchase cancelled by user")

            case .pending:
                // Ask-to-Buy / SCA / parental approval. Not an error —
                // the transaction will arrive on Transaction.updates if/when
                // approved. JS surfaces this as a "waiting for approval"
                // state.
                reject(invoke, code: "PURCHASE_PENDING",
                       message: "Purchase is awaiting external approval")

            @unknown default:
                reject(invoke, code: "PURCHASE_UNKNOWN",
                       message: "StoreKit returned an unrecognized PurchaseResult")
            }
        } catch {
            let (code, msg) = errorCodeAndMessage(error)
            reject(invoke, code: code, message: msg)
        }
    }

    // MARK: - restorePurchases

    @objc public func restorePurchases(_ invoke: Invoke) async throws {
        let args = try? invoke.parseArgs(RestorePurchasesArgs.self)
        var purchases: [JsonObject] = []

        for await result in Transaction.currentEntitlements {
            switch result {
            case .verified:
                guard case .verified(let transaction) = result else { continue }

                // Per-product details; if Product.products fails for ONE
                // product we log and skip rather than aborting the whole
                // restore. Restore is best-effort.
                let product: Product?
                do {
                    let fetched = try await Product.products(for: [transaction.productID])
                    product = fetched.first
                } catch {
                    NSLog("[IapPlugin] restore: failed to fetch product %@: %@",
                          transaction.productID, String(describing: error))
                    continue
                }
                guard let product = product else { continue }

                if let requestedType = args?.productType {
                    let matches: Bool
                    switch requestedType {
                    case "subs":
                        matches = (product.type == .autoRenewable || product.type == .nonRenewable)
                    case "inapp":
                        matches = (product.type == .consumable || product.type == .nonConsumable)
                    default:
                        matches = true
                    }
                    if !matches { continue }
                }

                do {
                    let purchase = try await createPurchaseObject(from: result, product: product)
                    purchases.append(purchase)
                } catch {
                    NSLog("[IapPlugin] restore: failed to build purchase object for %@: %@",
                          transaction.productID, String(describing: error))
                }

            case .unverified:
                continue
            }
        }

        invoke.resolve(["purchases": purchases])
    }

    // MARK: - getPurchaseHistory

    @objc public func getPurchaseHistory(_ invoke: Invoke) async throws {
        var history: [JsonObject] = []

        for await result in Transaction.all {
            switch result {
            case .verified(let transaction):
                let record: JsonObject = [
                    "productId": transaction.productID,
                    "purchaseTime": Int(transaction.purchaseDate.timeIntervalSince1970 * 1000),
                    "purchaseToken": String(transaction.id),
                    "quantity": transaction.purchasedQuantity,
                    "originalJson": "",
                    "signature": "",
                ]
                history.append(record)
            case .unverified:
                continue
            }
        }

        invoke.resolve(["history": history])
    }

    // MARK: - acknowledgePurchase

    @objc public func acknowledgePurchase(_ invoke: Invoke) throws {
        // iOS auto-acknowledges via transaction.finish().
        invoke.resolve(["success": true])
    }

    // MARK: - getProductStatus

    @objc public func getProductStatus(_ invoke: Invoke) async throws {
        let args = try invoke.parseArgs(GetProductStatusArgs.self)

        var statusResult: JsonObject = [
            "productId": args.productId,
            "isOwned": false,
        ]

        // Transaction.latest(for:) is more efficient than iterating
        // currentEntitlements when we only care about one product.
        guard let latest = await Transaction.latest(for: args.productId) else {
            invoke.resolve(statusResult)
            return
        }
        guard case .verified(let transaction) = latest else {
            // Unverified transaction — treat as not-owned but log so a
            // verification failure isn't silent.
            NSLog("[IapPlugin] getProductStatus: latest transaction for %@ is unverified",
                  args.productId)
            invoke.resolve(statusResult)
            return
        }

        statusResult["isOwned"] = true
        statusResult["purchaseTime"] = Int(transaction.purchaseDate.timeIntervalSince1970 * 1000)
        statusResult["purchaseToken"] = String(transaction.id)
        statusResult["isAcknowledged"] = true
        if #available(iOS 16.0, *) {
            statusResult["environment"] = String(describing: transaction.environment)
        }

        if let revocationDate = transaction.revocationDate {
            statusResult["purchaseState"] = PurchaseStateValue.canceled.rawValue
            statusResult["isOwned"] = false
            statusResult["expirationTime"] = Int(revocationDate.timeIntervalSince1970 * 1000)
        } else if let expirationDate = transaction.expirationDate {
            if expirationDate < Date() {
                statusResult["purchaseState"] = PurchaseStateValue.canceled.rawValue
                statusResult["isOwned"] = false
            } else {
                statusResult["purchaseState"] = PurchaseStateValue.purchased.rawValue
            }
            statusResult["expirationTime"] = Int(expirationDate.timeIntervalSince1970 * 1000)
        } else {
            statusResult["purchaseState"] = PurchaseStateValue.purchased.rawValue
        }

        // Subscription renewal status — fetch product (with retry on transient
        // empty), check status, exhaustively map RenewalState. RenewalState
        // is a RawRepresentable struct, not an enum — we map known states
        // and fall through `default` for any future cases.
        let productFetch = await fetchProductsWithRetry(ids: [args.productId])
        if case .success(let products) = productFetch,
           let product = products.first,
           product.type == .autoRenewable {
            do {
                if let statuses = try await product.subscription?.status {
                    for status in statuses {
                        switch status.state {
                        case .subscribed, .inGracePeriod, .inBillingRetryPeriod:
                            statusResult["isAutoRenewing"] = true
                            statusResult["purchaseState"] = PurchaseStateValue.purchased.rawValue
                            statusResult["isOwned"] = true
                        case .expired, .revoked:
                            statusResult["isAutoRenewing"] = false
                            statusResult["purchaseState"] = PurchaseStateValue.canceled.rawValue
                            statusResult["isOwned"] = false
                        default:
                            // Unknown future state — be conservative.
                            statusResult["isAutoRenewing"] = false
                            statusResult["isOwned"] = false
                        }
                        break
                    }
                }
            } catch {
                NSLog("[IapPlugin] getProductStatus: subscription.status threw for %@: %@",
                      args.productId, String(describing: error))
            }
        }

        invoke.resolve(statusResult)
    }

    // MARK: - presentOfferCodeRedeemSheet

    /// Present the App Store "Redeem Code" sheet for subscription offer codes.
    ///
    /// Prefers the StoreKit 2 `AppStore.presentOfferCodeRedeemSheet(in:)`
    /// (iOS 16+) and falls back to the StoreKit 1
    /// `SKPaymentQueue.presentCodeRedemptionSheet()` (iOS 14+) when the SK2
    /// API is unavailable. The redeemed transaction is delivered through the
    /// existing `Transaction.updates` listener (set up in `load`) — we do NOT
    /// re-implement transaction handling here.
    @objc public func presentOfferCodeRedeemSheet(_ invoke: Invoke) async throws {
        // The sheet must be presented from the active window scene on the
        // main actor.
        await MainActor.run {
            if #available(iOS 16.0, *),
               let scene = Self.activeWindowScene() {
                AppStore.presentOfferCodeRedeemSheet(in: scene)
                invoke.resolve()
                return
            }

            if #available(iOS 14.0, *) {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                invoke.resolve()
                return
            }

            self.reject(invoke, code: "NOT_ENTITLED",
                        message: "Offer code redemption requires iOS 14.0 or later")
        }
    }

    // MARK: - requestReview

    /// Request the OS-native in-app review prompt (StoreKit
    /// `SKStoreReviewController`). The OS itself throttles how often this is
    /// actually shown (~3×/year) and may show nothing — the call is always a
    /// best-effort nudge, never gated and never guaranteed to display. We
    /// resolve as soon as the request has been made.
    ///
    /// Prefers the scene-based `requestReview(in:)` (iOS 14+), falling back to
    /// the deprecated `requestReview()` when no active window scene is found.
    @objc public func requestReview(_ invoke: Invoke) async throws {
        await MainActor.run {
            if #available(iOS 14.0, *), let scene = Self.activeWindowScene() {
                SKStoreReviewController.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview()
            }
            invoke.resolve()
        }
    }

    /// Find the foreground-active `UIWindowScene` to present StoreKit sheets in.
    @MainActor
    private static func activeWindowScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes
        // Prefer the foreground-active scene; fall back to any window scene.
        if let active = scenes.first(where: {
            $0.activationState == .foregroundActive
        }) as? UIWindowScene {
            return active
        }
        return scenes.compactMap { $0 as? UIWindowScene }.first
    }

    // MARK: - Transaction.updates handler

    private func handleTransactionUpdate(_ result: VerificationResult<Transaction>) async {
        switch result {
        case .verified(let transaction):
            if #available(iOS 16.0, *) {
                NSLog("[IapPlugin] Transaction.updates verified productId=%@ env=%@",
                      transaction.productID,
                      String(describing: transaction.environment))
            }
            // Best-effort emit to JS. fetchProducts may transiently return
            // empty during a renewal storm — log but still finish the txn.
            do {
                let products = try await Product.products(for: [transaction.productID])
                if let product = products.first {
                    if let purchase = try? await createPurchaseObject(from: result, product: product) {
                        trigger("purchaseUpdated", data: purchase as! JSObject)
                    }
                }
            } catch {
                NSLog("[IapPlugin] Transaction.updates: fetch product failed for %@: %@",
                      transaction.productID, String(describing: error))
            }
            await transaction.finish()

        case .unverified(let transaction, let verifyError):
            NSLog("[IapPlugin] Transaction.updates unverified for %@: %@",
                  transaction.productID, String(describing: verifyError))
            // Don't finish unverified transactions; Apple may retry.
        }
    }

    // MARK: - Helpers for createPurchaseObject

    private func createPurchaseObject(from verificationResult: VerificationResult<Transaction>, product: Product) async throws -> JsonObject {
        guard case .verified(let transaction) = verificationResult else {
            throw NSError(domain: "IapPlugin", code: -1, userInfo: [NSLocalizedDescriptionKey: "Transaction not verified"])
        }

        var isAutoRenewing = false

        if product.type == .autoRenewable {
            do {
                if let statuses = try await product.subscription?.status {
                    for status in statuses {
                        switch status.state {
                        case .subscribed, .inGracePeriod, .inBillingRetryPeriod:
                            isAutoRenewing = true
                        default:
                            isAutoRenewing = false
                        }
                        break
                    }
                }
            } catch {
                NSLog("[IapPlugin] subscription.status threw: %@", String(describing: error))
            }
        }

        var purchase: JsonObject = [
            "orderId": String(transaction.id),
            "originalId": String(transaction.originalID),
            "jwsRepresentation": verificationResult.jwsRepresentation,
            "packageName": Bundle.main.bundleIdentifier ?? "",
            "productId": transaction.productID,
            "purchaseTime": Int(transaction.purchaseDate.timeIntervalSince1970 * 1000),
            "purchaseToken": String(transaction.id),
            "purchaseState": transaction.revocationDate == nil ? PurchaseStateValue.purchased.rawValue : PurchaseStateValue.canceled.rawValue,
            "isAutoRenewing": isAutoRenewing,
            "isAcknowledged": true,
            "originalJson": "",
            "signature": "",
        ]

        if #available(iOS 16.0, *) {
            purchase["environment"] = String(describing: transaction.environment)
        }

        return purchase
    }

    private func formatSubscriptionPeriod(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day:
            return "P\(period.value)D"
        case .week:
            return "P\(period.value)W"
        case .month:
            return "P\(period.value)M"
        case .year:
            return "P\(period.value)Y"
        @unknown default:
            return "P1M"
        }
    }

    /// Convert a StoreKit `Decimal` price into integer micros
    /// (price × 1,000,000), matching the Android `priceAmountMicros`
    /// convention. Uses NSDecimalNumber to avoid binary-float rounding.
    private func microsFromDecimal(_ price: Decimal) -> Int {
        let micros = price * Decimal(1_000_000)
        return NSDecimalNumber(decimal: micros).intValue
    }

    /// Map StoreKit's intro-offer payment mode to a stable string understood
    /// by the JS layer: "freeTrial" / "payAsYouGo" / "payUpFront".
    private func paymentModeString(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        default: return "payUpFront"
        }
    }

    private func getCurrencyCode(for product: Product) -> String {
        if #available(iOS 16.0, *) {
            return product.priceFormatStyle.locale.currency?.identifier ?? ""
        } else {
            return ""
        }
    }
}

@_cdecl("init_plugin_iap")
func initPlugin() -> Plugin {
    if #available(iOS 15.0, *) {
        return IapPlugin()
    } else {
        class DummyPlugin: Plugin {
            @objc func getProducts(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func purchase(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func restorePurchases(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func getPurchaseHistory(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func acknowledgePurchase(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func getProductStatus(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func presentOfferCodeRedeemSheet(_ invoke: Invoke) {
                invoke.reject("NOT_ENTITLED: IAP requires iOS 15.0 or later")
            }
            @objc func requestReview(_ invoke: Invoke) {
                // The review prompt is best-effort; on a pre-iOS-15 device we
                // simply resolve without showing anything.
                invoke.resolve()
            }
        }
        return DummyPlugin()
    }
}
