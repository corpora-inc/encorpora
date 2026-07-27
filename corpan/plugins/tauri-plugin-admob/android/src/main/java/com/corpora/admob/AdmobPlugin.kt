package com.corpora.admob

import android.app.Activity
import com.google.android.gms.ads.AdRequest
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

@TauriPlugin
class AdmobPlugin(private val activity: Activity) : Plugin(activity) {

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var isInitialized = false

    // Google's official test ad unit IDs
    private val testInterstitialId = "ca-app-pub-3940256099942544/1033173712"
    private val testRewardedId = "ca-app-pub-3940256099942544/5224354917"

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
