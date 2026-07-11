// cap-pronounce — the whisper-score round as a capability module
// (capability-modules.md §4.1), extracted from pronunciation-coach
// (Parlometron): show target text → hold-to-record → whisper score →
// verdict headline + per-word pills. The pack keeps its deck/swipe chrome,
// streak/quota, model-setup UI and multiplayer; it consumes the moved
// tuning tables, text helpers, recorder and result view from here.
import "./styles.css"
import type {
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
  CapabilityAvailability,
  CapabilityHandle,
  CapabilityHostApi,
  CapabilityModule,
  SttTranscriptionResult,
} from "@shared/capabilities/core"
import {
  clamp01,
  createActiveClock,
  createSettleOnce,
  formatErr,
  makeAbandonedResult,
} from "@shared/capabilities/core"
import { isWhisperSupported } from "./src/whisperLangs"
import {
  allFolders,
  modelByFolder,
  visibleModels,
  visibleDefaultModel,
} from "./src/modelRegistry"
import {
  bindPushToTalk,
  createPushToTalkRecorder,
  tryPrepareOnce,
  type PushToTalkRecorder,
} from "./src/recorder"
import {
  clearResultSlots,
  renderPronounceResult,
  resultSlotsAboveHtml,
  resultSlotsBelowHtml,
  type PronounceVerdict,
} from "./src/resultView"
import { stimulusBodyHtml, langBadgeText } from "./src/roundView"
import { escapeHtml } from "./src/text"
import { capPronounceT, type CapPronounceStringKey } from "./strings"

// Re-exports: the pronunciation-coach pack (and future consumers) import
// the moved modules through here / via deep @shared/capabilities/pronounce/*
// paths. One source file per concern — never copied.
export * from "./src/whisperLangs"
export * from "./src/whisperTuning"
export * from "./src/scoringTuning"
export * from "./src/modelRegistry"
export * from "./src/text"
export * from "./src/session"
export * from "./src/recorder"
export * from "./src/resultView"
export * from "./src/roundView"
export { capPronounceT, type CapPronounceStringKey } from "./strings"

export interface CapPronounceParams {
  /** REQUIRED. The exact text to pronounce (target language). */
  text: string
  /** BCP-ish corpan code of `text`. Must pass `isWhisperSupported` or
   *  availability = unavailable. */
  lang: string
  romanization?: string
  /** Native gloss shown under the stimulus (omit on single-language stacks). */
  nativeText?: string
  /** "installed-only" (default for the Journey feed) never triggers install
   *  UI; checkAvailability reports needs-model instead. "offer-install"
   *  renders the module's minimal inline install prompt (pop-in surface). */
  modelPolicy?: "installed-only" | "offer-install"
  /** Attempts allowed before auto-settle (default 3; best attempt wins). */
  maxAttempts?: number
  /** Speak the target once on first resume (default false). */
  autoSpeakFirst?: boolean
  startPaused?: boolean
}

const readParams = (spec: ActivitySpec): CapPronounceParams =>
  (spec.params ?? {}) as unknown as CapPronounceParams

/** Bar count for the live mic waveform (a short scrolling amplitude history). */
const WAVE_BARS = 15

/** Find a Whisper model that is ALREADY installed on this device, across
 *  EVERY folder the pack knows — not just the tiny default. This is what lets
 *  Journey reuse the big model a user already installed via pronunciation-coach:
 *  both packs go through the same `hostApi.stt` seam and the same
 *  `modelRegistry` folders, so an install by one is visible to the other.
 *
 *  Preference order:
 *    1. The model the native context currently has LOADED (`getStatus().model`)
 *       — zero-cost to reuse, no re-load.
 *    2. The largest already-installed model (better transcription quality).
 *
 *  Robust to hosts where `listInstalled` is missing or returns a non-canonical
 *  shape (an older Android bridge answers `{ installed: [...] }` rather than
 *  `{ models: [...] }`): in that case we fall back to per-folder
 *  `validateModel`, which pronunciation-coach trusts as reliable on every
 *  shipped host. Returns `null` when nothing usable is installed anywhere. */
