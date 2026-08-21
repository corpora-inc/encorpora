// Whisper tuner UI — bottom-sheet panel reachable via long-press on
// the language badge in the card. Power-user surface only: not in
// any normal-user flow. Live-applies to localStorage; the next
// recording sees the new params via `mergeForLang(lang)`.

import {
  BUILT_IN_PROFILES,
  LIBRARY_DEFAULTS,
  loadUserOverrides,
  resetAll,
  resetLang,
  setLangOverride,
  type WhisperParams,
} from "@shared/capabilities/pronounce/src/whisperTuning"

type NumericKey =
  | "temperature"
  | "temperature_inc"
  | "entropy_thold"
  | "logprob_thold"
  | "no_speech_thold"
  | "n_threads"

type BoolKey = "suppress_blank" | "suppress_nst"

type TextKey = "initial_prompt"

type NumericRow = {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  help: string
}

type BoolRow = {
  key: BoolKey
  label: string
  help: string
}

type TextRow = {
  key: TextKey
  label: string
  placeholder: string
  help: string
}

const NUMERIC_ROWS: NumericRow[] = [
  {
    key: "temperature_inc",
    label: "temperature_inc",
    min: 0,
    max: 0.5,
    step: 0.05,
    help:
      "Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). " +
      "0.0 disables retries entirely — one greedy decode, deterministic.",
  },
  {
    key: "temperature",
    label: "temperature",
    min: 0,
    max: 1.5,
    step: 0.05,
    help:
      "Initial decoding temperature. 0.0 = greedy. Raise to sample " +
      "from the start (almost never want for transcription).",
  },
  {
    key: "entropy_thold",
    label: "entropy_thold",
    min: 0,
    max: 10,
    step: 0.1,
    help:
      "Compression-ratio-style quality gate. Higher = more " +
      "permissive. Indic BPE routinely exceeds 2.4 default.",
  },
  {
    key: "logprob_thold",
    label: "logprob_thold",
    min: -5,
    max: 0,
    step: 0.1,
    help:
      "Avg per-token log-prob below which the decode is flagged " +
      "unconfident and the fallback fires.",
  },
  {
    key: "no_speech_thold",
    label: "no_speech_thold",
    min: 0,
    max: 1,
    step: 0.05,
    help:
      "Whisper's posterior threshold for 'this segment is silence.' " +
      "Above this, the segment emits nothing.",
  },
  {
    key: "n_threads",
    label: "n_threads",
    min: 0,
    max: 12,
    step: 1,
    help:
      "CPU thread count. 0 = let the plugin decide (cores − 2). " +
      "Higher uses more battery; lower can free the UI thread.",
  },
]

const BOOL_ROWS: BoolRow[] = [
  {
    key: "suppress_blank",
    label: "suppress_blank",
    help: "Suppress blank tokens at the start of a segment.",
  },
  {
    key: "suppress_nst",
    label: "suppress_nst",
    help:
      "Suppress non-speech tokens (music, noise markers). False by default.",
  },
]

const TEXT_ROWS: TextRow[] = [
  {
    key: "initial_prompt",
    label: "initial_prompt",
    placeholder: "(empty)",
    help:
      "Up to ~224 tokens prepended before decoding. Bias toward a " +
      "script/language; do NOT leak the expected phrase (model will " +
      "parrot it). Native-script primer recommended for Indic langs.",
  },
]

// ─── helpers ────────────────────────────────────────────────────────

const baseLang = (lang: string): string => lang.split("-")[0].toLowerCase()

