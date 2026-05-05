import { addPluginListener, invoke } from "@tauri-apps/api/core"

import { speakWithStackPrefs, speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs"
import { useSettingsStore } from "@/store/settings"
import type {
  HostApi,
  PackDbQuery,
  SttApi,
  SttInstallProgress,
  SttPrepareResult,
  SttStartSessionResult,
  SttStatus,
  SttTranscriptionResult,
} from "./types"

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
        return await invoke<SttPrepareResult>("plugin:stt|prepare", {
          args: { model: opts?.model },
        })
      } catch (error) {
        console.error("[stt] prepare error:", error)
        return {
          ready: false,
          model: opts?.model ?? "",
          message: String(error),
        }
      }
    },
    startSession: async (opts) => {
      const result = await invoke<SttStartSessionResult>(
        "plugin:stt|start_session",
        { args: opts },
      )
      return result
    },
    stopSession: async (opts) => {
      const result = await invoke<SttTranscriptionResult>(
        "plugin:stt|stop_session",
        { args: opts },
      )
      return result
    },
    cancelSession: async (opts) => {
      try {
        await invoke<void>("plugin:stt|cancel_session", { args: opts })
      } catch (error) {
        console.error("[stt] cancel_session error:", error)
      }
    },
    wipeModel: async (opts) => {
      try {
        await invoke<{ wiped: boolean; model: string }>(
          "plugin:stt|wipe_model",
          { args: { model: opts?.model } },
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
        }>("plugin:stt|validate_model", { args: { model: opts?.model } })
      } catch (error) {
        console.error("[stt] validate_model error:", error)
        return {
          model: opts?.model ?? "",
          valid: false,
          problems: [String(error)],
        }
      }
    },
    installModel: async (opts, onProgress) => {
      // Subscribe to install_progress events for the duration of the
      // install. The plugin emits one for every fractionCompleted tick
      // plus phase transitions (downloading → verifying → verified | failed).
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
        }>("plugin:stt|install_model", { args: { model: opts.model } })
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
