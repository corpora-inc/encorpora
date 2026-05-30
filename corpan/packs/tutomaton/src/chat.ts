/**
 * Tutomaton — multilingual on-device language tutor (pack entry point).
 *
 * This is the SHELL. Per-language content (sqlite, prompts, retriever) lives
 * in `languages/<code>/` as a downloadable module, managed by LanguageManager.
 *
 *   user message
 *     → LanguageManager.current().retrieve(message)
 *     → if kind === "theme": render canonical list directly (no LLM call)
 *     → else: invoke llm_chat with messages + system prompt + grounding + reference
 *           → stream tokens into the message bubble via Tauri events
 *     → if TTS toggle on: hostApi.speak(activeLang.voiceLanguageCode, finalText)
 *
 * Voice mode: parlometron push-to-talk. On unmount, hostApi.stt.releaseAudio()
 * is non-negotiable for the iOS mic indicator.
 */

import { LanguageManager, type HostApi, type LanguageRegistryEntry, type LanguageRuntime } from "./languageManager"

// Minimal slice of @corpan/sdk's ContentPackModule that we actually use.
// (Other packs inline their own host-shape too — see packs/hover-runner.)
type ContentPackModule = {
  mount: (container: HTMLElement, hostApi: HostApi) => Promise<{ unmount?: () => void } | void> | { unmount?: () => void } | void
}

const PACK_ID = "tutomaton-v1"
const BASE_MODEL_ID = "llm-base-qwen3-4b-v1"

type Msg = { role: "user" | "assistant"; content: string }

type State = {
  messages: Msg[]
  ttsEnabled: boolean
  voiceModeEnabled: boolean
  activeLanguage: LanguageRuntime | null
  currentStreamId: string | null
  recording: boolean
  sttSession: string | null
}

// ============================================================
// Tauri bridge
// ============================================================

declare global {
  interface Window {
    __TAURI__?: {
      core: { invoke: (cmd: string, args?: object) => Promise<unknown> }
      event: {
        listen: (event: string, handler: (ev: { payload: unknown }) => void) => Promise<() => void>
      }
    }
  }
}

async function invoke<T = unknown>(cmd: string, args?: object): Promise<T> {
  if (!window.__TAURI__) throw new Error("Tauri runtime not available")
  return window.__TAURI__.core.invoke(cmd, args) as Promise<T>
}

async function listen(event: string, handler: (payload: unknown) => void): Promise<() => void> {
  if (!window.__TAURI__) throw new Error("Tauri runtime not available")
  return window.__TAURI__.event.listen(event, (ev) => handler(ev.payload))
}

async function llmEnsureLoaded(): Promise<void> {
  const status = await invoke<{ loaded: boolean; modelId?: string }>("plugin:corpan-llm|llm_status")
  if (status.loaded && status.modelId === BASE_MODEL_ID) return
  await invoke("plugin:corpan-llm|llm_load", { modelPackId: BASE_MODEL_ID })
}