const formatNum = (n: number, step: number): string => {
  if (step >= 1) return String(Math.round(n))
  if (step >= 0.1) return n.toFixed(1)
  return n.toFixed(2)
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// ─── singleton state ────────────────────────────────────────────────

let activeRoot: HTMLDivElement | null = null
let activeLang = ""

// ─── public API ─────────────────────────────────────────────────────

export const isTunerOpen = (): boolean => activeRoot !== null

export const openTuner = (lang: string): void => {
  if (activeRoot) closeTuner()
  activeLang = baseLang(lang)

  const root = document.createElement("div")
  root.className = "pc-tuner-root"
  root.innerHTML = renderRootHtml(activeLang)
  document.body.appendChild(root)

  // Animate in next frame so the slide-up plays.
  requestAnimationFrame(() => {
    root.classList.add("open")
  })

  // Backdrop / close-button / ESC.
  root.querySelector<HTMLElement>("[data-pc-tuner-backdrop]")?.addEventListener(
    "click",
    closeTuner
  )
  root.querySelector<HTMLElement>("[data-pc-tuner-close]")?.addEventListener(
    "click",
    closeTuner
  )

  // Drag-to-dismiss on the handle band. Lifted from the canonical
  // implementation at `packs/shared/ui/commandDrawer.ts:253-301`.
  // Threshold = 15% of sheet height, or quick downward flick
  // (velocity > 0.5 px/ms and dy > 20). Releases above threshold
  // snap back. Also: tapping (dy ≈ 0) closes — matches iOS handle
  // behaviour where a tap on the indicator dismisses the sheet.
  const handleEl = root.querySelector<HTMLElement>("[data-pc-tuner-handle]")
  const sheetEl = root.querySelector<HTMLElement>(".pc-tuner-sheet")
  if (handleEl && sheetEl) {
    let dragStartY = 0
    let dragStartTime = 0
    let isDragging = false
    const TAP_THRESHOLD_PX = 6
    handleEl.addEventListener("pointerdown", (e: PointerEvent) => {
      isDragging = true
      dragStartY = e.clientY
      dragStartTime = Date.now()
      handleEl.setPointerCapture(e.pointerId)
      sheetEl.style.transition = "none"
    })
    handleEl.addEventListener("pointermove", (e: PointerEvent) => {
      if (!isDragging) return
      const dy = Math.max(0, e.clientY - dragStartY)
      sheetEl.style.transform = `translateY(${dy}px)`
    })
    const finishDrag = (e: PointerEvent, canClose: boolean) => {
      if (!isDragging) return
      isDragging = false
      try {
        handleEl.releasePointerCapture(e.pointerId)
      } catch {
        /* pointer was already released */
      }
      const dy = e.clientY - dragStartY
      const elapsed = Date.now() - dragStartTime
      const velocity = elapsed > 0 ? dy / elapsed : 0
      const dragThreshold = sheetEl.offsetHeight * 0.15
      const dismiss =
        canClose &&
        (dy > dragThreshold ||
          (velocity > 0.5 && dy > 20) ||
          Math.abs(dy) < TAP_THRESHOLD_PX) // tap = dismiss
      sheetEl.style.transition = ""
      sheetEl.style.transform = ""
      if (dismiss) closeTuner()
    }
    handleEl.addEventListener("pointerup", (e: PointerEvent) =>
      finishDrag(e, true)
    )
    handleEl.addEventListener("pointercancel", (e: PointerEvent) =>
      finishDrag(e, false)
    )
  }
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTuner()
  })

  // Wire each numeric row: slider <-> numeric input <-> localStorage.
  for (const row of NUMERIC_ROWS) {
    wireNumericRow(root, row)
  }
  for (const row of BOOL_ROWS) {
    wireBoolRow(root, row)
  }
  for (const row of TEXT_ROWS) {
    wireTextRow(root, row)
  }

  // Footer actions.
  root.querySelector<HTMLElement>("[data-pc-tuner-copy]")?.addEventListener(
    "click",
    onCopyJson
  )
  root.querySelector<HTMLElement>("[data-pc-tuner-reset-lang]")?.addEventListener(
    "click",
    onResetLang
  )
  root.querySelector<HTMLElement>("[data-pc-tuner-reset-all]")?.addEventListener(
    "click",
    onResetAll
  )

  activeRoot = root
}

