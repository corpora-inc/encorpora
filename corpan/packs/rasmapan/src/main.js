import "./styles.css"

import {
  BrushStore,
  BrushConfigWidget,
  BUILTIN_PRESETS,
} from "../brush/index.js"
import { LessonRunner } from "./lessons.js"
import { LetterTraceLayer, WordTraceLayer } from "./trace.js"
import { StylesView } from "./styles_view.js"

;(() => {
  const GAME_ID = "rasmapan"

  const template = `
    <div class="rasmapan-app">
      <button class="exit-btn" data-action="exit" aria-label="Exit">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
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
      <div class="mode-tabs" role="tablist">
        <button class="mode-tab is-active" data-mode="letters" role="tab" type="button">Letters</button>
        <button class="mode-tab" data-mode="words" role="tab" type="button">Words</button>
        <button class="mode-tab" data-mode="styles" role="tab" type="button">Styles</button>
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
                  <path d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5zM8 13.5v3.2c0 .8 2.1 1.8 4 1.8s4-1 4-1.8v-3.2" />
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
    }

    const packBaseUrl = resolvePackBaseUrl()
    const brushStore = new BrushStore("rasmapan-brush-v1")
    let brushWidget = null

    let traceLayer = null
    let wordTraceLayer = null
    let drawingEngine = null

    const queryPackDb = async (sql, params = []) => {
      if (!hostApi.queryPackDb || !state.packDbAvailable) {
        return { columns: [], rows: [] }
      }
      try {
        return await hostApi.queryPackDb({ sql, params })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[rasmapan] queryPackDb failed", err)
        state.packDbAvailable = false
        return { columns: [], rows: [] }
      }
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
      const res = await queryPackDb(
        "SELECT id, family_id, name_ar, name_en, connects_before, connects_after, frequency " +
          "FROM arabic_letter WHERE position = 'isolated' " +
          "ORDER BY frequency DESC NULLS LAST, id"
      )
      const families = res.rows || []
      // Discover positions per family.
      const allPosRes = await queryPackDb(
        "SELECT family_id, position FROM arabic_letter"
      )
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
        connects_before: !!f.connects_before,
        connects_after: !!f.connects_after,
        positions: Array.from(posByFamily.get(f.family_id) || new Set(["isolated"])),
      }))
    }

    const loadWords = async () => {
      const res = await queryPackDb(
        "SELECT id, word, transliteration, meaning_json, letter_ids_json, difficulty " +
          "FROM arabic_word ORDER BY difficulty ASC, id ASC"
      )
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
      const res = await queryPackDb(
        "SELECT data_json FROM arabic_letter_writer WHERE id = ?",
        [id]
      )
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
      const res = await queryPackDb(
        `SELECT language_code, summary FROM arabic_letter_note WHERE letter_id = ? AND language_code IN (${placeholders})`,
        [familyId, ...langs]
      )
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

    const renderFormPicker = () => {
      const fam = state.families.find((f) => f.id === state.activeFamilyId)
      if (!fam) {
        elFormPicker.innerHTML = ""
        return
      }
      const order = ["isolated", "initial", "medial", "final"]
      const html = order
        .map((pos) => {
          const available = fam.positions.includes(pos)
          const cls = `form-chip${pos === state.activePosition ? " is-active" : ""}`
          const disabled = available ? "" : "disabled"
          return `<button type="button" class="${cls}" data-pos="${pos}" ${disabled}>${pos}</button>`
        })
        .join("")
      elFormPicker.innerHTML = html
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
        elChar.textContent = writer.letter || ""
        elLetterName.textContent = `${fam.name_en} (${fam.name_ar}) — ${state.activePosition}`
        elLetterNameEn.textContent = fam.name_en
        const note = await loadFamilyNote(fam.id)
        elEtymology.textContent = note || ""
        // Push glyph into trace layer.
        if (traceLayer) {
          traceLayer.setWriter(writer)
          traceLayer.setGhostVisible(state.ghostVisible)
          traceLayer.setFreeDraw(state.freeDraw)
        }
        const total = (writer.outline || []).length || 1
        elStrokes.textContent = `${total} ${total === 1 ? "stroke" : "strokes"}`
        elOverlay.style.display = "none"
      } else if (state.mode === "words") {
        const word = state.words.find((w) => w.id === state.activeWordId)
        if (!word) return
        state.currentWord = word
        elChar.classList.add("word-trace-run")
        elChar.textContent = word.word
        const glossLang = state.stackConfig.languages.find((l) => word.meaning[l]) || "en"
        const gloss = word.meaning[glossLang] || word.meaning.en || ""
        elLetterName.innerHTML =
          `<span class="translit">${escapeHtml(word.transliteration || "")}</span>` +
          (gloss ? `<span class="gloss"> — ${escapeHtml(gloss)}</span>` : "")
        elLetterNameEn.textContent = word.transliteration || ""
        elEtymology.textContent = ""
        elFormPicker.innerHTML = ""
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
        elStrokes.textContent = `${word.letter_ids.length} letters`
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
      await stylesView.render()
    }

    // Words mode: render a vertical list of word pills in the examples panel.
    const renderWordPicker = () => {
      if (!state.words.length) {
        elExamples.innerHTML = "<div class='example-text'>No words available.</div>"
        return
      }
      const html = state.words
        .map((w) => {
          const cls = w.id === state.activeWordId ? "word-pill is-active" : "word-pill"
          const glossLang = state.stackConfig.languages.find((l) => w.meaning[l]) || "en"
          const gloss = w.meaning[glossLang] || w.meaning.en || ""
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
      elExamplesFooter.textContent = "Tap a word to trace"
      elExamples.querySelectorAll("[data-word]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.activeWordId = btn.dataset.word
          renderWordPicker()
          renderHero()
        })
      })
    }

    const renderExamplesPanel = async () => {
      if (state.mode === "words") {
        renderWordPicker()
        return
      }
      if (state.mode !== "letters") return
      if (!hostApi.searchEntriesByText) {
        elExamples.innerHTML = "<div class='example-text muted'>Corpus search unavailable.</div>"
        return
      }
      const text = state.currentLetter || ""
      if (!text || !ARABIC_RANGE.test(text)) {
        elExamples.innerHTML = ""
        elExampleCount.textContent = "—"
        return
      }
      state.loadingExamples = true
      const langCodes = unique([
        ...(state.stackConfig.languages || []),
        "ar",
      ])
      let entries = []
      try {
        entries = await hostApi.searchEntriesByText({
          text,
          languageCodes: langCodes,
          limit: 24,
          offset: 0,
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[rasmapan] searchEntriesByText failed", err)
        entries = []
      }
      state.examples = entries || []
      state.loadingExamples = false
      const html = state.examples
        .map((entry) => {
          const arT = (entry.translations || []).find((t) => t.language_code === "ar")
          if (!arT) return ""
          const others = (entry.translations || []).filter((t) => t.language_code !== "ar")
          const otherHtml = others
            .slice(0, 2)
            .map((t) => `<div class="example-translation"><span class="example-lang">${escapeHtml(t.language_code)}</span> ${escapeHtml(t.text)}</div>`)
            .join("")
          return `
            <button class="example-card" type="button" data-speak="${escapeHtml(arT.text)}">
              <div class="example-text" lang="ar">${escapeHtml(arT.text)}</div>
              ${otherHtml}
            </button>
          `
        })
        .join("")
      elExamples.innerHTML = html || "<div class='example-text muted'>No phrases found.</div>"
      elExampleCount.textContent = String(state.examples.length)
      elExamplesFooter.textContent = state.examples.length ? "Tap a phrase to hear" : "—"
      elExamples.querySelectorAll("[data-speak]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const text = btn.dataset.speak
          if (text) {
            try { hostApi.speak("ar", text) } catch { /* tolerated */ }
          }
        })
      })
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
        // Host wires the exit button via initialState callbacks; if
        // not provided, just no-op. (Pack registry typically has an
        // unmount path triggered by the host.)
        if (typeof initialState.onExit === "function") initialState.onExit()
        return
      }
      if (action === "speak") {
        const text = state.mode === "words" && state.currentWord
          ? state.currentWord.word
          : state.currentLetter
        if (text) {
          try { hostApi.speak("ar", text) } catch { /* tolerated */ }
        }
        return
      }
      if (action === "clear") {
        if (drawingEngine) drawingEngine.clear()
        if (traceLayer) traceLayer.setWriter(state.currentWriter)  // resets stroke index
        elScore.style.width = "0%"
        return
      }
      if (action === "replay") {
        // Re-fetch the current glyph; in v0.1.0 this is just a redraw.
        if (state.mode === "letters") renderHero()
        else if (state.mode === "words") renderHero()
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
        if (traceLayer) traceLayer.redraw()
        if (wordTraceLayer) wordTraceLayer.redraw()
      })
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(elCanvasShell)
    window.addEventListener("resize", handleResize)

    // --- onStackConfigChange --------------------------------------------

    if (hostApi.onStackConfigChange) {
      hostApi.onStackConfigChange((next) => {
        state.stackConfig = next
        renderExamplesPanel()
      })
    }

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

    // Lessons first, then practice.
    const lessonRunner = new LessonRunner({
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
