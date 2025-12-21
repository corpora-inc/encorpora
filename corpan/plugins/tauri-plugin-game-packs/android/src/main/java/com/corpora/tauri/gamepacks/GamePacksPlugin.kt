package com.corpora.tauri.gamepacks

import android.app.Activity
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.play.core.assetpacks.AssetPackManager
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackState
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.AssetPackStatus
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import org.json.JSONArray

@InvokeArg
internal class PackRequest {
    lateinit var packId: String
}

@TauriPlugin
class GamePacksPlugin(private val activity: Activity) : Plugin(activity) {
    private val manager: AssetPackManager = AssetPackManagerFactory.getInstance(activity)
    private val pendingInvokes = mutableMapOf<String, Invoke>()

    private val listener = AssetPackStateUpdateListener { state ->
        handleStateUpdate(state)
    }

    override fun load(webView: WebView) {
        manager.registerListener(listener)
    }

    override fun close() {
        manager.unregisterListener(listener)
        super.close()
    }

    @Command
    fun listPacks(invoke: Invoke) {
        val packs = JSONArray()
        KNOWN_PACKS.forEach { info ->
            val obj = JSObject()
            obj.put("id", info.id)
            obj.put("name", info.name)
            obj.put("version", info.version)
            packs.put(obj)
        }
        invoke.resolve(packs)
    }

    @Command
    fun getManifestUrl(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(PackRequest::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        val packId = args.packId
        val location = manager.getPackLocation(packId)
        if (location != null && location.assetsPath() != null) {
            try {
                val manifestUrl = installPackAssets(packId, location.assetsPath()!!)
                invoke.resolve(manifestUrl)
            } catch (e: Exception) {
                invoke.reject("Failed to install pack: ${e.message}")
            }
            return
        }

        pendingInvokes[packId] = invoke
        manager.fetch(listOf(packId)).addOnFailureListener { error ->
            pendingInvokes.remove(packId)
            invoke.reject("Pack fetch failed: ${error.message}")
        }
    }

    private fun handleStateUpdate(state: AssetPackState) {
        val packId = state.name()
        val invoke = pendingInvokes[packId] ?: return

        when (state.status()) {
            AssetPackStatus.COMPLETED -> {
                val location = manager.getPackLocation(packId)
                val assetsPath = location?.assetsPath()
                if (assetsPath == null) {
                    pendingInvokes.remove(packId)
                    invoke.reject("Pack completed but assets path missing")
                    return
                }
                try {
                    val manifestUrl = installPackAssets(packId, assetsPath)
                    pendingInvokes.remove(packId)
                    invoke.resolve(manifestUrl)
                } catch (e: Exception) {
                    pendingInvokes.remove(packId)
                    invoke.reject("Failed to install pack: ${e.message}")
                }
            }
            AssetPackStatus.REQUIRES_USER_CONFIRMATION -> {
                manager.showCellularDataConfirmation(activity)
            }
            AssetPackStatus.FAILED,
            AssetPackStatus.CANCELED -> {
                pendingInvokes.remove(packId)
                invoke.reject("Pack download failed: ${state.status()}")
            }
        }
    }

    private fun installPackAssets(packId: String, assetsPath: String): String {
        val srcDir = File(assetsPath)
        val destDir = File(activity.filesDir, "corpan-packs/$packId")
        if (!destDir.exists()) {
            destDir.mkdirs()
        }
        copyDirectory(srcDir, destDir)
        return buildManifestUrl(packId)
    }

    private fun buildManifestUrl(packId: String): String {
        return "http://corpan-pack.localhost/$packId/manifest.json"
    }

    private fun copyDirectory(source: File, target: File) {
        if (source.isDirectory) {
            if (!target.exists()) {
                target.mkdirs()
            }
            source.listFiles()?.forEach { child ->
                copyDirectory(child, File(target, child.name))
            }
        } else {
            FileInputStream(source).use { input ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var len = input.read(buffer)
                    while (len > 0) {
                        output.write(buffer, 0, len)
                        len = input.read(buffer)
                    }
                }
            }
        }
    }

    companion object {
        private val KNOWN_PACKS = listOf(
            PackInfo("endless_runner", "Endless Runner", "0.1.0")
        )
    }
}

private data class PackInfo(
    val id: String,
    val name: String,
    val version: String?
)