export const closeTuner = (): void => {
  if (!activeRoot) return
  const root = activeRoot
  activeRoot = null
  root.classList.remove("open")
  // Wait for the slide-out animation before removing from DOM.
  window.setTimeout(() => {
    if (root.parentNode) root.parentNode.removeChild(root)
  }, 240)
}

// ─── rendering ──────────────────────────────────────────────────────

const renderRootHtml = (lang: string): string => {
  const builtIn = BUILT_IN_PROFILES[lang] ?? {}
  const user = loadUserOverrides()[lang] ?? {}

  const numericRows = NUMERIC_ROWS.map((row) =>
    renderNumericRowHtml(row, builtIn, user)
  ).join("")
  const boolRows = BOOL_ROWS.map((row) =>
    renderBoolRowHtml(row, builtIn, user)
  ).join("")
  const textRows = TEXT_ROWS.map((row) =>
    renderTextRowHtml(row, builtIn, user)
  ).join("")

  return `
    <div class="pc-tuner-backdrop" data-pc-tuner-backdrop></div>
    <div class="pc-tuner-sheet" role="dialog" aria-label="Whisper tuning">
      <div class="pc-tuner-handle" data-pc-tuner-handle
           role="button" aria-label="Close tuner" tabindex="0">
        <div class="pc-tuner-handle-bar"></div>
      </div>
      <header class="pc-tuner-head">
        <div class="pc-tuner-title">
          <span class="pc-tuner-eyebrow">whisper tuning</span>
          <span class="pc-tuner-lang">${escapeAttr(lang.toUpperCase())}</span>
        </div>
        <button class="pc-tuner-close" data-pc-tuner-close
                aria-label="Close tuner">×</button>
      </header>
      <div class="pc-tuner-body">
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Initial prompt</h3>
          ${textRows}
        </div>
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Decoder gates</h3>
          ${numericRows}
        </div>
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Toggles</h3>
          ${boolRows}
        </div>
      </div>
      <footer class="pc-tuner-foot">
        <button class="pc-tuner-btn" data-pc-tuner-copy>Copy as JSON</button>
        <button class="pc-tuner-btn" data-pc-tuner-reset-lang>Reset this lang</button>
        <button class="pc-tuner-btn danger" data-pc-tuner-reset-all>Reset all</button>
        <button class="pc-tuner-btn primary" data-pc-tuner-close>Done</button>
      </footer>
    </div>
  `
}

const renderNumericRowHtml = (
  row: NumericRow,
  builtIn: WhisperParams,
  user: WhisperParams
): string => {
  const libDefault = (LIBRARY_DEFAULTS[row.key] ?? 0) as number
  const builtInVal = builtIn[row.key]
  const userVal = user[row.key]
  const effective =
    userVal !== undefined
      ? userVal
      : builtInVal !== undefined
        ? builtInVal
        : libDefault
  const modified = userVal !== undefined && userVal !== libDefault

  const trailLines: string[] = []
  trailLines.push(
    `<span>default <b>${formatNum(libDefault, row.step)}</b></span>`
  )
  if (builtInVal !== undefined) {
    trailLines.push(
      `<span>built-in <b>${formatNum(builtInVal, row.step)}</b></span>`
    )
  }
  if (modified) {
    trailLines.push(`<span class="pc-tuner-modified">modified</span>`)
  }

  return `
    <div class="pc-tuner-row" data-pc-row="${row.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-input-${row.key}">
          ${row.label}
        </label>
        <input type="number"
               id="pc-tuner-input-${row.key}"
               class="pc-tuner-num"
               step="${row.step}"
               min="${row.min}"
               max="${row.max}"
               value="${formatNum(effective, row.step)}"
               data-pc-tuner-num="${row.key}" />
      </div>
      <input type="range"
             class="pc-tuner-slider"
             step="${row.step}"
             min="${row.min}"
             max="${row.max}"
             value="${effective}"
             data-pc-tuner-slider="${row.key}"
             aria-label="${row.label}" />
      <div class="pc-tuner-row-trail">
        ${trailLines.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${row.help}</p>
    </div>
  `
}

