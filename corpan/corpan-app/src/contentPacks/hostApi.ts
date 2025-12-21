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
  let lastSpokenAt = 0
  let speaking = false
  let disposed = false
  let pending: { uiCode: string; text: string } | null = null

  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const speakScheduled = async (uiCode: string, text: string) => {
    if (disposed) {
      return
    }
    pending = { uiCode, text }
    if (speaking) {
      return
    }
    speaking = true

    while (pending) {
      const next = pending
      pending = null

      const now = Date.now()
      const gap = 1200
      const wait = Math.max(0, gap - (now - lastSpokenAt))
      if (wait) {
        await delay(wait)
      }

      if (!disposed) {
        const { rate } = useSettingsStore.getState()
        await speakWithStackPrefs(next.uiCode, next.text, rate)
        lastSpokenAt = Date.now()
      }
    }

    speaking = false
  }

  const stopSpeech = async () => {
    pending = null
    speaking = false
    lastSpokenAt = 0
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    try {
      await invoke("plugin:tts|stop")
    } catch {
      // native stop not available on all builds; ignore
    }
  }

  const dispose = () => {
    disposed = true
    pending = null
    speaking = false
  }

  return {
    speak: async (uiCode, text) => {
      await speakScheduled(uiCode, text)
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
