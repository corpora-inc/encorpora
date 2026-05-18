import "./styles.css"

import {
  BrushStore,
  BrushConfigWidget,
  BUILTIN_PRESETS,
} from "../brush/index.js"
import { LessonRunner, resetLessonProgress } from "./lessons.js"
import { LetterTraceLayer, WordTraceLayer } from "./trace.js"
import { StylesView } from "./styles_view.js"
import { t, subscribeLanguageChanged, currentLanguage } from "./i18n.js"
import { tokenizeText, wordContainsLetter } from "./tokenize.js"

;(() => {
  const GAME_ID = "rasmapan"

  const template = `
    <div class="rasmapan-app">
      <button class="exit-btn" data-action="exit" aria-label="Exit">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      </button>
      <button class="tutorial-btn" data-action="tutorial" aria-label="Tutorial">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5V5.5z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5V5.5z" />
          <path d="M11 4v15M13 4v15" />
        </svg>
      </button>
      <div class="hero">
        <div class="card hero-card">
          <div class="hero-left">
            <button class="nav-btn nav-prev" data-nav="prev" aria-label="Previous">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 5.5 9 12l6.5 6.5" />
              </svg>
            </button>
            <div class="char-symbol" data-char lang="ar" dir="rtl"></div>
            <div class="letter-name-badge" data-letter-name></div>
            <div class="char-row">
              <button class="pinyin-btn" data-letter-name-en data-action="speak" aria-label="Speak"></button>
            </div>
            <button class="nav-btn nav-next" data-nav="next" aria-label="Next">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.5 15 12l-6.5 6.5" />
              </svg>
            </button>
          </div>
          <div class="hero-right">
            <div class="ety-text" data-etymology></div>
            <div class="form-picker" data-form-picker></div>
          </div>
        </div>
      </div>
      <div class="mode-tabs" role="tablist" data-mode-tabs>
        <button class="mode-tab is-active" data-mode="letters" role="tab" type="button"></button>
        <button class="mode-tab" data-mode="words" role="tab" type="button"></button>
        <button class="mode-tab" data-mode="styles" role="tab" type="button"></button>
      </div>
      <div class="letter-picker" data-letter-picker></div>
      <div class="workspace mode-letters" data-workspace>
        <div class="panel draw-panel" data-draw-panel>
          <div class="panel-toolbar">
            <div class="toolbar-left">
              <button class="icon-chip play-chip" data-action="replay" aria-label="Play">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 6.5 18 12 8 17.5Z" fill="currentColor" stroke="none" />
                </svg>
              </button>
              <button class="icon-chip" data-action="brush-settings" aria-label="Brush settings">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 2l3 3-3 3M18 5H9a4 4 0 0 0 0 8h1M6 22l-3-3 3-3M6 19h9a4 4 0 0 0 0-8h-1" />
                </svg>
              </button>
            </div>
            <div class="toolbar-right">
              <button class="icon-chip" data-action="toggle-freedraw" data-freedraw-toggle aria-label="Free draw mode">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <button class="icon-chip active" data-guided-toggle aria-label="Guided hints">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  <path class="eye-slash" d="M4 4 20 20" />
                </svg>
              </button>
              <button class="icon-chip" data-action="clear" aria-label="Clear">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
                </svg>
              </button>
            </div>
          </div>
          <div class="canvas-shell" data-canvas-shell>
            <canvas class="canvas-layer" data-ghost></canvas>
            <canvas class="canvas-layer" data-draw></canvas>
            <canvas class="canvas-layer" data-fx></canvas>
            <div class="canvas-overlay" data-overlay>Loading...</div>
          </div>
          <div class="panel-footer">
            <div class="score-bar" data-score-bar>
              <div class="score-fill" data-score></div>
            </div>
            <div class="meta-row">
              <span class="chip chip-inline" data-strokes></span>
              <div class="meta-right">
                <span class="total-score" data-total-score>0</span>
                <span class="meta-divider">•</span>
                <span class="complete-count" aria-label="Completed">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 12.5 10 18l9.5-12" />
                  </svg>
                  <span data-complete-count>0</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="panel examples-panel" data-examples-panel>
          <div class="panel-header">
            <div class="panel-count" data-example-count aria-label="Total phrases">—</div>
          </div>
          <div class="examples-list" data-examples></div>
          <div class="examples-footer" data-examples-footer>Ready</div>
        </div>
      </div>
    </div>
  `

  const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)))

  const escapeHtml = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")

  /**
   * Drawing engine — pointer + brush. Trimmed version of hanzipan's
   * DrawingEngine; uses the same BrushStore for config (so the
   * brush-settings widget works identically), with a simpler
   * variable-width line rendering: width scales with pressure and
   * inverse-velocity, smoothed across recent points.
   */
  class DrawingEngine {
    constructor(canvasShell, drawCanvas, onStrokeEnd) {
      this.shell = canvasShell
      this.canvas = drawCanvas
      this.ctx = drawCanvas.getContext("2d")
      this.onStrokeEnd = onStrokeEnd
      this.config = BrushStore.getDefaultConfig()
      this.strokes = []  // [[{x,y,width,...}, ...], ...]
      this.current = null
      this.tracking = false
      this.lastPoint = null
      this.dpr = window.devicePixelRatio || 1
      this.size = { w: 0, h: 0 }
      this.color = "#1a1410"
      this.userBrushWidth = 18
      this.resize()
    }

    setBrushConfig(config) {
      this.config = { ...this.config, ...config }
    }

    setColor(c) {
      this.color = c
    }

    setBrushWidth(w) {
      this.userBrushWidth = w
    }

    clear() {
      this.strokes = []
      this.current = null
      this._clear()
    }

    redraw() {
      this._clear()
      for (const s of this.strokes) this._renderStroke(s)
    }

    resize() {
      const rect = this.shell.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      this.dpr = dpr
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      this.size = { w, h }
      const canvases = this.shell.querySelectorAll(".canvas-layer")
      canvases.forEach((c) => {
        c.width = w * dpr
        c.height = h * dpr
        c.style.width = `${w}px`
        c.style.height = `${h}px`
      })
      this.redraw()
    }

    enable() {
      const onDown = (e) => this._onDown(e)
      const onMove = (e) => this._onMove(e)
      const onUp = (e) => this._onUp(e)
      const onCancel = (e) => this._onUp(e)

      this.canvas.addEventListener("pointerdown", onDown)
      this.canvas.addEventListener("pointermove", onMove)
      this.canvas.addEventListener("pointerup", onUp)
      this.canvas.addEventListener("pointercancel", onCancel)
      this.canvas.addEventListener("pointerleave", onUp)

      this._cleanup = () => {
        this.canvas.removeEventListener("pointerdown", onDown)
        this.canvas.removeEventListener("pointermove", onMove)
        this.canvas.removeEventListener("pointerup", onUp)
        this.canvas.removeEventListener("pointercancel", onCancel)
        this.canvas.removeEventListener("pointerleave", onUp)
      }
    }

    disable() {
      if (this._cleanup) this._cleanup()
      this._cleanup = null
    }

    _onDown(e) {
      e.preventDefault()
      this.canvas.setPointerCapture(e.pointerId)
      this.tracking = true
      this.current = []
      this.lastPoint = null
      this._appendPoint(e)
    }

    _onMove(e) {
      if (!this.tracking) return
      this._appendPoint(e)
    }

    _onUp(e) {
      if (!this.tracking) return
      this.tracking = false
      try { this.canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      const stroke = this.current || []
      this.current = null
      if (stroke.length >= 2) {
        this.strokes.push(stroke)
        if (typeof this.onStrokeEnd === "function") {
          try { this.onStrokeEnd(stroke) } catch (err) { /* eslint-disable-next-line no-console */
            console.warn("[rasmapan] onStrokeEnd failed", err)
          }
        }
      }
    }

    _appendPoint(e) {
      const rect = this.canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * this.dpr
      const y = (e.clientY - rect.top) * this.dpr
      const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5
      const now = performance.now()
      const cfg = this.config
      let velocity = 0
      if (this.lastPoint) {
        const dt = Math.max(1, now - this.lastPoint.t)
        const dx = x - this.lastPoint.x
        const dy = y - this.lastPoint.y
        velocity = Math.sqrt(dx * dx + dy * dy) / dt
      }
      // Smooth position.
      let sx = x
      let sy = y
      if (this.lastPoint && cfg.positionSmoothing) {
        const a = cfg.positionSmoothing
        sx = this.lastPoint.x * a + x * (1 - a)
        sy = this.lastPoint.y * a + y * (1 - a)
      }
      const base = this.userBrushWidth * (cfg.baseWidthMultiplier || 1)
      const minW = base * (cfg.minWidthFactor || 0.5)
      const maxW = base * (cfg.maxWidthFactor || 1.6)
      const pInfluence = cfg.pressureInfluence ?? 0.5
      const vInfluence = cfg.velocityInfluence ?? 0.5
      const vRange = Math.max(1, cfg.velocityRange || 2.0)
      // Pressure factor (0..1 → exponent curve).
      const pNorm = Math.pow(Math.min(1, pressure / 0.5 * 0.5 + pressure * 0.5), cfg.pressureExponent || 0.75)
      // Velocity factor — high velocity narrows the stroke.
      const vNorm = Math.max(0, Math.min(1, velocity / vRange))
      const vFactor = cfg.velocityInverted ? vNorm : 1 - vNorm
      const widthFactor =
        (1 - pInfluence - vInfluence) +
        pInfluence * pNorm +
        vInfluence * vFactor
      const widthRaw = minW + (maxW - minW) * widthFactor
      let width = Math.max(minW, Math.min(maxW, widthRaw))

      // Smooth width across recent points.
      if (this.lastPoint && cfg.widthSmoothing) {
        const a = cfg.widthSmoothing
        width = this.lastPoint.width * a + width * (1 - a)
      }

      const point = { x: sx, y: sy, width, t: now, pressure }
      this.lastPoint = point
      if (!this.current) this.current = []
      this.current.push(point)
      this._renderSegment(this.current)
    }

    _renderStroke(stroke) {
      if (!stroke || stroke.length < 2) return
      const ctx = this.ctx
      ctx.strokeStyle = this.color
      ctx.fillStyle = this.color
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      // Render as a series of variable-width segments.
      for (let i = 1; i < stroke.length; i += 1) {
        const a = stroke[i - 1]
        const b = stroke[i]
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineWidth = (a.width + b.width) / 2
        ctx.stroke()
      }
    }

    _renderSegment(current) {
      if (!current || current.length < 2) return
      const a = current[current.length - 2]
      const b = current[current.length - 1]
      const ctx = this.ctx
      ctx.strokeStyle = this.color
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineWidth = (a.width + b.width) / 2
      ctx.stroke()
    }

    _clear() {
      this.ctx.save()
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.ctx.restore()
    }
  }

  // Resolve the pack's base URL — used for asset paths (style samples).
  const resolvePackBaseUrl = () => {
    const script =
      document.querySelector(`script[data-corp-game-id="${GAME_ID}"]`) ||
      document.currentScript
    const dataset = script && script.dataset ? script.dataset : null
    const baseAttr = dataset ? dataset.corpGameBaseUrl : ""
    if (baseAttr) return baseAttr
    const srcAttr = dataset ? dataset.corpGameSrc : ""
    if (srcAttr) {
      try { return new URL(".", srcAttr).toString() } catch { /* fall through */ }
    }
    const src = script && script.src ? script.src : ""
    if (src) {
      try { return new URL(".", src).toString() } catch { /* fall through */ }
    }
    return window.location.href
  }

  const mount = (container, hostApi, initialState = {}) => {
    const root = document.createElement("div")
    root.className = "rasmapan-root"
    root.innerHTML = template
    container.appendChild(root)

    // Adaptive top inset (mirrors Hanzipan).
    const ua = (navigator.userAgent || "")
    if (/iPhone|iPod/i.test(ua)) root.style.setProperty("--safe-top", "30px")
    else if (/Android/i.test(ua)) root.style.setProperty("--safe-top", "25px")
    else root.style.setProperty("--safe-top", "0px")

    const elChar = root.querySelector("[data-char]")
    const elLetterName = root.querySelector("[data-letter-name]")
    const elLetterNameEn = root.querySelector("[data-letter-name-en]")
    const elEtymology = root.querySelector("[data-etymology]")
    const elFormPicker = root.querySelector("[data-form-picker]")
    const elLetterPicker = root.querySelector("[data-letter-picker]")
    const elWorkspace = root.querySelector("[data-workspace]")
    const elDrawPanel = root.querySelector("[data-draw-panel]")
    const elExamplesPanel = root.querySelector("[data-examples-panel]")
    const elExamples = root.querySelector("[data-examples]")
    const elExampleCount = root.querySelector("[data-example-count]")
    const elExamplesFooter = root.querySelector("[data-examples-footer]")
    const elScore = root.querySelector("[data-score]")
    const elTotalScore = root.querySelector("[data-total-score]")
    const elCompleteCount = root.querySelector("[data-complete-count]")
    const elStrokes = root.querySelector("[data-strokes]")
    const elOverlay = root.querySelector("[data-overlay]")
    const elCanvasShell = root.querySelector("[data-canvas-shell]")
    const elGhost = root.querySelector("[data-ghost]")
    const elDraw = root.querySelector("[data-draw]")
    const elFx = root.querySelector("[data-fx]")
    const guidedToggle = root.querySelector("[data-guided-toggle]")
    const freeDrawToggle = root.querySelector("[data-freedraw-toggle]")
    const modeTabs = root.querySelectorAll("[data-mode]")

    const state = {
      mode: "letters",  // letters | words | styles
      stackConfig: initialState.stackConfig || hostApi.getStackConfig(),
      families: [],     // [{ id, name_ar, name_en, positions: [...] }]
      activeFamilyId: null,
      activePosition: "isolated",
      currentWriter: null,
      currentLetter: "",
      words: [],
      activeWordId: null,
      currentWord: null,
      examples: [],
      examplesOffset: 0,
      examplesTotal: null,
      loadingExamples: false,
      noMoreExamples: false,
      packDbAvailable: true,
      totalScore: 0,
      completedCount: 0,
      ghostVisible: true,
      freeDraw: false,
      // Styles mode state — populated lazily when the styles tab
      // is first opened; nav arrows cycle through `styleIds`.
      styleIds: [],
      activeStyleId: null,
    }

    const packBaseUrl = resolvePackBaseUrl()
    const brushStore = new BrushStore("rasmapan-brush-v1")
    let brushWidget = null

    let traceLayer = null
    let wordTraceLayer = null
    let drawingEngine = null
    let lessonRunner = null

    // --- Speak wrapper (juice-squeeze pattern) ---------------------------
    //
    // Prefer `speakConcurrent` so rapid taps don't cancel each other
    // (e.g. word-chip taps in a phrase); fall back to the standard
    // `speak`. Silently tolerate failures (missing system voice etc.).
    const speak = (lang, text) => {
      if (!text) return
      if (typeof hostApi.speakConcurrent === "function") {
        try { hostApi.speakConcurrent(lang, text); return } catch { /* fall through */ }
      }
      try { hostApi.speak(lang, text) } catch { /* tolerated */ }
    }

    // --- pickByLang (juice-squeeze pattern) ------------------------------
    //
    // Choose the best translation row for a given language code,
    // with locale-base fallback so "ko-polite" finds a "ko"
    // translation when the stack only carries the base. Adapted
    // from juice-squeeze src/data.ts:50-60.
    const pickByLang = (translations, lang) => {
      if (!translations || !translations.length) return undefined
      const norm = (s) => (s || "").toLowerCase()
      const desired = norm(lang)
      if (desired) {
        const exact = translations.find(t => norm(t.language_code) === desired)
        if (exact) return exact
        const base = desired.split("-")[0]
        const baseMatch = translations.find(t => norm(t.language_code).split("-")[0] === base)
        if (baseMatch) return baseMatch
      }
      return translations[0]
    }

    // Accepts the SDK-shaped query object `{ sql, params, ... }`.
    // Subcomponents (LessonRunner, StylesView) call us with the
    // same shape so we route directly to hostApi.queryPackDb.
    // Tauri's `content_packs_query_db` command expects `sql` as a
    // string; passing an object as `sql` returns "invalid type: map".
    //
    // We DON'T permanently disable packDb on a single failure — one
    // error (e.g. a stale cached connection after a hot reinstall
    // with schema changes) shouldn't lock the pack out forever. We
    // log + return empty for that one call and let the next one try.
    const queryPackDb = async (query) => {
      if (!hostApi.queryPackDb) {
        return { columns: [], rows: [] }
      }
      if (typeof query !== "object" || query === null) {
        return { columns: [], rows: [] }
      }
      try {
        return await hostApi.queryPackDb(query)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[rasmapan] queryPackDb failed:", err && err.message ? err.message : err)
        return { columns: [], rows: [] }
      }
    }

    // Family → base Arabic codepoint (U+0600-U+064A range). Used to
    // search the corpus on the base letter even if a stale cached
    // pack-DB connection doesn't have our `base_letter` column yet.
    // This is the canonical Unicode mapping for the 28 letters; it
    // never needs to change.
    const BASE_LETTER_BY_FAMILY = {
      alif: "ا", baa: "ب", taa: "ت", thaa: "ث",
      jiim: "ج", Haa: "ح", khaa: "خ", daal: "د",
      dhaal: "ذ", raa: "ر", zaay: "ز", siin: "س",
      shiin: "ش", Saad: "ص", Daad: "ض", Taa: "ط",
      DHaa: "ظ", ain: "ع", ghain: "غ", faa: "ف",
      qaaf: "ق", kaaf: "ك", laam: "ل", miim: "م",
      nuun: "ن", haa: "ه", waaw: "و", yaa: "ي",
    }

    const getColors = () => {
      const cs = getComputedStyle(root)
      return {
        strokeGhost:
          cs.getPropertyValue("--stroke-ghost").trim() ||
          "rgba(107, 76, 42, 0.22)",
        strokeHighlight:
          cs.getPropertyValue("--accent").trim() ||
          "rgba(139, 105, 20, 0.85)",
        strokeUser:
          cs.getPropertyValue("--stroke-user").trim() ||
          "#1a1410",
      }
    }

    // --- Loaders ---------------------------------------------------------

    const loadFamilies = async () => {
      // Try the new schema first (includes `base_letter`). If it
      // fails (stale cached connection against an older DB without
      // the column), fall back to the legacy schema and synthesize
      // base_letter from the family id via BASE_LETTER_BY_FAMILY.
      const COLUMNS_NEW = "id, family_id, base_letter, name_ar, name_en, connects_before, connects_after, frequency"
      const COLUMNS_LEGACY = "id, family_id, name_ar, name_en, connects_before, connects_after, frequency"
      let res = await queryPackDb({
        sql:
          `SELECT ${COLUMNS_NEW} FROM arabic_letter ` +
          "WHERE position = 'isolated' " +
          "ORDER BY frequency DESC NULLS LAST, id",
      })
      if (!res.rows || !res.rows.length) {
        // Try again without base_letter — covers the "stale cached
        // connection after a re-install with schema change" case.
        res = await queryPackDb({
          sql:
            `SELECT ${COLUMNS_LEGACY} FROM arabic_letter ` +
            "WHERE position = 'isolated' " +
            "ORDER BY frequency DESC NULLS LAST, id",
        })
      }
      const families = res.rows || []
      // Discover positions per family.
      const allPosRes = await queryPackDb({
        sql: "SELECT family_id, position FROM arabic_letter",
      })
      const posByFamily = new Map()
      for (const row of allPosRes.rows || []) {
        const set = posByFamily.get(row.family_id) || new Set()
        set.add(row.position)
        posByFamily.set(row.family_id, set)
      }
      state.families = families.map((f) => ({
        id: f.family_id,
        name_ar: f.name_ar,
        name_en: f.name_en,
        // Base Arabic codepoint — prefer the DB value if available,
        // else look it up in our static JS map (the 28 canonical
        // base letters never change).
        base_letter: f.base_letter || BASE_LETTER_BY_FAMILY[f.family_id] || "",
        connects_before: !!f.connects_before,
        connects_after: !!f.connects_after,
        positions: Array.from(posByFamily.get(f.family_id) || new Set(["isolated"])),
      }))
    }

    const loadWords = async () => {
      const res = await queryPackDb({
        sql:
          "SELECT id, word, transliteration, meaning_json, letter_ids_json, difficulty " +
          "FROM arabic_word ORDER BY difficulty ASC, id ASC",
      })
      state.words = (res.rows || []).map((row) => {
        let meaning = {}
        let letter_ids = []
        try { meaning = JSON.parse(row.meaning_json || "{}") } catch { /* */ }
        try { letter_ids = JSON.parse(row.letter_ids_json || "[]") } catch { /* */ }
        return {
          id: row.id,
          word: row.word,
          transliteration: row.transliteration,
          meaning,
          letter_ids,
          difficulty: row.difficulty,
        }
      })
    }

    const loadWriter = async (id) => {
      const res = await queryPackDb({
        sql: "SELECT data_json FROM arabic_letter_writer WHERE id = ?",
        params: [id],
      })
      const row = (res.rows || [])[0]
      if (!row) return null
      try { return JSON.parse(row.data_json) } catch { return null }
    }

    const loadFamilyNote = async (familyId) => {
      const langs = unique([
        ...(state.stackConfig.languages || []),
        "en",
      ])
      const placeholders = langs.map(() => "?").join(",")
      const res = await queryPackDb({
        sql: `SELECT language_code, summary FROM arabic_letter_note WHERE letter_id = ? AND language_code IN (${placeholders})`,
        params: [familyId, ...langs],
      })
      const rows = res.rows || []
      const byLang = new Map(rows.map((r) => [r.language_code, r.summary]))
      for (const lang of langs) {
        if (byLang.has(lang)) return byLang.get(lang)
      }
      return ""
    }

    // --- Renderers -------------------------------------------------------

    const renderLetterPicker = () => {
      if (!state.families.length) {
        elLetterPicker.innerHTML = ""
        return
      }
      const html = state.families
        .map((f) => {
          const cls = f.id === state.activeFamilyId ? "letter-pill is-active" : "letter-pill"
          // Need the isolated-form glyph for the pill — fetch from local cache.
          const letter = f._isolatedLetter || ""
          return `<button type="button" class="${cls}" data-family="${escapeHtml(f.id)}" title="${escapeHtml(f.name_en)}">${escapeHtml(letter)}</button>`
        })
        .join("")
      elLetterPicker.innerHTML = html
    }

    // Form picker chips render the actual letter glyph in each
    // position — a tiny diagram per chip. This is language-free,
    // so no translation surface for the picker beyond aria-labels.
    const renderFormPicker = async () => {
      const fam = state.families.find((f) => f.id === state.activeFamilyId)
      if (!fam) {
        elFormPicker.innerHTML = ""
        return
      }
      const order = ["isolated", "initial", "medial", "final"]
      const cards = []
      for (const pos of order) {
        const available = fam.positions.includes(pos)
        const cls = `form-chip${pos === state.activePosition ? " is-active" : ""}`
        const ariaLabel = t(`form.${pos}`)
        if (!available) {
          cards.push(`<button type="button" class="${cls} is-empty" data-pos="${pos}" disabled aria-label="${escapeHtml(ariaLabel)}"></button>`)
          continue
        }
        // Render the actual glyph for this positional form so the
        // chip itself is the diagram.
        const glyphId = pos === "isolated" ? fam.id : `${fam.id}.${pos}`
        const writer = await loadWriter(glyphId)
        const glyph = (writer && writer.letter) || ""
        cards.push(
          `<button type="button" class="${cls}" data-pos="${pos}" aria-label="${escapeHtml(ariaLabel)}">` +
            `<span class="form-chip-glyph" lang="ar">${escapeHtml(glyph)}</span>` +
            `</button>`,
        )
      }
      elFormPicker.innerHTML = cards.join("")
    }

    const renderModeTabs = () => {
      modeTabs.forEach((tab) => {
        const key = `mode.${tab.dataset.mode}`
        tab.textContent = t(key)
        tab.classList.toggle("is-active", tab.dataset.mode === state.mode)
      })
    }

    // Update aria-labels on the icon-only toolbar buttons so screen
    // readers see the translated text. Visible chrome is icons, so
    // this is the only place the chrome cares about language.
    const ARIA_KEYS = {
      exit: "aria.exit",
      replay: "aria.play",
      tutorial: "aria.tutorial",
      "brush-settings": "aria.brush",
      "toggle-freedraw": "aria.free_draw",
      clear: "aria.clear",
    }
    const renderToolbarAria = () => {
      root.querySelectorAll("[data-action]").forEach((btn) => {
        const key = ARIA_KEYS[btn.dataset.action]
        if (key) btn.setAttribute("aria-label", t(key))
      })
      if (guidedToggle) guidedToggle.setAttribute("aria-label", t("aria.hints"))
    }

    const renderHero = async () => {
      if (state.mode === "letters") {
        const fam = state.families.find((f) => f.id === state.activeFamilyId)
        if (!fam) return
        const glyphId = state.activePosition === "isolated" ? fam.id : `${fam.id}.${state.activePosition}`
        const writer = await loadWriter(glyphId)
        if (!writer) {
          elChar.textContent = ""
          return
        }
        state.currentWriter = writer
        state.currentLetter = writer.letter || ""
        // Base codepoint (U+06-range) for corpus search. Falls back
        // to the presentation form if the family didn't carry one.
        state.baseLetter = fam.base_letter || writer.letter || ""
        elChar.textContent = writer.letter || ""
        // Bilingual label including the positional form name in
        // the user's UI language — restores text the iconic pass
        // had stripped (e.g. "ألف · alif — isolated").
        const posName = t(`form.${state.activePosition}`)
        elLetterName.textContent =
          `${fam.name_ar} · ${fam.name_en} — ${posName}`
        elLetterNameEn.textContent = fam.name_en
        const note = await loadFamilyNote(fam.id)
        elEtymology.textContent = note || ""
        // Push glyph into trace layer.
        if (traceLayer) {
          traceLayer.setWriter(writer)
          traceLayer.setGhostVisible(state.ghostVisible)
          traceLayer.setFreeDraw(state.freeDraw)
        }
        // Stroke count as localized text — "3 strokes" / "3 trazos"
        // / "3 traits" — re-rendered on language change via the
        // onLanguageChanged handler.
        const total = (writer.outline || []).length || 1
        const strokeWord = t(total === 1 ? "stroke.singular" : "stroke.plural")
        elStrokes.textContent = `${total} ${strokeWord}`
        elOverlay.style.display = "none"
      } else if (state.mode === "words") {
        const word = state.words.find((w) => w.id === state.activeWordId)
        if (!word) return
        state.currentWord = word
        elChar.classList.add("word-trace-run")
        elChar.textContent = word.word
        // Use pickByLang to pick the gloss for the user's stack,
        // with locale-base fallback. Convert the word.meaning map
        // into the translations-array shape pickByLang expects.
        const meaningRows = Object.entries(word.meaning || {})
          .filter(([lang, text]) => lang && text && lang !== "ar")
          .map(([lang, text]) => ({ language_code: lang, text }))
        const primary = (state.stackConfig.languages || []).find(l => l !== "ar")
        const picked = pickByLang(meaningRows, primary || currentLanguage())
        const gloss = picked ? picked.text : ""
        elLetterName.innerHTML =
          `<span class="translit">${escapeHtml(word.transliteration || "")}</span>` +
          (gloss ? `<span class="gloss"> — ${escapeHtml(gloss)}</span>` : "")
        elLetterNameEn.textContent = word.transliteration || ""
        elFormPicker.innerHTML = ""
        // Component-letter chips for the word. Each chip shows the
        // family's isolated glyph + the English name underneath as
        // a small italic label. Tapping a chip drills into Letters
        // mode with that family active — a learning shortcut from
        // "I see this word" → "let me practice each letter".
        const familyMap = new Map(state.families.map(f => [f.id, f]))
        const chipsHtml = (word.letter_ids || [])
          .map((famId) => {
            const fam = familyMap.get(famId)
            if (!fam) return ""
            const glyph = fam._isolatedLetter || ""
            return `<button class="letter-chip" type="button" data-letter-family="${escapeHtml(famId)}" title="${escapeHtml(fam.name_en)}">` +
              `<span lang="ar">${escapeHtml(glyph)}</span>` +
              `<span class="letter-chip-label">${escapeHtml(fam.name_en)}</span>` +
              `</button>`
          })
          .join("")
        elEtymology.innerHTML = chipsHtml
          ? `<div class="word-letters" dir="rtl">${chipsHtml}</div>`
          : ""
        elEtymology.querySelectorAll("[data-letter-family]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const famId = btn.dataset.letterFamily
            if (!famId) return
            state.mode = "letters"
            state.activeFamilyId = famId
            state.activePosition = "isolated"
            renderModeTabs()
            renderLetterPicker()
            renderFormPicker()
            renderModeUI()
            renderExamplesPanel()
            if (drawingEngine) drawingEngine.clear()
          })
        })
        // Load all letter writers for the word.
        const writers = []
        for (const letterFamilyId of word.letter_ids) {
          const w = await loadWriter(letterFamilyId)
          if (w) writers.push({ writer: w })
        }
        if (wordTraceLayer) {
          wordTraceLayer.setWord(writers)
          wordTraceLayer.setGhostVisible(state.ghostVisible)
        }
        // Letter count as localized text.
        const ltrCount = word.letter_ids.length
        const ltrWord = t(ltrCount === 1 ? "letter.singular" : "letter.plural")
        elStrokes.textContent = `${ltrCount} ${ltrWord}`
        elOverlay.style.display = "none"
      }
    }

    const renderModeUI = () => {
      modeTabs.forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.mode === state.mode)
      })
      elWorkspace.classList.remove("mode-letters", "mode-words", "mode-styles")
      elWorkspace.classList.add(`mode-${state.mode}`)
      elChar.classList.remove("word-trace-run")
      // Picker visibility.
      elLetterPicker.style.display = state.mode === "letters" ? "" : "none"
      elFormPicker.style.display = state.mode === "letters" ? "" : "none"
      if (state.mode === "styles") {
        elExamplesPanel.style.display = "none"
        elDrawPanel.style.display = "none"
        renderStylesMode()
      } else {
        elExamplesPanel.style.display = ""
        elDrawPanel.style.display = ""
        // Clear any leftover styles UI.
        const sc = root.querySelector(".style-cards-host")
        if (sc) sc.remove()
        if (state.mode === "letters" && state.activeFamilyId) {
          renderHero()
        } else if (state.mode === "words" && state.activeWordId) {
          renderHero()
        } else if (state.mode === "words" && !state.activeWordId && state.words.length) {
          state.activeWordId = state.words[0].id
          renderWordPicker()
          renderHero()
        }
      }
    }

    let stylesView = null
    const renderStylesMode = async () => {
      // Create a host below the mode tabs if not present.
      let host = root.querySelector(".style-cards-host")
      if (!host) {
        host = document.createElement("div")
        host.className = "style-cards-host"
        elWorkspace.parentNode.insertBefore(host, elWorkspace.nextSibling)
      }
      if (!stylesView) {
        stylesView = new StylesView({
          container: host,
          hostApi,
          queryPackDb,
          packBaseUrl,
        })
      }
      await stylesView.render({ highlightId: state.activeStyleId })
      // Cache the list of style IDs on first render so nav arrows
      // can cycle through them without re-querying.
      if (!state.styleIds.length) {
        const res = await queryPackDb({
          sql: "SELECT id FROM arabic_style ORDER BY ord ASC",
        })
        state.styleIds = (res.rows || []).map((r) => r.id)
        if (!state.activeStyleId && state.styleIds.length) {
          state.activeStyleId = state.styleIds[0]
        }
      }
    }

    // Pick the user's primary non-Arabic stack language; falls back
    // to current i18next UI language; ultimate fallback English.
    const stackPrimaryLang = () => {
      const langs = state.stackConfig.languages || []
      for (const l of langs) {
        if (l && l !== "ar") return l
      }
      return currentLanguage() || "en"
    }

    // Render the Arabic source as a row of clickable word chips so
    // the user can tap each word in isolation. Words containing the
    // active baseLetter get a `.matches-letter` accent. Falls back
    // to a plain `<span>` for non-Arabic strings.
    const renderArabicChips = (text) => {
      const tokens = tokenizeText(text)
      if (!tokens.length) {
        return `<span class="example-text" lang="ar">${escapeHtml(text)}</span>`
      }
      const baseLetter = state.baseLetter || ""
      const chips = tokens.map((tok) => {
        const matches = baseLetter && wordContainsLetter(tok, baseLetter)
        const cls = matches ? "word-chip matches-letter" : "word-chip"
        return `<button class="${cls}" type="button" data-speak-word="${escapeHtml(tok)}" lang="ar">${escapeHtml(tok)}</button>`
      })
      return `<div class="example-words" dir="rtl">${chips.join("")}</div>`
    }

    // Words mode: render a vertical list of word pills in the examples panel.
    const renderWordPicker = () => {
      if (!state.words.length) {
        elExamples.innerHTML = "<div class='example-text'>—</div>"
        return
      }
      const primary = stackPrimaryLang()
      const html = state.words
        .map((w) => {
          const cls = w.id === state.activeWordId ? "word-pill is-active" : "word-pill"
          const meaningRows = Object.entries(w.meaning || {})
            .filter(([lang, text]) => lang && text && lang !== "ar")
            .map(([lang, text]) => ({ language_code: lang, text }))
          const picked = pickByLang(meaningRows, primary)
          const gloss = picked ? picked.text : ""
          return `
            <button class="${cls}" type="button" data-word="${escapeHtml(w.id)}">
              <span class="word-text" lang="ar">${escapeHtml(w.word)}</span>
              <span class="word-meaning">${escapeHtml(gloss)}</span>
            </button>
          `
        })
        .join("")
      elExamples.innerHTML = `<div class='word-picker'>${html}</div>`
      elExampleCount.textContent = String(state.words.length)
      elExamplesFooter.textContent = t("word_picker.hint")
      elExamples.querySelectorAll("[data-word]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.activeWordId = btn.dataset.word
          renderWordPicker()
          renderHero()
        })
      })
    }

    // Letters mode examples panel: pack-owned curated words +
    // corpus phrases that contain the active letter. The Arabic
    // text on each card is rendered as clickable word chips
    // (juice-squeeze tokenization) so each word can be heard in
    // isolation.
    const renderLetterExamples = async () => {
      const family = state.activeFamilyId
      if (!family) {
        elExamples.innerHTML = ""
        elExampleCount.textContent = "—"
        elExamplesFooter.textContent = "—"
        return
      }
      const primary = stackPrimaryLang()
      // Step 1: curated words from arabic_word with this letter in
      // letter_ids_json.
      const wordRes = await queryPackDb({
        sql:
          'SELECT id, word, transliteration, meaning_json ' +
          'FROM arabic_word WHERE letter_ids_json LIKE ? ' +
          'ORDER BY difficulty ASC, id ASC LIMIT 24',
        params: [`%"${family}"%`],
      })
      const wordCards = (wordRes.rows || []).map((row) => {
        let meaning = {}
        try { meaning = JSON.parse(row.meaning_json || "{}") } catch { /* */ }
        const meaningRows = Object.entries(meaning)
          .filter(([lang, text]) => lang && text && lang !== "ar")
          .map(([lang, text]) => ({ language_code: lang, text }))
        const picked = pickByLang(meaningRows, primary)
        const gloss = picked ? picked.text : ""
        return `
          <article class="example-card" data-speak-phrase="${escapeHtml(row.word)}">
            <span class="example-marker example-marker-curated" aria-hidden="true"></span>
            ${renderArabicChips(row.word)}
            <div class="example-translation translit">
              ${escapeHtml(row.transliteration || "")}
            </div>
            ${gloss ? `<div class="example-translation gloss">${escapeHtml(gloss)}</div>` : ""}
          </article>
        `
      })

      // Step 2: corpus phrases containing this letter (base
      // codepoint — the U+0600-range one, NOT the
      // presentation-form). limit raised to 20.
      const corpusCards = []
      if (hostApi.searchEntriesByText && state.baseLetter) {
        const stackLangs = state.stackConfig.languages || []
        try {
          const entries = await hostApi.searchEntriesByText({
            text: state.baseLetter,
            languageCodes: unique(["ar", ...stackLangs]),
            limit: 20,
            offset: 0,
          })
          for (const entry of entries || []) {
            const ar = (entry.translations || []).find(tr => tr.language_code === "ar")
            if (!ar) continue
            const nonAr = (entry.translations || [])
              .filter(tr => tr.language_code !== "ar")
            // Show the picked stack-primary translation first; fall
            // back to en otherwise.
            const picked = pickByLang(nonAr, primary) || pickByLang(nonAr, "en")
            const transHtml = picked
              ? `<div class="example-translation">${escapeHtml(picked.text)}</div>`
              : ""
            corpusCards.push(`
              <article class="example-card" data-speak-phrase="${escapeHtml(ar.text)}">
                <span class="example-marker example-marker-corpus" aria-hidden="true"></span>
                ${renderArabicChips(ar.text)}
                ${transHtml}
              </article>
            `)
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[rasmapan] corpus search failed", err)
        }
      }

      const sections = []
      if (wordCards.length) {
        sections.push(
          `<div class="example-section-title">${escapeHtml(t("examples.heading_curated"))}</div>`,
          ...wordCards,
        )
      }
      if (corpusCards.length) {
        sections.push(
          `<div class="example-section-title">${escapeHtml(t("examples.heading_corpus"))}</div>`,
          ...corpusCards,
        )
      }
      const totalCount = wordCards.length + corpusCards.length
      elExamples.innerHTML =
        sections.join("") ||
        `<div class="example-text muted">${escapeHtml(t("examples.empty_for_letter"))}</div>`
      elExampleCount.textContent = String(totalCount)
      elExamplesFooter.textContent = totalCount
        ? t("examples.tap_word_hint")
        : "—"

      // Wire taps: chip → speak word; card body → speak whole
      // phrase. The chip listener stops propagation so its click
      // doesn't also trigger the parent's phrase-speak.
      elExamples.querySelectorAll("[data-speak-word]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation()
          const text = btn.dataset.speakWord
          if (text) speak("ar", text)
        })
      })
      elExamples.querySelectorAll("[data-speak-phrase]").forEach((card) => {
        card.addEventListener("click", (e) => {
          // If the click landed on a chip, the chip already handled it.
          if (e.target.closest("[data-speak-word]")) return
          const text = card.dataset.speakPhrase
          if (text) speak("ar", text)
        })
      })
    }

    const renderExamplesPanel = async () => {
      if (state.mode === "words") {
        renderWordPicker()
        return
      }
      if (state.mode === "letters") {
        await renderLetterExamples()
      }
    }

    const updateScoreBar = (quality, accepted) => {
      const pct = Math.max(0, Math.min(100, Math.round((quality || 0) * 100)))
      elScore.style.width = `${pct}%`
      if (accepted) {
        state.totalScore += Math.round((quality || 0) * 100)
        elTotalScore.textContent = String(state.totalScore)
      }
    }

    const markComplete = () => {
      state.completedCount += 1
      elCompleteCount.textContent = String(state.completedCount)
    }

    // --- Setup drawing/tracing ------------------------------------------

    const ensureCanvases = () => {
      if (!traceLayer) traceLayer = new LetterTraceLayer(elGhost, getColors)
      if (!wordTraceLayer) wordTraceLayer = new WordTraceLayer(elGhost, getColors)
      if (!drawingEngine) {
        drawingEngine = new DrawingEngine(elCanvasShell, elDraw, (stroke) => {
          // Convert into compact point array for the trace layer.
          const points = stroke.map((p) => ({ x: p.x, y: p.y }))
          const colors = getColors()
          drawingEngine.setColor(colors.strokeUser)
          let result = { accepted: false, quality: 0, complete: false, strokeIndex: -1 }
          if (state.mode === "letters" && traceLayer) {
            result = traceLayer.consumeUserStroke(points)
          } else if (state.mode === "words" && wordTraceLayer) {
            result = wordTraceLayer.consumeUserStroke(points)
          }
          updateScoreBar(result.quality, result.accepted)
          if (result.complete) markComplete()
        })
        drawingEngine.enable()
        drawingEngine.setColor(getColors().strokeUser)
        drawingEngine.setBrushConfig(brushStore.getConfig())
        brushStore.subscribe((cfg) => drawingEngine.setBrushConfig(cfg))
      }
    }

    // --- Wire UI events --------------------------------------------------

    elLetterPicker.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-family]")
      if (!btn) return
      state.activeFamilyId = btn.dataset.family
      state.activePosition = "isolated"
      renderLetterPicker()
      renderFormPicker()
      renderHero()
      renderExamplesPanel()
      if (drawingEngine) drawingEngine.clear()
    })

    elFormPicker.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pos]:not([disabled])")
      if (!btn) return
      state.activePosition = btn.dataset.pos
      renderFormPicker()
      renderHero()
      if (drawingEngine) drawingEngine.clear()
    })

    modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.dataset.mode
        if (state.mode === mode) return
        state.mode = mode
        renderModeUI()
        if (mode === "letters") renderExamplesPanel()
        if (mode === "words") renderWordPicker()
        if (drawingEngine) drawingEngine.clear()
      })
    })

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]")
      if (!btn) return
      const action = btn.dataset.action
      if (action === "exit") {
        // Corpan listens for `corpan:exit` on window and unmounts the
        // pack (see corpan-app/src/App.tsx). Matches hanzipan's exit
        // pattern (corpan/packs/hanzipan/src/main.js:2671).
        try {
          window.dispatchEvent(new CustomEvent("corpan:exit"))
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[rasmapan] exit dispatch failed", err)
        }
        return
      }
      if (action === "speak") {
        // For individual letters use the base U+06-range codepoint
        // (e.g. ب U+0628) — the presentation-form codepoint in
        // `state.currentLetter` (ﺏ U+FE8F) isn't pronounceable by
        // most system Arabic TTS voices. Words/phrases speak
        // verbatim since the corpus already uses base codepoints.
        const text = state.mode === "words" && state.currentWord
          ? state.currentWord.word
          : state.baseLetter || state.currentLetter
        if (text) speak("ar", text)
        return
      }
      if (action === "clear") {
        if (drawingEngine) drawingEngine.clear()
        if (traceLayer) traceLayer.setWriter(state.currentWriter)  // resets stroke index
        elScore.style.width = "0%"
        return
      }
      if (action === "replay") {
        // Speak the current letter or word. The dedicated speak
        // button (in the hero) does the same; the toolbar Play
        // gives users a second affordance right next to the
        // canvas, useful mid-tracing without moving the cursor.
        const text = state.mode === "words" && state.currentWord
          ? state.currentWord.word
          : state.baseLetter || state.currentLetter
        if (text) speak("ar", text)
        return
      }
      if (action === "toggle-freedraw") {
        state.freeDraw = !state.freeDraw
        btn.classList.toggle("active", state.freeDraw)
        if (traceLayer) traceLayer.setFreeDraw(state.freeDraw)
        if (state.freeDraw) {
          state.ghostVisible = false
          guidedToggle.classList.remove("active")
          if (traceLayer) traceLayer.setGhostVisible(false)
        }
        return
      }
      if (action === "brush-settings") {
        if (!brushWidget) {
          brushWidget = new BrushConfigWidget({
            container: root,
            store: brushStore,
            presets: BUILTIN_PRESETS,
          })
        }
        brushWidget.toggle()
        return
      }
      if (action === "tutorial") {
        // Reset lesson progress so the runner re-shows from step 1.
        // The user reaches this when they want to revisit the intro
        // (e.g. after switching their stack language).
        resetLessonProgress()
        if (lessonRunner) {
          lessonRunner.start()
        }
        return
      }
    })

    guidedToggle.addEventListener("click", () => {
      state.ghostVisible = !state.ghostVisible
      guidedToggle.classList.toggle("active", state.ghostVisible)
      if (traceLayer) traceLayer.setGhostVisible(state.ghostVisible)
      if (wordTraceLayer) wordTraceLayer.setGhostVisible(state.ghostVisible)
    })

    const navByDelta = (delta) => {
      if (state.mode === "letters") {
        const idx = state.families.findIndex((f) => f.id === state.activeFamilyId)
        if (idx < 0) return
        const next = state.families[(idx + delta + state.families.length) % state.families.length]
        state.activeFamilyId = next.id
        state.activePosition = "isolated"
        renderLetterPicker()
        renderFormPicker()
        renderHero()
        renderExamplesPanel()
        if (drawingEngine) drawingEngine.clear()
      } else if (state.mode === "words") {
        const idx = state.words.findIndex((w) => w.id === state.activeWordId)
        if (idx < 0) return
        const next = state.words[(idx + delta + state.words.length) % state.words.length]
        state.activeWordId = next.id
        renderWordPicker()
        renderHero()
        if (drawingEngine) drawingEngine.clear()
      } else if (state.mode === "styles") {
        if (!state.styleIds.length) return
        const idx = state.styleIds.indexOf(state.activeStyleId)
        const base = idx < 0 ? 0 : idx
        state.activeStyleId =
          state.styleIds[(base + delta + state.styleIds.length) % state.styleIds.length]
        if (stylesView) stylesView.render({ highlightId: state.activeStyleId })
      }
    }
    root.querySelector("[data-nav='prev']").addEventListener("click", () => navByDelta(-1))
    root.querySelector("[data-nav='next']").addEventListener("click", () => navByDelta(+1))

    // --- Resize ---------------------------------------------------------

    let resizeRaf = 0
    const handleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        if (drawingEngine) drawingEngine.resize()
        // Only redraw the layer that owns the canvas in this mode.
        // Both layers share the same ghost canvas — if we redraw
        // both, the inactive one runs `clearRect` first and wipes
        // the visible ghost (its own data is empty in this mode).
        if (state.mode === "letters" && traceLayer) traceLayer.redraw()
        else if (state.mode === "words" && wordTraceLayer) wordTraceLayer.redraw()
      })
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(elCanvasShell)
    window.addEventListener("resize", handleResize)

    // --- onStackConfigChange --------------------------------------------

    // Two language-change channels — both call the same re-render
    // cascade so chrome stays in sync whether the user changed
    // their stack primary or the host i18next language directly.
    const onLanguageChanged = () => {
      renderModeTabs()
      renderToolbarAria()
      renderFormPicker()
      renderHero()
      renderExamplesPanel()
      if (state.mode === "styles" && stylesView) {
        stylesView.render({ highlightId: state.activeStyleId })
      }
    }

    if (hostApi.onStackConfigChange) {
      hostApi.onStackConfigChange((next) => {
        state.stackConfig = next
        onLanguageChanged()
      })
    }
    subscribeLanguageChanged(onLanguageChanged)

    // --- Initial load ---------------------------------------------------

    const bootstrap = async () => {
      try {
        await loadFamilies()
        await loadWords()
        // Each family also needs its isolated letter glyph for the pill.
        for (const fam of state.families) {
          const w = await loadWriter(fam.id)
          fam._isolatedLetter = (w && w.letter) || ""
        }
        if (!state.activeFamilyId && state.families.length) {
          state.activeFamilyId = state.families[0].id
        }
        if (!state.activeWordId && state.words.length) {
          state.activeWordId = state.words[0].id
        }
        renderModeTabs()
        renderToolbarAria()
        renderLetterPicker()
        renderFormPicker()
        renderModeUI()
        renderExamplesPanel()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[rasmapan] bootstrap failed", err)
        elOverlay.textContent = "Failed to load pack data."
      }
    }

    // Lessons first, then practice. `lessonRunner` is also referenced
    // by the Tutorial toolbar action above, so it must be reachable
    // by the time a user can click anything.
    lessonRunner = new LessonRunner({
      container: root,
      hostApi,
      queryPackDb,
      onComplete: ({ initialLetter }) => {
        if (initialLetter) state.activeFamilyId = initialLetter
        ensureCanvases()
        bootstrap()
      },
    })
    lessonRunner.load().then(() => {
      if (lessonRunner.shouldShow()) {
        lessonRunner.start()
      } else {
        ensureCanvases()
        bootstrap()
      }
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[rasmapan] lessons load failed; skipping", err)
      ensureCanvases()
      bootstrap()
    })

    return {
      unmount: () => {
        resizeObserver.disconnect()
        window.removeEventListener("resize", handleResize)
        if (resizeRaf) cancelAnimationFrame(resizeRaf)
        if (drawingEngine) drawingEngine.disable()
        root.remove()
      },
    }
  }

  const registerGame = (game) => {
    if (typeof window === "undefined") return
    const registry = window.CorpanGames || (window.CorpanGames = {})
    registry[game.id] = game
  }

  registerGame({ id: GAME_ID, mount })
})()