const renderBoolRowHtml = (
  row: BoolRow,
  builtIn: WhisperParams,
  user: WhisperParams
): string => {
  const libDefault = LIBRARY_DEFAULTS[row.key] as boolean
  const builtInVal = builtIn[row.key]
  const userVal = user[row.key]
  const effective =
    userVal !== undefined
      ? userVal
      : builtInVal !== undefined
        ? builtInVal
        : libDefault
  const modified = userVal !== undefined && userVal !== libDefault

  return `
    <div class="pc-tuner-row pc-tuner-row-bool" data-pc-row="${row.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label">
          ${row.label}
        </label>
        <label class="pc-tuner-switch">
          <input type="checkbox"
                 ${effective ? "checked" : ""}
                 data-pc-tuner-bool="${row.key}" />
          <span class="pc-tuner-switch-slider"></span>
        </label>
      </div>
      <div class="pc-tuner-row-trail">
        <span>default <b>${libDefault ? "on" : "off"}</b></span>
        ${
          builtInVal !== undefined
            ? `<span class="pc-tuner-sep">·</span>
               <span>built-in <b>${builtInVal ? "on" : "off"}</b></span>`
            : ""
        }
        ${
          modified
            ? `<span class="pc-tuner-sep">·</span>
               <span class="pc-tuner-modified">modified</span>`
            : ""
        }
      </div>
      <p class="pc-tuner-help">${row.help}</p>
    </div>
  `
}

const renderTextRowHtml = (
  row: TextRow,
  builtIn: WhisperParams,
  user: WhisperParams
): string => {
  const builtInVal = builtIn[row.key]
  const userVal = user[row.key]
  const effective =
    userVal !== undefined ? userVal : builtInVal !== undefined ? builtInVal : ""
  const modified =
    userVal !== undefined && userVal !== (builtInVal ?? "")

  const trail: string[] = []
  if (builtInVal && builtInVal.length > 0) {
    trail.push(`<span>built-in <b>"${escapeAttr(builtInVal)}"</b></span>`)
  } else {
    trail.push(`<span>default <b>(empty)</b></span>`)
  }
  if (modified) {
    trail.push(`<span class="pc-tuner-modified">modified</span>`)
  }

  return `
    <div class="pc-tuner-row pc-tuner-row-text" data-pc-row="${row.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-text-${row.key}">
          ${row.label}
        </label>
      </div>
      <textarea id="pc-tuner-text-${row.key}"
                class="pc-tuner-text"
                rows="2"
                placeholder="${escapeAttr(row.placeholder)}"
                data-pc-tuner-text="${row.key}"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off">${escapeAttr(effective)}</textarea>
      <div class="pc-tuner-row-trail">
        ${trail.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${row.help}</p>
    </div>
  `
}

// ─── row wiring ─────────────────────────────────────────────────────

const wireNumericRow = (root: HTMLElement, row: NumericRow): void => {
  const slider = root.querySelector<HTMLInputElement>(
    `[data-pc-tuner-slider="${row.key}"]`
  )
  const num = root.querySelector<HTMLInputElement>(
    `[data-pc-tuner-num="${row.key}"]`
  )
  if (!slider || !num) return

  const commit = (raw: string) => {
    const v = parseFloat(raw)
    if (Number.isNaN(v)) return
    const clamped = Math.min(row.max, Math.max(row.min, v))
    setLangOverride(activeLang, { [row.key]: clamped } as WhisperParams)
    slider.value = String(clamped)
    num.value = formatNum(clamped, row.step)
    refreshRowTrail(root, row.key)
  }

  slider.addEventListener("input", () => {
    num.value = formatNum(parseFloat(slider.value), row.step)
  })
  slider.addEventListener("change", () => commit(slider.value))
  num.addEventListener("change", () => commit(num.value))
}

