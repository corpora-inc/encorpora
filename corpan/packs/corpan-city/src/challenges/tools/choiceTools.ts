/**
 * Multiple-choice family of micro-challenges. Each runs a short series of
 * rounds, tracks a streak/combo, and finishes with a normalized score
 * (correct/total, with a small speed bonus where a timer is used). They share
 * the {@link renderChoiceRound} helper so the juicy correct/wrong behavior is
 * consistent across every tile-tap tool.
 */

import type { ChallengeContext, ChallengeSpec } from "@corpan-city/contracts"
import type { OverlayApi } from "../overlay"
import type { ChallengeRuntimeHost, ChallengeEntry } from "../host"
import { entryPair } from "../host"
import {
  baseSpec,
  computeReward,
  difficultyFromLevel,
  h,
  clear,
  mulberry32,
  randomEntries,
  sample,
  seedOf,
  shuffle,
  type ToolImpl,
} from "./_shared"
import { challengeStrings } from "./strings"

interface Round {
  prompt: string
  promptSub?: string
  /** Spoken before the round (TTS), if any. */
  speak?: string
  options: string[]
  correct: number
}

interface SeriesOpts {
  difficulty: 1 | 2 | 3
  timerSeconds?: number
  speakOnMount?: boolean
  cols?: 1 | 2 | 3
}

/** Render one MC round into the body; resolves with whether it was correct. */
function renderChoiceRound(
  overlay: OverlayApi,
  round: Round,
  cols: 1 | 2 | 3,
): Promise<boolean> {
  return new Promise((resolve) => {
    clear(overlay.body)
    // The choice prompt is a META-INSTRUCTION ("Which is it?") → render it as the
    // quiet secondary caption, not a big bold bubble. `promptSub` is folded in.
    overlay.setInstruction(round.promptSub ? `${round.prompt} · ${round.promptSub}` : round.prompt)
    const grid = h("div", `wp-ch-grid ${cols === 1 ? "wp-ch-grid--row" : cols === 3 ? "wp-ch-grid--3" : "wp-ch-grid--2"}`)
    let answered = false
    round.options.forEach((opt, i) => {
      const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
      // QA-only seam (gated by window.__wpChallengeAuto, off in production): mark the
      // correct tile so a Playwright walkthrough can drive the REAL challenge to a
      // REAL win — real tap → real scoring → real complete() → real quest advance.
      // Same philosophy as the __wpQuest dev hook; invisible + inert without the flag.
      if (
        i === round.correct &&
        typeof window !== "undefined" &&
        (window as unknown as { __wpChallengeAuto?: boolean }).__wpChallengeAuto
      ) {
        btn.dataset.correct = "1"
      }
      btn.addEventListener("click", () => {
        if (answered) return
        answered = true
        const ok = i === round.correct
        if (ok) {
          btn.classList.add("wp-ch-tile--correct")
        } else {
          btn.classList.add("wp-ch-tile--wrong")
          const right = grid.children[round.correct] as HTMLElement
          right?.classList.add("wp-ch-tile--correct")
        }
        Array.from(grid.children).forEach((c, j) => {
          if (j !== i && j !== round.correct) c.classList.add("wp-ch-tile--ghost")
        })
        // Let the answer LAND before advancing — and give a wrong pick a longer
        // beat so the revealed correct tile actually registers (teaching moment).
        setTimeout(() => resolve(ok), ok ? 620 : 1100)
      })
      grid.appendChild(btn)
    })
    overlay.body.appendChild(grid)
  })
}

/** Run a series of MC rounds → normalized score → reward. */
async function runSeries(
  overlay: OverlayApi,
  rounds: Round[],
  opts: SeriesOpts,
): Promise<void> {
  // #67: NO rounds = missing content, not a loss. Treat 0 rounds as an ABORT (the
  // encounter re-picks / closes with no scored fail), never `complete(0)` →
  // instant "Try again". `cancel()` resolves with outcome "aborted", so a quest
  // gate never counts it against the player and the NPC doesn't congratulate.
  if (rounds.length === 0) {
    console.warn("[wp-challenge] runSeries: 0 rounds (missing content) → abort, not a scored fail.")
    overlay.cancel()
    return
  }

  let correct = 0
  let streak = 0
  let bestStreak = 0
  let expired = false

  if (opts.timerSeconds) {
    overlay.startTimer(opts.timerSeconds, () => {
      expired = true
    })
  }

  for (let i = 0; i < rounds.length; i++) {
    if (expired) break
    const round = rounds[i]
    if ((opts.speakOnMount || round.speak) && round.speak) {
      void overlay.speak(round.speak)
    }
    const ok = await renderChoiceRound(overlay, round, opts.cols ?? 2)
    if (ok) {
      correct++
      streak++
      bestStreak = Math.max(bestStreak, streak)
      overlay.feedback("good", streak >= 3 ? `🔥 x${streak}` : "✓")
    } else {
      streak = 0
      overlay.feedback("bad")
    }
    overlay.setStreak(streak)
    overlay.setScore(correct / rounds.length)
  }

  overlay.stopTimer()
  const score = rounds.length ? correct / rounds.length : 0
  // small combo bonus folds into reward seed, not the normalized score.
  const reward = computeReward(opts.difficulty, score, seedOf({ challengeId: `${correct}-${bestStreak}` } as ChallengeSpec))
  setTimeout(() => overlay.complete(score, reward), 360)
}

