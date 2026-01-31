import type { EntryOut, HostApi, StackConfig } from "./sdk/types"
import { SequencerClock } from "./sequencerClock"

const TICKS_PER_BEAT = 48
const MAX_SEGMENTS = 180

const SUBDIVISIONS = [
  { id: "quarter", label: "1/4", ticks: 48 },
  { id: "eighth", label: "1/8", ticks: 24 },
  { id: "eighth-triplet", label: "1/8T", ticks: 16 },
  { id: "sixteenth", label: "1/16", ticks: 12 },
  { id: "sixteenth-triplet", label: "1/16T", ticks: 8 },
  { id: "thirty-second", label: "1/32", ticks: 6 },
  { id: "thirty-second-triplet", label: "1/32T", ticks: 4 },
]

type Segment = {
  id: string
  text: string
}

type SegmentMeta = {
  start: number
  end: number
  gain: number
  tone: number
  rate: number
  rendered: boolean
  rendering: boolean
  lengthSec: number
  buffer?: AudioBuffer
}

type Track = {
  id: string
  name: string
  steps: Array<string | null>
  muted: boolean
}

type SequencerState = {
  bpm: number
  isPlaying: boolean
  numerator: number
  denominator: number
  bars: number
  stepTicks: number
  loopTicks: number
  stepCount: number
  segments: Segment[]
  segmentColors: Record<string, string>
  segmentMeta: Record<string, SegmentMeta>
  segmentUnitLabel: string
  segmentMode: "word" | "char"
  selectedSegmentId: string | null
  activeEntry: EntryOut | null
  activeLanguage: string
  maxSegmentWords: number
  metronome: boolean
  tracks: Track[]
  barTicks: number
}

type Tokenization = {
  tokens: string[]
  joiner: string
  unitLabel: string
  mode: "word" | "char"
}

