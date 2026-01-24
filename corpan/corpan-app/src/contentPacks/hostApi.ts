import { invoke } from "@tauri-apps/api/core"

import { speakWithStackPrefs } from "@/util/speakWithStackPrefs"
import { useSettingsStore } from "@/store/settings"
import type { HostApi, PackDbQuery } from "./types"

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

  const dispose = () => {
    disposed = true
  }

  const resolvePackId = (query: PackDbQuery) => {
    return query.packId ?? packId
  }

  return {
    speak: async (uiCode, text) => {
      await speakImmediate(uiCode, text)
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
  }
}
