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
  let disposed = false
  let running = false
  let generation = 0
  let queue: Array<{ uiCode: string; text: string; rate: number }> = []

  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const delayUnlessInterrupted = async (ms: number, gen: number) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (disposed || gen !== generation) {
        return
      }
      await delay(120)
    }
  }

  const estimateDurationMs = (text: string, rate: number) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length
    const wpm = 160 * Math.max(rate, 0.4)
    const ms = (words / wpm) * 60000
    return Math.max(1800, Math.min(ms + 600, 12000))
  }

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
    generation += 1
    queue = []
    await stopNativeSpeech()
  }

  let lastEnqueued: { uiCode: string; text: string; at: number } | null = null

  const runQueue = async () => {
    if (running) {
      return
    }
    running = true
    while (queue.length && !disposed) {
      const currentGen = generation
      const next = queue.shift()
      if (!next) {
        break
      }
      if (currentGen !== generation) {
        continue
      }
      await speakWithStackPrefs(next.uiCode, next.text, next.rate)
      if (currentGen !== generation) {
        continue
      }
      const wait = estimateDurationMs(next.text, next.rate)
      await delayUnlessInterrupted(wait, currentGen)
    }
    running = false
  }

  const speakScheduled = async (uiCode: string, text: string) => {
    if (disposed) {
      return
    }
    const { rate } = useSettingsStore.getState()
    const now = Date.now()
    if (
      lastEnqueued &&
      lastEnqueued.uiCode === uiCode &&
      lastEnqueued.text === text &&
      now - lastEnqueued.at < 600
    ) {
      return
    }
    lastEnqueued = { uiCode, text, at: now }
    queue.push({ uiCode, text, rate })
    void runQueue()
  }

  const dispose = () => {
    disposed = true
    queue = []
    running = false
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
