import { addPluginListener, invoke } from "@tauri-apps/api/core"

import { speakWithStackPrefs, speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs"
import { useHistoryStore } from "@/store/history"
import { useSettingsStore } from "@/store/settings"
import { useRatingStore } from "@/store/rating"
import { usePhrasePacksStore } from "@/store/phrasePacks"
import { useDrawerStore } from "@/store/drawer"
import type { TextSizeType } from "@/store/settings"
import type { StackConfigPatch } from "./types"
import type {
  HostApi,
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
    getRandomEntries: async (count: number) => {
      const { levels, phrasePackIds, baseCorpusEnabled } =
        useSettingsStore.getState()
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
    stt,
  }
}