const pickInstalledModelFolder = async (
  stt: CapabilityHostApi["stt"],
): Promise<string | null> => {
  if (!stt) return null
  const folders = allFolders()

  // Prefer the currently-loaded model — reusing it skips a re-prepare.
  let loadedFolder: string | null = null
  try {
    const status = await stt.getStatus?.()
    if (status?.model && folders.includes(status.model)) {
      loadedFolder = status.model
    }
  } catch (err) {
    console.warn("[cap-pronounce] getStatus probe failed:", err)
  }

  const usable = new Set<string>()
  if (loadedFolder) usable.add(loadedFolder)

  // Primary probe: listInstalled with the canonical `{ models: [{valid}] }`
  // shape. Guarded so a mis-shaped/absent response doesn't throw us out.
  if (stt.listInstalled) {
    try {
      const res = await stt.listInstalled({ models: folders })
      const models = Array.isArray(res?.models) ? res.models : []
      for (const m of models) {
        if (m?.valid && typeof m.model === "string") usable.add(m.model)
      }
    } catch (err) {
      console.warn("[cap-pronounce] listInstalled probe failed:", err)
    }
  }

  // Fallback probe: if listInstalled told us nothing usable (missing on this
  // host, or the non-canonical shape), validate each folder directly.
  if (usable.size === 0 && stt.validateModel) {
    for (const folder of folders) {
      try {
        const v = await stt.validateModel({ model: folder })
        if (v?.valid) usable.add(folder)
      } catch (err) {
        console.warn(`[cap-pronounce] validateModel(${folder}) failed:`, err)
      }
    }
  }

  if (usable.size === 0) return null
  if (loadedFolder && usable.has(loadedFolder)) return loadedFolder

  // Pick the largest installed model — a user who installed the big Whisper
  // gets it, not the 75 MB Tiny.
  let best: string | null = null
  let bestSize = -1
  for (const folder of usable) {
    const size = modelByFolder(folder)?.approxSizeMB ?? 0
    if (size > bestSize) {
      bestSize = size
      best = folder
    }
  }
  return best
}

type Attempt = {
  verdict: PronounceVerdict
  result: SttTranscriptionResult
}

