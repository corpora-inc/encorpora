import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

import { createVoiceTTS, createVoiceTTSConcurrent } from "@/util/speak"
import { speakWithStackPrefs, speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs"
import { getVoicesCached, type VoiceInfo } from "@/util/tts-voices"
import { useSettingsStore } from "@/store/settings"
import type {
  HostApi,
  HostApiSpeakVoiceOptions,
  HostApiTtsVoiceQuery,
  LocalLlmGenerateRequest,
  LocalLlmRuntimeStatus,
  LocalLlmStreamCallbacks,
  PackDbQuery,
  PackLlmConfig,
  TtsVoice,
  TtsVoiceGender,
} from "./types"

const EVENT_LLM_DELTA = "corpan://local-llm/delta"
const EVENT_LLM_DONE = "corpan://local-llm/done"
const EVENT_LLM_CANCELLED = "corpan://local-llm/cancelled"
const EVENT_LLM_ERROR = "corpan://local-llm/error"

type LocalLlmStartResponse = {
  requestId: string
}

type LocalLlmCancelResponse = {
  requestId: string
  cancelled: boolean
}

type LocalLlmDeltaEventPayload = {
  requestId: string
  delta: string
  accumulatedText: string
}

type LocalLlmDoneEventPayload = {
  requestId: string
  output: string
}

type LocalLlmErrorEventPayload = {
  requestId: string
  message: string
}

const activeLlmStreams = new Map<string, LocalLlmStreamCallbacks>()
let llmListenersReady: Promise<void> | null = null

const ensureLocalLlmListeners = () => {
  if (llmListenersReady) {
    return llmListenersReady
  }

  llmListenersReady = (async () => {
    await listen<LocalLlmDeltaEventPayload>(EVENT_LLM_DELTA, (event) => {
      const payload = event.payload
      const handlers = activeLlmStreams.get(payload.requestId)
      handlers?.onDelta?.(payload.delta, payload.accumulatedText)
    })

    await listen<LocalLlmDoneEventPayload>(EVENT_LLM_DONE, (event) => {
      const payload = event.payload
      const handlers = activeLlmStreams.get(payload.requestId)
      handlers?.onDone?.(payload.output)
      activeLlmStreams.delete(payload.requestId)
    })

    await listen<LocalLlmDoneEventPayload>(EVENT_LLM_CANCELLED, (event) => {
      const payload = event.payload
      const handlers = activeLlmStreams.get(payload.requestId)
      handlers?.onCancelled?.(payload.output)
      activeLlmStreams.delete(payload.requestId)
    })

    await listen<LocalLlmErrorEventPayload>(EVENT_LLM_ERROR, (event) => {
      const payload = event.payload
      const handlers = activeLlmStreams.get(payload.requestId)
      handlers?.onError?.(payload.message)
      activeLlmStreams.delete(payload.requestId)
    })
  })()

  return llmListenersReady
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

const normalizeVoiceGender = (gender?: string): TtsVoiceGender => {
  if (!gender) {
    return "unspecified"
  }
  const normalized = gender.trim().toLowerCase()
  if (normalized === "male" || normalized === "female") {
    return normalized
  }
  return "unspecified"
}

const matchesLanguagePrefix = (voiceLanguage: string, languagePrefix: string) => {
  const want = languagePrefix.trim().toLowerCase()
  if (!want) {
    return true
  }
  const lang = voiceLanguage.trim().toLowerCase()
  return lang === want || lang.startsWith(`${want}-`)
}

const normalizeVoice = (voice: VoiceInfo): TtsVoice => ({
  id: voice.id,
  name: voice.name ?? undefined,
  language: voice.language,
  gender: normalizeVoiceGender(voice.gender),
  quality: voice.quality,
  engine: voice.engine ?? undefined,
  networkRequired: voice.networkRequired,
})

const queryVoices = (voices: TtsVoice[], query?: HostApiTtsVoiceQuery) => {
  let filtered = voices

  if (query?.languagePrefix?.trim()) {
    filtered = filtered.filter((voice) =>
      matchesLanguagePrefix(voice.language, query.languagePrefix ?? "")
    )
  }

  if (query?.femaleOnly) {
    filtered = filtered.filter((voice) => voice.gender === "female")
  } else if (query?.gender) {
    filtered = filtered.filter((voice) => voice.gender === query.gender)
  }

  return filtered.sort((left, right) => {
    const leftName = (left.name ?? left.id).toLowerCase()
    const rightName = (right.name ?? right.id).toLowerCase()
    if (leftName < rightName) {
      return -1
    }
    if (leftName > rightName) {
      return 1
    }
    return left.id.localeCompare(right.id)
  })
}

export const createHostApi = (packId?: string): HostApi => {
  let disposed = false
  const ownedLlmRequestIds = new Set<string>()

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

  const speakWithVoice = async (
    uiCode: string,
    text: string,
    options?: HostApiSpeakVoiceOptions
  ) => {
    if (disposed) {
      return
    }
    const rate = typeof options?.rate === "number"
      ? options.rate
      : useSettingsStore.getState().rate
    await createVoiceTTS(uiCode)(text, rate, options?.voiceId)
  }

  const speakConcurrentWithVoice = async (
    uiCode: string,
    text: string,
    options?: HostApiSpeakVoiceOptions
  ): Promise<string> => {
    if (disposed) {
      return ""
    }
    const rate = typeof options?.rate === "number"
      ? options.rate
      : useSettingsStore.getState().rate
    return await createVoiceTTSConcurrent(uiCode)(text, rate, options?.voiceId)
  }

  const listTtsVoices = async (query?: HostApiTtsVoiceQuery): Promise<TtsVoice[]> => {
    const voices = await getVoicesCached({ maxAgeMs: 15_000 })
    const normalized = voices.map(normalizeVoice)
    return queryVoices(normalized, query)
  }

  const cancelLocalRequest = async (requestId: string): Promise<boolean> => {
    const response = await invoke<LocalLlmCancelResponse>("local_llm_cancel", {
      requestId,
    })
    return response.cancelled
  }

  const dispose = () => {
    disposed = true
    const ids = Array.from(ownedLlmRequestIds)
    ownedLlmRequestIds.clear()
    for (const requestId of ids) {
      void cancelLocalRequest(requestId)
      activeLlmStreams.delete(requestId)
    }
  }

  const resolvePackId = (query?: PackDbQuery | { packId?: string }) => {
    return query?.packId ?? packId
  }

  const resolveRequiredPackId = (context: string) => {
    const resolved = resolvePackId()
    if (!resolved) {
      throw new Error(`Pack ID is required to ${context}.`)
    }
    return resolved
  }

  return {
    speak: async (uiCode, text) => {
      await speakImmediate(uiCode, text)
    },
    speakConcurrent: async (uiCode, text) => {
      return await speakConcurrent(uiCode, text)
    },
    speakWithVoice: async (uiCode, text, options) => {
      await speakWithVoice(uiCode, text, options)
    },
    speakConcurrentWithVoice: async (uiCode, text, options) => {
      return await speakConcurrentWithVoice(uiCode, text, options)
    },
    listTtsVoices: async (query) => {
      return await listTtsVoices(query)
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
    resolvePackAssetPath: async (relativePath: string) => {
      const resolvedPackId = resolveRequiredPackId("resolve pack assets")
      return invoke<string>("content_packs_resolve_asset_path", {
        packId: resolvedPackId,
        relativePath,
      })
    },
    getPackLlmConfig: async () => {
      const resolvedPackId = resolveRequiredPackId("read pack LLM config")
      return invoke<PackLlmConfig>("content_packs_get_llm_config", {
        packId: resolvedPackId,
      })
    },
    getLocalLlmRuntimeStatus: async () => {
      return invoke<LocalLlmRuntimeStatus>("local_llm_runtime_status")
    },
    cancelLocalLlmStream: async (requestId: string) => {
      const cancelled = await cancelLocalRequest(requestId)
      ownedLlmRequestIds.delete(requestId)
      activeLlmStreams.delete(requestId)
      return cancelled
    },
    startLocalLlmStream: async (
      request: LocalLlmGenerateRequest,
      callbacks?: LocalLlmStreamCallbacks
    ) => {
      await ensureLocalLlmListeners()
      const resolvedPackId = resolvePackId(request)
      const payload = {
        ...request,
        packId: resolvedPackId,
      }
      const response = await invoke<LocalLlmStartResponse>("local_llm_generate_stream", {
        request: payload,
      })
      if (callbacks) {
        activeLlmStreams.set(response.requestId, callbacks)
      } else {
        activeLlmStreams.delete(response.requestId)
      }
      ownedLlmRequestIds.add(response.requestId)

      return {
        requestId: response.requestId,
        cancel: async () => {
          const cancelled = await cancelLocalRequest(response.requestId)
          ownedLlmRequestIds.delete(response.requestId)
          if (cancelled) {
            activeLlmStreams.delete(response.requestId)
          }
          return cancelled
        },
      }
    },
  }
}