/* ------------------------------------------------------------------ *
 * Helpers to assemble rounds from corpus entries.
 * ------------------------------------------------------------------ */

async function pickEntries(
  host: ChallengeRuntimeHost,
  spec: ChallengeSpec,
  n: number,
): Promise<ChallengeEntry[]> {
  // The COHESIVE CORE: the step's authored ids (drilled exactly). When they alone
  // can fill the draw we use them; otherwise we BLEND — keep the core ids and top
  // up with a THEMED + LEVEL-SCALED random draw (varies across plays), so the game
  // stays on-topic AND feels bottomless instead of the same six phrases.
  if (spec.entryIds && spec.entryIds.length) {
    const core = await host.getEntriesByIds(spec.entryIds)
    if (core.length >= n) return core.slice(0, n)
    const fill = await randomEntries(host, spec, n - core.length + 4)
    return dedupeEntries([...core, ...fill]).slice(0, n)
  }
  return randomEntries(host, spec, n)
}

/** De-dup entries by id, preserving order (core first, then themed fill). */
function dedupeEntries(entries: ChallengeEntry[]): ChallengeEntry[] {
  const seen = new Set<number>()
  const out: ChallengeEntry[] = []
  for (const e of entries) {
    if (seen.has(e.entry_id)) continue
    seen.add(e.entry_id)
    out.push(e)
  }
  return out
}

function pairsOf(
  entries: ChallengeEntry[],
  spec: ChallengeSpec,
): Array<{ target: string; native: string; romanization: string }> {
  const out: Array<{ target: string; native: string; romanization: string }> = []
  for (const e of entries) {
    const p = entryPair(e, spec.language, spec.nativeLanguage)
    if (p) out.push(p)
  }
  return out
}

/* ================================================================== *
 * fast-translate — tap the correct translation against the clock.
 * ================================================================== */
export const fastTranslate: ToolImpl = {
  id: "fast-translate",
  title: "Fast Translate",
  difficulty: 1,
  isCrossLanguage: true, // prompt (target) vs answer (native) — two languages
  buildSpec: (ctx: ChallengeContext) =>
    Promise.resolve(baseSpec("fast-translate", ctx, { rounds: 5 })),
  run: (overlay, spec, host) => {
    void (async () => {
      const entries = await pickEntries(host, spec, 12)
      const pairs = pairsOf(entries, spec)
      const rnd = mulberry32(seedOf(spec))
      const rounds: Round[] = sample(pairs, Math.min(5, pairs.length), rnd).map((p) => {
        const distractors = sample(
          pairs.filter((q) => q.native !== p.native),
          3,
          rnd,
        ).map((q) => q.native)
        const opts = shuffle([p.native, ...distractors], rnd)
        return {
          prompt: p.target,
          promptSub: p.romanization || undefined,
          // VOICE the target phrase (host TTS) on each round — you HEAR the language
          // you're learning, not just read it. Leans on our on-device TTS strength;
          // the city/scene becomes audible. runSeries speaks `round.speak` on mount.
          speak: p.target,
          options: opts,
          correct: opts.indexOf(p.native),
        }
      })
      await runSeries(overlay, rounds, { difficulty: 1, timerSeconds: 22 })
    })()
  },
}

/* ================================================================== *
 * tap-translation — pick the tile that means the given (native) word.
 * (target shown as prompt; same as fast-translate but reversed direction)
 * ================================================================== */
