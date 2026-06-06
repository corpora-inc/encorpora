import { addPluginListener, invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

import { speakWithStackPrefs, speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs"
import { getVoicesCached } from "@/util/tts-voices"
import { createVoiceTTS } from "@/util/speak"
import { trackEvent } from "@/util/analytics"
import { useHistoryStore } from "@/store/history"
import { useSettingsStore } from "@/store/settings"
import { useRatingStore } from "@/store/rating"
import { usePhrasePacksStore } from "@/store/phrasePacks"
import { useDrawerStore } from "@/store/drawer"
import type { TextSizeType } from "@/store/settings"
import { rankProviders } from "@shared/asr"
import type { StackConfigPatch } from "./types"
import type {
  AsrApi,
  AsrCapability,
  AsrCaptureMode,
  AsrProvider,
  AsrSession,
  HostApi,
  LlmApi,
  ModelBudget,
  ModelsApi,
  PackDbQuery,
  SttApi,
  SttAudioLevelEvent,
  SttErrorCode,
  SttInstallProgress,
  SttListInstalledResult,
  SttPrepareResult,
  SttStartSessionResult,
  SttStatus,
  SttTranscriptionResult,
} from "./types"

const STT_ERROR_CODES: ReadonlySet<SttErrorCode> = new Set<SttErrorCode>([
  "MODEL_NOT_INSTALLED",
  "MODEL_NOT_LOADED",
  "NETWORK",
  "LOAD_FAILED",
  "IO_FAILED",
  "BUSY",
  "CANCELLED",
  "MIC_PERMISSION_DENIED",
  "NO_ACTIVE_SESSION",
  "AUDIO_FAILED",
  "INSUFFICIENT_MEMORY",
  "UNKNOWN",
])

/**
 * Convert a raw rejection from the iOS plugin into an Error with a
 * `code` field. The Swift side encodes errors as `"CODE: human message"`
 * (matching the convention used by tauri-plugin-iap). If we recognize
 * the code prefix, we attach it to the thrown Error so packs can route
 * on `err.code` rather than substring-matching the message.
 */
const sttRejectionToError = (raw: unknown): Error & { code?: SttErrorCode } => {
  const text = typeof raw === "string"
    ? raw
    : raw instanceof Error
      ? raw.message
      : String(raw)
  const colon = text.indexOf(":")
  if (colon > 0) {
    const head = text.slice(0, colon).trim()
    if (STT_ERROR_CODES.has(head as SttErrorCode)) {
      const message = text.slice(colon + 1).trim()
      const e = new Error(message) as Error & { code: SttErrorCode }
      e.code = head as SttErrorCode
      return e
    }
  }
  return new Error(text)
}

const getStackSnapshot = () => {
  const {
    activeStackId,
    languages,
    domains,
    levels,
    rate,
    textSize,
    showRomanization,
    phrasePackIds,
    baseCorpusEnabled,
    scrollNavigationEnabled,
  } = useSettingsStore.getState()
  return {
    activeStackId,
    languages: [...languages],
    domains: [...domains],
    levels: [...levels],
    rate,
    textSize,
    showRomanization,
    phrasePackIds: [...phrasePackIds],
    baseCorpusEnabled,
    scrollNavigationEnabled,
  }
}

type SettingsState = ReturnType<typeof useSettingsStore.getState>

type StackSlice = {
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
  voicePrefs: SettingsState["voicePrefs"]
  phrasePackIds: string[]
  baseCorpusEnabled: boolean
  scrollNavigationEnabled: boolean
}

const getStackSlice = (state: SettingsState): StackSlice => {
  return {
    languages: state.languages,
    domains: state.domains,
    levels: state.levels,
    rate: state.rate,
    textSize: state.textSize,
    showRomanization: state.showRomanization,
    voicePrefs: state.voicePrefs,
    phrasePackIds: state.phrasePackIds,
    baseCorpusEnabled: state.baseCorpusEnabled,
    scrollNavigationEnabled: state.scrollNavigationEnabled,
  }
}

const isSameStackSlice = (a: StackSlice, b: StackSlice) => {
  return (
    a.languages === b.languages &&
    a.domains === b.domains &&
    a.levels === b.levels &&
    a.rate === b.rate &&
    a.textSize === b.textSize &&
    a.showRomanization === b.showRomanization &&
    a.voicePrefs === b.voicePrefs &&
    // phrasePackIds/baseCorpusEnabled drive the sampler — toggling a pack
    // MUST re-emit so the experience re-rolls. (Previously omitted → stale.)
    a.phrasePackIds === b.phrasePackIds &&
    a.baseCorpusEnabled === b.baseCorpusEnabled &&
    a.scrollNavigationEnabled === b.scrollNavigationEnabled
  )
}

export const createHostApi = (packId?: string): HostApi => {
  let disposed = false

  const stopNativeSpeech = async () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    try {
      await invoke("plugin:tts|stop")
    } catch {
      // native stop not available on all builds; ignore
    }
  }

  const stopSpeech = async () => {
    await stopNativeSpeech()
  }

  const speakImmediate = async (uiCode: string, text: string) => {
    if (disposed) {
      return
    }
    const { rate } = useSettingsStore.getState()
    await speakWithStackPrefs(uiCode, text, rate)
  }

  const speakConcurrent = async (uiCode: string, text: string): Promise<string> => {
    if (disposed) {
      return ""
    }
    const { rate } = useSettingsStore.getState()
    return await speakConcurrentWithStackPrefs(uiCode, text, rate)
  }

  const dispose = () => {
    disposed = true
  }

  const resolvePackId = (query: PackDbQuery) => {
    return query.packId ?? packId
  }

  // Normalize a Tauri/plugin rejection into a readable Error. The plugin
  // serializes its errors as `{ code, message }` (see error.rs); a bare
  // `String(obj)` would render "[object Object]", hiding the real cause.
  const llmError = (raw: unknown): Error & { code?: string } => {
    if (raw && typeof raw === "object") {
      const o = raw as { code?: string; message?: string; error?: string }
      const msg = o.message ?? o.error
      if (msg) {
        const e = new Error(o.code ? `${o.code}: ${msg}` : msg) as Error & { code?: string }
        e.code = o.code
        return e
      }
    }
    return new Error(raw instanceof Error ? raw.message : String(raw)) as Error & { code?: string }
  }

  // On-device LLM bridge. Streaming is callback-based: the host owns the Tauri
  // event listeners (llm-token/done/error:{sessionId}) and tears them down on
  // done/error/cancel, so packs never touch window.__TAURI__.
  const llm: LlmApi = {
    status: async () => {
      try {
        return await invoke("plugin:corpan-llm|llm_status")
      } catch (error) {
        throw llmError(error)
      }
    },
    isInstalled: async (packId) => {
      // A model pack IS a content pack on disk: getManifestUrl succeeds only when
      // it's installed (else it throws "Pack not installed").
      try {
        await invoke("content_packs_get_manifest_url", { packId })
        return true
      } catch {
        return false
      }
    },
    install: async (args, onProgress) => {
      // The base GGUF ships as a content-pack ZIP, so reuse the host pack
      // downloader. Progress arrives on the global `pack-install-progress`
      // event — filter to our pack id and forward to the callback.
      let un: (() => void) | null = null
      try {
        if (onProgress) {
          un = await listen<{
            pack_id?: string
            stage?: string
            progress?: number
            total?: number
            message?: string
          }>("pack-install-progress", (ev) => {
            const p = ev.payload
            if (!p || p.pack_id !== args.packId) return
            onProgress({
              stage: p.stage ?? "downloading",
              progress: p.progress ?? 0,
              total: p.total ?? 0,
              message: p.message ?? "",
            })
          })
        }
        await invoke("content_packs_install_from_url", {
          packId: args.packId,
          downloadUrl: args.url,
          expectedSha256: args.sha256,
        })
      } catch (error) {
        throw llmError(error)
      } finally {
        if (un) {
          try {
            un()
          } catch (error) {
            console.error("[llm] install unlisten failed:", error)
          }
        }
      }
    },
    load: async (args) => {
      // Tauri wraps command params under the param name (`args: LoadArgs`),
      // so the payload must be `{ args: {...} }` (same convention as stt).
      try {
        await invoke("plugin:corpan-llm|llm_load", {
          args: {
            modelPackId: args.modelPackId,
            gpuLayers: args.gpuLayers,
            contextSize: args.contextSize,
          },
        })
      } catch (error) {
        throw llmError(error)
      }
    },
    unload: async () => {
      try {
        await invoke("plugin:corpan-llm|llm_unload")
      } catch (error) {
        throw llmError(error)
      }
    },
    chat: async (args, handlers) => {
      let sessionId: string
      try {
        sessionId = await invoke<string>("plugin:corpan-llm|llm_chat", {
          args: {
            messages: args.messages,
            options: args.options ?? {},
          },
        })
      } catch (error) {
        // Synchronous command failure (e.g. MODEL_NOT_LOADED): surface via
        // onError so the pack shows the real reason, and rethrow for awaiters.
        const e = llmError(error)
        handlers.onError(e.message, e.code)
        throw e
      }
      let buf = ""
      const unlisteners: Array<() => void> = []
      const teardown = () => {
        for (const u of unlisteners) {
          try {
            u()
          } catch (error) {
            console.error("[llm] unlisten failed:", error)
          }
        }
        unlisteners.length = 0
      }
      const unT = await listen<{ token?: string }>(`llm-token:${sessionId}`, (ev) => {
        const tok = String(ev.payload?.token ?? "")
        buf += tok
        handlers.onToken(tok)
      })
      const unD = await listen<{ totalTokens?: number; elapsedMs?: number }>(
        `llm-done:${sessionId}`,
        (ev) => {
          teardown()
          handlers.onDone(buf, {
            totalTokens: ev.payload?.totalTokens ?? 0,
            elapsedMs: ev.payload?.elapsedMs ?? 0,
          })
        },
      )
      const unE = await listen<{ error?: string; code?: string }>(
        `llm-error:${sessionId}`,
        (ev) => {
          teardown()
          handlers.onError(String(ev.payload?.error ?? "unknown"), ev.payload?.code)
        },
      )
      unlisteners.push(unT, unD, unE)
      return {
        sessionId,
        cancel: async () => {
          try {
            await invoke("plugin:corpan-llm|llm_stop", { args: { sessionId } })
          } catch (error) {
            console.error("[llm] stop error:", error)
          }
        },
      }
    },
  }

  const stt: SttApi = {
    isAvailable: async () => {
      // No try/catch: if the bridge fails (deserialization mismatch,
      // missing native binding, etc.) we want the pack to SEE that
      // failure, not a synthetic `false` that renders an
      // "unavailable" screen with no explanation. The caller decides
      // how to surface bridge errors.
      return await invoke<boolean>("plugin:stt|is_available")
    },
    getStatus: async () => {
      try {
        const status = await invoke<SttStatus>("plugin:stt|get_status")
        if (status.priorInitCrash) {
          // A previous on-device whisper init never returned — an
          // uncatchable native SIGSEGV/abort in ggml model load. The plugin
          // wrote a breadcrumb before the crash and held it across the
          // restart; record it ONCE into on-device analytics so the failure
          // is actually harvested (we can't pull logcat from a random user's
          // device). The native field is cleared by this same getStatus call.
          try {
            trackEvent("stt_init_crash", {
              context: String(status.priorInitCrash).slice(0, 500),
            })
          } catch (e) {
            console.error("[stt] failed to record prior init crash:", e)
          }
        }
        return status
      } catch (error) {
        console.error("[stt] get_status error:", error)
        return {
          available: false,
          prepared: false,
          model: null,
          recording: false,
          message: String(error),
        }
      }
    },
    prepare: async (opts) => {
      try {
        // prepare() always resolves with PreparePayload — successful or
        // not. The `code` field on the resolved object is the structured
        // signal; we never throw from here on a normal failure path.
        return await invoke<SttPrepareResult>("plugin:stt|prepare", {
          args: { model: opts?.model },
        })
      } catch (error) {
        // True bridge-level failure (plugin missing, malformed args).
        // Translate to the same shape so callers don't have to dual-route.
        console.error("[stt] prepare error:", error)
        const e = sttRejectionToError(error)
        return {
          ready: false,
          model: opts?.model ?? "",
          message: e.message,
          code: e.code,
        }
      }
    },
    startSession: async (opts) => {
      try {
        return await invoke<SttStartSessionResult>(
          "plugin:stt|start_session",
          { args: opts },
        )
      } catch (error) {
        throw sttRejectionToError(error)
      }
    },
    stopSession: async (opts) => {
      try {
        return await invoke<SttTranscriptionResult>(
          "plugin:stt|stop_session",
          { args: opts },
        )
      } catch (error) {
        throw sttRejectionToError(error)
      }
    },
    cancelSession: async (opts) => {
      try {
        await invoke<void>("plugin:stt|cancel_session", { args: opts })
      } catch (error) {
        console.error("[stt] cancel_session error:", error)
      }
    },
    // The wipe/install/validate/list/unload commands are NOT
    // registered in the plugin's Rust invoke_handler — they route
    // directly to the iOS @objc methods. Tauri does NOT unwrap the
    // `args` key for that path, so the Swift `parseArgs(PrepareArgs)`
    // sees the WHOLE wrapper as the payload and `model` ends up nil
    // (then falls back to `Self.defaultModel = "openai_whisper-base"`).
    // That single bug is why Remove on Advanced wiped Standard,
    // Install on Advanced installed Standard, validateModel(advanced)
    // returned Standard's truth, etc. — every "model" arg has been
    // silently replaced by Standard. The fix is to send the payload
    // FLAT (no `args` wrapper) for these commands.
    wipeModel: async (opts) => {
      try {
        await invoke<{ wiped: boolean; model: string }>(
          "plugin:stt|wipe_model",
          { model: opts?.model },
        )
        return { wiped: true }
      } catch (error) {
        console.error("[stt] wipe_model error:", error)
        return { wiped: false, message: String(error) }
      }
    },
    validateModel: async (opts) => {
      try {
        return await invoke<{
          model: string
          valid: boolean
          problems: string[]
        }>("plugin:stt|validate_model", { model: opts?.model })
      } catch (error) {
        console.error("[stt] validate_model error:", error)
        throw sttRejectionToError(error)
      }
    },
    installModel: async (opts, onProgress) => {
      let unlisten: (() => void) | null = null
      if (onProgress) {
        try {
          const handle = await addPluginListener<SttInstallProgress>(
            "stt",
            "install_progress",
            (event) => {
              try {
                onProgress(event)
              } catch (error) {
                console.error("[stt] install_progress handler threw:", error)
              }
            },
          )
          unlisten = () => handle.unregister()
        } catch (error) {
          console.error("[stt] addPluginListener install_progress failed:", error)
        }
      }
      try {
        return await invoke<{
          installed: boolean
          model: string
          alreadyInstalled: boolean
        }>("plugin:stt|install_model", {
          model: opts.model,
          downloadUrl: opts.downloadUrl,
        })
      } catch (error) {
        throw sttRejectionToError(error)
      } finally {
        if (unlisten) {
          try {
            unlisten()
          } catch (error) {
            console.error("[stt] unlisten install_progress failed:", error)
          }
        }
      }
    },
    listInstalled: async (opts) => {
      try {
        return await invoke<SttListInstalledResult>(
          "plugin:stt|list_installed",
          { models: opts.models },
        )
      } catch (error) {
        console.error("[stt] list_installed error:", error)
        throw sttRejectionToError(error)
      }
    },
    unload: async () => {
      // Throw on bridge failure. The caller asked to unload; if we
      // couldn't, they need to know — returning a quiet
      // `{ unloaded: false }` is the same fail-open lie pattern.
      try {
        return await invoke<{ unloaded: boolean }>("plugin:stt|unload")
      } catch (error) {
        console.error("[stt] unload error:", error)
        throw sttRejectionToError(error)
      }
    },
    releaseAudio: async () => {
      // Best-effort — pack-close is the only caller and there's no
      // useful recovery if the bridge fails. Swallow errors and log;
      // the worst case (mic indicator stuck on) is still better than
      // crashing the dispose path.
      try {
        await invoke("plugin:stt|release_audio")
      } catch (error) {
        console.error("[stt] releaseAudio error:", error)
      }
    },
    subscribeAudioLevel: async (callback) => {
      const handle = await addPluginListener<SttAudioLevelEvent>(
        "stt",
        "audio_level",
        (event) => {
          try {
            callback(event)
          } catch (error) {
            console.error("[stt] audio_level handler threw:", error)
          }
        },
      )
      return () => {
        try {
          handle.unregister()
        } catch (error) {
          console.error("[stt] unregister audio_level failed:", error)
        }
      }
    },
  }

  // --- host.models: the Budget Arbiter seam ------------------------------
  // The refcount/dedup STORE (install/evict/locate/list) is the registry
  // plugin (Phase-2). But the BUDGET — the question World Plaza/Tutomaton
  // actually ask ("does Qwen3-ASR fit next to my 4B right now?") — is
  // answerable TODAY from real signals: device memory via stt.getStatus()
  // (availableMemoryMB / physicalMemoryMB) and the resident LLM via
  // llm.status(). We surface those; the store methods are honest stubs that
  // report "not yet" rather than pretending. Noisy on error, never silent.
  const RESIDENT_LLM_MB = 2500 // Qwen3-4B GGUF resident footprint (approx).
  const readBudget = async (): Promise<ModelBudget> => {
    let availableMB = 0
    let physicalMB = 0
    try {
      const s = await invoke<SttStatus>("plugin:stt|get_status")
      availableMB = s.availableMemoryMB ?? 0
      physicalMB = s.physicalMemoryMB ?? 0
    } catch (error) {
      // The stt plugin is the device-memory oracle; if it's absent we report
      // zeros (arbiter then conservatively blocks downloadable engines).
      console.error("[models] budget: stt.get_status failed:", error)
    }
    const resident: ModelBudget["resident"] = []
    try {
      const ls = await llm.status()
      if (ls?.loaded) {
        resident.push({ id: "llm-base-qwen3-4b", mb: RESIDENT_LLM_MB, kind: "llm" })
      }
    } catch (error) {
      // LLM plugin not registered (or not loaded) → no LLM resident entry.
      console.error("[models] budget: llm.status failed:", error)
    }
    return { availableMB, physicalMB, resident }
  }

  const models: ModelsApi = {
    // Store ops await the registry plugin (Phase-2). Report honestly.
    list: async () => [],
    ensure: async () => ({ ready: false, downloading: false }),
    locate: async () => null,
    evict: async () => {},
    budget: readBudget,
    fits: async (req) => {
      const b = await readBudget()
      const need = req.residentMB ?? 0
      // Headroom = what the OS says we can still allocate. No eviction list
      // until the refcount store exists, so mustEvict is empty for now.
      return { fits: need > 0 && need <= b.availableMB, mustEvict: [] }
    },
    whatFitsAlongside: async () => {
      // Until a provider plugin registers capabilities, nothing on-device
      // qualifies; native (residentMemoryMB 0) would always pass once present.
      return []
    },
  }

  // --- host.asr: native dictation provider over tauri-plugin-asr-native ----
  // The provider bridges host.asr to the OS-native recognizer plugin: its
  // session invokes plugin:asr-native commands and relays the plugin's
  // `asr://partial`/`asr://level`/`asr://error` events into AsrSession
  // callbacks. DEGRADE-SAFE: every native call is wrapped — if the plugin
  // isn't registered (desktop dev) or the language isn't supported, the
  // probe/transcribe fails or returns nothing → pick() returns null → the
  // caller (MicInput / wireDictation) falls back to the KEYBOARD floor (the
  // mic just doesn't show). So this can't regress anything.

  // One session = one start_session…stop_session, with its event listeners.
  const openNativeSession = async (
    lang: string,
    mode: AsrCaptureMode,
  ): Promise<AsrSession> => {
    const sessionId = `asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let partialCb: ((t: string) => void) | undefined
    let levelCb: ((rms: number, tMs: number) => void) | undefined
    let errorCb: ((code: string, message?: string) => void) | undefined
    const unlisteners: Array<() => void> = []

    const sub = async <T extends { sessionId: string }>(
      ev: string,
      handler: (e: T) => void,
    ) => {
      try {
        const h = await addPluginListener<T>("asr-native", ev, (e) => {
          if (e?.sessionId !== sessionId) return // route to THIS session only
          try {
            handler(e)
          } catch (err) {
            console.error(`[asr] ${ev} handler threw:`, err)
          }
        })
        unlisteners.push(() => {
          try {
            h.unregister()
          } catch (err) {
            console.error(`[asr] unregister ${ev} failed:`, err)
          }
        })
      } catch (err) {
        console.error(`[asr] addPluginListener ${ev} failed:`, err)
      }
    }

    await sub<{ sessionId: string; text: string }>("asr://partial", (e) =>
      partialCb?.(e.text),
    )
    await sub<{ sessionId: string; rms: number; tMs: number }>(
      "asr://level",
      (e) => levelCb?.(e.rms, e.tMs),
    )
    await sub<{ sessionId: string; code: string; message?: string }>(
      "asr://error",
      (e) => errorCb?.(e.code, e.message),
    )

    const teardown = () => {
      for (const u of unlisteners.splice(0)) u()
    }

    await invoke("plugin:asr-native|start_session", {
      args: { sessionId, lang, mode },
    })

    return {
      onPartial: (cb) => {
        partialCb = cb
      },
      onLevel: (cb) => {
        levelCb = cb
      },
      onError: (cb) => {
        errorCb = cb
      },
      stop: async () => {
        try {
          return await invoke("plugin:asr-native|stop_session", {
            args: { sessionId },
          })
        } finally {
          teardown()
        }
      },
      cancel: () => {
        void invoke("plugin:asr-native|cancel_session", {
          args: { sessionId },
        }).catch((err) => console.error("[asr] cancel_session failed:", err))
        teardown()
      },
    }
  }

  const nativeProvider: AsrProvider = {
    id: "native",
    capabilities: () =>
      invoke<AsrCapability>("plugin:asr-native|capabilities"),
    isAvailable: (lang) =>
      invoke<{ ok: boolean; needsDownload: boolean }>(
        "plugin:asr-native|is_available",
        { args: { lang } },
      ),
    ensure: (lang) =>
      invoke<{ ready: boolean; downloading: boolean }>(
        "plugin:asr-native|ensure",
        { args: { lang } },
      ),
    transcribe: ({ lang, mode }) => openNativeSession(lang, mode),
  }

  const asr: AsrApi = {
    provider: async (id) => (id === "native" ? nativeProvider : null),
    pick: async ({ lang, budgetMB, goal = "dictation" }) => {
      // Probe native capabilities; any failure (plugin absent on desktop dev,
      // etc.) → no provider → keyboard floor.
      let cap: AsrCapability
      try {
        cap = await nativeProvider.capabilities()
      } catch (err) {
        console.error("[asr] native capabilities() failed → keyboard:", err)
        return null
      }
      // Live ASR budget headroom from the registry (native is out-of-process,
      // residentMemoryMB 0, so it always fits; this is here for downloadable
      // providers later). Default generous if budget read fails.
      let availableForAsrMB = budgetMB ?? 4096
      if (budgetMB == null) {
        try {
          const b = await readBudget()
          availableForAsrMB = b.availableMB || 4096
        } catch {
          /* keep the generous default */
        }
      }
      const androidCpuOnly =
        typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
      const ranked = rankProviders([cap], {
        lang,
        goal,
        budget: { availableForAsrMB, androidCpuOnly },
      })
      return ranked[0] === "native" ? nativeProvider : null
    },
  }

  return {
    speak: async (uiCode, text) => {
      await speakImmediate(uiCode, text)
    },
    speakConcurrent: async (uiCode, text) => {
      return await speakConcurrent(uiCode, text)
    },
    stopSpeech,
    // Voice enumeration + voice-pinned speak — the mechanism a pack uses to give
    // each NPC ONE sticky, gender-matched voice. Both reuse the SAME machinery the
    // app's own per-language `voicePrefs` already run on (native voices with gender
    // via `getVoicesCached`; `createVoiceTTS(uiCode)(text, rate, voiceId)` speaks a
    // specific voice on native + browser), so there is no new native work.
    listVoices: async (uiCode?: string) => {
      const all = await getVoicesCached({ maxAgeMs: 30_000 })
      const base = (uiCode ?? "").toLowerCase().split("-")[0]
      const matched = base
        ? all.filter((v) => (v.language ?? "").toLowerCase().split("-")[0] === base)
        : all
      // Contract: listVoices(uiCode) returns ONLY uiCode-language voices — an empty
      // result is correct (the caller degrades to a language-only speak), and we must
      // NEVER substitute a wrong-language list. (`matched` is already `all` when no
      // uiCode is passed.) The old `matched.length>0 ? matched : all` returned e.g.
      // Spanish voices for `listVoices("en")` on a device with no EN voice installed.
      const list = matched
      return list.map((v) => ({
        id: v.id,
        name: v.name ?? undefined,
        language: v.language,
        gender: v.gender ?? "unspecified",
      }))
    },
    speakVoice: async (uiCode: string, text: string, voiceId: string) => {
      if (disposed) return
      const { rate } = useSettingsStore.getState()
      await createVoiceTTS(uiCode)(text, rate, voiceId)
    },
    // Native clipboard via tauri-plugin-clipboard-manager — the web
    // `navigator.clipboard` API is blocked in the WKWebView (NotAllowedError),
    // so packs route copy through here.
    copyText: async (text: string) => {
      try {
        await invoke("plugin:clipboard-manager|write_text", { label: null, text })
      } catch (error) {
        console.error("[content-packs] copyText failed:", error)
        throw error instanceof Error ? error : new Error(String(error))
      }
    },
    dispose,
    getStackConfig: () => {
      return getStackSnapshot()
    },
    onStackConfigChange: (listener) => {
      const emit = () => {
        listener(getStackSnapshot())
      }
      emit()

      // Selective subscription: only fire when stack config changes
      // Exclude _voiceCycleIndex to prevent voice cycling from triggering game updates
      let previous = getStackSlice(useSettingsStore.getState())
      const unsubscribe = useSettingsStore.subscribe((state) => {
        const next = getStackSlice(state)
        if (isSameStackSlice(previous, next)) {
          return
        }
        previous = next
        emit()
      })
      return () => unsubscribe()
    },
    // Pack-facing sampler. Forwards the user's active phrase-pack
    // selection so every pack (including pre-0.13 production builds of
    // Parlometron, Juice Squeeze, Hover Runner, …) benefits from topical
    // packs the moment the user toggles them on — no pack rebuild needed.
    // Robustness against partial install state (pack id in settings but
    // SQLite not yet on disk) lives in Rust: `collect_pack_counts` treats
    // missing-pack errors as zero and continues sampling from the rest.
    getRandomEntry: async () => {
      const { levels, phrasePackIds, baseCorpusEnabled } =
        useSettingsStore.getState()
      // `domains` intentionally NOT forwarded — phrase packs supersede
      // the base corpus's domain axis in 0.15.1+. The Rust sampler
      // treats omitted domains as "all domains, no JOIN".
      // `exclude` is the most-recent 10 (source, entry_id) tuples
      // from the host's history — anti-repetition that Rust falls
      // through cleanly when the pool is too thin.
      return invoke("get_random_entry_with_translations", {
        levels,
        phrasePackIds,
        baseCorpusEnabled,
        exclude: useHistoryStore.getState().getRecentTuples(10),
      })
    },
    getRandomEntries: async (q) => {
      const { levels, phrasePackIds, baseCorpusEnabled } =
        useSettingsStore.getState()
      // Two call shapes. A bare number = the historical path (user-global `levels`,
      // domains NOT forwarded — phrase packs supersede the domain axis in 0.15.1+).
      // An options object = a pack asking for a THEMED + LEVEL-SCALED draw: forward
      // its `domains`/`levels`/`languageCodes` to the bundled-corpus command, which
      // INNER-JOINs on `cor_entry_domains` and relaxes (drop levels → drop domains
      // → all) so a strict filter never starves. A pack-supplied `levels` overrides
      // the user-global one (the pack is scaling difficulty to the quest);
      // `languageCodes` constrains to the TARGET translation. When a pack passes a
      // filter we sample from the BASE corpus (the filterable, domain-tagged
      // corpus) rather than weaving in the user's phrase packs, so the requested
      // theme is honored faithfully.
      if (typeof q === "object") {
        const hasFilter =
          (q.domains?.length ?? 0) > 0 ||
          (q.levels?.length ?? 0) > 0 ||
          (q.languageCodes?.length ?? 0) > 0
        if (hasFilter) {
          return invoke("get_random_entries_with_translations", {
            count: q.count,
            levels: q.levels && q.levels.length ? q.levels : levels,
            domains: q.domains,
            languageCodes: q.languageCodes,
            // Filtered themed draws sample the domain-tagged BASE corpus; the
            // command falls back to base when no packs are supplied.
            baseCorpusEnabled: true,
            exclude: useHistoryStore.getState().getRecentTuples(10),
          })
        }
      }
      const count = typeof q === "number" ? q : q.count
      return invoke("get_random_entries_with_translations", {
        count,
        levels,
        phrasePackIds,
        baseCorpusEnabled,
        exclude: useHistoryStore.getState().getRecentTuples(10),
      })
    },
    getEntryById: async (entryId, source) => {
      return invoke("get_entry_by_id_with_translations", { entryId, source })
    },
    searchEntriesByText: async ({ text, languageCodes, limit, offset }) => {
      return invoke("search_entries_by_translation_text", {
        text,
        languageCodes,
        limit,
        offset,
      })
    },
    searchEntriesByTextCount: async ({ text, languageCodes }) => {
      return invoke("search_entries_by_translation_text_count", {
        text,
        languageCodes,
      })
    },
    queryPackDb: async (query) => {
      const resolvedPackId = resolvePackId(query)
      if (!resolvedPackId) {
        throw new Error("Pack ID is required to query pack databases.")
      }
      return invoke("content_packs_query_db", {
        packId: resolvedPackId,
        dbName: query.dbName,
        sql: query.sql,
        params: query.params ?? [],
        maxRows: query.maxRows,
      })
    },
    // Whitelisted write surface — maps each present key to its store setter.
    // Pure JS-side Zustand mutation; no Rust/wire boundary crossed.
    setStackConfig: (patch: StackConfigPatch) => {
      const s = useSettingsStore.getState()
      if (patch.levels !== undefined) s.setLevels(patch.levels)
      if (patch.rate !== undefined) s.setRate(patch.rate)
      if (patch.domains !== undefined) s.setDomains(patch.domains)
      if (patch.languages !== undefined) s.setLanguages(patch.languages)
      if (patch.textSize !== undefined) s.setTextSize(patch.textSize as TextSizeType)
      if (patch.showRomanization !== undefined) s.setShowRomanization(patch.showRomanization)
      if (patch.scrollNavigationEnabled !== undefined) s.setScrollNavigationEnabled(patch.scrollNavigationEnabled)
      if (patch.phrasePackIds !== undefined) s.setPhrasePackIds(patch.phrasePackIds)
      if (patch.baseCorpusEnabled !== undefined) s.setBaseCorpusEnabled(patch.baseCorpusEnabled)
    },
    openQuickSettings: () => useDrawerStore.getState().openQuickSettings(),
    history: {
      getState: () => {
        const aId = useSettingsStore.getState().activeStackId
        const h = useHistoryStore.getState().byStack[aId]
        return h
          ? { ids: [...h.ids], sources: [...h.sources], index: h.index }
          : { ids: [], sources: [], index: -1 }
      },
      push: (entryId, source) => useHistoryStore.getState().pushEntry(entryId, source),
      setIndex: (index) => useHistoryStore.getState().setIndex(index),
      replaceCurrent: (entryId, source) =>
        useHistoryStore.getState().replaceCurrent(entryId, source),
      getRecentTuples: (n) =>
        useHistoryStore
          .getState()
          .getRecentTuples(n)
          .map((t) => ({ entryId: t.entryId, source: t.source })),
      subscribe: (listener) => {
        // Fire on history changes AND active-stack switches.
        const u1 = useHistoryStore.subscribe(() => listener())
        let prevStack = useSettingsStore.getState().activeStackId
        const u2 = useSettingsStore.subscribe((st) => {
          if (st.activeStackId !== prevStack) {
            prevStack = st.activeStackId
            listener()
          }
        })
        return () => { u1(); u2() }
      },
    },
    notifyUtterance: () => {
      useRatingStore.getState().incrementUtteranceCount()
    },
    phrasePacks: {
      getInstalled: () => {
        const installed = usePhrasePacksStore.getState().installed
        const out: Record<string, import("./types").HostInstalledPhrasePack> = {}
        for (const [id, p] of Object.entries(installed)) {
          out[id] = {
            id: p.id,
            name: p.name,
            nameLocalized: p.nameLocalized,
            topic: p.topic,
            topicLocalized: p.topicLocalized,
            accentColor: p.accentColor,
          }
        }
        return out
      },
      setEnabled: (id, on) => {
        const s = useSettingsStore.getState()
        const current = s.phrasePackIds
        const next = on
          ? (current.includes(id) ? current : [...current, id])
          : current.filter((x) => x !== id)
        s.setPhrasePackIds(next)
      },
      subscribe: (listener) => usePhrasePacksStore.subscribe(() => listener()),
    },
    // Download + extract a module ZIP into a subpath of a pack's on-disk dir
    // (e.g. a tutor pack's per-language data). Progress arrives on the global
    // `pack-install-progress` event (same as content_packs_install_from_url) —
    // filter to our pack id and forward to the callback. The JS arg names
    // (`url`/`sha256`) are remapped to the Rust command params
    // (`downloadUrl`/`expectedSha256`) here at the bridge.
    installModuleZip: async (args, onProgress) => {
      let un: (() => void) | null = null
      try {
        if (onProgress) {
          un = await listen<{
            pack_id?: string
            stage?: string
            progress?: number
            total?: number
            message?: string
          }>("pack-install-progress", (ev) => {
            const p = ev.payload
            if (!p || p.pack_id !== args.packId) return
            onProgress({
              stage: p.stage ?? "downloading",
              progress: p.progress ?? 0,
              total: p.total ?? 0,
              message: p.message ?? "",
            })
          })
        }
        await invoke("content_packs_install_module", {
          packId: args.packId,
          subPath: args.subPath,
          downloadUrl: args.url,
          // An empty-string sha means "unknown / not yet published" — treat it
          // as no-sha (skip verification) rather than passing "" to Rust, which
          // would be Some("") and fail every download with "module hash mismatch".
          expectedSha256: args.sha256 ? args.sha256 : undefined,
          packManifest: args.packManifest,
        })
      } catch (error) {
        console.error("[content-packs] installModuleZip error:", error)
        throw error instanceof Error ? error : new Error(String(error))
      } finally {
        if (un) {
          try {
            un()
          } catch (error) {
            console.error("[content-packs] installModuleZip unlisten failed:", error)
          }
        }
      }
    },
    packFileExists: async (packId, relPath) => {
      return invoke<boolean>("content_packs_module_file_exists", {
        packId,
        relPath,
      })
    },
    discoverPacksByType: async (_packType: string) => {
      // Native discovery (content_packs_list_installed_by_type + manifest
      // packType/source fields) is not wired yet. Returning [] means Tutomaton
      // runs with its built-in sources only; installed source packs slot in the
      // moment the native command lands — no Tutomaton release required.
      return []
    },
    stt,
    llm,
    asr,
    models,
  }
}