const wireBoolRow = (root: HTMLElement, row: BoolRow): void => {
  const cb = root.querySelector<HTMLInputElement>(
    `[data-pc-tuner-bool="${row.key}"]`
  )
  if (!cb) return
  cb.addEventListener("change", () => {
    setLangOverride(activeLang, { [row.key]: cb.checked } as WhisperParams)
    refreshRowTrail(root, row.key)
  })
}

const wireTextRow = (root: HTMLElement, row: TextRow): void => {
  const ta = root.querySelector<HTMLTextAreaElement>(
    `[data-pc-tuner-text="${row.key}"]`
  )
  if (!ta) return
  // Commit on blur and on Enter (Cmd/Ctrl+Enter for newline). The pack
  // reads localStorage on every startSession, so as long as the value
  // is saved before the user hits the mic, it applies on next decode.
  const commit = () => {
    const value = ta.value
    // Empty string explicitly stored as undefined → falls back to the
    // built-in profile (which may or may not have a prompt).
    setLangOverride(
      activeLang,
      { [row.key]: value.length > 0 ? value : undefined } as WhisperParams
    )
    refreshRowTrail(root, row.key)
  }
  ta.addEventListener("blur", commit)
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault()
      ta.blur() // triggers commit
    }
  })
}

const refreshRowTrail = (
  root: HTMLElement,
  key: NumericKey | BoolKey | TextKey
): void => {
  // Re-render just the trail line so the "modified" badge stays in
  // sync without redrawing the whole sheet. Cheap enough.
  const builtIn = BUILT_IN_PROFILES[activeLang] ?? {}
  const user = loadUserOverrides()[activeLang] ?? {}
  const row = root.querySelector<HTMLElement>(`[data-pc-row="${key}"]`)
  if (!row) return
  const trail = row.querySelector<HTMLElement>(".pc-tuner-row-trail")
  if (!trail) return

  const numRow = NUMERIC_ROWS.find((r) => r.key === key)
  if (numRow) {
    const libDefault = (LIBRARY_DEFAULTS[key as NumericKey] ?? 0) as number
    const builtInVal = builtIn[key as NumericKey]
    const userVal = user[key as NumericKey]
    const modified = userVal !== undefined && userVal !== libDefault
    const parts: string[] = [
      `<span>default <b>${formatNum(libDefault, numRow.step)}</b></span>`,
    ]
    if (builtInVal !== undefined) {
      parts.push(
        `<span>built-in <b>${formatNum(builtInVal, numRow.step)}</b></span>`
      )
    }
    if (modified) {
      parts.push(`<span class="pc-tuner-modified">modified</span>`)
    }
    trail.innerHTML = parts.join('<span class="pc-tuner-sep">·</span>')
    return
  }

  const boolRow = BOOL_ROWS.find((r) => r.key === key)
  if (boolRow) {
    const libDefault = LIBRARY_DEFAULTS[key as BoolKey] as boolean
    const builtInVal = builtIn[key as BoolKey]
    const userVal = user[key as BoolKey]
    const modified = userVal !== undefined && userVal !== libDefault
    const parts: string[] = [
      `<span>default <b>${libDefault ? "on" : "off"}</b></span>`,
    ]
    if (builtInVal !== undefined) {
      parts.push(
        `<span>built-in <b>${builtInVal ? "on" : "off"}</b></span>`
      )
    }
    if (modified) {
      parts.push(`<span class="pc-tuner-modified">modified</span>`)
    }
    trail.innerHTML = parts.join('<span class="pc-tuner-sep">·</span>')
    return
  }

  const textRow = TEXT_ROWS.find((r) => r.key === key)
  if (textRow) {
    const builtInVal = builtIn[key as TextKey]
    const userVal = user[key as TextKey]
    const modified =
      userVal !== undefined && userVal !== (builtInVal ?? "")
    const parts: string[] = []
    if (builtInVal && builtInVal.length > 0) {
      parts.push(`<span>built-in <b>"${escapeAttr(builtInVal)}"</b></span>`)
    } else {
      parts.push(`<span>default <b>(empty)</b></span>`)
    }
    if (modified) {
      parts.push(`<span class="pc-tuner-modified">modified</span>`)
    }
    trail.innerHTML = parts.join('<span class="pc-tuner-sep">·</span>')
  }
}

