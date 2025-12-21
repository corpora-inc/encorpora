import { invoke } from "@tauri-apps/api/core"

import { speakWithStackPrefs } from "@/util/speakWithStackPrefs"
import { useSettingsStore } from "@/store/settings"
import type { HostApi } from "./types"

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

export const createHostApi = (): HostApi => {
  return {
    speak: async (uiCode, text) => {
      const { rate } = useSettingsStore.getState()
      await speakWithStackPrefs(uiCode, text, rate)
    },
    getStackConfig: () => {
      return getStackSnapshot()
    },
    onStackConfigChange: (listener) => {
      const emit = () => {
        listener(getStackSnapshot())
      }
      emit()
      const unsubscribe = useSettingsStore.subscribe(() => {
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
    getEntryById: async (entryId) => {
      return invoke("get_entry_by_id_with_translations", { entryId })
    },
  }
}