export const tapTranslation: ToolImpl = {
  id: "tap-translation",
  title: "Tap the Translation",
  difficulty: 1,
  isCrossLanguage: true, // prompt (native) vs answer (target) — two languages
  buildSpec: (ctx) => Promise.resolve(baseSpec("tap-translation", ctx, { rounds: 5 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const entries = await pickEntries(host, spec, 12)
      const pairs = pairsOf(entries, spec)
      const rnd = mulberry32(seedOf(spec))
      const rounds: Round[] = sample(pairs, Math.min(5, pairs.length), rnd).map((p) => {
        const distractors = sample(pairs.filter((q) => q.target !== p.target), 3, rnd).map(
          (q) => q.target,
        )
        const opts = shuffle([p.target, ...distractors], rnd)
        return {
          prompt: p.native,
          promptSub: S.tapMeaning,
          options: opts,
          correct: opts.indexOf(p.target),
        }
      })
      await runSeries(overlay, rounds, { difficulty: 1, timerSeconds: 24 })
    })()
  },
}

/* ================================================================== *
 * listen-choose-pic — hear the phrase (TTS), pick the matching word.
 * ================================================================== */
export const listenChoose: ToolImpl = {
  id: "listen-choose-pic",
  title: "Listen & Choose",
  difficulty: 2,
  isCrossLanguage: true, // hear target → tap the native meaning — two languages
  buildSpec: (ctx) => Promise.resolve(baseSpec("listen-choose-pic", ctx, { rounds: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const entries = await pickEntries(host, spec, 12)
      const pairs = pairsOf(entries, spec)
      const rnd = mulberry32(seedOf(spec))
      const rounds: Round[] = sample(pairs, Math.min(4, pairs.length), rnd).map((p) => {
        const distractors = sample(pairs.filter((q) => q.native !== p.native), 3, rnd).map(
          (q) => q.native,
        )
        const opts = shuffle([p.native, ...distractors], rnd)
        return {
          prompt: S.whichHeard,
          promptSub: S.tapSpeakerReplay,
          speak: p.target,
          options: opts,
          correct: opts.indexOf(p.native),
        }
      })
      // add replay buttons by wrapping the prompt
      await runSeriesWithReplay(overlay, rounds, { difficulty: 2 }, spec.language)
    })()
  },
}

/** Like runSeries but the prompt is a tappable speaker that replays the phrase. */
async function runSeriesWithReplay(
  overlay: OverlayApi,
  rounds: Round[],
  opts: SeriesOpts,
  _lang: string,
): Promise<void> {
  // #67: 0 rounds (missing content) → ABORT, never a scored fail (same as runSeries).
  if (rounds.length === 0) {
    console.warn("[wp-challenge] runSeriesWithReplay: 0 rounds (missing content) → abort.")
    overlay.cancel()
    return
  }

  let correct = 0
  let streak = 0
  for (const round of rounds) {
    const ok = await new Promise<boolean>((resolve) => {
      clear(overlay.body)
      const speaker = h("button", "wp-ch-mic", "🔊")
      speaker.style.background = "radial-gradient(circle at 38% 32%, #ffe6b3, #e0a45c)"
      speaker.addEventListener("click", () => round.speak && void overlay.speak(round.speak))
      overlay.body.appendChild(speaker)
      if (round.speak) void overlay.speak(round.speak)
      // Meta-instruction → quiet caption (the speaker button IS the stimulus here).
      overlay.setInstruction(round.promptSub ? `${round.prompt} · ${round.promptSub}` : round.prompt)
      const grid = h("div", "wp-ch-grid wp-ch-grid--2")
      let answered = false
      round.options.forEach((opt, i) => {
        const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
        btn.addEventListener("click", () => {
          if (answered) return
          answered = true
          const good = i === round.correct
          btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
          if (!good) (grid.children[round.correct] as HTMLElement)?.classList.add("wp-ch-tile--correct")
          // wrong → linger on the revealed answer so it registers.
          setTimeout(() => resolve(good), good ? 600 : 1100)
        })
        grid.appendChild(btn)
      })
      overlay.body.appendChild(grid)
    })
    if (ok) {
      correct++
      streak++
      overlay.feedback("good", streak >= 3 ? `🔥 x${streak}` : "✓")
    } else {
      streak = 0
      overlay.feedback("bad")
    }
    overlay.setStreak(streak)
    overlay.setScore(correct / rounds.length)
  }
  const score = rounds.length ? correct / rounds.length : 0
  setTimeout(() => overlay.complete(score, computeReward(opts.difficulty, score)), 360)
}

/* ================================================================== *
 * true-false — does the shown translation match? tap True/False.
 * ================================================================== */
