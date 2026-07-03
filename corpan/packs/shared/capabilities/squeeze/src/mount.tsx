/**
 * cap-squeeze mount — the DOM boundary for non-React consumers
 * (capability-modules.md §4.2). The module stays React INTERNALLY (a vanilla
 * rewrite would fork logic, which D14 forbids): `mount` calls
 * `createRoot(container-child)` and `dispose` unmounts it. react/react-dom/
 * @dnd-kit/* resolve from the CONSUMER's node_modules (source-alias
 * consumption, §3.1) so React consumers dedupe to zero added framework bytes.
 *
 * Result mapping (spec §4.2): juice-squeeze has no failure signal — the
 * proxies are explicit: pass = completed without reveal; partial = reveal
 * used OR completion over the 6 s/word active-time budget (detail
 * flags.slow); fail only on timebox expiry with the sentence unfinished.
 * score = pass 1.0 / partial 0.5 / fail 0, modulated by
 * −0.1 × min(hintsUsed, 3). hintsUsed = ear presses + reveal.
 */
import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { flushSync } from "react-dom"
import type {
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
  CapabilityHandle,
  CapabilityHostApi,
} from "@shared/capabilities/core"
import {
  clamp01,
  createActiveClock,
  createSettleOnce,
  makeAbandonedResult,
} from "@shared/capabilities/core"
import { SqueezeRound, type SqueezeRoundEvent } from "./round"

export interface CapSqueezeParams {
  /** REQUIRED. The sentence to rebuild, in the block language. */
  text: string
  /** REQUIRED. Language of `text`. */
  blockLang: string
  /** Prompt shown at top (usually the other language's rendering). */
  promptText?: string
  promptLang?: string
  /** Pre-tokenized words; when absent the module tokenizes (CJK-aware). */
  words?: string[]
  /** Allow the eye (silent reveal) affordance. Default true. */
  revealAllowed?: boolean
  /** Speak the completed sentence on win (pack behavior). Default true. */
  speakOnWin?: boolean
  startPaused?: boolean
}

const SLOW_MS_PER_WORD = 6000

export function mountSqueeze(
  container: HTMLElement,
  hostApi: CapabilityHostApi,
  spec: ActivitySpec,
): CapabilityHandle {
  const params = (spec.params ?? {}) as unknown as CapSqueezeParams
  const settle = createSettleOnce()
  const clock = createActiveClock(undefined, params.startPaused === true)

  const rootEl = document.createElement("div")
  rootEl.className = "capSqz-root"
  container.appendChild(rootEl)

  let reactRoot: Root | null = null
  let disposed = false
  let paused = params.startPaused === true
  let interacted = false
  let ears = 0
  let revealUsed = false
  let moves = 0
  let winDetail: { moves: number; wordCount: number } | null = null
  let timeboxTimer: ReturnType<typeof setTimeout> | null = null

  const wordCount = () =>
    params.words?.length ??
    (winDetail?.wordCount ?? params.text.trim().split(/\s+/).filter(Boolean).length)

  const buildResult = (outcome: "pass" | "partial" | "fail"): ActivityResult => {
    const hintsUsed = ears + (revealUsed ? 1 : 0)
    const active = clock.activeMs()
    const wc = Math.max(1, wordCount())
    const msPerWord = Math.round(active / wc)
    const slow = active > SLOW_MS_PER_WORD * wc
    const base = outcome === "pass" ? 1 : outcome === "partial" ? 0.5 : 0
    const score = clamp01(base - 0.1 * Math.min(hintsUsed, 3))
    const perItem: ActivityItemResult[] = spec.itemRefs.map((itemRef) => ({
      itemRef,
      outcome,
      hintsUsed,
      detail: { numbers: { msPerWord } },
    }))
    return {
      specId: spec.specId,
      score,
      perItem,
      durationMs: Math.round(active),
      detail: {
        numbers: {
          moves,
          minMoves: wc,
          wordCount: wc,
          msPerWord,
        },
        flags: {
          revealUsed,
          earUsed: ears > 0,
          ...(slow ? { slow: true } : {}),
        },
      },
    }
  }

  const settleWin = (detail: { moves: number; wordCount: number; revealUsed: boolean; earUsed: boolean }) => {
    winDetail = detail
    moves = detail.moves
    const active = clock.activeMs()
    const slow = active > SLOW_MS_PER_WORD * Math.max(1, detail.wordCount)
    const outcome = detail.revealUsed || slow ? "partial" : "pass"
    settle.settle(buildResult(outcome))
    clearTimebox()
    // §2.3.5: after settle the module freezes its final frame (the round shows
    // its ✓ verdict); celebration is the HOST's job.
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
      onTimebox()
      return
    }
    timeboxTimer = setTimeout(onTimebox, remaining)
  }

  const onTimebox = () => {
    if (settle.settled() || paused) return
    if (!interacted) {
      settle.settle(makeAbandonedResult(spec, clock.activeMs()))
    } else {
      // Sentence unfinished at the timebox → fail (measured, not abandoned).
      settle.settle(buildResult("fail"))
    }
    render()
  }

  const onEvent = (e: SqueezeRoundEvent) => {
    if (settle.settled()) return
    interacted = true
    if (e.type === "placement") moves = e.moves
    else if (e.type === "ear") ears += 1
    else if (e.type === "reveal") revealUsed = true
    else if (e.type === "win") settleWin(e.detail)
  }

  const speak = (lang: string, text: string) => {
    void hostApi.speak(lang, text).catch((err) => {
      console.error("[cap-squeeze] speak failed:", err)
    })
  }

  const render = () => {
    if (!reactRoot || disposed) return
    flushSync(() => {
      reactRoot!.render(
        createElement(SqueezeRound, {
          text: params.text ?? "",
          blockLang: params.blockLang ?? "en",
          promptText: params.promptText,
          promptLang: params.promptLang,
          words: params.words,
          revealAllowed: params.revealAllowed,
          speakOnWin: params.speakOnWin,
          paused: paused || settle.settled(),
          speak,
          onEvent,
        }),
      )
    })
  }

  try {
    reactRoot = createRoot(rootEl)
    render()
    armTimebox()
  } catch (err) {
    console.error("[cap-squeeze] mount failed:", err)
    settle.settle(
      makeAbandonedResult(spec, clock.activeMs(), { flags: { mountFailed: true } }),
    )
  }

  return {
    result: settle.promise,
    pause() {
      if (paused) return
      paused = true
      clock.pause()
      clearTimebox()
      render()
    },
    resume() {
      if (!paused) return
      paused = false
      clock.resume()
      armTimebox()
      render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      clearTimebox()
      if (!settle.settled()) {
        settle.settle(makeAbandonedResult(spec, clock.activeMs()))
      }
      const r = reactRoot
      reactRoot = null
      // React 18 forbids synchronous unmount during a render pass; this is a
      // plain teardown path so unmount() is safe here.
      r?.unmount()
      rootEl.remove()
    },
  }
}
