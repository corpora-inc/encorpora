import "./styles.css"

import {
  BrushStore,
  BrushConfigWidget,
  BUILTIN_PRESETS,
} from "../brush/index.js"
import { LessonRunner, resetLessonProgress } from "./lessons.js"
import { LetterTraceLayer, WordTraceLayer } from "./trace.js"
import { scoreFreeDrawing } from "./scoring.js"
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
              <button class="icon-chip variant-chip" data-action="variant" aria-label="See other writer" data-variant-chip hidden>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="6" cy="12" r="2.5" />
                  <circle cx="12" cy="12" r="2.5" />
                  <circle cx="18" cy="12" r="2.5" />
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
              <button class="icon-chip" data-action="score" aria-label="Score me">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
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
            <div class="score-banner" data-score-banner hidden>
              <div class="score-banner-pct" data-score-banner-pct>—</div>
              <div class="score-banner-msg" data-score-banner-msg></div>
            </div>
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
      const dpr = window.devicePixelRatio || 1
      this.dpr = dpr
      // Size the canvas BUFFER to the canvas-layer's actual rendered
      // bounds (governed by CSS: `inset: 12px` inside the shell's
      // padding box + `width: calc(100% - 24px)`). Previously we were
      // sizing to the SHELL's bounding rect and force-overriding the
      // CSS via inline style — that pushed the canvas buffer 24 CSS
      // px past the shell's overflow:hidden clip on the right and
      // bottom, shifting every centered glyph toward the lower-right
      // and causing it to overlap the dashed border (`::after { inset:
      // 20px }`) on those sides. With buffer=visible-area the trace
      // layers' centering math becomes accurate.
      const canvases = this.shell.querySelectorAll(".canvas-layer")
      let layerW = 0
      let layerH = 0
      canvases.forEach((c) => {
        const rect = c.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width))
        const h = Math.max(1, Math.floor(rect.height))
        c.width = w * dpr
        c.height = h * dpr
        // Intentionally NOT setting c.style.width / c.style.height —
        // CSS governs visible size via `inset: 12px` + calc().
        if (!layerW) { layerW = w; layerH = h }
      })
      this.size = { w: layerW, h: layerH }
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

    // Safe-area handling — env(safe-area-inset-*) works reliably on
    // iOS WebView but on Android the inset is often reported as 0px
    // even when the system status bar IS overlapping the WebView
    // content (host needs WindowCompat.setDecorFitsSystemWindows +
    // viewport-fit=cover for env() to populate; older Tauri or older
    // Android builds may not). On iOS we trust env(); on Android we
    // apply a minimum floor so chrome (close button, hero card top,
    // bottom action chips) doesn't slide under the status bar /
    // gesture inset.
    //
    // We layer max(env(...), <android-min>) onto the existing CSS
    // custom properties — iOS notch (~47px) wins over our 28px
    // floor; Android with edge-to-edge enabled (~24px) is close to
    // the floor and roughly matches; Android without edge-to-edge
    // (env=0) gets the floor, keeping content visible.
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || ""
    const isAndroid = /Android/i.test(ua)
    if (isAndroid) {
      root.style.setProperty("--safe-top", "max(env(safe-area-inset-top, 0px), 28px)")
      root.style.setProperty("--safe-bottom", "max(env(safe-area-inset-bottom, 0px), 18px)")
      root.style.setProperty("--safe-left", "max(env(safe-area-inset-left, 0px), 8px)")
      root.style.setProperty("--safe-right", "max(env(safe-area-inset-right, 0px), 8px)")
    }

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
    const elScoreBanner = root.querySelector("[data-score-banner]")
    const elScoreBannerPct = root.querySelector("[data-score-banner-pct]")
    const elScoreBannerMsg = root.querySelector("[data-score-banner-msg]")

    const state = {
      mode: "letters",  // letters | words. Styles live in the intro
      // lesson flow now (lessons 7-10), not as a top-level mode tab.
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

    // v0.1.1: stroke-order animation removed. Per-letter medians
    // produced by the masked-Calliar pipeline didn't visually match
    // the letter centerlines — the animation taught the wrong path
    // and confused learners. Static ghost outline + start dot stays;
    // a future Calligrapher-watch surface (v0.2) will replace this
    // with word/phrase-level playback using Calliar's native render
    // pattern instead of fighting their data into our viewBox.
    //
    // The trace.js `playStrokeOrder` API is intentionally left in
    // place so v0.2 can rewire it, but no call sites remain here.
    const variantChip = root.querySelector("[data-variant-chip]")
    if (variantChip) variantChip.hidden = true
    const refreshVariantChip = () => {
      if (variantChip) variantChip.hidden = true
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
      // Look up the etymology in the user's CURRENT UI language
      // (host i18next primary), then its base ("ko-polite" → "ko"),
      // then English. Other stack languages don't get a shot — if
      // we don't have the user's primary, English is the
      // universally-readable fallback. Previously we'd walk the
      // whole stack and return e.g. Spanish to a user who'd
      // switched to Greek just because they happened to still
      // have Spanish secondary.
      const cur = currentLanguage()
      const base = cur.split("-")[0]
      const langs = unique([cur, base, "en"]).filter((l) => l && l !== "ar")
      if (!langs.length) return ""
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
        refreshVariantChip()
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
        const picked =
          pickByLang(meaningRows, stackPrimaryLang()) ||
          pickByLang(meaningRows, "en")
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
        // Load each letter's writer at the CORRECT positional form
        // (isolated / initial / medial / final). Without this, every
        // glyph in the word was loaded as `isolated`, which on the
        // canvas reads as "trace 3 standalone letters" rather than
        // a connected word — wrong for everything except single-
        // letter words and never wrong-but-still-rare in the seed.
        //
        // Connection rules:
        //   prev connects forward AND this connects backward → linked on the right
        //   this connects forward AND next connects backward → linked on the left
        //   both linked → medial
        //   right-only → final
        //   left-only  → initial
        //   neither    → isolated
        //
        // The six non-connectors (alif, daal, dhaal, raa, zaay, waaw)
        // have `connects_after: false` in the seed, which naturally
        // forces the letter AFTER them into `initial` form. That
        // matches real Arabic typography.
        const famMap = new Map(state.families.map((fm) => [fm.id, fm]))
        const ids = word.letter_ids || []
        const writers = []
        for (let i = 0; i < ids.length; i += 1) {
          const fam = famMap.get(ids[i])
          if (!fam) continue
          const prevFam = i > 0 ? famMap.get(ids[i - 1]) : null
          const nextFam = i < ids.length - 1 ? famMap.get(ids[i + 1]) : null
          const linkedRight = !!(prevFam && prevFam.connects_after && fam.connects_before)
          const linkedLeft  = !!(nextFam && fam.connects_after && nextFam.connects_before)
          let pos
          if (linkedRight && linkedLeft) pos = "medial"
          else if (linkedRight) pos = "final"
          else if (linkedLeft) pos = "initial"
          else pos = "isolated"
          // Graceful fallback if the seed doesn't carry the requested
          // form (e.g. some letter only has isolated+final). Walks
          // down through closely-related forms before giving up.
          if (!fam.positions.includes(pos)) {
            const fallback = pos === "medial" ? ["final", "initial", "isolated"]
              : pos === "initial" ? ["medial", "isolated"]
              : pos === "final" ? ["medial", "isolated"]
              : []
            const next = fallback.find((p) => fam.positions.includes(p))
            pos = next || "isolated"
          }
          const glyphId = pos === "isolated" ? fam.id : `${fam.id}.${pos}`
          const w = await loadWriter(glyphId)
          if (w) writers.push({ writer: w })
        }
        if (wordTraceLayer) {
          // Pass the raw Arabic string alongside the per-letter
          // writers — v0.4 renders the ghost as a single big Amiri
          // fillText composition instead of slotting separate letter
          // glyphs side-by-side.
          wordTraceLayer.setWord(writers, word.word)
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
      elWorkspace.classList.remove("mode-letters", "mode-words")
      elWorkspace.classList.add(`mode-${state.mode}`)
      elChar.classList.remove("word-trace-run")
      // Picker visibility.
      elLetterPicker.style.display = state.mode === "letters" ? "" : "none"
      elFormPicker.style.display = state.mode === "letters" ? "" : "none"
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

    // The user's CURRENT UI language — what's set as primary in
    // corpan Settings. Anchored to host i18next so it always
    // reflects what the user just picked, not whatever was first
    // in the stack array historically. Used to pick which
    // translation to show for letter notes, word glosses, and
    // corpus example phrases.
    const stackPrimaryLang = () => currentLanguage() || "en"

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

    // Words mode: paint the 40-word picker synchronously, then
    // async-append host-corpus phrases containing the active word.
    // Mirrors `renderLetterExamples` pattern but rendered in two
    // stages so the picker shows up immediately.
    const wordCorpusSeq = { current: 0 }  // bumped to invalidate stale fetches
    const renderWordPicker = () => {
      if (!state.words.length) {
        elExamples.innerHTML = "<div class='example-text'>—</div>"
        return
      }
      const primary = stackPrimaryLang()
      const pillsHtml = state.words
        .map((w) => {
          const cls = w.id === state.activeWordId ? "word-pill is-active" : "word-pill"
          const meaningRows = Object.entries(w.meaning || {})
            .filter(([lang, text]) => lang && text && lang !== "ar")
            .map(([lang, text]) => ({ language_code: lang, text }))
          const picked =
            pickByLang(meaningRows, primary) ||
            pickByLang(meaningRows, "en")
          const gloss = picked ? picked.text : ""
          return `
            <button class="${cls}" type="button" data-word="${escapeHtml(w.id)}">
              <span class="word-text" lang="ar">${escapeHtml(w.word)}</span>
              <span class="word-meaning">${escapeHtml(gloss)}</span>
            </button>
          `
        })
        .join("")
      // Render an empty `word-corpus` container — async append will
      // fill it once the host search returns. Keeps the picker
      // pills painted immediately.
      elExamples.innerHTML =
        `<div class='word-picker'>${pillsHtml}</div>` +
        `<div data-word-corpus></div>`
      elExampleCount.textContent = String(state.words.length)
      elExamplesFooter.textContent = t("word_picker.hint")
      elExamples.querySelectorAll("[data-word]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.activeWordId = btn.dataset.word
          renderWordPicker()
          renderHero()
        })
      })
      // Async corpus fetch for the active word.
      const seq = ++wordCorpusSeq.current
      void (async () => {
        const activeWord = state.words.find((w) => w.id === state.activeWordId)
        if (!activeWord || !activeWord.word || !hostApi.searchEntriesByText) return
        const stackLangs = state.stackConfig.languages || []
        let entries = []
        try {
          entries = await hostApi.searchEntriesByText({
            text: activeWord.word,
            languageCodes: unique(["ar", ...stackLangs]),
            limit: 20,
            offset: 0,
          })
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[rasmapan] corpus search (words mode) failed", err)
          return
        }
        // Bail if the user changed words while we were fetching.
        if (seq !== wordCorpusSeq.current) return
        const slot = elExamples.querySelector("[data-word-corpus]")
        if (!slot) return
        const corpusCards = []
        for (const entry of entries || []) {
          const ar = (entry.translations || []).find((tr) => tr.language_code === "ar")
          if (!ar) continue
          const nonAr = (entry.translations || [])
            .filter((tr) => tr.language_code !== "ar")
          const pickedRow = pickByLang(nonAr, primary) || pickByLang(nonAr, "en")
          const transHtml = pickedRow
            ? `<div class="example-translation">${escapeHtml(pickedRow.text)}</div>`
            : ""
          corpusCards.push(`
            <article class="example-card" data-speak-phrase="${escapeHtml(ar.text)}">
              <span class="example-marker example-marker-corpus" aria-hidden="true"></span>
              ${renderArabicChips(ar.text)}
              ${transHtml}
            </article>
          `)
        }
        if (!corpusCards.length) {
          slot.innerHTML = ""
          return
        }
        slot.innerHTML =
          `<div class="example-section-title">${escapeHtml(t("examples.heading_corpus"))}</div>` +
          corpusCards.join("")
        elExampleCount.textContent = String(state.words.length + corpusCards.length)
        elExamplesFooter.textContent = t("examples.tap_word_hint")
        // Re-wire taps on the just-appended cards.
        slot.querySelectorAll("[data-speak-word]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation()
            const text = btn.dataset.speakWord
            if (text) speak("ar", text)
          })
        })
        slot.querySelectorAll("[data-speak-phrase]").forEach((card) => {
          card.addEventListener("click", (e) => {
            if (e.target.closest("[data-speak-word]")) return
            const text = card.dataset.speakPhrase
            if (text) speak("ar", text)
          })
        })
      })()
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
        const picked =
          pickByLang(meaningRows, primary) ||
          pickByLang(meaningRows, "en")
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

    // --- v0.3 "Score me" --------------------------------------------------
    //
    // Grab the user's drawn strokes (from DrawingEngine, in canvas
    // device-pixel coords), convert to 0..1000 viewBox via the active
    // trace layer's _canvasToView, score against the current writer's
    // outline polygon via scoreFreeDrawing(), and show a transient
    // banner with the % match + a status string.
    let scoreBannerTimer = null
    const hideScoreBanner = () => {
      if (scoreBannerTimer) {
        clearTimeout(scoreBannerTimer)
        scoreBannerTimer = null
      }
      if (elScoreBanner) elScoreBanner.hidden = true
    }
    const showScoreBanner = (pct, message, accent) => {
      if (!elScoreBanner) return
      elScoreBanner.hidden = false
      elScoreBanner.dataset.tone = accent
      if (elScoreBannerPct) elScoreBannerPct.textContent = `${pct}%`
      if (elScoreBannerMsg) {
        elScoreBannerMsg.textContent = t(`score.${message}`) || ""
      }
      if (scoreBannerTimer) clearTimeout(scoreBannerTimer)
      scoreBannerTimer = setTimeout(hideScoreBanner, 4200)
    }
    const scoreUserDrawing = () => {
      if (!drawingEngine || !drawingEngine.strokes || !drawingEngine.strokes.length) {
        showScoreBanner(0, "draw_to_score", "muted")
        return
      }
      // Convert each user stroke from canvas device-pixel coords to
      // viewBox 0..1000 via whichever trace layer owns the canvas
      // in the current mode (both expose the same `_canvasToView`).
      const layer = state.mode === "words" ? wordTraceLayer : traceLayer
      if (!layer || typeof layer._canvasToView !== "function") {
        showScoreBanner(0, "draw_to_score", "muted")
        return
      }
      const userStrokesView = drawingEngine.strokes.map((s) =>
        s.map((p) => layer._canvasToView(p.x, p.y)),
      )
      // Pick the scoring target: a writer record for letter mode,
      // a word-text target (rasterized fillText mask at the canvas's
      // own aspect ratio) for word mode.
      let target = null
      if (state.mode === "letters" && state.currentWriter) {
        target = state.currentWriter
      } else if (state.mode === "words" && state.currentWord && state.currentWord.word) {
        const vp = typeof layer.getViewportSize === "function"
          ? layer.getViewportSize()
          : { width: 1000, height: 1000 }
        target = {
          kind: "text",
          text: state.currentWord.word,
          width: vp.width,
          height: vp.height,
        }
      }
      if (!target) {
        showScoreBanner(0, "draw_to_score", "muted")
        return
      }
      const result = scoreFreeDrawing(userStrokesView, target)
      const pct = Math.round((result.quality || 0) * 100)
      const tone =
        result.quality >= 0.85 ? "great" :
        result.quality >= 0.65 ? "good" :
        result.quality >= 0.35 ? "ok" : "low"
      showScoreBanner(pct, result.message, tone)
    }

    // --- Setup drawing/tracing ------------------------------------------

    const ensureCanvases = () => {
      if (!traceLayer) {
        traceLayer = new LetterTraceLayer(elGhost, getColors)
        traceLayer.setFxCanvas(elFx)
      }
      if (!wordTraceLayer) {
        wordTraceLayer = new WordTraceLayer(elGhost, getColors)
        wordTraceLayer.setFxCanvas(elFx)
      }
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
      if (traceLayer) traceLayer.cancelAnimation()
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
        refreshVariantChip()
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
        hideScoreBanner()
        return
      }
      if (action === "score") {
        scoreUserDrawing()
        return
      }
      if (action === "replay") {
        // Toolbar Play is a TTS replay shortcut next to the canvas.
        // No stroke-order animation in v0.1.1 (see comment above
        // `refreshVariantChip`).
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
      // variant action removed in v0.1.1 along with playStrokeOrder.
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
      // Only touch the layer that owns the canvas in this mode.
      // Calling both `setGhostVisible`s makes the inactive layer's
      // redraw clearRect the canvas (its data is empty) and the
      // ghost never comes back when toggled on. Same fix as the
      // resize handler.
      if (state.mode === "letters" && traceLayer) {
        traceLayer.setGhostVisible(state.ghostVisible)
      } else if (state.mode === "words" && wordTraceLayer) {
        wordTraceLayer.setGhostVisible(state.ghostVisible)
      }
    })

    const navByDelta = (delta) => {
      if (state.mode === "letters") {
        const idx = state.families.findIndex((f) => f.id === state.activeFamilyId)
        if (idx < 0) return
        const next = state.families[(idx + delta + state.families.length) % state.families.length]
        state.activeFamilyId = next.id
        state.activePosition = "isolated"
        if (traceLayer) traceLayer.cancelAnimation()
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
        if (wordTraceLayer) wordTraceLayer.cancelAnimation()
        renderWordPicker()
        renderHero()
        if (drawingEngine) drawingEngine.clear()
      }
    }
    root.querySelector("[data-nav='prev']").addEventListener("click", () => navByDelta(-1))
    root.querySelector("[data-nav='next']").addEventListener("click", () => navByDelta(+1))

    // Global swipe navigation — fires from anywhere on the main pack
    // screen EXCEPT the brush canvas (`touch-action: none` for
    // drawing) and the horizontally-scrolling letter picker. The
    // examples panel scrolls vertically, so horizontal swipe there
    // doesn't conflict.
    //
    // Mirrors lessons.js `_wireSwipe`: all listeners on the same
    // element (root), per-pointer state via a Map (so a stray touch
    // doesn't confuse a primary gesture), and the swipe FIRES on
    // pointermove the moment the threshold is crossed — instead of
    // waiting for pointerup. This makes it feel snappy and avoids
    // the case where pointerup fires off the listener's element on
    // mobile.
    const SKIP_SWIPE_SEL =
      ".canvas-shell, .letter-picker, " +
      "button, a, input, textarea, select"
    const SWIPE_THRESHOLD = 32
    const swipeMap = new Map()  // pointerId -> { startX, startY, fired }
    const onSwipeDown = (e) => {
      if (e.target.closest(SKIP_SWIPE_SEL)) return
      swipeMap.set(e.pointerId, {
        startX: e.clientX,
        startY: e.clientY,
        fired: false,
      })
    }
    const onSwipeMove = (e) => {
      const s = swipeMap.get(e.pointerId)
      if (!s || s.fired) return
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (Math.abs(dx) < SWIPE_THRESHOLD) return
      if (Math.abs(dy) > Math.abs(dx)) return
      s.fired = true  // prevent re-fire within the same gesture
      if (dx < 0) navByDelta(1)
      else navByDelta(-1)
    }
    const onSwipeEnd = (e) => {
      swipeMap.delete(e.pointerId)
    }
    root.addEventListener("pointerdown", onSwipeDown)
    root.addEventListener("pointermove", onSwipeMove)
    root.addEventListener("pointerup", onSwipeEnd)
    root.addEventListener("pointercancel", onSwipeEnd)

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
      packBaseUrl,
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
        // Swipe listeners are attached to `root`; removing root
        // takes them down automatically.
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