const CJK_CHAR_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/g
const CJK_PUNCT_REGEX = /^[\u3000-\u303f\uff00-\uff65]+$/
const ASCII_PUNCT_REGEX = /^[!-/:-@[-`{-~]+$/

const isCjkLanguage = (uiCode?: string) => {
  if (!uiCode) return false
  const base = uiCode.split("-")[0]?.toLowerCase()
  return base === "zh" || base === "ja" || base === "ko"
}

const isCjkText = (text: string) => {
  const compact = text.replace(/\s+/g, "")
  if (!compact) return false
  const matches = compact.match(CJK_CHAR_REGEX)
  if (!matches) return false
  if (!/\s/.test(text)) return true
  const ratio = matches.length / compact.length
  return ratio > 0.35
}

const isPunctuationToken = (value: string) => {
  if (!value.trim()) return true
  if (ASCII_PUNCT_REGEX.test(value)) return true
  if (CJK_PUNCT_REGEX.test(value)) return true
  return false
}

const segmentWithIntl = (text: string, granularity: "word" | "grapheme") => {
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) {
    return null
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity })
  const tokens: string[] = []
  for (const part of segmenter.segment(text) as Iterable<{ segment: string; isWordLike?: boolean }>) {
    if (granularity === "word" && part.isWordLike === false) continue
    const value = String(part.segment)
    if (!value.trim()) continue
    tokens.push(value)
  }
  return tokens
}

const tokenize = (text: string, uiCode?: string): Tokenization => {
  const trimmed = text.trim()
  if (!trimmed) {
    return { tokens: [], joiner: " ", unitLabel: "words", mode: "word" }
  }

  if (isCjkLanguage(uiCode) || isCjkText(trimmed)) {
    const tokens =
      segmentWithIntl(trimmed, "grapheme") ??
      Array.from(trimmed).filter((value) => !isPunctuationToken(value))
    const filtered = tokens.filter((value) => !isPunctuationToken(value))
    return { tokens: filtered, joiner: "", unitLabel: "characters", mode: "char" }
  }

  const tokens =
    segmentWithIntl(trimmed, "word") ??
    trimmed.split(/\s+/).filter(Boolean)
  return { tokens, joiner: " ", unitLabel: "words", mode: "word" }
}

const buildSegments = (text: string, maxWords: number, uiCode?: string) => {
  const { tokens, joiner, unitLabel, mode } = tokenize(text, uiCode)
  if (tokens.length === 0) {
    return { segments: [] as Segment[], unitLabel, mode }
  }

  const segments: Segment[] = []
  const seen = new Set<string>()
  const maxLen = Math.min(maxWords, tokens.length)

  for (let len = 1; len <= maxLen; len += 1) {
    for (let start = 0; start <= tokens.length - len; start += 1) {
      const slice = tokens.slice(start, start + len).join(joiner)
      if (seen.has(slice)) continue
      seen.add(slice)
      segments.push({ id: `${start}-${len}-${slice}`, text: slice })
      if (segments.length >= MAX_SEGMENTS) {
        return { segments, unitLabel, mode }
      }
    }
  }

  return { segments, unitLabel, mode }
}

const pickTranslation = (entry: EntryOut | null, uiCode: string) => {
  if (!entry) return ""
  const base = uiCode.split("-")[0]
  const exact = entry.translations.find((t) => t.language_code === uiCode)
  const baseMatch = entry.translations.find((t) => t.language_code === base)
  return exact?.text ?? baseMatch?.text ?? entry.translations[0]?.text ?? ""
}

const computeLoop = (numerator: number, denominator: number, bars: number) => {
  const beatsPerBar = numerator * (4 / denominator)
  const loopBeats = bars * beatsPerBar
  const loopTicks = Math.max(1, Math.round(loopBeats * TICKS_PER_BEAT))
  const barTicks = Math.max(1, Math.round(beatsPerBar * TICKS_PER_BEAT))
  return { loopTicks, barTicks, loopBeats }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const createSegmentColors = (segments: Segment[]) => {
  const colors: Record<string, string> = {}
  segments.forEach((segment, index) => {
    const hue = (index * 47) % 360
    colors[segment.id] = `hsl(${hue} 78% 52%)`
  })
  return colors
}

const estimateSegmentLength = (text: string) => {
  return clamp(text.length * 0.05 + 0.18, 0.2, 2.2)
}

const createSegmentMeta = (text: string): SegmentMeta => ({
  start: 0,
  end: 1,
  gain: 1,
  tone: 0.65,
  rate: 1,
  rendered: false,
  rendering: false,
  lengthSec: estimateSegmentLength(text),
})

const ensureAudioContext = async (current: AudioContext | null) => {
  if (!current) {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    await ctx.resume()
    return ctx
  }
  if (current.state === "suspended") {
    await current.resume()
  }
  return current
}

const playClick = (ctx: AudioContext, time: number, isDownbeat: boolean) => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = isDownbeat ? 880 : 520
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(0.22, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.08)
}

const createTrack = (index: number, stepCount: number): Track => ({
  id: `track-${index}-${Math.random().toString(16).slice(2)}`,
  name: `Track ${index + 1}`,
  steps: Array.from({ length: stepCount }, () => null),
  muted: false,
})

export const createTtsSequencer = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: { stackConfig?: StackConfig }
) => {
  if (typeof hostApi.stopSpeech === "function") {
    hostApi.stopSpeech()
  }

  const root = document.createElement("div")
  root.className = "tts-sequencer"
  container.appendChild(root)

  const stackConfig = initialState?.stackConfig ?? hostApi.getStackConfig()
  const initialLang = stackConfig.languages[0] ?? "en"

  const { loopTicks, barTicks } = computeLoop(4, 4, 2)

  const state: SequencerState = {
    bpm: 120,
    isPlaying: false,
    numerator: 4,
    denominator: 4,
    bars: 2,
    stepTicks: SUBDIVISIONS[3].ticks,
    loopTicks,
    stepCount: Math.max(1, Math.round(loopTicks / SUBDIVISIONS[3].ticks)),
    segments: [],
    segmentColors: {},
    segmentMeta: {},
    segmentUnitLabel: "words",
    segmentMode: "word",
    selectedSegmentId: null,
    activeEntry: null,
    activeLanguage: initialLang,
    maxSegmentWords: 5,
    metronome: true,
    tracks: [createTrack(0, Math.max(1, Math.round(loopTicks / SUBDIVISIONS[3].ticks)))],
    barTicks,
  }

  let audioContext: AudioContext | null = null
  let clock: SequencerClock | null = null
  let rafId: number | null = null
  let lastPlayheadStep = -1
  let stepButtons: HTMLButtonElement[][] = []
  let waveformDpr = 1

  const tapTimes: number[] = []

  const layout = {
    header: document.createElement("header"),
    transport: document.createElement("section"),
    main: document.createElement("section"),
    grid: document.createElement("section"),
  }

  layout.header.className = "hero"
  layout.transport.className = "transport"
  layout.main.className = "main"
  layout.grid.className = "grid-section"

  const title = document.createElement("div")
  title.className = "hero-title"
  title.textContent = "TTS Sequencer"

  const subtitle = document.createElement("div")
  subtitle.className = "hero-subtitle"
  subtitle.textContent = "Slice phrases, sculpt snippets, and drop them on the grid."

  layout.header.append(title, subtitle)

  const transportControls = document.createElement("div")
  transportControls.className = "transport-controls"

  const playButton = document.createElement("button")
  playButton.className = "btn btn-primary"
  playButton.textContent = "Play"

  const stopButton = document.createElement("button")
  stopButton.className = "btn btn-ghost"
  stopButton.textContent = "Stop"
  stopButton.disabled = true

  const bpmLabel = document.createElement("label")
  bpmLabel.className = "field"
  bpmLabel.innerHTML = `<span>BPM</span>`
  const bpmInput = document.createElement("input")
  bpmInput.type = "number"
  bpmInput.min = "30"
  bpmInput.max = "320"
  bpmInput.value = String(state.bpm)
  bpmInput.step = "1"
  bpmLabel.appendChild(bpmInput)

  const tapButton = document.createElement("button")
  tapButton.className = "btn btn-outline"
  tapButton.textContent = "Tap"

  const metronomeLabel = document.createElement("label")
  metronomeLabel.className = "toggle"
  const metronomeInput = document.createElement("input")
  metronomeInput.type = "checkbox"
  metronomeInput.checked = state.metronome
  metronomeLabel.append(metronomeInput, document.createElement("span"))
  const metronomeText = document.createElement("div")
  metronomeText.className = "toggle-label"
  metronomeText.textContent = "Metronome"

  transportControls.append(playButton, stopButton, bpmLabel, tapButton, metronomeLabel, metronomeText)

  const loopControls = document.createElement("div")
  loopControls.className = "loop-controls"

  const signatureLabel = document.createElement("label")
  signatureLabel.className = "field"
  signatureLabel.innerHTML = `<span>Time Sig</span>`
  const numeratorInput = document.createElement("input")
  numeratorInput.type = "number"
  numeratorInput.min = "1"
  numeratorInput.max = "31"
  numeratorInput.step = "1"
  numeratorInput.value = String(state.numerator)
  const denominatorSelect = document.createElement("select")
  ;[4, 8, 16].forEach((value) => {
    const option = document.createElement("option")
    option.value = String(value)
    option.textContent = `/${value}`
    if (value === state.denominator) option.selected = true
    denominatorSelect.appendChild(option)
  })
  const signatureRow = document.createElement("div")
  signatureRow.className = "signature-row"
  signatureRow.append(numeratorInput, denominatorSelect)
  signatureLabel.appendChild(signatureRow)

  const barsLabel = document.createElement("label")
  barsLabel.className = "field"
  barsLabel.innerHTML = `<span>Bars</span>`
  const barsInput = document.createElement("input")
  barsInput.type = "number"
  barsInput.min = "1"
  barsInput.max = "64"
  barsInput.step = "1"
  barsInput.value = String(state.bars)
  barsLabel.appendChild(barsInput)

  const subdivisionLabel = document.createElement("label")
  subdivisionLabel.className = "field"
  subdivisionLabel.innerHTML = `<span>Grid</span>`
  const subdivisionSelect = document.createElement("select")
  SUBDIVISIONS.forEach((subdivision) => {
    const option = document.createElement("option")
    option.value = subdivision.id
    option.textContent = subdivision.label
    if (subdivision.ticks === state.stepTicks) option.selected = true
    subdivisionSelect.appendChild(option)
  })
  subdivisionLabel.appendChild(subdivisionSelect)

  const loopInfo = document.createElement("div")
  loopInfo.className = "loop-info"

  loopControls.append(signatureLabel, barsLabel, subdivisionLabel, loopInfo)

  layout.transport.append(transportControls, loopControls)

  const phrasePanel = document.createElement("div")
  phrasePanel.className = "panel"
  const phraseHeader = document.createElement("div")
  phraseHeader.className = "panel-header"
  phraseHeader.textContent = "Phrase source"

  const phraseControls = document.createElement("div")
  phraseControls.className = "phrase-controls"

  const randomButton = document.createElement("button")
  randomButton.className = "btn btn-outline"
  randomButton.textContent = "Random Phrase"

  const languageLabel = document.createElement("label")
  languageLabel.className = "field"
  languageLabel.innerHTML = `<span>Language</span>`
  const languageSelect = document.createElement("select")
  languageLabel.appendChild(languageSelect)

  phraseControls.append(randomButton, languageLabel)

  const searchRow = document.createElement("div")
  searchRow.className = "search-row"
  const searchInput = document.createElement("input")
  searchInput.type = "text"
  searchInput.placeholder = "Search phrase in corpus"
  const searchButton = document.createElement("button")
  searchButton.className = "btn btn-ghost"
  searchButton.textContent = "Find"
  searchRow.append(searchInput, searchButton)

  const phraseText = document.createElement("div")
  phraseText.className = "phrase-text"
  phraseText.textContent = "Pick a phrase to start building.";

  const searchResults = document.createElement("div")
  searchResults.className = "search-results"

  phrasePanel.append(phraseHeader, phraseControls, searchRow, phraseText, searchResults)

  const segmentsPanel = document.createElement("div")
  segmentsPanel.className = "panel"
  const segmentsHeader = document.createElement("div")
  segmentsHeader.className = "panel-header"
  segmentsHeader.textContent = "Segments"

  const segmentsControls = document.createElement("div")
  segmentsControls.className = "segments-controls"

  const maxWordsLabel = document.createElement("label")
  maxWordsLabel.className = "field"
  maxWordsLabel.innerHTML = `<span>Max units</span>`
  const maxWordsInput = document.createElement("input")
  maxWordsInput.type = "number"
  maxWordsInput.min = "1"
  maxWordsInput.max = "8"
  maxWordsInput.step = "1"
  maxWordsInput.value = String(state.maxSegmentWords)
  maxWordsLabel.appendChild(maxWordsInput)

  const segmentModeBadge = document.createElement("div")
  segmentModeBadge.className = "badge"
  segmentModeBadge.textContent = "Units: words"

  const selectedSegmentDisplay = document.createElement("div")
  selectedSegmentDisplay.className = "selected-segment"
  selectedSegmentDisplay.textContent = "Select a segment to paint the grid."

  segmentsControls.append(maxWordsLabel, segmentModeBadge, selectedSegmentDisplay)

  const segmentsList = document.createElement("div")
  segmentsList.className = "segments-list"

  const clipEditor = document.createElement("div")
  clipEditor.className = "clip-editor"
  const clipHeader = document.createElement("div")
  clipHeader.className = "clip-header"
  clipHeader.textContent = "Clip designer"
  const clipMeta = document.createElement("div")
  clipMeta.className = "clip-meta"
  clipMeta.textContent = "Select a segment to render and shape."
  const clipActions = document.createElement("div")
  clipActions.className = "clip-actions"
  const renderClipButton = document.createElement("button")
  renderClipButton.className = "btn btn-primary"
  renderClipButton.textContent = "Render clip"
  const previewClipButton = document.createElement("button")
  previewClipButton.className = "btn btn-outline"
  previewClipButton.textContent = "Preview"
  previewClipButton.disabled = true
  clipActions.append(renderClipButton, previewClipButton)
  const clipWaveform = document.createElement("canvas")
  clipWaveform.className = "clip-waveform"
  const clipControls = document.createElement("div")
  clipControls.className = "clip-controls"

  const createSlider = (label: string, min: number, max: number, step: number) => {
    const row = document.createElement("div")
    row.className = "clip-row"
    const name = document.createElement("div")
    name.className = "clip-label"
    name.textContent = label
    const input = document.createElement("input")
    input.type = "range"
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    const value = document.createElement("div")
    value.className = "clip-value"
    row.append(name, input, value)
    return { row, input, value }
  }

  const trimStart = createSlider("Start", 0, 100, 1)
  const trimEnd = createSlider("End", 0, 100, 1)
  const trimGain = createSlider("Gain", 0, 200, 1)
  const trimTone = createSlider("Tone", 0, 100, 1)
  const trimRate = createSlider("Speed", 50, 200, 1)
  clipControls.append(trimStart.row, trimEnd.row, trimGain.row, trimTone.row, trimRate.row)

  clipEditor.append(clipHeader, clipMeta, clipActions, clipWaveform, clipControls)

  segmentsPanel.append(segmentsHeader, segmentsControls, segmentsList, clipEditor)

  const trackPanel = document.createElement("div")
  trackPanel.className = "panel"
  const trackHeader = document.createElement("div")
  trackHeader.className = "panel-header"
  trackHeader.textContent = "Tracks"
  const trackActions = document.createElement("div")
  trackActions.className = "track-actions"
  const addTrackButton = document.createElement("button")
  addTrackButton.className = "btn btn-outline"
  addTrackButton.textContent = "Add Track"
  const clearTracksButton = document.createElement("button")
  clearTracksButton.className = "btn btn-ghost"
  clearTracksButton.textContent = "Clear All"
  trackActions.append(addTrackButton, clearTracksButton)
  const trackList = document.createElement("div")
  trackList.className = "track-list"

  trackPanel.append(trackHeader, trackActions, trackList)

  layout.main.append(phrasePanel, segmentsPanel, trackPanel)

  const gridHeader = document.createElement("div")
  gridHeader.className = "grid-header"
  gridHeader.textContent = "Timeline"
  const gridScroller = document.createElement("div")
  gridScroller.className = "grid-scroller"
  const gridBody = document.createElement("div")
  gridBody.className = "grid-body"
  gridScroller.appendChild(gridBody)
  layout.grid.append(gridHeader, gridScroller)

  root.append(layout.header, layout.transport, layout.main, layout.grid)

  const updateLoopInfo = () => {
    const beatsPerBar = state.numerator * (4 / state.denominator)
    const loopBeats = state.bars * beatsPerBar
    loopInfo.textContent = `${loopBeats.toFixed(2)} beats | ${state.stepCount} steps | ${state.loopTicks} ticks`
  }

  const updateLanguageOptions = (stack: StackConfig) => {
    languageSelect.innerHTML = ""
    stack.languages.forEach((lang) => {
      const option = document.createElement("option")
      option.value = lang
      option.textContent = lang
      if (lang === state.activeLanguage) option.selected = true
      languageSelect.appendChild(option)
    })
  }

  const pruneTracksForSegments = () => {
    const valid = new Set(state.segments.map((s) => s.id))
    state.tracks.forEach((track) => {
      track.steps = track.steps.map((step) => (step && valid.has(step) ? step : null))
    })
  }

  const syncTrackSteps = () => {
    state.tracks.forEach((track) => {
      if (track.steps.length === state.stepCount) return
      if (track.steps.length > state.stepCount) {
        track.steps = track.steps.slice(0, state.stepCount)
        return
      }
      const extra = Array.from({ length: state.stepCount - track.steps.length }, () => null)
      track.steps = [...track.steps, ...extra]
    })
  }

  const ensureSegmentMeta = (segments: Segment[]) => {
    const next: Record<string, SegmentMeta> = {}
    segments.forEach((segment) => {
      next[segment.id] = state.segmentMeta[segment.id] ?? createSegmentMeta(segment.text)
    })
    state.segmentMeta = next
  }

  const getSelectedSegment = () => {
    if (!state.selectedSegmentId) return null
    return state.segments.find((segment) => segment.id === state.selectedSegmentId) ?? null
  }

  const getSelectedMeta = () => {
    const segment = getSelectedSegment()
    if (!segment) return null
    return state.segmentMeta[segment.id] ?? null
  }

  const resizeWaveform = () => {
    const rect = clipWaveform.getBoundingClientRect()
    waveformDpr = window.devicePixelRatio || 1
    clipWaveform.width = Math.max(1, Math.floor(rect.width * waveformDpr))
    clipWaveform.height = Math.max(1, Math.floor(rect.height * waveformDpr))
    const ctx = clipWaveform.getContext("2d")
    if (ctx) {
      ctx.setTransform(waveformDpr, 0, 0, waveformDpr, 0, 0)
    }
    drawWaveform(state.selectedSegmentId ?? undefined)
  }

  const drawWaveform = (segmentId?: string) => {
    const ctx = clipWaveform.getContext("2d")
    if (!ctx) return
    const width = clipWaveform.width / waveformDpr
    const height = clipWaveform.height / waveformDpr
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "rgba(15, 23, 42, 0.05)"
    ctx.fillRect(0, 0, width, height)

    if (!segmentId) {
      ctx.strokeStyle = "rgba(15, 23, 42, 0.25)"
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      return
    }

    const meta = state.segmentMeta[segmentId]
    if (!meta) return

    const buffer = meta.buffer
    ctx.strokeStyle = "rgba(15, 23, 42, 0.5)"
    ctx.lineWidth = 1
    ctx.beginPath()
    if (buffer) {
      const data = buffer.getChannelData(0)
      const step = Math.max(1, Math.floor(data.length / width))
      for (let x = 0; x < width; x += 1) {
        const start = x * step
        let min = 1
        let max = -1
        for (let i = 0; i < step; i += 1) {
          const value = data[start + i] ?? 0
          if (value < min) min = value
          if (value > max) max = value
        }
        const yTop = (1 - (max + 1) / 2) * height
        const yBottom = (1 - (min + 1) / 2) * height
        ctx.moveTo(x, yTop)
        ctx.lineTo(x, yBottom)
      }
    } else {
      const mid = height / 2
      for (let x = 0; x < width; x += 1) {
        const amp = Math.sin((x / width) * Math.PI * 6) * 0.35
        ctx.moveTo(x, mid - amp * mid)
        ctx.lineTo(x, mid + amp * mid)
      }
    }
    ctx.stroke()

    const startX = meta.start * width
    const endX = meta.end * width
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)"
    ctx.fillRect(0, 0, startX, height)
    ctx.fillRect(endX, 0, width - endX, height)
    ctx.strokeStyle = "rgba(15, 23, 42, 0.6)"
    ctx.strokeRect(startX + 0.5, 0.5, Math.max(0, endX - startX - 1), height - 1)
  }

  const syncClipControls = (meta: SegmentMeta) => {
    const startValue = Math.round(meta.start * 100)
    const endValue = Math.round(meta.end * 100)
    const gainValue = Math.round(meta.gain * 100)
    const toneValue = Math.round(meta.tone * 100)
    const rateValue = Math.round(meta.rate * 100)
    trimStart.input.value = String(startValue)
    trimEnd.input.value = String(endValue)
    trimGain.input.value = String(gainValue)
    trimTone.input.value = String(toneValue)
    trimRate.input.value = String(rateValue)
    trimStart.value.textContent = `${startValue}%`
    trimEnd.value.textContent = `${endValue}%`
    trimGain.value.textContent = `x${(gainValue / 100).toFixed(2)}`
    trimTone.value.textContent = `${toneValue}%`
    trimRate.value.textContent = `x${(rateValue / 100).toFixed(2)}`
  }

  const updateClipEditor = () => {
    const segment = getSelectedSegment()
    if (!segment) {
      clipMeta.textContent = "Select a segment to render and shape."
      renderClipButton.disabled = true
      previewClipButton.disabled = true
      trimStart.input.disabled = true
      trimEnd.input.disabled = true
      trimGain.input.disabled = true
      trimTone.input.disabled = true
      trimRate.input.disabled = true
      drawWaveform()
      return
    }

    const meta = state.segmentMeta[segment.id]
    if (!meta) return
    renderClipButton.disabled = meta.rendering
    previewClipButton.disabled = !meta.rendered
    trimStart.input.disabled = false
    trimEnd.input.disabled = false
    trimGain.input.disabled = false
    trimTone.input.disabled = false
    trimRate.input.disabled = false
    clipMeta.textContent = meta.rendered
      ? `Rendered ${meta.lengthSec.toFixed(2)}s`
      : "Not rendered yet"
    syncClipControls(meta)
    drawWaveform(segment.id)
  }

  window.setTimeout(resizeWaveform, 0)
  window.addEventListener("resize", resizeWaveform)

  const renderSegment = async (segment: Segment) => {
    const meta = state.segmentMeta[segment.id]
    if (!meta || meta.rendering) return
    audioContext = await ensureAudioContext(audioContext)
    if (!audioContext) return
    meta.rendering = true
    updateClipEditor()

    const duration = meta.lengthSec
    const sampleRate = audioContext.sampleRate
    const frameCount = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    const baseFreq = 140 + (segment.text.length % 14) * 18
    let phase = 0

    for (let i = 0; i < frameCount; i += 1) {
      const t = i / sampleRate
      const attack = Math.min(1, t / 0.015)
      const decay = Math.max(0, 1 - t / duration)
      const env = Math.pow(attack, 0.6) * Math.pow(decay, 1.2)
      phase += (Math.PI * 2 * baseFreq) / sampleRate
      const tone = Math.sin(phase) * 0.6
      const noise = (Math.random() * 2 - 1) * 0.35
      data[i] = (tone + noise) * env * 0.6
    }

    meta.buffer = buffer
    meta.rendered = true
    meta.rendering = false
    meta.lengthSec = buffer.duration
    updateClipEditor()
    renderSegments()
    renderGrid()
  }

  const playRenderedSegment = (segment: Segment, time?: number) => {
    if (!audioContext) return
    const meta = state.segmentMeta[segment.id]
    if (!meta?.buffer) return

    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const gainNode = audioContext.createGain()
    source.buffer = meta.buffer
    source.playbackRate.value = meta.rate
    filter.type = "lowpass"
    filter.frequency.value = 500 + meta.tone * 12000
    gainNode.gain.value = 0.0001
    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(audioContext.destination)

    const bufferDuration = meta.buffer.duration
    const startOffset = clamp(meta.start, 0, 0.98) * bufferDuration
    const endOffset = clamp(meta.end, meta.start + 0.02, 1) * bufferDuration
    const duration = Math.max(0.02, endOffset - startOffset)
    const startTime = time ?? audioContext.currentTime + 0.01

    gainNode.gain.setValueAtTime(0.0001, startTime)
    gainNode.gain.linearRampToValueAtTime(meta.gain, startTime + 0.01)
    gainNode.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    source.start(startTime, startOffset, duration)
  }

  const previewSegment = async (segment: Segment) => {
    audioContext = await ensureAudioContext(audioContext)
    if (!audioContext) return
    if (!state.segmentMeta[segment.id]?.buffer) {
      await renderSegment(segment)
    }
    if (!state.segmentMeta[segment.id]?.buffer) return
    playRenderedSegment(segment)
  }

  const selectSegment = (segment: Segment | null) => {
    state.selectedSegmentId = segment?.id ?? null
    if (segment) {
      selectedSegmentDisplay.textContent = `Painting: \"${segment.text}\"`
    } else {
      selectedSegmentDisplay.textContent = "Select a segment to paint the grid."
    }
    renderSegments()
    updateClipEditor()
  }

  const renderSegments = () => {
    segmentsList.innerHTML = ""
    if (state.segments.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty"
      empty.textContent = "No segments yet. Fetch a phrase to slice."
      segmentsList.appendChild(empty)
      return
    }

    state.segments.forEach((segment) => {
      const meta = state.segmentMeta[segment.id]
      const chip = document.createElement("button")
      chip.className = "segment-chip"
      chip.style.setProperty("--segment-color", state.segmentColors[segment.id])
      chip.setAttribute("data-segment", segment.id)
      chip.setAttribute("data-rendered", meta?.rendered ? "true" : "false")
      if (state.selectedSegmentId === segment.id) {
        chip.classList.add("is-selected")
      }

      const text = document.createElement("span")
      text.textContent = segment.text
      const status = document.createElement("span")
      status.className = "segment-status"
      if (meta?.rendered) status.classList.add("is-ready")

      const quick = document.createElement("button")
      quick.className = "segment-quick"
      quick.textContent = meta?.rendering ? "Wait" : meta?.rendered ? "Play" : "Render"
      quick.disabled = Boolean(meta?.rendering)
      quick.addEventListener("click", (event) => {
        event.stopPropagation()
        void previewSegment(segment)
      })

      chip.append(text, status, quick)
      chip.addEventListener("click", () => {
        selectSegment(segment)
      })

      segmentsList.appendChild(chip)
    })
  }

  const renderTracksList = () => {
    trackList.innerHTML = ""
    state.tracks.forEach((track) => {
      const row = document.createElement("div")
      row.className = "track-row"
      if (track.muted) row.classList.add("is-muted")

      const name = document.createElement("div")
      name.className = "track-name"
      name.textContent = track.name

      const actions = document.createElement("div")
      actions.className = "track-row-actions"
      const mute = document.createElement("button")
      mute.className = "btn btn-ghost"
      mute.textContent = track.muted ? "Unmute" : "Mute"
      mute.addEventListener("click", () => {
        track.muted = !track.muted
        renderTracksList()
        renderGrid()
      })

      const clear = document.createElement("button")
      clear.className = "btn btn-ghost"
      clear.textContent = "Clear"
      clear.addEventListener("click", () => {
        track.steps = track.steps.map(() => null)
        renderGrid()
      })

      actions.append(mute, clear)
      row.append(name, actions)
      trackList.appendChild(row)
    })
  }

  const renderGrid = () => {
    gridBody.innerHTML = ""
    stepButtons = []

    state.tracks.forEach((track, trackIndex) => {
      const row = document.createElement("div")
      row.className = "grid-row"
      if (track.muted) row.classList.add("is-muted")

      const label = document.createElement("div")
      label.className = "grid-label"
      label.textContent = track.name

      const steps = document.createElement("div")
      steps.className = "grid-steps"
      steps.style.gridTemplateColumns = `repeat(${state.stepCount}, minmax(18px, 1fr))`

      const rowButtons: HTMLButtonElement[] = []

      for (let stepIndex = 0; stepIndex < state.stepCount; stepIndex += 1) {
        const stepButton = document.createElement("button")
        stepButton.className = "step"
        stepButton.setAttribute("aria-label", `Step ${stepIndex + 1}`)
        const assigned = track.steps[stepIndex]
        if (assigned) {
          stepButton.classList.add("is-on")
          const meta = state.segmentMeta[assigned]
          if (!meta?.rendered) {
            stepButton.classList.add("is-unrendered")
          }
          const color = state.segmentColors[assigned]
          if (color) {
            stepButton.style.setProperty("--segment-color", color)
          }
          const seg = state.segments.find((s) => s.id === assigned)
          if (seg) stepButton.title = seg.text
        }

        stepButton.addEventListener("click", () => {
          const selected = state.selectedSegmentId
          if (!selected) {
            track.steps[stepIndex] = null
          } else {
            track.steps[stepIndex] = track.steps[stepIndex] === selected ? null : selected
          }
          renderGrid()
        })

        rowButtons.push(stepButton)
        steps.appendChild(stepButton)
      }

      row.append(label, steps)
      gridBody.appendChild(row)
      stepButtons.push(rowButtons)
    })
  }

  const setPlayhead = (stepIndex: number) => {
    if (stepIndex === lastPlayheadStep) return
    if (lastPlayheadStep >= 0) {
      stepButtons.forEach((row) => {
        const prev = row[lastPlayheadStep]
        if (prev) prev.classList.remove("is-playhead")
      })
    }
    if (stepIndex >= 0) {
      stepButtons.forEach((row) => {
        const current = row[stepIndex]
        if (current) current.classList.add("is-playhead")
      })
    }
    lastPlayheadStep = stepIndex
  }

  const startPlayheadLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    const tick = () => {
      if (!clock || !state.isPlaying) {
        setPlayhead(-1)
        return
      }
      const currentTick = clock.getCurrentTick()
      const stepIndex = Math.floor(currentTick / state.stepTicks)
      setPlayhead(stepIndex)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  const scheduleStep = (stepIndex: number, time: number) => {
    if (!audioContext) return
    state.tracks.forEach((track) => {
      if (track.muted) return
      const segmentId = track.steps[stepIndex]
      if (!segmentId) return
      const segment = state.segments.find((s) => s.id === segmentId)
      if (!segment) return
      playRenderedSegment(segment, time)
    })
  }

  const scheduleMetronome = (tick: number, time: number) => {
    if (!state.metronome || !audioContext) return
    if (tick % TICKS_PER_BEAT !== 0) return
    const isDownbeat = tick % state.barTicks === 0
    playClick(audioContext, time, isDownbeat)
  }

  const ensureClock = () => {
    if (!audioContext) return
    if (!clock) {
      clock = new SequencerClock(audioContext, {
        bpm: state.bpm,
        loopTicks: state.loopTicks,
        stepTicks: state.stepTicks,
        onStep: (stepIndex, time) => {
          scheduleStep(stepIndex, time)
        },
        onTick: (tick, time) => {
          scheduleMetronome(tick, time)
        },
      })
      return
    }
    clock.update({
      bpm: state.bpm,
      loopTicks: state.loopTicks,
      stepTicks: state.stepTicks,
      onStep: (stepIndex, time) => {
        scheduleStep(stepIndex, time)
      },
      onTick: (tick, time) => {
        scheduleMetronome(tick, time)
      },
    })
  }

  const updateClockConfig = () => {
    if (!clock) return
    clock.update({
      bpm: state.bpm,
      loopTicks: state.loopTicks,
      stepTicks: state.stepTicks,
    })
  }

  const updateSequenceMetrics = () => {
    const loop = computeLoop(state.numerator, state.denominator, state.bars)
    state.loopTicks = loop.loopTicks
    state.barTicks = loop.barTicks
    state.stepCount = Math.max(1, Math.round(state.loopTicks / state.stepTicks))
    syncTrackSteps()
    updateLoopInfo()
    updateClockConfig()
  }

  const applyEntry = (entry: EntryOut) => {
    state.activeEntry = entry
    const phrase = pickTranslation(entry, state.activeLanguage)
    phraseText.textContent = phrase || "(No translation found for this language)"
    searchResults.innerHTML = ""
    const built = buildSegments(phrase, state.maxSegmentWords, state.activeLanguage)
    state.segments = built.segments
    state.segmentUnitLabel = built.unitLabel
    state.segmentMode = built.mode
    segmentModeBadge.textContent = `Units: ${built.unitLabel}`
    state.segmentColors = createSegmentColors(state.segments)
    ensureSegmentMeta(state.segments)
    const firstSegment = state.segments[0]
    selectSegment(firstSegment ?? null)
    pruneTracksForSegments()
    renderSegments()
    renderGrid()
  }

  const fetchRandomPhrase = async () => {
    if (!hostApi.getRandomEntry) return
    randomButton.disabled = true
    randomButton.textContent = "Loading..."
    try {
      const entry = await hostApi.getRandomEntry()
      if (entry) {
        applyEntry(entry)
      }
    } finally {
      randomButton.disabled = false
      randomButton.textContent = "Random Phrase"
    }
  }

  const runSearch = async () => {
    if (!hostApi.searchEntriesByText) return
    const query = searchInput.value.trim()
    if (!query) return
    searchButton.disabled = true
    searchButton.textContent = "..."
    searchResults.innerHTML = ""

    try {
      const results = await hostApi.searchEntriesByText({
        text: query,
        languageCodes: [state.activeLanguage],
        limit: 12,
        offset: 0,
      })
      if (!results || results.length === 0) {
        const empty = document.createElement("div")
        empty.className = "empty"
        empty.textContent = "No matches. Try another query."
        searchResults.appendChild(empty)
        return
      }

      results.forEach((entry) => {
        const item = document.createElement("button")
        item.className = "search-result"
        const text = pickTranslation(entry, state.activeLanguage) || entry.translations[0]?.text || "(no text)"
        item.textContent = text
        item.addEventListener("click", () => {
          applyEntry(entry)
          searchResults.innerHTML = ""
        })
        searchResults.appendChild(item)
      })
    } finally {
      searchButton.disabled = false
      searchButton.textContent = "Find"
    }
  }

  const updateTapTempo = () => {
    const now = performance.now()
    tapTimes.push(now)
    if (tapTimes.length > 8) tapTimes.shift()
    if (tapTimes.length < 2) return

    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i])
    const avg = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    const bpm = clamp(Math.round(60000 / avg), 30, 320)
    state.bpm = bpm
    bpmInput.value = String(bpm)
    updateClockConfig()
  }

  playButton.addEventListener("click", async () => {
    if (state.isPlaying) return
    audioContext = await ensureAudioContext(audioContext)
    ensureClock()
    clock?.start()
    state.isPlaying = true
    playButton.disabled = true
    stopButton.disabled = false
    startPlayheadLoop()
  })

  stopButton.addEventListener("click", () => {
    if (!state.isPlaying) return
    clock?.stop()
    state.isPlaying = false
    playButton.disabled = false
    stopButton.disabled = true
    setPlayhead(-1)
    if (typeof hostApi.stopSpeech === "function") {
      void hostApi.stopSpeech()
    }
  })

  bpmInput.addEventListener("change", () => {
    const next = clamp(Number(bpmInput.value || state.bpm), 30, 320)
    state.bpm = next
    bpmInput.value = String(next)
    updateClockConfig()
  })

  tapButton.addEventListener("click", async () => {
    audioContext = await ensureAudioContext(audioContext)
    updateTapTempo()
  })

  metronomeInput.addEventListener("change", () => {
    state.metronome = metronomeInput.checked
  })

  numeratorInput.addEventListener("change", () => {
    state.numerator = clamp(Number(numeratorInput.value || state.numerator), 1, 31)
    numeratorInput.value = String(state.numerator)
    updateSequenceMetrics()
    renderGrid()
  })

  denominatorSelect.addEventListener("change", () => {
    state.denominator = Number(denominatorSelect.value)
    updateSequenceMetrics()
    renderGrid()
  })

  barsInput.addEventListener("change", () => {
    state.bars = clamp(Number(barsInput.value || state.bars), 1, 64)
    barsInput.value = String(state.bars)
    updateSequenceMetrics()
    renderGrid()
  })

  subdivisionSelect.addEventListener("change", () => {
    const next = SUBDIVISIONS.find((sub) => sub.id === subdivisionSelect.value)
    if (!next) return
    state.stepTicks = next.ticks
    updateSequenceMetrics()
    renderGrid()
  })

  randomButton.addEventListener("click", () => {
    void fetchRandomPhrase()
  })

  searchButton.addEventListener("click", () => {
    void runSearch()
  })

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      void runSearch()
    }
  })

  languageSelect.addEventListener("change", () => {
    state.activeLanguage = languageSelect.value
    if (state.activeEntry) {
      applyEntry(state.activeEntry)
    }
  })

  maxWordsInput.addEventListener("change", () => {
    state.maxSegmentWords = clamp(Number(maxWordsInput.value || state.maxSegmentWords), 1, 8)
    maxWordsInput.value = String(state.maxSegmentWords)
    if (state.activeEntry) {
      applyEntry(state.activeEntry)
    }
  })

  renderClipButton.addEventListener("click", () => {
    const segment = getSelectedSegment()
    if (!segment) return
    void renderSegment(segment)
  })

  previewClipButton.addEventListener("click", () => {
    const segment = getSelectedSegment()
    if (!segment) return
    void previewSegment(segment)
  })

  trimStart.input.addEventListener("input", () => {
    const meta = getSelectedMeta()
    if (!meta) return
    const next = clamp(Number(trimStart.input.value) / 100, 0, meta.end - 0.02)
    meta.start = next
    if (meta.end <= meta.start + 0.01) {
      meta.end = clamp(meta.start + 0.02, 0, 1)
      trimEnd.input.value = String(Math.round(meta.end * 100))
    }
    trimStart.value.textContent = `${Math.round(meta.start * 100)}%`
    trimEnd.value.textContent = `${Math.round(meta.end * 100)}%`
    drawWaveform(state.selectedSegmentId ?? undefined)
  })

  trimEnd.input.addEventListener("input", () => {
    const meta = getSelectedMeta()
    if (!meta) return
    const next = clamp(Number(trimEnd.input.value) / 100, meta.start + 0.02, 1)
    meta.end = next
    trimEnd.value.textContent = `${Math.round(meta.end * 100)}%`
    drawWaveform(state.selectedSegmentId ?? undefined)
  })

  trimGain.input.addEventListener("input", () => {
    const meta = getSelectedMeta()
    if (!meta) return
    meta.gain = clamp(Number(trimGain.input.value) / 100, 0, 2)
    trimGain.value.textContent = `x${meta.gain.toFixed(2)}`
  })

  trimTone.input.addEventListener("input", () => {
    const meta = getSelectedMeta()
    if (!meta) return
    meta.tone = clamp(Number(trimTone.input.value) / 100, 0, 1)
    trimTone.value.textContent = `${Math.round(meta.tone * 100)}%`
  })

  trimRate.input.addEventListener("input", () => {
    const meta = getSelectedMeta()
    if (!meta) return
    meta.rate = clamp(Number(trimRate.input.value) / 100, 0.5, 2)
    trimRate.value.textContent = `x${meta.rate.toFixed(2)}`
  })

  addTrackButton.addEventListener("click", () => {
    const next = createTrack(state.tracks.length, state.stepCount)
    state.tracks.push(next)
    renderTracksList()
    renderGrid()
  })

  clearTracksButton.addEventListener("click", () => {
    state.tracks.forEach((track) => {
      track.steps = track.steps.map(() => null)
    })
    renderGrid()
  })

  if (hostApi.searchEntriesByText === undefined) {
    searchRow.classList.add("is-disabled")
    searchInput.placeholder = "Search not available"
    searchInput.disabled = true
    searchButton.disabled = true
  }

  updateLanguageOptions(stackConfig)
  updateLoopInfo()
  renderSegments()
  renderTracksList()
  renderGrid()
  updateClipEditor()

  if (hostApi.onStackConfigChange) {
    hostApi.onStackConfigChange((next) => {
      updateLanguageOptions(next)
      if (!next.languages.includes(state.activeLanguage)) {
        state.activeLanguage = next.languages[0] ?? state.activeLanguage
      }
      if (state.activeEntry) {
        applyEntry(state.activeEntry)
      }
    })
  }

  void fetchRandomPhrase()

  return {
    dispose: () => {
      clock?.stop()
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (typeof hostApi.stopSpeech === "function") {
        void hostApi.stopSpeech()
      }
      window.removeEventListener("resize", resizeWaveform)
      root.remove()
    },
  }
}
