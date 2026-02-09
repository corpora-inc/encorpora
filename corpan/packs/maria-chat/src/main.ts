import "./styles.css"
import type {
  GameModule,
  HostApiTtsVoiceQuery,
  LocalLlmMessage,
  LocalLlmStreamHandle,
  PackLlmConfig,
  PackLlmDefaults,
  PackLlmModel,
  TtsVoice,
} from "./sdk/types"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __mariaChat?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "maria_chat"
const MARIA_VOICE_STORAGE_KEY = "maria-chat:selected-voice-id"
const VOICE_PREVIEW_TEXT = "Hola, soy María."

const sanitizeText = (input: string) => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

const isSpanishVoice = (voice: TtsVoice) => {
  const language = voice.language?.toLowerCase() ?? ""
  return language === "es" || language.startsWith("es-")
}

const getStoredVoiceId = () => {
  if (typeof localStorage === "undefined") {
    return ""
  }
  return localStorage.getItem(MARIA_VOICE_STORAGE_KEY) ?? ""
}

const setStoredVoiceId = (voiceId: string) => {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.setItem(MARIA_VOICE_STORAGE_KEY, voiceId)
}

const renderVoiceLabel = (voice: TtsVoice) => {
  const name = voice.name?.trim() || voice.id
  return `${name} • ${voice.language}`
}

const compareVoices = (left: TtsVoice, right: TtsVoice) => {
  const leftWeight = left.gender === "female" ? 0 : 1
  const rightWeight = right.gender === "female" ? 0 : 1
  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight
  }
  return renderVoiceLabel(left).localeCompare(renderVoiceLabel(right), undefined, {
    sensitivity: "base",
  })
}

const buildPromptMessages = (history: LocalLlmMessage[]) => {
  const system: LocalLlmMessage = {
    role: "system",
    content:
      "You are Maria, a concise and supportive language tutor. Keep answers practical and direct.",
  }
  const filtered = history.filter((message) => {
    if (message.role !== "assistant") {
      return true
    }
    return message.content.trim().length > 0
  })
  const trimmed = filtered.slice(-18)
  return [system, ...trimmed]
}

const pickDefaultModel = (models: PackLlmModel[], fallbackModelId?: string) => {
  return (
    models.find((model) => model.id === fallbackModelId) ??
    models.find((model) => model.recommended) ??
    models[0] ??
    null
  )
}

