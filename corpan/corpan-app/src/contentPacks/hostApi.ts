import { addPluginListener, invoke } from "@tauri-apps/api/core"

import { speakWithStackPrefs, speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs"
import { useSettingsStore } from "@/store/settings"
import type {
  HostApi,
  PackDbQuery,
  SttApi,
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
  } = useSettingsStore.getState()
  return {
    activeStackId,
    languages: [...languages],
    domains: [...domains],
    levels: [...levels],
    rate,
    textSize,
    showRomanization,
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
    a.voicePrefs === b.voicePrefs
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

  const stt: SttApi = {
    isAvailable: async () => {
      try {
        return await invoke<boolean>("plugin:stt|is_available")
      } catch (error) {
        console.error("[stt] is_available error:", error)
        return false
      }
    },
    getStatus: async () => {
      try {
        return await invoke<SttStatus>("plugin:stt|get_status")
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
        }>("plugin:stt|install_model", { model: opts.model })
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
  }

  return {
    speak: async (uiCode, text) => {
      await speakImmediate(uiCode, text)
    },
    speakConcurrent: async (uiCode, text) => {
      return await speakConcurrent(uiCode, text)
    },
    stopSpeech,
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
    getRandomEntry: async () => {
      const { levels, domains } = useSettingsStore.getState()
      return invoke("get_random_entry_with_translations", {
        levels,
        domains,
      })
    },
    getRandomEntries: async (count: number) => {
      const { levels, domains } = useSettingsStore.getState()
      return invoke("get_random_entries_with_translations", {
        count,
        levels,
        domains,
      })
    },
    getEntryById: async (entryId) => {
      return invoke("get_entry_by_id_with_translations", { entryId })
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
    stt,
  }
}
