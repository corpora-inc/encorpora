package app.tauri.iap

import android.app.Activity
import android.webkit.WebView
import app.tauri.Logger
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import com.android.billingclient.api.*
import com.google.android.play.core.review.ReviewManagerFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

@InvokeArg
class GetProductsArgs {
    var productIds: List<String> = emptyList()
    var productType: String = "subs" // "subs" or "inapp"
}

@InvokeArg
class PurchaseArgs {
    var productId: String = ""
    var productType: String = "subs" // "subs" or "inapp"
    var offerToken: String? = null
    var obfuscatedAccountId: String? = null
    var obfuscatedProfileId: String? = null
    var oldPurchaseToken: String? = null
    var subscriptionReplacementMode: Int? = null
}

@InvokeArg
class RestorePurchasesArgs {
    var productType: String = "subs" // "subs" or "inapp"
}

@InvokeArg
class GetPurchaseHistoryArgs

@InvokeArg
class AcknowledgePurchaseArgs {
    var purchaseToken: String? = null
}

@InvokeArg
class GetProductStatusArgs {
    var productId: String = ""
    var productType: String = "subs" // "subs" or "inapp"
}

@TauriPlugin
class IapPlugin(private val activity: Activity): Plugin(activity), PurchasesUpdatedListener, BillingClientStateListener {
    private lateinit var billingClient: BillingClient
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private var pendingPurchaseInvoke: Invoke? = null
    private val TAG = "IapPlugin"
    
    // Keep in sync with PurchaseState in guest-js/index.ts
    companion object {
        const val PURCHASE_STATE_PURCHASED = 0
        const val PURCHASE_STATE_CANCELED = 1
        const val PURCHASE_STATE_PENDING = 2

        fun translatePurchaseState(state: Int): Int = when(state) {
            Purchase.PurchaseState.PURCHASED -> PURCHASE_STATE_PURCHASED
            Purchase.PurchaseState.PENDING -> PURCHASE_STATE_PENDING
            else -> PURCHASE_STATE_CANCELED
        }

        fun translateProductType(productType: String): String = when(productType) {
            "inapp" -> BillingClient.ProductType.INAPP
            else -> BillingClient.ProductType.SUBS
        }
    }
    
    override fun load(webView: WebView) {
        super.load(webView)
        initializeBillingClient()
    }
    
    private fun initializeBillingClient() {
        var params = PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build();

        billingClient = BillingClient.newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(params)
            .enableAutoServiceReconnection()
            .build()

        billingClient.startConnection(this)
    }
    
