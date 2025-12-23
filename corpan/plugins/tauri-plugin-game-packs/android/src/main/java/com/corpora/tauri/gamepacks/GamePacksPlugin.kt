package com.corpora.tauri.gamepacks

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

@InvokeArg
internal class PackRequest {
    lateinit var packId: String
}

@TauriPlugin
class GamePacksPlugin(private val activity: Activity) : Plugin(activity) {

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
        val payload = JSObject()
        payload.put("packs", packs)
        invoke.resolve(payload)
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
        val payload = JSObject()
        payload.put("url", buildManifestUrl(packId))
        invoke.resolve(payload)
    }

    private fun buildManifestUrl(packId: String): String {
        return "http://corpan-pack.localhost/$packId/manifest.json"
    }

    companion object {
        private val KNOWN_PACKS = listOf(
            PackInfo("endless_learner", "Endless Learner", "0.1.0")
        )
    }
}

private data class PackInfo(
    val id: String,
    val name: String,
    val version: String?
)