const resolveModelPath = (config: PackLlmConfig) => {
  if (!config.models.length) {
    throw new Error("This pack does not expose any model assets.")
  }

  const availableModels = config.models.filter((model) => model.exists)
  if (!availableModels.length) {
    throw new Error("No usable model assets were found after pack install.")
  }

  const selected = pickDefaultModel(availableModels, config.defaultModel)
  if (!selected) {
    throw new Error("Unable to select a local model.")
  }

  return selected.relativePath
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi) => {
      const scope = globalThis as GlobalScope
      if (scope.__mariaChat) {
        scope.__mariaChat.dispose()
        scope.__mariaChat = undefined
      }

      container.innerHTML = `
        <div class="maria-shell">
          <header class="maria-header">
            <h1 class="maria-title">María</h1>
            <div class="maria-header-actions">
              <button type="button" class="maria-icon-button" data-role="reset" aria-label="Reset conversation" title="Reset">↺</button>
              <div class="maria-voice-wrap">
                <button
                  type="button"
                  class="maria-icon-button"
                  data-role="voice-toggle"
                  aria-label="Voice settings"
                  aria-expanded="false"
                  title="Voice"
                >
                  ♪
                </button>
                <div class="maria-voice-popover" data-role="voice-popover" hidden>
                  <label class="sr-only" for="maria-voice-select">Voice</label>
                  <span class="maria-select-wrap">
                    <select id="maria-voice-select" data-role="voice" class="maria-voice-select"></select>
                    <span class="maria-select-chevron" aria-hidden="true">▾</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="maria-icon-button maria-exit-button"
                data-role="exit"
                aria-label="Exit Maria chat and return to Corpán"
                title="Exit"
              >
                ✕
              </button>
            </div>
          </header>
          <div class="maria-error" data-role="error" hidden></div>
          <section class="maria-transcript maria-transcript-empty" data-role="transcript"></section>
          <form class="maria-input-row" data-role="form">
            <textarea data-role="input" placeholder="Escribe a María…" rows="2"></textarea>
            <button type="submit" class="maria-send-button" data-role="send" data-mode="send" aria-label="Send message">
              <span data-role="send-icon" aria-hidden="true">↑</span>
            </button>
          </form>
        </div>
      `

      const resetButton = container.querySelector<HTMLButtonElement>("[data-role=reset]")
      const voiceToggleButton = container.querySelector<HTMLButtonElement>("[data-role=voice-toggle]")
      const voicePopover = container.querySelector<HTMLElement>("[data-role=voice-popover]")
      const voiceSelect = container.querySelector<HTMLSelectElement>("[data-role=voice]")
      const exitButton = container.querySelector<HTMLButtonElement>("[data-role=exit]")
      const errorNode = container.querySelector<HTMLElement>("[data-role=error]")
      const transcriptNode = container.querySelector<HTMLElement>("[data-role=transcript]")
      const formNode = container.querySelector<HTMLFormElement>("[data-role=form]")
      const inputNode = container.querySelector<HTMLTextAreaElement>("[data-role=input]")
      const sendButton = container.querySelector<HTMLButtonElement>("[data-role=send]")
      const sendIcon = container.querySelector<HTMLElement>("[data-role=send-icon]")

      if (
        !resetButton ||
        !voiceToggleButton ||
        !voicePopover ||
        !voiceSelect ||
        !exitButton ||
        !errorNode ||
        !transcriptNode ||
        !formNode ||
        !inputNode ||
        !sendButton ||
        !sendIcon
      ) {
        throw new Error("Maria pack UI failed to initialize.")
      }

      let disposed = false
      let history: LocalLlmMessage[] = []
      let defaults: PackLlmDefaults = {}
      let selectedModelPath = ""
      let activeStream: LocalLlmStreamHandle | null = null
      let allSpanishVoices: TtsVoice[] = []
      let selectedVoiceId = ""
      let voicePopoverOpen = false

      const setError = (message: string | null) => {
        if (!message) {
          errorNode.hidden = true
          errorNode.textContent = ""
          return
        }
        errorNode.hidden = false
        errorNode.textContent = message
      }

      const supportsFixedVoice = () => {
        return typeof hostApi.speakWithVoice === "function" && typeof hostApi.listTtsVoices === "function"
      }

      const selectedVoice = () => {
        return allSpanishVoices.find((voice) => voice.id === selectedVoiceId) ?? null
      }

      const setVoicePopoverOpen = (open: boolean) => {
        const canOpen =
          supportsFixedVoice() &&
          allSpanishVoices.length > 0 &&
          !activeStream &&
          !voiceToggleButton.disabled &&
          !voiceToggleButton.hidden
        voicePopoverOpen = open && canOpen
        voicePopover.hidden = !voicePopoverOpen
        voiceToggleButton.setAttribute("aria-expanded", voicePopoverOpen ? "true" : "false")
      }

      const syncVoiceControls = () => {
        const voiceApiReady = supportsFixedVoice()
        voiceToggleButton.hidden = !voiceApiReady
        const enabled = voiceApiReady && allSpanishVoices.length > 0 && !activeStream
        voiceToggleButton.disabled = !enabled
        voiceSelect.disabled = !enabled
        if (!enabled) {
          setVoicePopoverOpen(false)
        }
      }

      const renderVoiceOptions = () => {
        voiceSelect.innerHTML = ""
        if (!allSpanishVoices.length) {
          const option = document.createElement("option")
          option.value = ""
          option.textContent = "Sin voz ES"
          voiceSelect.appendChild(option)
          selectedVoiceId = ""
          syncVoiceControls()
          return
        }

        const storedVoiceId = getStoredVoiceId()
        const defaultVoice =
          allSpanishVoices.find((voice) => voice.id === selectedVoiceId) ??
          allSpanishVoices.find((voice) => voice.id === storedVoiceId) ??
          allSpanishVoices.find((voice) => voice.gender === "female") ??
          allSpanishVoices[0]

        for (const voice of allSpanishVoices) {
          const option = document.createElement("option")
          option.value = voice.id
          option.textContent = renderVoiceLabel(voice)
          voiceSelect.appendChild(option)
        }

        selectedVoiceId = defaultVoice.id
        voiceSelect.value = defaultVoice.id
        setStoredVoiceId(defaultVoice.id)
        syncVoiceControls()
      }

      const loadSpanishVoices = async () => {
        if (!hostApi.listTtsVoices) {
          allSpanishVoices = []
          selectedVoiceId = ""
          renderVoiceOptions()
          return
        }

        try {
          const query: HostApiTtsVoiceQuery = { languagePrefix: "es" }
          const voices = await hostApi.listTtsVoices(query)
          allSpanishVoices = voices.filter(isSpanishVoice).sort(compareVoices)
          renderVoiceOptions()
        } catch {
          allSpanishVoices = []
          selectedVoiceId = ""
          renderVoiceOptions()
        }
      }

      const speakMaria = async (text: string) => {
        const cleaned = text.trim()
        if (!cleaned || disposed) {
          return
        }

        try {
          if (hostApi.stopSpeech) {
            await hostApi.stopSpeech()
          }

          if (hostApi.speakWithVoice && selectedVoiceId) {
            const voice = selectedVoice()
            const language = voice?.language || "es-ES"
            await hostApi.speakWithVoice(language, cleaned, {
              voiceId: selectedVoiceId,
            })
            return
          }

          await hostApi.speak("es-ES", cleaned)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Maria TTS playback failed."
          setError(message)
        }
      }

      const renderTranscript = () => {
        transcriptNode.innerHTML = ""
        const visibleMessages = history.filter((message) => message.role !== "system")
        transcriptNode.classList.toggle("maria-transcript-empty", visibleMessages.length === 0)
        if (visibleMessages.length === 0) {
          return
        }

        for (const message of visibleMessages) {
          const article = document.createElement("article")
          article.className = `bubble ${message.role === "user" ? "bubble-user" : "bubble-assistant"}`

          const content = document.createElement("p")
          content.className = "bubble-text"
          const rendered = sanitizeText(message.content || "").replace(/\n/g, "<br />")
          content.innerHTML = rendered || "&nbsp;"
          article.appendChild(content)

          transcriptNode.appendChild(article)
        }
        transcriptNode.scrollTop = transcriptNode.scrollHeight
      }

      const setBusy = (busy: boolean) => {
        sendButton.dataset.mode = busy ? "stop" : "send"
        sendButton.setAttribute("aria-label", busy ? "Stop generation" : "Send message")
        sendIcon.textContent = busy ? "■" : "↑"
        sendButton.disabled = !busy && !selectedModelPath
        syncVoiceControls()
      }

      const ensureRuntimeApi = () => {
        if (!hostApi.startLocalLlmStream || !hostApi.getPackLlmConfig) {
          throw new Error(
            "Host runtime is missing local LLM APIs. Update the Corpán host app to use GGUF packs."
          )
        }
      }

      const onVoiceChange = () => {
        selectedVoiceId = voiceSelect.value
        if (selectedVoiceId) {
          setStoredVoiceId(selectedVoiceId)
        }
        setVoicePopoverOpen(false)
        setError(null)
        void speakMaria(VOICE_PREVIEW_TEXT)
      }

      const cancelActive = async () => {
        if (!activeStream) {
          if (hostApi.stopSpeech) {
            await hostApi.stopSpeech()
          }
          return
        }

        const stream = activeStream
        activeStream = null
        setBusy(false)
        await stream.cancel()
        if (hostApi.stopSpeech) {
          await hostApi.stopSpeech()
        }
      }

      const onReset = async () => {
        await cancelActive()
        history = []
        renderTranscript()
        setError(null)
        setVoicePopoverOpen(false)
      }

      const onExit = async () => {
        await cancelActive()
        window.dispatchEvent(new CustomEvent("corpan:exit"))
      }

      const onSend = async (event: SubmitEvent) => {
        event.preventDefault()
        if (disposed) {
          return
        }

        if (activeStream) {
          void cancelActive()
          return
        }

        const rawInput = inputNode.value.trim()
        if (!rawInput) {
          return
        }

        try {
          ensureRuntimeApi()
          if (!selectedModelPath) {
            throw new Error("Local model is not ready.")
          }

          if (hostApi.stopSpeech) {
            await hostApi.stopSpeech()
          }

          setError(null)
          const userMessage: LocalLlmMessage = { role: "user", content: rawInput }
          const assistantMessage: LocalLlmMessage = { role: "assistant", content: "" }
          history = [...history, userMessage, assistantMessage]
          inputNode.value = ""
          renderTranscript()
          setBusy(true)

          const stream = await hostApi.startLocalLlmStream!(
            {
              modelPath: selectedModelPath,
              messages: buildPromptMessages(history),
              maxTokens: defaults.maxTokens ?? 256,
              temperature: defaults.temperature ?? 0.7,
              topP: defaults.topP ?? 0.9,
              repeatPenalty: defaults.repeatPenalty ?? 1.1,
              contextLength: defaults.contextLength ?? 4096,
            },
            {
              onDelta: (delta) => {
                assistantMessage.content += delta
                renderTranscript()
              },
              onDone: (output) => {
                if (output.trim().length > 0) {
                  assistantMessage.content = output
                }
                activeStream = null
                setBusy(false)
                renderTranscript()
                void speakMaria(assistantMessage.content)
              },
              onCancelled: (output) => {
                if (output.trim().length > 0) {
                  assistantMessage.content = output
                }
                if (!assistantMessage.content.trim()) {
                  history = history.filter((message) => message !== assistantMessage)
                }
                activeStream = null
                setBusy(false)
                renderTranscript()
              },
              onError: (message) => {
                if (!assistantMessage.content.trim()) {
                  history = history.filter((entry) => entry !== assistantMessage)
                }
                activeStream = null
                setBusy(false)
                setError(message)
                renderTranscript()
              },
            }
          )

          activeStream = stream
        } catch (err) {
          activeStream = null
          setBusy(false)
          const message = err instanceof Error ? err.message : "Failed to start local model generation."
          setError(message)
          renderTranscript()
        }
      }

      const onInputKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          formNode.requestSubmit()
        }
      }

      const onVoiceToggleClick = () => {
        setVoicePopoverOpen(!voicePopoverOpen)
      }

      const onExitClick = () => {
        void onExit()
      }

      const onResetClick = () => {
        void onReset()
      }

      const onDocumentPointerDown = (event: PointerEvent) => {
        if (!voicePopoverOpen) {
          return
        }
        const target = event.target
        if (!(target instanceof Node)) {
          return
        }
        if (voicePopover.contains(target) || voiceToggleButton.contains(target)) {
          return
        }
        setVoicePopoverOpen(false)
      }

      const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return
        }
        if (voicePopoverOpen) {
          setVoicePopoverOpen(false)
          return
        }
        if (activeStream) {
          void cancelActive()
        }
      }

      formNode.addEventListener("submit", onSend)
      inputNode.addEventListener("keydown", onInputKeyDown)
      resetButton.addEventListener("click", onResetClick)
      exitButton.addEventListener("click", onExitClick)
      voiceToggleButton.addEventListener("click", onVoiceToggleClick)
      voiceSelect.addEventListener("change", onVoiceChange)
      window.addEventListener("pointerdown", onDocumentPointerDown)
      window.addEventListener("keydown", onWindowKeyDown)
      setBusy(false)

      const bootstrap = async () => {
        try {
          ensureRuntimeApi()

          const runtime = await hostApi.getLocalLlmRuntimeStatus?.()
          if (runtime && !runtime.available) {
            throw new Error(
              runtime.detail
                ? `Local runtime unavailable: ${runtime.detail}`
                : "Local runtime unavailable."
            )
          }

          const config = await hostApi.getPackLlmConfig!()
          defaults = config.defaults ?? {}
          selectedModelPath = resolveModelPath(config)

          if (supportsFixedVoice()) {
            await loadSpanishVoices()
          } else {
            syncVoiceControls()
          }

          setBusy(false)
        } catch (err) {
          selectedModelPath = ""
          setBusy(false)
          const message = err instanceof Error ? err.message : "Failed to initialize Maria pack."
          setError(message)
        }
      }

      void bootstrap()
      renderTranscript()

      const dispose = () => {
        disposed = true
        formNode.removeEventListener("submit", onSend)
        inputNode.removeEventListener("keydown", onInputKeyDown)
        voiceToggleButton.removeEventListener("click", onVoiceToggleClick)
        voiceSelect.removeEventListener("change", onVoiceChange)
        exitButton.removeEventListener("click", onExitClick)
        resetButton.removeEventListener("click", onResetClick)
        window.removeEventListener("pointerdown", onDocumentPointerDown)
        window.removeEventListener("keydown", onWindowKeyDown)
        if (hostApi.stopSpeech) {
          void hostApi.stopSpeech()
        }
        void cancelActive()
      }

      scope.__mariaChat = { dispose }
      return {
        unmount: () => {
          dispose()
          if (scope.__mariaChat?.dispose === dispose) {
            scope.__mariaChat = undefined
          }
        },
      }
    },
  }
}

registerGame()