    @Command
    fun getProducts(invoke: Invoke) {
        val args = invoke.parseArgs(GetProductsArgs::class.java)
        
        if (!billingClient.isReady) {
            invoke.reject("STOREKIT_UNKNOWN: Billing client not ready")
            return
        }
        
        val productType = translateProductType(args.productType)
        
        val productList = args.productIds.map { productId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(productType)
                .build()
        }
        
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()
        
        billingClient.queryProductDetailsAsync(params) { billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val products = JSObject()
                val productsArray = productDetailsResult.productDetailsList?.map { productDetails ->
                    JSObject().apply {
                        put("productId", productDetails.productId)
                        put("title", productDetails.title)
                        put("description", productDetails.description)
                        put("productType", productDetails.productType)
                        
                        // For subscriptions, include offer details
                        if (productDetails.productType == BillingClient.ProductType.SUBS) {
                            val subscriptionOfferDetails = productDetails.subscriptionOfferDetails
                            if (!subscriptionOfferDetails.isNullOrEmpty()) {
                                val offers = subscriptionOfferDetails.map { offer ->
                                    JSObject().apply {
                                        put("offerToken", offer.offerToken)
                                        put("basePlanId", offer.basePlanId)
                                        put("offerId", offer.offerId)
                                        
                                        // Pricing phases
                                        val pricingPhases = offer.pricingPhases.pricingPhaseList.map { phase ->
                                            JSObject().apply {
                                                put("formattedPrice", phase.formattedPrice)
                                                put("priceCurrencyCode", phase.priceCurrencyCode)
                                                put("priceAmountMicros", phase.priceAmountMicros)
                                                put("billingPeriod", phase.billingPeriod)
                                                put("billingCycleCount", phase.billingCycleCount)
                                                put("recurrenceMode", phase.recurrenceMode)
                                            }
                                        }
                                        put("pricingPhases", JSONArray(pricingPhases))
                                    }
                                }
                                put("subscriptionOfferDetails", JSONArray(offers))
                            }
                        } else {
                            // For one-time products
                            val oneTimePurchaseOfferDetails = productDetails.oneTimePurchaseOfferDetails
                            if (oneTimePurchaseOfferDetails != null) {
                                put("formattedPrice", oneTimePurchaseOfferDetails.formattedPrice)
                                put("priceCurrencyCode", oneTimePurchaseOfferDetails.priceCurrencyCode)
                                put("priceAmountMicros", oneTimePurchaseOfferDetails.priceAmountMicros)
                            }
                        }
                    }
                }
                products.put("products", JSONArray(productsArray))
                invoke.resolve(products)
            } else {
                invoke.reject("NETWORK_ERROR: Failed to fetch products: ${billingResult.debugMessage}")
            }
        }
    }
    
    @Command
    fun purchase(invoke: Invoke) {
        val args = invoke.parseArgs(PurchaseArgs::class.java)
        
        if (!billingClient.isReady) {
            invoke.reject("STOREKIT_UNKNOWN: Billing client not ready")
            return
        }
        
        pendingPurchaseInvoke = invoke
        
        val productType = translateProductType(args.productType)
        
        // First, get the product details
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(args.productId)
                .setProductType(productType)
                .build()
        )
        
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()
        
        billingClient.queryProductDetailsAsync(params) { billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && productDetailsResult.productDetailsList.isNotEmpty()) {
                val productDetails = productDetailsResult.productDetailsList[0]

                // Pick the offer. An explicit token (affiliate/code path) wins.
                // Otherwise PREFER the offer that grants a FREE TRIAL — one whose
                // pricing has a zero-price phase — so a trial-eligible user reliably
                // gets the 7-day trial instead of whichever offer is first (which
                // may be the bare base plan). queryProductDetails only returns offers
                // the user is ELIGIBLE for, so selecting a present trial offer is
                // safe. Falls back to the first available offer when there's no trial.
                val offers = productDetails.subscriptionOfferDetails
                val offerToken = args.offerToken
                    ?: offers?.firstOrNull { offer ->
                        offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L }
                    }?.offerToken
                    ?: offers?.firstOrNull()?.offerToken
                
                val productDetailsParamsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetails)
                
                offerToken?.let { productDetailsParamsBuilder.setOfferToken(it) }
                
                val productDetailsParamsList = listOf(productDetailsParamsBuilder.build())
                
                val billingFlowParamsBuilder = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(productDetailsParamsList)
                
                // Add obfuscated account ID if provided
                args.obfuscatedAccountId?.let { accountId ->
                    billingFlowParamsBuilder.setObfuscatedAccountId(accountId)
                }
                
                // Add obfuscated profile ID if provided
                args.obfuscatedProfileId?.let { profileId ->
                    billingFlowParamsBuilder.setObfuscatedProfileId(profileId)
                }

                // Add subscription update params for upgrades/downgrades
                args.oldPurchaseToken?.let { oldToken ->
                    val replacementMode = args.subscriptionReplacementMode
                        ?: BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION

                    val subscriptionUpdateParams = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                        .setOldPurchaseToken(oldToken)
                        .setSubscriptionReplacementMode(replacementMode)
                        .build()

                    billingFlowParamsBuilder.setSubscriptionUpdateParams(subscriptionUpdateParams)
                }

                val billingFlowParams = billingFlowParamsBuilder.build()
                
                val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
                
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchaseInvoke = null
                    invoke.reject("STOREKIT_UNKNOWN: Failed to launch billing flow: ${billingResult.debugMessage}")
                }
            } else {
                pendingPurchaseInvoke = null
                invoke.reject("PRODUCT_UNAVAILABLE: Product not found")
            }
        }
    }
    
    @Command
    fun restorePurchases(invoke: Invoke) {
        val args = invoke.parseArgs(RestorePurchasesArgs::class.java)
        
        if (!billingClient.isReady) {
            invoke.reject("STOREKIT_UNKNOWN: Billing client not ready")
            return
        }
        
        val productType = translateProductType(args.productType)
        
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(productType)
            .build()
        
        billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val purchasesArray = purchases.map { purchase ->
                    JSObject().apply {
                        put("orderId", purchase.orderId)
                        put("packageName", purchase.packageName)
                        put("productId", purchase.products.firstOrNull() ?: "")
                        put("purchaseTime", purchase.purchaseTime)
                        put("purchaseToken", purchase.purchaseToken)
                        put("purchaseState", translatePurchaseState(purchase.purchaseState))
                        put("isAutoRenewing", purchase.isAutoRenewing)
                        put("isAcknowledged", purchase.isAcknowledged)
                        put("originalJson", purchase.originalJson)
                        put("signature", purchase.signature)
                    }
                }

                val result = JSObject()
                result.put("purchases", JSONArray(purchasesArray))
                invoke.resolve(result)
            } else {
                invoke.reject("NETWORK_ERROR: Failed to restore purchases: ${billingResult.debugMessage}")
            }
        }
    }
    
    @Command
    fun getPurchaseHistory(invoke: Invoke) {
        invoke.reject("Purchase history is not supported")
    }
    
    @Command
    fun acknowledgePurchase(invoke: Invoke) {
        val purchaseToken = invoke.parseArgs(AcknowledgePurchaseArgs::class.java).purchaseToken
        
        if (purchaseToken == null) {
            invoke.reject("INVALID_QUANTITY: Purchase token is required")
            return
        }
        
        if (!billingClient.isReady) {
            invoke.reject("STOREKIT_UNKNOWN: Billing client not ready")
            return
        }
        
        val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()
        
        billingClient.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                invoke.resolve(JSObject().put("success", true))
            } else {
                invoke.reject("NETWORK_ERROR: Failed to acknowledge purchase: ${billingResult.debugMessage}")
            }
        }
    }
    
    @Command
    fun getProductStatus(invoke: Invoke) {
        val args = invoke.parseArgs(GetProductStatusArgs::class.java)
        
        if (!billingClient.isReady) {
            invoke.reject("STOREKIT_UNKNOWN: Billing client not ready")
            return
        }
        
        val productType = translateProductType(args.productType)
        
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(productType)
            .build()
        
        billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val productPurchase = purchases.find { purchase ->
                    purchase.products.contains(args.productId)
                }
                
                val statusResult = JSObject().apply {
                    put("productId", args.productId)
                    
                    if (productPurchase != null) {
                        put("isOwned", true)
                        put("purchaseState", translatePurchaseState(productPurchase.purchaseState))
                        put("purchaseTime", productPurchase.purchaseTime)
                        put("isAutoRenewing", productPurchase.isAutoRenewing)
                        put("isAcknowledged", productPurchase.isAcknowledged)
                        put("purchaseToken", productPurchase.purchaseToken)
                        
                        // Note: Android doesn't provide expiration time directly for subscriptions
                        // It would require additional Google Play Developer API calls
                    } else {
                        put("isOwned", false)
                    }
                }
                
                invoke.resolve(statusResult)
            } else {
                invoke.reject("NETWORK_ERROR: Failed to get product status: ${billingResult.debugMessage}")
            }
        }
    }

    @Command
    fun presentOfferCodeRedeemSheet(invoke: Invoke) {
        // Google Play has no equivalent "redeem code sheet" launched from the
        // app for this flow. Promo/offer codes are entered in the Play Store
        // app, and offer codes flow through the in-app code field + offer
        // token (handled elsewhere). Surface a clear unsupported error.
        invoke.reject("NOT_ENTITLED: Offer code redemption sheet is not supported on Android")
    }

    @Command
    fun requestReview(invoke: Invoke) {
        // Google Play In-App Review. Play itself throttles how often the card
        // is actually shown (and may show nothing) — this is a best-effort
        // nudge, never gated. We resolve as soon as the flow has completed
        // (or fails), regardless of whether a card was displayed; the API
        // intentionally gives no signal about that.
        try {
            val manager = ReviewManagerFactory.create(activity)
            manager.requestReviewFlow().addOnCompleteListener { request ->
                if (request.isSuccessful) {
                    manager.launchReviewFlow(activity, request.result)
                        .addOnCompleteListener {
                            // Always resolve: Play never tells us if a card was
                            // shown, and the user must never be blocked on it.
                            invoke.resolve()
                        }
                } else {
                    // No review flow available (e.g. not installed from Play,
                    // quota exhausted). Resolve quietly — the host fires this
                    // best-effort on pack exit.
                    Logger.debug(TAG, "requestReviewFlow not available: ${request.exception?.message}")
                    invoke.resolve()
                }
            }
        } catch (e: Exception) {
            Logger.debug(TAG, "requestReview threw: ${e.message}")
            invoke.resolve()
        }
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                if (purchases.isNullOrEmpty()) {
                    // OK with no purchases — Google sometimes emits this when
                    // the user dismisses the sheet. Treat as cancellation if
                    // we still have a pending invoke.
                    pendingPurchaseInvoke?.reject("USER_CANCELLED: Purchase cancelled by user")
                    pendingPurchaseInvoke = null
                } else {
                    for (purchase in purchases) {
                        handlePurchase(purchase)
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                pendingPurchaseInvoke?.reject("USER_CANCELLED: Purchase cancelled by user")
                pendingPurchaseInvoke = null
            }
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> {
                pendingPurchaseInvoke?.reject("ALREADY_OWNED: Item already owned")
                pendingPurchaseInvoke = null
            }
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> {
                pendingPurchaseInvoke?.reject("PRODUCT_UNAVAILABLE: ${billingResult.debugMessage}")
                pendingPurchaseInvoke = null
            }
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE,
            BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> {
                pendingPurchaseInvoke?.reject("PURCHASE_NOT_ALLOWED: ${billingResult.debugMessage}")
                pendingPurchaseInvoke = null
            }
            BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.NETWORK_ERROR -> {
                pendingPurchaseInvoke?.reject("NETWORK_ERROR: ${billingResult.debugMessage}")
                pendingPurchaseInvoke = null
            }
            else -> {
                pendingPurchaseInvoke?.reject("STOREKIT_UNKNOWN: ${billingResult.debugMessage}")
                pendingPurchaseInvoke = null
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> {
                val purchaseData = JSObject().apply {
                    put("orderId", purchase.orderId)
                    put("packageName", purchase.packageName)
                    put("productId", purchase.products.firstOrNull() ?: "")
                    put("purchaseTime", purchase.purchaseTime)
                    put("purchaseToken", purchase.purchaseToken)
                    put("purchaseState", translatePurchaseState(purchase.purchaseState))
                    put("isAutoRenewing", purchase.isAutoRenewing)
                    put("isAcknowledged", purchase.isAcknowledged)
                    put("originalJson", purchase.originalJson)
                    put("signature", purchase.signature)
                }

                pendingPurchaseInvoke?.resolve(purchaseData)
                pendingPurchaseInvoke = null

                // Emit event for purchase state change
                trigger("purchaseUpdated", purchaseData)
            }
            Purchase.PurchaseState.PENDING -> {
                // Slow payment methods (carrier billing, some banks) put the
                // purchase in PENDING. Match iOS behavior — JS handles
                // PURCHASE_PENDING as a "waiting for approval" state, not an
                // error. Without this branch, pendingPurchaseInvoke stays set
                // and JS hangs forever.
                pendingPurchaseInvoke?.reject("PURCHASE_PENDING: Purchase is awaiting external approval")
                pendingPurchaseInvoke = null
            }
            else -> {
                // UNSPECIFIED_STATE or any future case — surface as error
                // rather than hang.
                pendingPurchaseInvoke?.reject("PURCHASE_UNKNOWN: Unexpected purchase state ${purchase.purchaseState}")
                pendingPurchaseInvoke = null
            }
        }
    }
    
    override fun onBillingSetupFinished(billingResult: BillingResult) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            Logger.info(TAG, "Billing setup finished successfully")
        } else {
            Logger.error(TAG, "Billing setup failed: ${billingResult.debugMessage}", null)
        }
    }

    override fun onBillingServiceDisconnected() {
        Logger.debug(TAG, "Billing service disconnected")
    }
}