// ─── footer actions ─────────────────────────────────────────────────

const onCopyJson = async () => {
  const json = JSON.stringify(loadUserOverrides(), null, 2)
  try {
    await navigator.clipboard?.writeText(json)
    flashFooter(`Copied (${json.length} chars)`)
  } catch (err) {
    console.error("[whisperTunerUI] clipboard write failed:", err)
    flashFooter("Copy failed — see console")
  }
}

/** Snap every input in the open sheet back to whatever
 *  `mergeForLang(activeLang)` currently resolves to, and refresh the
 *  modified-indicator trails. Used after Reset-this-lang / Reset-all
 *  so we don't have to close-and-reopen the drawer (which previously
 *  flashed a slide-down / slide-up animation users found jarring). */
const refreshAllInputs = (root: HTMLElement): void => {
  const builtIn = BUILT_IN_PROFILES[activeLang] ?? {}
  const user = loadUserOverrides()[activeLang] ?? {}

  for (const row of NUMERIC_ROWS) {
    const libDefault = (LIBRARY_DEFAULTS[row.key] ?? 0) as number
    const effective =
      user[row.key] !== undefined
        ? (user[row.key] as number)
        : builtIn[row.key] !== undefined
          ? (builtIn[row.key] as number)
          : libDefault
    const slider = root.querySelector<HTMLInputElement>(
      `[data-pc-tuner-slider="${row.key}"]`
    )
    const num = root.querySelector<HTMLInputElement>(
      `[data-pc-tuner-num="${row.key}"]`
    )
    if (slider) slider.value = String(effective)
    if (num) num.value = formatNum(effective, row.step)
    refreshRowTrail(root, row.key)
  }

  for (const row of BOOL_ROWS) {
    const libDefault = LIBRARY_DEFAULTS[row.key] as boolean
    const effective =
      user[row.key] !== undefined
        ? (user[row.key] as boolean)
        : builtIn[row.key] !== undefined
          ? (builtIn[row.key] as boolean)
          : libDefault
    const cb = root.querySelector<HTMLInputElement>(
      `[data-pc-tuner-bool="${row.key}"]`
    )
    if (cb) cb.checked = effective
    refreshRowTrail(root, row.key)
  }

  for (const row of TEXT_ROWS) {
    const effective =
      user[row.key] !== undefined
        ? (user[row.key] as string)
        : builtIn[row.key] !== undefined
          ? (builtIn[row.key] as string)
          : ""
    const ta = root.querySelector<HTMLTextAreaElement>(
      `[data-pc-tuner-text="${row.key}"]`
    )
    if (ta) ta.value = effective
    refreshRowTrail(root, row.key)
  }
}

const onResetLang = () => {
  if (!activeRoot) return
  resetLang(activeLang)
  refreshAllInputs(activeRoot)
  flashFooter("Reset to built-in")
}

const onResetAll = () => {
  if (!activeRoot) return
  resetAll()
  refreshAllInputs(activeRoot)
  flashFooter("All languages reset")
}

const flashFooter = (msg: string) => {
  if (!activeRoot) return
  const foot = activeRoot.querySelector<HTMLElement>(".pc-tuner-foot")
  if (!foot) return
  const flash = document.createElement("div")
  flash.className = "pc-tuner-flash"
  flash.textContent = msg
  foot.appendChild(flash)
  window.setTimeout(() => {
    if (flash.parentNode) flash.parentNode.removeChild(flash)
  }, 1600)
}
