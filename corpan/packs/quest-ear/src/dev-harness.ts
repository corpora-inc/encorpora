// DEV-ONLY browser harness — lets you play quest-ear in a plain browser without
// the Corpán host. Provides a mock HostApi (Web Speech TTS + live caption) and a
// language picker that drives the NPC language rotation. NOT shipped in the pack
// zip (only manifest.json + dist/ are packaged); index.html/this file are dev-only.
import "./main"
import type { HostApi, StackConfig } from "./sdk/types"

type Mountable = {
  mount: (
    c: HTMLElement,
    h: HostApi,
    s?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
type GlobalScope = typeof globalThis & { CorpanGames?: Record<string, Mountable> }

const ALL = [
  "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR", "de", "nl", "no", "sv",
  "da", "fi", "hu", "lt", "pl", "cs", "sk", "sl", "hr", "sr", "bg", "uk", "ru",
  "el", "tr", "he", "ar", "fa", "ur", "pa-Arab", "pa-Guru", "hi", "ne", "bn",
  "mr", "gu", "kn", "te", "ta", "th", "vi", "id", "ms", "sw", "zh-Hans",
  "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
]
const DEFAULT = ["es", "fr", "de", "ja", "ar", "sw", "el", "hi", "yue-Hant-HK", "sr", "ko-polite", "ne"]

// corpan code -> BCP-47 tag for browser voice matching
const TAG: Record<string, string> = {
  "pt-BR": "pt-BR", "pt-PT": "pt-PT", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW",
  "yue-Hant-HK": "zh-HK", "ko-polite": "ko-KR", "pa-Arab": "pa", "pa-Guru": "pa",
  no: "nb-NO", he: "he-IL", el: "el-GR", uk: "uk-UA", sr: "sr-RS", cs: "cs-CZ",
}
const bcp47 = (c: string) => TAG[c] || c

let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => { voices = window.speechSynthesis?.getVoices?.() ?? [] }
loadVoices()
window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices)
const pickVoice = (c: string) => {
  const tag = bcp47(c).toLowerCase()
  const base = tag.split("-")[0]
  return (
    voices.find((v) => v.lang.toLowerCase() === tag) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  )
}

let languages = [...DEFAULT]
const makeConfig = (): StackConfig => ({
  activeStackId: "dev",
  languages,
  domains: [],
  levels: [],
  rate: 1,
  textSize: "md",
  showRomanization: false,
})

// --- caption overlay: shows the last spoken line + whether a voice exists ---
const cap = document.createElement("div")
cap.style.cssText =
  "position:fixed;left:8px;bottom:8px;max-width:60ch;padding:8px 28px 8px 12px;background:rgba(0,0,0,.8);color:#9f9;font:14px/1.4 monospace;border:1px solid #393;border-radius:6px;z-index:9999;white-space:pre-wrap"
const capClose = document.createElement("button")
capClose.textContent = "×"
capClose.title = "hide caption"
capClose.style.cssText =
  "position:absolute;top:2px;right:6px;background:none;border:none;color:#9f9;font:16px monospace;cursor:pointer"
capClose.onclick = () => {
  cap.style.display = "none"
}
const capText = document.createElement("span")
capText.textContent = "▶ speak() output will show here"
cap.appendChild(capClose)
cap.appendChild(capText)
document.body.appendChild(cap)
const showCaption = (lang: string, text: string) => {
  const v = pickVoice(lang)
  capText.textContent = `[${lang}] ${text}\n${v ? "voice: " + v.name : "(no local voice for this language — text only)"}`
  cap.style.display = ""
}

const host: HostApi = {
  speak: (lang, text) => {
    try {
      window.speechSynthesis?.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(lang)
      if (v) u.voice = v
      u.lang = bcp47(lang)
      window.speechSynthesis?.speak(u)
    } catch (e) {
      console.warn("[dev-harness] speak failed", e)
    }
    showCaption(lang, text)
  },
  stopSpeech: () => window.speechSynthesis?.cancel(),
  getStackConfig: makeConfig,
  onStackConfigChange: () => () => {},
}

const root = document.getElementById("corpan-game-root") as HTMLElement
const scope = globalThis as GlobalScope
let handle: { unmount?: () => void } | void

const mountGame = () => {
  if (handle && handle.unmount) handle.unmount()
  root.innerHTML = ""
  handle = scope.CorpanGames?.quest_ear?.mount(root, host, { stackConfig: makeConfig() })
}

// --- language picker ---
const bar = document.createElement("div")
bar.style.cssText =
  "position:fixed;top:8px;left:8px;z-index:9999;background:rgba(0,0,0,.8);color:#cfc;font:12px/1.3 monospace;padding:8px;border:1px solid #393;border-radius:6px;max-height:90vh;overflow:auto"
const header = document.createElement("div")
header.style.cssText = "cursor:pointer;user-select:none"
bar.appendChild(header)

const panel = document.createElement("div")
panel.style.marginTop = "6px"
bar.appendChild(panel)

let open = false
const setOpen = (v: boolean) => {
  open = v
  panel.style.display = open ? "" : "none"
  header.textContent = (open ? "▾" : "▸") + " languages (NPC rotation)"
}
header.onclick = () => setOpen(!open)

for (const code of ALL) {
  const label = document.createElement("label")
  label.style.cssText = "display:inline-block;width:7.5em;cursor:pointer"
  const cb = document.createElement("input")
  cb.type = "checkbox"
  cb.checked = languages.includes(code)
  cb.dataset.code = code
  label.appendChild(cb)
  label.appendChild(document.createTextNode(" " + code))
  panel.appendChild(label)
}
const apply = document.createElement("button")
apply.textContent = "Apply + restart"
apply.style.cssText = "display:block;margin-top:6px;cursor:pointer"
apply.onclick = () => {
  const picked = [...panel.querySelectorAll<HTMLInputElement>("input[type=checkbox]")]
    .filter((c) => c.checked)
    .map((c) => c.dataset.code as string)
  languages = picked.length ? picked : ["en"]
  mountGame()
  setOpen(false)
}
panel.appendChild(apply)

// DEV-ONLY: jump straight to the Rat King lair (a short walk from the trigger).
const boss = document.createElement("button")
boss.textContent = "🐀 Jump to Rat King"
boss.style.cssText = "display:block;margin-top:6px;cursor:pointer"
boss.onclick = () => {
  ;(globalThis as { __questEarDebugStartX?: number }).__questEarDebugStartX = 79600
  mountGame()
  setOpen(false)
}
panel.appendChild(boss)

setOpen(false)
document.body.appendChild(bar)

// In the real Corpán app the host closes the pack on corpan:exit. The harness has
// nowhere to "exit" to, so we actually unmount + show a Restart button — otherwise
// the exit button looks dead in-browser.
window.addEventListener("corpan:exit", () => {
  if (handle && handle.unmount) handle.unmount()
  handle = undefined
  root.innerHTML =
    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#cfc;font:16px/1.4 monospace;background:#0f0f23"><div>↩ Exited the pack (corpan:exit). In Corpán this closes the game.</div><button id="dev-restart" style="font:14px monospace;padding:8px 16px;cursor:pointer">▶ Restart</button></div>'
  document.getElementById("dev-restart")?.addEventListener("click", () => mountGame())
  capText.textContent = "▶ corpan:exit fired — host would close the pack here."
  cap.style.display = ""
})

mountGame()