export const trueFalse: ToolImpl = {
  id: "true-false",
  title: "True or False",
  isCrossLanguage: true, // judge a target↔native translation claim — two languages
  difficulty: 1,
  buildSpec: (ctx) => Promise.resolve(baseSpec("true-false", ctx, { rounds: 6 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const entries = await pickEntries(host, spec, 12)
      const pairs = pairsOf(entries, spec)
      const rnd = mulberry32(seedOf(spec))
      const rounds: Round[] = sample(pairs, Math.min(6, pairs.length), rnd).map((p) => {
        const isTrue = rnd() < 0.5
        const shown = isTrue
          ? p.native
          : sample(pairs.filter((q) => q.native !== p.native), 1, rnd)[0]?.native ?? p.native
        return {
          prompt: `${p.target}`,
          promptSub: `= “${shown}” ?`,
          options: [S.trueLabel, S.falseLabel],
          correct: isTrue ? 0 : 1,
        }
      })
      await runSeries(overlay, rounds, { difficulty: 1, cols: 2 })
    })()
  },
}

/* ================================================================== *
 * odd-one-out — three share a domain, one doesn't. Tap the intruder.
 * ================================================================== */
export const oddOneOut: ToolImpl = {
  id: "odd-one-out",
  title: "Odd One Out",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("odd-one-out", ctx, { rounds: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const entries = await host.getRandomEntries(24)
      const rnd = mulberry32(seedOf(spec))
      // group by first domain
      const byDomain = new Map<string, ChallengeEntry[]>()
      for (const e of entries) {
        const d = e.domains[0] ?? "misc"
        if (!byDomain.has(d)) byDomain.set(d, [])
        byDomain.get(d)!.push(e)
      }
      const domains = [...byDomain.entries()].filter(([, v]) => v.length >= 3)
      const rounds: Round[] = []
      for (const [, group] of domains.slice(0, 4)) {
        const three = sample(group, 3, rnd)
        const otherDomain = domains.find(([d2]) => d2 !== three[0].domains[0])
        const intruderEntry = otherDomain ? sample(otherDomain[1], 1, rnd)[0] : null
        if (!intruderEntry) continue
        const toText = (e: ChallengeEntry) =>
          entryPair(e, spec.language, spec.nativeLanguage)?.target ?? ""
        const items = [...three.map(toText), toText(intruderEntry)].filter(Boolean)
        if (items.length < 4) continue
        const opts = shuffle(items, rnd)
        rounds.push({
          prompt: S.oddOneOut,
          options: opts,
          correct: opts.indexOf(toText(intruderEntry)),
        })
      }
      // #67: no buildable rounds (corpus lacked ≥2 domains with ≥3 items) → abort,
      // not a scored fail. runSeries also guards this, but bail early + cleanly.
      if (!rounds.length) {
        overlay.cancel()
        return
      }
      await runSeries(overlay, rounds, { difficulty: 2, cols: 2 })
    })()
  },
}

/* ================================================================== *
 * number-drill — hear a price/number (TTS), tap the matching figure.
 * ================================================================== */
export const numberDrill: ToolImpl = {
  id: "number-drill",
  title: "Price Drill",
  difficulty: 1,
  buildSpec: (ctx) => Promise.resolve(baseSpec("number-drill", ctx, { rounds: 5 })),
  run: (overlay, spec, _host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const numberWord = numberWords(spec.language)
      const rounds: Round[] = []
      for (let i = 0; i < 5; i++) {
        const n = 1 + Math.floor(rnd() * 20)
        const distractors = new Set<number>()
        while (distractors.size < 3) {
          const d = 1 + Math.floor(rnd() * 20)
          if (d !== n) distractors.add(d)
        }
        const opts = shuffle([n, ...distractors], rnd)
        rounds.push({
          prompt: S.tapNumber,
          speak: numberWord(n),
          options: opts.map(String),
          correct: opts.indexOf(n),
        })
      }
      await runSeriesWithReplay(overlay, rounds, { difficulty: 1 }, spec.language)
    })()
  },
}

/** A tiny Spanish/English number-word table (TTS reads the word, learner taps the figure). */
function numberWords(language: string): (n: number) => string {
  const es = [
    "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
    "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
    "diecisiete", "dieciocho", "diecinueve", "veinte",
  ]
  const en = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  ]
  const table = language.startsWith("es") ? es : en
  return (n: number) => table[n] ?? String(n)
}

export const choiceToolList: ToolImpl[] = [
  fastTranslate,
  tapTranslation,
  listenChoose,
  trueFalse,
  oddOneOut,
  numberDrill,
]

export { difficultyFromLevel }