const mount = (
  container: HTMLElement,
  hostApi: CapabilityHostApi,
  spec: ActivitySpec,
): CapabilityHandle => {
  const params = readParams(spec)
  const settle = createSettleOnce()
  const clock = createActiveClock(undefined, params.startPaused === true)
  const uiLang = hostApi.getStackConfig().languages[0] || "en"
  const tt = (key: CapPronounceStringKey, p?: Record<string, string>) =>
    capPronounceT(key, uiLang, p)

  const maxAttempts = Math.max(1, params.maxAttempts ?? 3)
  const showRoman = hostApi.getStackConfig().showRomanization !== false

  const root = document.createElement("div")
  root.className = "capPron-root"
  const badge = langBadgeText(params.lang)
  root.innerHTML = `
    <div class="capPron-card" data-cappron-card>
      <div class="capPron-card-above">${resultSlotsAboveHtml()}</div>
      <div class="capPron-card-center">
        ${stimulusBodyHtml({
          targetText: params.text ?? "",
          romanization: params.romanization,
          nativeText: params.nativeText,
          showRomanization: showRoman,
        })}
      </div>
      <div class="capPron-card-below">${resultSlotsBelowHtml()}</div>
    </div>
    <div class="capPron-stage">
      ${badge ? `<span class="capPron-lang-badge">${escapeHtml(badge)}</span>` : ""}
      <div class="capPron-wave" data-cappron-wave hidden aria-hidden="true">
        ${Array.from({ length: WAVE_BARS }, () => `<span class="capPron-wave-bar"></span>`).join("")}
      </div>
      <button class="capPron-mic" type="button" disabled>
        <span class="capPron-mic-icon">●</span>
      </button>
      <div class="capPron-mic-label">${escapeHtml(tt("bootLoading"))}</div>
      <div class="capPron-error" hidden></div>
    </div>
  `
  container.appendChild(root)
  const card = root.querySelector<HTMLElement>("[data-cappron-card]")!
  const micBtn = root.querySelector<HTMLButtonElement>(".capPron-mic")!
  const micIcon = root.querySelector<HTMLSpanElement>(".capPron-mic-icon")!
  const micLabel = root.querySelector<HTMLDivElement>(".capPron-mic-label")!
  const errorEl = root.querySelector<HTMLDivElement>(".capPron-error")!
  const waveEl = root.querySelector<HTMLDivElement>("[data-cappron-wave]")!
  const waveBars = Array.from(waveEl.querySelectorAll<HTMLSpanElement>(".capPron-wave-bar"))

  // Live "I'm listening to you NOW" waveform. Driven by the host's real per-
  // buffer mic RMS (subscribeAudioLevel) when the host ships it; otherwise the
  // .capPron-wave--idle CSS keeps the bars gently breathing so recording still
  // reads as live. The bars are a short scrolling history of amplitude.
  let unsubLevel: (() => void) | null = null
  const waveHistory = new Array(WAVE_BARS).fill(0)
  const paintWave = () => {
    for (let i = 0; i < waveBars.length; i++) {
      const v = waveHistory[i] ?? 0
      // 12%..100% height so a bar is always visible; ease the low end up.
      const h = 12 + Math.round(Math.min(1, Math.sqrt(v)) * 88)
      waveBars[i].style.height = `${h}%`
    }
  }
  const startWave = () => {
    waveEl.hidden = false
    waveHistory.fill(0)
    paintWave()
    if (unsubLevel) return
    const subscribe = stt?.subscribeAudioLevel
    if (!subscribe) {
      // No real level signal from this host build — fall back to the CSS idle
      // breathing so the learner still sees a live "listening" state.
      waveEl.classList.add("capPron-wave--idle")
      return
    }
    waveEl.classList.remove("capPron-wave--idle")
    void subscribe((e) => {
        if (disposed || uiState !== "recording") return
        waveHistory.shift()
        waveHistory.push(Math.max(0, Math.min(1, e.rms)))
        paintWave()
      })
      .then((off) => {
        if (disposed || uiState !== "recording") {
          off()
          return
        }
        unsubLevel = off
      })
      .catch(() => {
        waveEl.classList.add("capPron-wave--idle")
      })
  }
  const stopWave = () => {
    waveEl.hidden = true
    waveEl.classList.remove("capPron-wave--idle")
    if (unsubLevel) {
      unsubLevel()
      unsubLevel = null
    }
  }

  let disposed = false
  let paused = params.startPaused === true
  let modelReady = false
  // The folder actually prepared/loaded for scoring — an already-installed
  // model wins over the tiny default (shared with pronunciation-coach). Falls
  // back to the visible default's folder for scoring-param keying until boot
  // resolves which model is really loaded.
  let activeModelFolder = visibleDefaultModel().folder
  let interacted = false
  let hintsUsed = 0 // replays of the target TTS
  let firstRecordLatencyMs: number | null = null
  const attempts: Attempt[] = []
  let recorder: PushToTalkRecorder | null = null
  let unbindMic: (() => void) | null = null
  let uiState: "idle" | "recording" | "scoring" = "idle"
  let timeboxTimer: ReturnType<typeof setTimeout> | null = null

  const stt = hostApi.stt

  const speak = (lang: string, text: string) => {
    void hostApi.speak(lang, text).catch((err) => {
      console.error("[cap-pronounce] speak failed:", err)
    })
  }

  const showError = (message: string) => {
    errorEl.textContent = message
    errorEl.hidden = false
  }
  const clearError = () => {
    errorEl.textContent = ""
    errorEl.hidden = true
  }

  const setUiState = (next: "idle" | "recording" | "scoring") => {
    uiState = next
    micBtn.classList.remove("recording", "scoring")
    micBtn.disabled = false
    if (next === "idle") {
      micIcon.textContent = "●"
      micLabel.textContent = modelReady ? tt("holdToSpeak") : tt("loadingModel")
      micBtn.disabled = !modelReady || paused || settle.settled()
      stopWave()
    } else if (next === "recording") {
      micBtn.classList.add("recording")
      micIcon.textContent = "■"
      micLabel.textContent = tt("listeningReleaseToStop")
      startWave()
    } else if (next === "scoring") {
      micBtn.classList.add("scoring")
      micIcon.innerHTML = `<span class="capPron-spinner"></span>`
      micLabel.textContent = tt("scoring")
      micBtn.disabled = true
      stopWave()
    }
  }

  const bestAttempt = (): Attempt | null => {
    let best: Attempt | null = null
    for (const a of attempts) {
      if (a.verdict.silent) continue
      if (!best || a.verdict.overall > best.verdict.overall) best = a
    }
    return best
  }

  const buildResult = (): ActivityResult => {
    const best = bestAttempt()
    const overall = best ? clamp01(best.verdict.overall) : 0
    // Outcome tiers from the pack's proven verdict bands: pass ≥ 0.85,
    // partial ≥ 0.6, else fail.
    const outcome: ActivityItemResult["outcome"] =
      overall >= 0.85 ? "pass" : overall >= 0.6 ? "partial" : "fail"
    const sttEvidence = best
      ? {
          overallScore: overall,
          perWord: (best.result.words ?? []).map((w) => ({
            word: w.word,
            probability: w.probability,
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        }
      : undefined
    const detail = {
      numbers: {
        attempts: attempts.length,
        ...(best
          ? {
              bestOverall: best.result.overallScore,
              bestTranscript: best.result.transcriptScore,
              bestAcoustic: best.result.acousticScore,
              bestLikelihood: best.result.likelihoodScore,
              bestNoSpeechProb: best.result.noSpeechProb,
              bestFreeVsConstrained: best.result.freeVsConstrainedSimilarity,
            }
          : {}),
      },
      ...(sttEvidence ? { stt: sttEvidence } : {}),
    }
    const perItem: ActivityItemResult[] = spec.itemRefs.map((itemRef) => ({
      itemRef,
      outcome,
      ...(firstRecordLatencyMs !== null
        ? { latencyMs: Math.round(firstRecordLatencyMs) }
        : {}),
      hintsUsed,
      detail,
    }))
    return {
      specId: spec.specId,
      score: overall,
      perItem,
      durationMs: Math.round(clock.activeMs()),
      detail,
    }
  }

  const settleMeasured = () => {
    if (settle.settled()) return
    if (attempts.length === 0) {
      settle.settle(makeAbandonedResult(spec, clock.activeMs()))
    } else {
      settle.settle(buildResult())
    }
    clearTimebox()
    setUiState("idle")
    micBtn.disabled = true
  }

  const settleSttUnavailable = () => {
    if (settle.settled()) return
    // Scheduler bug / degraded host — surfaced, never hidden (§2.3.6).
    // feed-ux §6.3 keys off flags.sttUnavailable.
    settle.settle(
      makeAbandonedResult(spec, clock.activeMs(), {
        flags: { sttUnavailable: true },
      }),
    )
    clearTimebox()
  }

  const settleDeclined = () => {
    if (settle.settled()) return
    // User waved off the model install (offer-install policy). The runtime
    // reads flags.sttDeclined and stops scheduling speak cards this session
    // (V0.2-PLAN contract #4) — distinct from sttUnavailable (host degraded).
    settle.settle(
      makeAbandonedResult(spec, clock.activeMs(), {
        flags: { sttDeclined: true },
      }),
    )
    clearTimebox()
  }

  const clearTimebox = () => {
    if (timeboxTimer !== null) {
      clearTimeout(timeboxTimer)
      timeboxTimer = null
    }
  }
  const armTimebox = () => {
    if (settle.settled() || typeof spec.timeboxSec !== "number" || spec.timeboxSec <= 0) return
    clearTimebox()
    const remaining = spec.timeboxSec * 1000 - clock.activeMs()
    if (remaining <= 0) {
      settleMeasured()
      return
    }
    timeboxTimer = setTimeout(() => {
      if (!paused) settleMeasured()
    }, remaining)
  }

  const onScored = (result: SttTranscriptionResult) => {
    if (disposed || settle.settled()) return
    const verdict = renderPronounceResult(card, result, {
      expectedText: params.text ?? "",
      compareLang: params.lang ?? "",
      uiLang,
      speak,
    })
    attempts.push({ verdict, result })
    // Silent attempts (mic heard nothing) don't burn the attempt budget —
    // the user never actually tried the phrase (pack streak precedent).
    const realAttempts = attempts.filter((a) => !a.verdict.silent).length
    if (realAttempts >= maxAttempts || verdict.band === "top") {
      settleMeasured()
    }
  }

  // Tap the target phrase to hear it (hint — counted).
  card.addEventListener("click", (e) => {
    const t = e.target as HTMLElement | null
    if (!t) return
    if (t.closest("button, input, a")) return
    if (!t.closest(".capPron-target, .capPron-romanization")) return
    if (paused || settle.settled()) return
    hintsUsed += 1
    speak(params.lang ?? "en", params.text ?? "")
  })

  const boot = async () => {
    if (!stt) {
      root.querySelector(".capPron-stage")?.classList.add("capPron-stage--dead")
      micLabel.textContent = tt("scoringUnavailableTitle")
      micBtn.disabled = true
      settleSttUnavailable()
      return
    }
    if (!params.lang || !isWhisperSupported(params.lang)) {
      micLabel.textContent = tt("scoringUnavailableTitle")
      micBtn.disabled = true
      settleSttUnavailable()
      return
    }

    recorder = createPushToTalkRecorder(stt, {
      model: () => {
        // The model actually prepared for this mount — a reused install from
        // pronunciation-coach, or the freshly-installed default. Scoring params
        // are keyed per (lang, model), so this must be the real folder.
        return activeModelFolder
      },
      onState: (s) => {
        if (disposed) return
        setUiState(s)
      },
      onResult: onScored,
      onError: (err, code, phase) => {
        if (disposed || settle.settled()) return
        if (code === "STT_UNAVAILABLE" || code === "MODEL_NOT_INSTALLED") {
          settleSttUnavailable()
          return
        }
        showError(
          phase === "start"
            ? tt("errStartRecording", { error: formatErr(err) })
            : tt("errScoringFailed", { error: formatErr(err) }),
        )
      },
    })

    unbindMic = bindPushToTalk(micBtn, {
      canStart: () =>
        uiState === "idle" && modelReady && !paused && !settle.settled(),
      onStart: () => {
        interacted = true
        clearError()
        clearResultSlots(card)
        if (firstRecordLatencyMs === null) firstRecordLatencyMs = clock.activeMs()
        void recorder!.start({ text: params.text ?? "", lang: params.lang })
      },
      onStop: () => {
        if (uiState === "recording") void recorder!.stop()
      },
    })

    // prepare() is LOCAL-ONLY — never downloads (parlometron rule). A module
    // finding its model unexpectedly absent settles sttUnavailable unless the
    // consumer opted into the inline install prompt (pop-in surface).
    //
    // SHARE THE INSTALLED MODEL: probe EVERY known folder first, so a big
    // Whisper the user already installed (e.g. via pronunciation-coach — same
    // hostApi.stt seam + same modelRegistry folders) is reused, never a
    // redundant 75 MB download offer. Only if nothing usable is installed
    // anywhere do we fall back to the default install offer.
    const installedFolder = await pickInstalledModelFolder(stt)
    if (disposed) return
    if (installedFolder) {
      const m = modelByFolder(installedFolder)
      try {
        await tryPrepareOnce(stt, installedFolder, {
          timeoutMs: (m?.approxSizeMB ?? 0) >= 1000 ? 180_000 : 60_000,
          label: `Loading ${m?.label ?? "model"} model`,
        })
        if (disposed) return
        activeModelFolder = installedFolder
        modelReady = true
        setUiState("idle")
        if (!paused && params.autoSpeakFirst) {
          speak(params.lang, params.text ?? "")
        }
        return
      } catch (err) {
        // Reported installed but wouldn't load (corrupt on disk / insufficient
        // memory). Fall through to the offer/unavailable paths rather than
        // silently wedging on a dead mic.
        console.error(
          `[cap-pronounce] prepare of installed model ${installedFolder} failed:`,
          err,
        )
      }
    }

    // Nothing usable installed anywhere (or the installed one failed to load).
    const model = visibleDefaultModel()
    if (params.modelPolicy === "offer-install" && stt.installModel) {
      renderInstallPrompt(model.folder)
    } else {
      settleSttUnavailable()
    }
  }

  // Inline offer surface (offer-install policy): what it is + model size +
  // one Install button (live progress) + a quiet decline. Decline settles
  // sttDeclined; a successful install flows straight into the scoring round
  // on the same mount (no remount).
  const renderInstallPrompt = (modelFolder: string) => {
    const m = visibleModels().find((v) => v.folder === modelFolder)
    const sizeMB = String(m?.approxSizeMB ?? 0)
    const btnLabel = () => tt("installOfferButton", { size: sizeMB })

    // Neutralize the mic affordance while offering — no dangling spinner
    // behind the offer; the mic returns once the model is ready.
    micBtn.hidden = true
    micLabel.hidden = true
    clearError()

    const prompt = document.createElement("div")
    prompt.className = "capPron-install"
    prompt.innerHTML = `
      <p class="capPron-install-title">${escapeHtml(tt("installOfferTitle"))}</p>
      <button class="capPron-install-btn" type="button">${escapeHtml(btnLabel())}</button>
      <button class="capPron-install-decline" type="button">${escapeHtml(
        tt("installOfferDecline"),
      )}</button>
    `
    root.querySelector(".capPron-stage")?.appendChild(prompt)

    const installBtn = prompt.querySelector<HTMLButtonElement>(".capPron-install-btn")!
    const declineBtn = prompt.querySelector<HTMLButtonElement>(".capPron-install-decline")!

    declineBtn.addEventListener("click", () => {
      if (settle.settled()) return
      settleDeclined()
      prompt.remove()
    })

    installBtn.addEventListener("click", async () => {
      if (settle.settled() || prompt.classList.contains("capPron-install--busy")) return
      prompt.classList.add("capPron-install--busy")
      installBtn.disabled = true
      declineBtn.disabled = true
      try {
        await stt!.installModel!(
          { model: modelFolder, ...(m?.downloadUrl ? { downloadUrl: m.downloadUrl } : {}) },
          (ev) => {
            if (disposed) return
            if (ev.phase === "downloading") {
              const pct =
                typeof ev.fraction === "number"
                  ? Math.round(clamp01(ev.fraction) * 100)
                  : 0
              installBtn.textContent = tt("installDownloading", { percent: String(pct) })
            } else if (ev.phase === "verifying") {
              installBtn.textContent = tt("installVerifying")
            }
          },
        )
        if (disposed) return
        await tryPrepareOnce(stt!, modelFolder, {
          timeoutMs: (m?.approxSizeMB ?? 0) >= 1000 ? 180_000 : 60_000,
          label: `Loading ${m?.label ?? "model"} model`,
        })
        if (disposed) return
        activeModelFolder = modelFolder
        modelReady = true
        prompt.remove()
        micBtn.hidden = false
        micLabel.hidden = false
        setUiState("idle")
        if (!paused && params.autoSpeakFirst) speak(params.lang, params.text ?? "")
      } catch (err) {
        if (disposed) return
        console.error("[cap-pronounce] inline install failed:", err)
        prompt.classList.remove("capPron-install--busy")
        installBtn.disabled = false
        declineBtn.disabled = false
        installBtn.textContent = btnLabel()
        showError(tt("errInstallFailed", { error: formatErr(err) }))
      }
    })
  }

  void boot()
  armTimebox()

  return {
    result: settle.promise,
    pause() {
      if (paused) return
      paused = true
      clock.pause()
      clearTimebox()
      // Cancel any in-flight recording — mic released (§2 contract).
      recorder?.cancel()
      if (uiState === "recording") setUiState("idle")
      micBtn.disabled = true
    },
    resume() {
      if (!paused) return
      paused = false
      clock.resume()
      armTimebox()
      setUiState(uiState)
      if (!interacted && params.autoSpeakFirst && modelReady) {
        speak(params.lang, params.text ?? "")
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      clearTimebox()
      if (!settle.settled()) {
        if (attempts.length > 0) settle.settle(buildResult())
        else settle.settle(makeAbandonedResult(spec, clock.activeMs()))
      }
      unbindMic?.()
      stopWave()
      recorder?.dispose()
      root.remove()
    },
  }
}

const checkAvailability = async (
  hostApi: CapabilityHostApi,
  spec?: ActivitySpec,
): Promise<CapabilityAvailability> => {
  const stt = hostApi.stt
  if (!stt) return { state: "unavailable", reason: "host has no stt seam" }
  const params = spec ? readParams(spec) : undefined
  if (params?.lang && !isWhisperSupported(params.lang)) {
    return {
      state: "unavailable",
      reason: `whisper cannot score ${params.lang}`,
    }
  }
  // Native-support probe (cheap, local, no download). Distinguishes
  // "unsupported" (native lib can't load — x86 Chromebook via ARC, degraded
  // build) from "needs-model" (supported, just missing the GGUF). iOS and
  // Android both answer this from `is_available`. A THROW here is a bridge
  // hiccup, not a definitive "no" — fall through to the model probe rather
  // than mislabel a transient failure as permanently unsupported.
  try {
    const supported = await stt.isAvailable()
    if (!supported) {
      return { state: "unavailable", reason: "whisper stt not available on this device" }
    }
  } catch (err) {
    console.warn("[cap-pronounce] isAvailable probe failed:", err)
  }
  // Cheap local probe only — NEVER downloads or loads models here.
  try {
    if (stt.listInstalled) {
      const folders = visibleModels().map((m) => m.folder)
      const installed = await stt.listInstalled({ models: folders })
      const usable = installed.models.some((m) => m.valid)
      if (!usable) {
        const smallest = visibleModels().reduce(
          (min, m) => (m.approxSizeMB < min ? m.approxSizeMB : min),
          Number.POSITIVE_INFINITY,
        )
        return {
          state: "needs-model",
          model: "stt",
          ...(Number.isFinite(smallest) ? { sizeMB: smallest } : {}),
        }
      }
    }
  } catch (err) {
    console.warn("[cap-pronounce] listInstalled probe failed:", err)
  }
  return { state: "ready" }
}

export const capability: CapabilityModule = {
  meta: {
    id: "cap-pronounce",
    version: "0.1.0",
    modelNeeds: ["stt"],
    cssPrefix: "capPron",
    usesHostApis: ["speak", "getStackConfig", "stt"],
  },
  mount,
  checkAvailability,
}