async function llmChat(
  systemPrompt: string,
  messages: Msg[],
  onToken: (token: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void
): Promise<string> {
  const sessionId = await invoke<string>("plugin:corpan-llm|llm_chat", {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    options: { temperature: 0.55, topP: 0.9, repeatPenalty: 1.2, maxTokens: 1500 },
  })
  let buf = ""
  const unsubT = await listen(`llm-token:${sessionId}`, (payload) => {
    const t = String((payload as { token?: string }).token ?? "")
    buf += t
    onToken(t)
  })
  const unsubD = await listen(`llm-done:${sessionId}`, () => {
    unsubT(); unsubD(); unsubE()
    onDone(buf)
  })
  const unsubE = await listen(`llm-error:${sessionId}`, (payload) => {
    unsubT(); unsubD(); unsubE()
    onError(String((payload as { error?: string }).error ?? "unknown"))
  })
  return sessionId
}

// ============================================================
// Mount
// ============================================================

const PackModule: ContentPackModule = {
  async mount(container: HTMLElement, hostApi: HostApi) {
    const state: State = {
      messages: [],
      ttsEnabled: false,
      voiceModeEnabled: false,
      activeLanguage: null,
      currentStreamId: null,
      recording: false,
      sttSession: null,
    }

    // Pack manifest (already extracted by the host).
    const manifest = await fetch("./manifest.json").then((r) => r.json()) as {
      languages: LanguageRegistryEntry[]
    }
    const registry = manifest.languages

    // ---------- LanguageManager wiring ----------
    const langMgr = new LanguageManager({
      hostApi,
      packId: PACK_ID,
      registry,
      isInstalled: async (code) => {
        // hostApi exposes a per-pack file-presence check (the polish machine
        // will wire this to the existing pack-cache APIs). For dev, attempt
        // to fetch the language module manifest; if it 200s, it's installed.
        try {
          const r = await fetch(`./languages/${code}/module.json`)
          return r.ok
        } catch { return false }
      },
      install: async (entry) => {
        // hostApi.installModuleZip is a new host capability — the polish
        // machine wires it to the existing pack downloader, scoped to the
        // pack's data dir under `languages/<code>/`. For dev, the language
        // module is bundled with the pack ZIP already (zero-download path).
        if ((hostApi as unknown as { installModuleZip?: Function }).installModuleZip) {
          await (hostApi as unknown as {
            installModuleZip: (args: { packId: string; subPath: string; url: string; sha256: string }) => Promise<void>
          }).installModuleZip({
            packId: PACK_ID,
            subPath: `languages/${entry.code}`,
            url: entry.moduleUrl,
            sha256: entry.sha256,
          })
        }
      },
      loadModuleFile: async (code, rel) => {
        return fetch(`./languages/${code}/${rel}`).then((r) => r.text())
      },
    })

    // ---------- UI shell ----------
    container.innerHTML = `
      <div class="lt-root" data-pack="${PACK_ID}">
        <header class="lt-header">
          <h1 class="lt-title">Tutomaton</h1>
          <select class="lt-lang" aria-label="Language"></select>
          <div class="lt-controls">
            <button class="lt-tts" aria-label="Toggle text-to-speech">🔊</button>
            <button class="lt-voice" aria-label="Toggle voice mode">🎤</button>
            <button class="lt-clear" aria-label="Clear conversation">↻</button>
          </div>
        </header>
        <div class="lt-log" role="log" aria-live="polite"></div>
        <footer class="lt-input">
          <button class="lt-mic" aria-label="Hold to speak" hidden>●</button>
          <input class="lt-text" type="text" placeholder="Type in any language…" autocomplete="off">
          <button class="lt-send" aria-label="Send">→</button>
        </footer>
      </div>
    `

    const $log = container.querySelector<HTMLDivElement>(".lt-log")!
    const $input = container.querySelector<HTMLInputElement>(".lt-text")!
    const $send = container.querySelector<HTMLButtonElement>(".lt-send")!
    const $clear = container.querySelector<HTMLButtonElement>(".lt-clear")!
    const $ttsBtn = container.querySelector<HTMLButtonElement>(".lt-tts")!
    const $voiceBtn = container.querySelector<HTMLButtonElement>(".lt-voice")!
    const $mic = container.querySelector<HTMLButtonElement>(".lt-mic")!
    const $langSel = container.querySelector<HTMLSelectElement>(".lt-lang")!

    // Populate language picker
    const uiLocale = (navigator.language || "en").split("-")[0]
    for (const entry of registry) {
      const opt = document.createElement("option")
      opt.value = entry.code
      opt.textContent = entry.displayName[uiLocale] || entry.displayName.en || entry.code
      $langSel.appendChild(opt)
    }

    function bubble(role: "user" | "assistant", text = ""): HTMLDivElement {
      const wrap = document.createElement("div")
      wrap.className = `lt-msg lt-msg-${role}`
      const body = document.createElement("div")
      body.className = "lt-msg-body"
      body.textContent = text
      wrap.appendChild(body)
      $log.appendChild(wrap)
      $log.scrollTop = $log.scrollHeight
      return body
    }

    function renderSystemMessage(text: string) {
      const wrap = document.createElement("div")
      wrap.className = "lt-msg lt-msg-system"
      wrap.textContent = text
      $log.appendChild(wrap)
    }

    // ---------- language switching ----------
    async function switchLanguage(code: string) {
      $langSel.disabled = true
      renderSystemMessage(`Loading ${code}…`)
      try {
        state.activeLanguage = await langMgr.activate(code)
        state.messages = []  // reset conversation on language change
        $log.innerHTML = ""
        renderSystemMessage(`Ready in ${state.activeLanguage.code}.`)
      } catch (e) {
        renderSystemMessage(`Failed to load ${code}: ${e}`)
      } finally {
        $langSel.disabled = false
      }
    }

    $langSel.addEventListener("change", () => switchLanguage($langSel.value))

    // ---------- bootstrap ----------
    const installedCodes = await langMgr.installed()
    const initialCode = installedCodes[0] || registry[0]?.code
    if (initialCode) {
      $langSel.value = initialCode
      await Promise.all([
        switchLanguage(initialCode),
        llmEnsureLoaded().catch((e) => renderSystemMessage(`Loading model… ${e}`)),
      ])
    }

    // ---------- send a turn ----------
    async function send(text: string) {
      if (!text.trim() || state.currentStreamId || !state.activeLanguage) return
      const userText = text.trim()
      const lang = state.activeLanguage
      state.messages.push({ role: "user", content: userText })
      bubble("user", userText)
      $input.value = ""
      $send.disabled = true

      try {
        const rag = await lang.retrieve(userText)

        // THEME BYPASS — deliver canonical list directly, no LLM call.
        if (rag.kind === "theme" && rag.reference) {
          const intro = pickThemeIntro(lang.code)
          const body = stripThemeHeader(rag.reference)
          const full = `${intro}\n\n${body}`
          const dest = bubble("assistant")
          dest.textContent = full
          state.messages.push({ role: "assistant", content: full })
          maybeSpeak(full)
          $send.disabled = false
          return
        }

        const systemFull = rag.reference
          ? `${lang.systemPrompt}\n\n${lang.groundingInstruction}${rag.reference}`
          : lang.systemPrompt
        const dest = bubble("assistant", "…")
        let buf = ""
        state.currentStreamId = await llmChat(
          systemFull,
          state.messages,
          (tok) => {
            if (buf === "") dest.textContent = ""
            buf += tok
            dest.textContent = scrubOutput(buf)
          },
          (full) => {
            state.currentStreamId = null
            const cleaned = scrubOutput(full)
            dest.textContent = cleaned
            state.messages.push({ role: "assistant", content: cleaned })
            maybeSpeak(cleaned)
            $send.disabled = false
          },
          (err) => {
            state.currentStreamId = null
            dest.textContent = `[Error: ${err}]`
            $send.disabled = false
          }
        )
      } catch (e) {
        const errText = `[Error: ${e instanceof Error ? e.message : String(e)}]`
        bubble("assistant", errText)
        $send.disabled = false
      }
    }

    function scrubOutput(s: string): string {
      s = s.replace(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu,
        ""
      )
      s = s.replace(/^#{1,6}\s+/gm, "")
      s = s.replace(/\*\*([^*]+?)\*\*/g, "$1")
      s = s.replace(/\*\*/g, "")
      s = s.replace(/<\/?reference>/gi, "")
      s = s.replace(/[ \t]+(?=\n)/g, "")
      s = s.replace(/\n{3,}/g, "\n\n")
      return s.trim()
    }

    function maybeSpeak(text: string) {
      if (state.ttsEnabled && text && state.activeLanguage) {
        hostApi.speak(state.activeLanguage.voiceLanguageCode, text).catch((e) => console.error("[tts]", e))
      }
    }

    // ---------- UI events ----------
    $send.addEventListener("click", () => send($input.value))
    $input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        send($input.value)
      }
    })
    $clear.addEventListener("click", () => {
      state.messages = []
      $log.innerHTML = ""
      renderSystemMessage("Cleared.")
    })
    $ttsBtn.addEventListener("click", () => {
      state.ttsEnabled = !state.ttsEnabled
      $ttsBtn.classList.toggle("active", state.ttsEnabled)
      if (!state.ttsEnabled) hostApi.stopSpeech?.()
    })

    $voiceBtn.addEventListener("click", async () => {
      state.voiceModeEnabled = !state.voiceModeEnabled
      $voiceBtn.classList.toggle("active", state.voiceModeEnabled)
      $mic.hidden = !state.voiceModeEnabled
      $input.style.display = state.voiceModeEnabled ? "none" : ""
      $send.style.display = state.voiceModeEnabled ? "none" : ""
      if (state.voiceModeEnabled) {
        try {
          await hostApi.stt?.prepare?.({ model: "ggml-medium.bin" })
        } catch (e) {
          renderSystemMessage(`Couldn't prepare voice recognition: ${e}`)
          state.voiceModeEnabled = false
          $voiceBtn.classList.remove("active")
          $mic.hidden = true
          $input.style.display = ""
          $send.style.display = ""
        }
      } else {
        await hostApi.stt?.cancelSession?.({ sessionId: state.sttSession ?? "" }).catch(() => {})
      }
    })

    $mic.addEventListener("click", async () => {
      if (!state.voiceModeEnabled || !state.activeLanguage) return
      if (!state.recording) {
        const sessionId = crypto.randomUUID()
        state.sttSession = sessionId
        state.recording = true
        $mic.classList.add("recording")
        await hostApi.stt?.startSession?.({
          sessionId,
          language: state.activeLanguage.voiceLanguageCode,
          expectedText: "",
        })
      } else {
        const result = await hostApi.stt?.stopSession?.({ sessionId: state.sttSession ?? "" })
        state.recording = false
        $mic.classList.remove("recording")
        if (result?.text) send(result.text)
      }
    })

    return {
      unmount: () => {
        // CRITICAL for iOS — release the audio engine so the mic indicator clears.
        hostApi.stt?.releaseAudio?.().catch((e) => console.error("[tutomaton] releaseAudio failed:", e))
        if (state.ttsEnabled) hostApi.stopSpeech?.()
      },
    }
  },
}

// ============================================================
// Per-language theme intros
// ============================================================

const THEME_INTROS: Record<string, string[]> = {
  es: ["Aquí tienes el vocabulario:", "Aquí va la lista:", "Te dejo el vocabulario completo:", "Aquí lo tienes:"],
  zh: ["这是词汇表:", "给你列表:", "下面是完整的词汇:", "请看:"],
  en: ["Here's the vocabulary:", "Here's the list:", "Here you go:"],
}

function pickThemeIntro(code: string): string {
  const arr = THEME_INTROS[code] || THEME_INTROS.en
  return arr[Math.floor(Math.random() * arr.length)]
}

function stripThemeHeader(s: string): string {
  const lines = s.split("\n")
  if (lines[0]?.startsWith("# ")) {
    lines.shift()
    while (lines.length && !lines[0].trim()) lines.shift()
  }
  return lines.join("\n")
}

export default PackModule
