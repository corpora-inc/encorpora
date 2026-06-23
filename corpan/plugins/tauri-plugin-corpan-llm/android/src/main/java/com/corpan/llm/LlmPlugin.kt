package com.corpan.llm

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// SCAFFOLD ONLY — the polish machine wires the JNI calls to LlmNative and
// finalizes the streaming pattern. The structure here mirrors the iOS plugin.

private object LlmNative {
    init {
        try {
            System.loadLibrary("corpan_llm")
        } catch (e: UnsatisfiedLinkError) {
            // native lib not built yet (dev); methods will throw
        }
    }

    external fun load(ggufPath: String, gpuLayers: Int, contextSize: Int): Boolean
    external fun unload()
    external fun chatStub(lastUser: String): String
}

@InvokeArg
class LoadArgs {
    lateinit var modelPackId: String
    var gpuLayers: Int? = null
    var contextSize: Int? = null
}

@InvokeArg
class ChatMessage {
    lateinit var role: String
    lateinit var content: String
}

@InvokeArg
class ChatOptions {
    var temperature: Float? = null
    var topP: Float? = null
    var repeatPenalty: Float? = null
    var maxTokens: Int? = null
}

@InvokeArg
class ChatArgs {
    lateinit var messages: List<ChatMessage>
    var options: ChatOptions? = null
}

@InvokeArg
class StopArgs {
    lateinit var sessionId: String
}

@TauriPlugin
class LlmPlugin(private val activity: Activity) : Plugin(activity) {

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val activeSessions = ConcurrentHashMap<String, Job>()

    @Volatile private var modelPackId: String? = null
    @Volatile private var backend: String? = null

    @Command
    fun llm_status(invoke: Invoke) {
        val mem = (activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).run {
            val info = ActivityManager.MemoryInfo()
            getMemoryInfo(info)
            info.availMem / 1024 / 1024
        }
        val result = JSObject().apply {
            put("loaded", modelPackId != null)
            put("modelId", modelPackId)
            put("backend", backend)
            put("availableMemoryMb", mem)
        }
        invoke.resolve(result)
    }

    @Command
    fun llm_load(invoke: Invoke) {
        val args = invoke.parseArgs(LoadArgs::class.java)
        val appData = activity.applicationInfo.dataDir
        val gguf = File("$appData/corpan-packs/${args.modelPackId}/model/base.gguf")
        if (!gguf.exists()) {
            invoke.reject("MODEL_NOT_FOUND", "GGUF not at ${gguf.absolutePath}")
            return
        }

        pluginScope.launch {
            try {
                // TODO (polish machine): real load with proper params.
                val ok = try {
                    LlmNative.load(gguf.absolutePath, args.gpuLayers ?: 999, args.contextSize ?: 4096)
                } catch (_: UnsatisfiedLinkError) {
                    true  // stub during scaffold phase
                }
                if (!ok) {
                    invoke.reject("LLAMA_CPP_ERROR", "load failed")
                    return@launch
                }
                modelPackId = args.modelPackId
                backend = "vulkan"  // TODO: detect actual backend used
                invoke.resolve()
            } catch (e: Exception) {
                invoke.reject("INTERNAL_ERROR", e.message ?: "unknown")
            }
        }
    }

    @Command
    fun llm_chat(invoke: Invoke) {
        val args = invoke.parseArgs(ChatArgs::class.java)
        if (modelPackId == null) {
            invoke.reject("MODEL_NOT_LOADED", "Call llm_load first")
            return
        }
        val sessionId = UUID.randomUUID().toString()
        val lastUser = args.messages.lastOrNull { it.role == "user" }?.content ?: ""

        val job = pluginScope.launch {
            try {
                // TODO (polish machine): real generation streaming.
                // For now, stub: emit words back to validate the streaming pipe.
                val words = lastUser.split("\\s+".toRegex())
                var count = 0
                for (w in words) {
                    if (!isActive(sessionId)) break
                    trigger("llm-token:$sessionId", JSObject().apply {
                        put("sessionId", sessionId)
                        put("token", "$w ")
                    })
                    count += 1
                    delay(30)
                }
                trigger("llm-done:$sessionId", JSObject().apply {
                    put("sessionId", sessionId)
                    put("totalTokens", count)
                    put("elapsedMs", 0)
                })
            } catch (e: Exception) {
                trigger("llm-error:$sessionId", JSObject().apply {
                    put("sessionId", sessionId)
                    put("code", "INTERNAL_ERROR")
                    put("error", e.message ?: "unknown")
                })
            } finally {
                activeSessions.remove(sessionId)
            }
        }
        activeSessions[sessionId] = job
        invoke.resolve(sessionId)
    }

    @Command
    fun llm_stop(invoke: Invoke) {
        val args = invoke.parseArgs(StopArgs::class.java)
        activeSessions[args.sessionId]?.cancel()
        activeSessions.remove(args.sessionId)
        invoke.resolve()
    }

    @Command
    fun llm_unload(invoke: Invoke) {
        try {
            LlmNative.unload()
        } catch (_: UnsatisfiedLinkError) { /* stub phase */ }
        modelPackId = null
        backend = null
        activeSessions.values.forEach { it.cancel() }
        activeSessions.clear()
        invoke.resolve()
    }

    @Command
    fun llm_query_pack_db(invoke: Invoke) {
        invoke.reject("NOT_IMPLEMENTED", "Use HostApi.queryPackDb from pack JS instead.")
    }

    private fun isActive(sessionId: String): Boolean {
        return activeSessions[sessionId]?.isActive == true
    }

    override fun onDestroy() {
        super.onDestroy()
        pluginScope.cancel()
    }
}
