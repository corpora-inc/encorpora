package com.corpora.admob

import android.app.Activity
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
internal class AdUnitArgs {
    var adUnitId: String? = null
}

@InvokeArg
internal class BannerAdArgs {
    var adUnitId: String? = null
    var position: String? = null
    var size: String? = null
}

@TauriPlugin
class AdmobPlugin(private val activity: Activity) : Plugin(activity) {

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var bannerAd: AdView? = null
    private var isInitialized = false

    // Google's official test ad unit IDs
    private val testInterstitialId = "ca-app-pub-3940256099942544/1033173712"
    private val testRewardedId = "ca-app-pub-3940256099942544/5224354917"
    private val testBannerId = "ca-app-pub-3940256099942544/6300978111"

    @Command
    fun initAdmob(invoke: Invoke) {
        if (isInitialized) {
            invoke.resolve()
            return
        }

        activity.runOnUiThread {
            MobileAds.initialize(activity) { status ->
                println("[ADMOB] SDK initialized: ${status.adapterStatusMap}")
                isInitialized = true

                // Pre-load ads after init
                preloadInterstitial(null)
                preloadRewarded(null)

                invoke.resolve()
            }
        }
    }

    @Command
    fun loadInterstitial(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(AdUnitArgs::class.java)
        } catch (e: Exception) {
            null
        }
        preloadInterstitial(args?.adUnitId)
        invoke.resolve()
    }

    @Command
    fun showInterstitial(invoke: Invoke) {
        activity.runOnUiThread {
            val ad = interstitialAd
            if (ad == null) {
                preloadInterstitial(null)
                val result = JSObject()
                result.put("shown", false)
                result.put("rewarded", false)
                result.put("error", "no interstitial loaded")
                invoke.resolve(result)
                return@runOnUiThread
            }

            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitialAd = null
                    preloadInterstitial(null)
                    val result = JSObject()
                    result.put("shown", true)
                    result.put("rewarded", false)
                    invoke.resolve(result)
                }

                override fun onAdFailedToShowFullScreenContent(error: com.google.android.gms.ads.AdError) {
                    println("[ADMOB] Failed to show interstitial: ${error.message}")
                    interstitialAd = null
                    preloadInterstitial(null)
                    val result = JSObject()
                    result.put("shown", false)
                    result.put("rewarded", false)
                    result.put("error", error.message)
                    invoke.resolve(result)
                }
            }

            ad.show(activity)
        }
    }

    @Command
    fun loadRewarded(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(AdUnitArgs::class.java)
        } catch (e: Exception) {
            null
        }
        preloadRewarded(args?.adUnitId)
        invoke.resolve()
    }

    @Command
    fun showRewarded(invoke: Invoke) {
        activity.runOnUiThread {
            val ad = rewardedAd
            if (ad == null) {
                preloadRewarded(null)
                val result = JSObject()
                result.put("shown", false)
                result.put("rewarded", false)
                result.put("error", "no rewarded ad loaded")
                invoke.resolve(result)
                return@runOnUiThread
            }

            var userEarnedReward = false

            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    rewardedAd = null
                    preloadRewarded(null)
                    val result = JSObject()
                    result.put("shown", true)
                    result.put("rewarded", userEarnedReward)
                    invoke.resolve(result)
                }

                override fun onAdFailedToShowFullScreenContent(error: com.google.android.gms.ads.AdError) {
                    println("[ADMOB] Failed to show rewarded: ${error.message}")
                    rewardedAd = null
                    preloadRewarded(null)
                    val result = JSObject()
                    result.put("shown", false)
                    result.put("rewarded", false)
                    result.put("error", error.message)
                    invoke.resolve(result)
                }
            }

            ad.show(activity) { reward ->
                userEarnedReward = true
                println("[ADMOB] User earned reward: ${reward.amount} ${reward.type}")
            }
        }
    }

    @Command
    fun showBanner(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(BannerAdArgs::class.java)
        } catch (e: Exception) {
            null
        }

        activity.runOnUiThread {
            // Remove existing banner if any
            bannerAd?.let { existing ->
                (existing.parent as? ViewGroup)?.removeView(existing)
                existing.destroy()
            }

            val unitId = args?.adUnitId ?: testBannerId
            val position = args?.position ?: "bottom"
            val sizeStr = args?.size ?: "banner"

            val adSize = when (sizeStr) {
                "largeBanner" -> AdSize.LARGE_BANNER
                "mediumRectangle" -> AdSize.MEDIUM_RECTANGLE
                "fullBanner" -> AdSize.FULL_BANNER
                "leaderboard" -> AdSize.LEADERBOARD
                else -> AdSize.BANNER
            }

            val adView = AdView(activity)
            adView.adUnitId = unitId
            adView.setAdSize(adSize)

            adView.adListener = object : AdListener() {
                override fun onAdLoaded() {
                    println("[ADMOB] Banner loaded")
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    println("[ADMOB] Banner load failed: ${error.message}")
                }
            }

            val gravity = if (position == "top") Gravity.TOP else Gravity.BOTTOM
            val layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                gravity or Gravity.CENTER_HORIZONTAL
            )

            val contentView = activity.window.decorView.findViewById<ViewGroup>(android.R.id.content)
            contentView.addView(adView, layoutParams)
            adView.loadAd(AdRequest.Builder().build())
            bannerAd = adView

            val result = JSObject()
            result.put("shown", true)
            invoke.resolve(result)
        }
    }

    @Command
    fun hideBanner(invoke: Invoke) {
        activity.runOnUiThread {
            bannerAd?.let { ad ->
                (ad.parent as? ViewGroup)?.removeView(ad)
                ad.destroy()
                println("[ADMOB] Banner hidden")
            }
            bannerAd = null

            val result = JSObject()
            result.put("shown", false)
            invoke.resolve(result)
        }
    }

    // MARK: - Private

    private fun preloadInterstitial(adUnitId: String?) {
        val unitId = adUnitId ?: testInterstitialId
        val request = AdRequest.Builder().build()

        InterstitialAd.load(activity, unitId, request, object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) {
                interstitialAd = ad
                println("[ADMOB] Interstitial loaded")
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                println("[ADMOB] Interstitial load failed: ${error.message}")
                interstitialAd = null
            }
        })
    }

    private fun preloadRewarded(adUnitId: String?) {
        val unitId = adUnitId ?: testRewardedId
        val request = AdRequest.Builder().build()

        RewardedAd.load(activity, unitId, request, object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) {
                rewardedAd = ad
                println("[ADMOB] Rewarded loaded")
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                println("[ADMOB] Rewarded load failed: ${error.message}")
                rewardedAd = null
            }
        })
    }
}
