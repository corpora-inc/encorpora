/**
 * Letter / word-tile family of micro-challenges: unscramble a word, build a
 * sentence from shuffled words, fill a blank, fill a dialogue line, spot a
 * typo, tap the right conjugation, and rhyme matching. These render tappable
 * chips into the overlay body.
 */

import type { ChallengeSpec } from "@corpan-city/contracts"
import type { ChallengeRuntimeHost, ChallengeEntry } from "../host"
import { entryPair } from "../host"
import {
  baseSpec,
  computeReward,
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

async function pickPairs(
  host: ChallengeRuntimeHost,
  spec: ChallengeSpec,
  n: number,
): Promise<Array<{ target: string; native: string; romanization: string; entry: ChallengeEntry }>> {
  // Pinned CORE (step ids) blended with a THEMED + LEVEL-SCALED random fill so the
  // drill stays on the quest's vocab yet draws fresh, relevant phrases each play.
  const core =
    spec.entryIds && spec.entryIds.length ? await host.getEntriesByIds(spec.entryIds) : []
  const fill = core.length >= n + 6 ? [] : await randomEntries(host, spec, n + 6 - core.length)
  const seen = new Set<number>()
  const entries: ChallengeEntry[] = []
  for (const e of [...core, ...fill]) {
    if (seen.has(e.entry_id)) continue
    seen.add(e.entry_id)
    entries.push(e)
  }
  const out: Array<{ target: string; native: string; romanization: string; entry: ChallengeEntry }> = []
  for (const e of entries) {
    const p = entryPair(e, spec.language, spec.nativeLanguage)
    if (p) out.push({ ...p, entry: e })
  }
  return out
}

/* ================================================================== *
 * word-scramble — unscramble the letters of a single target word.
 * ================================================================== */
export const wordScramble: ToolImpl = {
  id: "word-scramble",
  title: "Unscramble",
  difficulty: 1,
  buildSpec: (ctx) => Promise.resolve(baseSpec("word-scramble", ctx, {})),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      // Scramble a SINGLE word (no spaces) — pick the longest meaningful token
      // from each target (skip articles), 3..12 letters.
      const STOP = new Set(["el", "la", "los", "las", "the", "un", "una", "a", "to"])
      const candidates = (await pickPairs(host, spec, 6))
        .map((p) => {
          const token =
            p.target
              .trim()
              .split(/\s+/)
              .filter((w) => !STOP.has(w.toLowerCase()))
              .sort((a, b) => b.length - a.length)[0] ?? p.target.trim()
          return { ...p, word: token }
        })
        .filter((p) => p.word.length >= 3 && p.word.length <= 12 && !/\s/.test(p.word))
      const chosen = candidates[0]
      if (!chosen) {
        // Insufficient content (#67/#81-hardening) → ABORT, never a 0% flash-fail.
        // cancel() resolves as "aborted" so the encounter re-picks/closes
        // cleanly and the quest gate never counts it against the player.
        overlay.cancel()
        return
      }
      const word = chosen.word
      const letters = word.split("")
      const scrambled = (() => {
        let s = shuffle(letters, rnd)
        let guard = 0
        while (s.join("") === word && guard++ < 6) s = shuffle(letters, rnd)
        return s
      })()

      clear(overlay.body)
      overlay.setInstruction(`${S.unscramble} · ${S.meansHint(chosen.native)}`)
      const slot = h("div", "wp-ch-slot")
      const tray = h("div", "wp-ch-grid wp-ch-grid--row")
      overlay.body.appendChild(slot)
      overlay.body.appendChild(tray)

      const speakBtn = h("button", "wp-ch-btn wp-ch-btn--ghost", S.hearIt)
      speakBtn.addEventListener("click", () => void overlay.speak(word))
      const actions = h("div", "wp-ch-actions")
      actions.appendChild(speakBtn)
      overlay.body.appendChild(actions)

      const placed: { ch: string; trayBtn: HTMLButtonElement }[] = []
      let wrong = 0

      const refreshSlot = () => {
        clear(slot)
        placed.forEach((p, idx) => {
          const chip = h("button", "wp-ch-chiptile wp-ch-chiptile--inslot", p.ch)
          chip.addEventListener("click", () => {
            // tap a placed letter to send it back
            p.trayBtn.classList.remove("wp-ch-chiptile--placed")
            placed.splice(idx, 1)
            refreshSlot()
          })
          slot.appendChild(chip)
        })
        if (!placed.length) {
          slot.appendChild(h("span", "wp-ch-sub", S.tapInOrder))
        }
      }
      refreshSlot()

      let solved = false
      const finish = () => {
        if (solved) return
        solved = true
        void overlay.speak(word)
        overlay.feedback("good", "✓")
        const score = Math.max(0.3, 1 - wrong * 0.15)
        setTimeout(() => overlay.complete(score, computeReward(1, score)), 500)
      }

      scrambled.forEach((ch) => {
        const btn = h("button", "wp-ch-chiptile", ch)
        btn.addEventListener("click", () => {
          if (btn.classList.contains("wp-ch-chiptile--placed")) return
          const nextChar = word[placed.length]
          if (ch === nextChar) {
            btn.classList.add("wp-ch-chiptile--placed")
            placed.push({ ch, trayBtn: btn })
            refreshSlot()
            if (placed.length === word.length) finish()
          } else {
            wrong++
            overlay.feedback("bad")
            btn.animate(
              [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
              { duration: 280 },
            )
          }
        })
        tray.appendChild(btn)
      })
    })()
  },
}

/* ================================================================== *
 * build-sentence — order shuffled words into the target sentence (Juice).
 * ================================================================== */
export const buildSentence: ToolImpl = {
  id: "build-sentence",
  title: "Build the Sentence",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("build-sentence", ctx, {})),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const pairs = (await pickPairs(host, spec, 8)).filter(
        (p) => p.target.trim().split(/\s+/).length >= 2,
      )
      const chosen =
        pairs.sort((a, b) => b.target.split(/\s+/).length - a.target.split(/\s+/).length)[0]
      if (!chosen) {
        // Insufficient content (#67/#81-hardening) → ABORT, never a 0% flash-fail.
        // cancel() resolves as "aborted" so the encounter re-picks/closes
        // cleanly and the quest gate never counts it against the player.
        overlay.cancel()
        return
      }
      const words = chosen.target.trim().split(/\s+/)
      const scrambled = shuffle(words, rnd)

      clear(overlay.body)
      overlay.setInstruction(`${S.buildOrder} · ${S.meansHint(chosen.native)}`)
      const slot = h("div", "wp-ch-slot")
      const tray = h("div", "wp-ch-grid wp-ch-grid--row")
      overlay.body.appendChild(slot)
      overlay.body.appendChild(tray)

      const built: { w: string; trayBtn: HTMLButtonElement }[] = []
      let wrong = 0

      const refresh = () => {
        clear(slot)
        if (!built.length) slot.appendChild(h("span", "wp-ch-sub", S.tapWordsInOrder))
        built.forEach((b, idx) => {
          const chip = h("button", "wp-ch-chiptile wp-ch-chiptile--inslot", b.w)
          chip.addEventListener("click", () => {
            b.trayBtn.classList.remove("wp-ch-chiptile--placed")
            built.splice(idx, 1)
            refresh()
          })
          slot.appendChild(chip)
        })
      }
      refresh()

      let solved = false
      scrambled.forEach((w) => {
        const btn = h("button", "wp-ch-chiptile", w)
        btn.addEventListener("click", () => {
          if (btn.classList.contains("wp-ch-chiptile--placed") || solved) return
          const expected = words[built.length]
          if (w === expected) {
            btn.classList.add("wp-ch-chiptile--placed")
            built.push({ w, trayBtn: btn })
            refresh()
            if (built.length === words.length) {
              solved = true
              void overlay.speak(chosen.target)
              overlay.feedback("good", "✓")
              const score = Math.max(0.3, 1 - wrong * 0.12)
              setTimeout(() => overlay.complete(score, computeReward(2, score)), 520)
            }
          } else {
            wrong++
            overlay.feedback("bad")
          }
        })
        tray.appendChild(btn)
      })
    })()
  },
}

/* ================================================================== *
 * fill-the-blank — choose the word that completes the sentence.
 * ================================================================== */
export const fillTheBlank: ToolImpl = {
  id: "fill-the-blank",
  title: "Fill the Blank",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("fill-the-blank", ctx, { rounds: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void S // #53 wip (i18n): localized strings being wired into this tool's UI
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const pairs = (await pickPairs(host, spec, 12)).filter(
        (p) => p.target.trim().split(/\s+/).length >= 2,
      )
      let correct = 0
      let streak = 0
      const rounds = sample(pairs, Math.min(4, pairs.length), rnd)
      for (const p of rounds) {
        const tokens = p.target.trim().split(/\s+/)
        const blankIdx = 1 + Math.floor(rnd() * (tokens.length - 1))
        const answer = tokens[blankIdx]
        const display = tokens.map((t, i) => (i === blankIdx ? "____" : t)).join(" ")
        const distractors = sample(
          pairs.filter((q) => q !== p).flatMap((q) => q.target.split(/\s+/)),
          3,
          rnd,
        )
        const opts = shuffle([answer, ...distractors], rnd)
        const ok = await new Promise<boolean>((resolve) => {
          clear(overlay.body)
          overlay.setPrompt(display, `“${p.native}”`)
          const grid = h("div", "wp-ch-grid wp-ch-grid--2")
          let answered = false
          opts.forEach((opt) => {
            const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
            btn.addEventListener("click", () => {
              if (answered) return
              answered = true
              const good = opt === answer
              btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
              if (!good) {
                const ri = opts.indexOf(answer)
                ;(grid.children[ri] as HTMLElement)?.classList.add("wp-ch-tile--correct")
              }
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
      setTimeout(() => overlay.complete(score, computeReward(2, score)), 360)
    })()
  },
}

/* ================================================================== *
 * dialogue-fill — pick the missing line of a 3-line dialogue.
 * ================================================================== */
export const dialogueFill: ToolImpl = {
  id: "dialogue-fill",
  title: "Finish the Dialogue",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("dialogue-fill", ctx, {})),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const pairs = await pickPairs(host, spec, 8)
      if (pairs.length < 4) {
        // Insufficient content (#67/#81-hardening) → ABORT, never a 0% flash-fail.
        // cancel() resolves as "aborted" so the encounter re-picks/closes
        // cleanly and the quest gate never counts it against the player.
        overlay.cancel()
        return
      }
      const [a, missing, b] = sample(pairs, 3, rnd)
      const distractors = sample(pairs.filter((p) => ![a, missing, b].includes(p)), 3, rnd).map(
        (p) => p.target,
      )
      const opts = shuffle([missing.target, ...distractors], rnd)

      clear(overlay.body)
      overlay.setInstruction(S.missingLine)
      const convo = h("div", "wp-ch-convo")
      const line = (who: string, text: string, dim = false) => {
        const row = h("div", "wp-ch-line", `${who}  ${text}`)
        if (dim) row.classList.add("wp-ch-line--dim")
        return row
      }
      convo.appendChild(line("🧑‍🍳", a.target))
      const gap = h("div", "wp-ch-line wp-ch-line--gap", "🙂  ______")
      convo.appendChild(gap)
      convo.appendChild(line("🧑‍🍳", b.target, true))
      overlay.body.appendChild(convo)
      // A quiet cue so the tappable answers read as the CHOICE, not more script.
      overlay.body.appendChild(h("div", "wp-ch-sub", S.chooseReply))
      void overlay.speak(a.target)

      const grid = h("div", "wp-ch-grid wp-ch-grid--2")
      let answered = false
      opts.forEach((opt) => {
        const btn = h("button", "wp-ch-tile", opt)
        btn.addEventListener("click", () => {
          if (answered) return
          answered = true
          const good = opt === missing.target
          btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
          if (good) {
            gap.textContent = `🙂  ${opt}`
            gap.classList.remove("wp-ch-line--gap")
            gap.classList.add("wp-ch-line--filled")
            void overlay.speak(missing.target)
            overlay.feedback("good", "✓")
          } else {
            ;(grid.children[opts.indexOf(missing.target)] as HTMLElement)?.classList.add(
              "wp-ch-tile--correct",
            )
            overlay.feedback("bad")
          }
          const score = good ? 1 : 0
          setTimeout(() => overlay.complete(score, computeReward(2, score)), 700)
        })
        grid.appendChild(btn)
      })
      overlay.body.appendChild(grid)
    })()
  },
}

/* ================================================================== *
 * spot-typo — one word is misspelled; tap the wrong one.
 * ================================================================== */
export const spotTypo: ToolImpl = {
  id: "spot-typo",
  title: "Spot the Typo",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("spot-typo", ctx, { rounds: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const pairs = (await pickPairs(host, spec, 14)).filter(
        (p) => p.target.replace(/\s/g, "").length >= 4,
      )
      let correct = 0
      let streak = 0
      const rounds = sample(pairs, Math.min(4, pairs.length), rnd)
      for (const p of rounds) {
        // build 4 words: 3 correct + 1 with a swapped letter
        const others = sample(pairs.filter((q) => q !== p), 3, rnd).map((q) => q.target)
        const typo = makeTypo(p.target, rnd)
        const set = shuffle([typo.word, ...others], rnd)
        const ok = await new Promise<boolean>((resolve) => {
          clear(overlay.body)
          overlay.setInstruction(S.whichTypo)
          const grid = h("div", "wp-ch-grid wp-ch-grid--2")
          let answered = false
          set.forEach((w) => {
            const btn = h("button", "wp-ch-tile", w)
            btn.addEventListener("click", () => {
              if (answered) return
              answered = true
              const good = w === typo.word
              btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
              if (!good)
                (grid.children[set.indexOf(typo.word)] as HTMLElement)?.classList.add(
                  "wp-ch-tile--correct",
                )
              // wrong → linger on the revealed answer so it registers.
              setTimeout(() => resolve(good), good ? 560 : 1100)
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
      setTimeout(() => overlay.complete(score, computeReward(2, score)), 360)
    })()
  },
}

function makeTypo(word: string, rnd: () => number): { word: string } {
  const letters = word.split("")
  const idxs = letters.map((c, i) => (/[a-záéíóúñü]/i.test(c) ? i : -1)).filter((i) => i >= 0)
  if (idxs.length < 2) return { word: word + "x" }
  const i = idxs[Math.floor(rnd() * idxs.length)]
  let j = idxs[Math.floor(rnd() * idxs.length)]
  let guard = 0
  while (j === i && guard++ < 6) j = idxs[Math.floor(rnd() * idxs.length)]
  ;[letters[i], letters[j]] = [letters[j], letters[i]]
  return { word: letters.join("") === word ? word + "e" : letters.join("") }
}

/* ================================================================== *
 * conjugation-tap — pick the verb form that matches the pronoun.
 * (A compact built-in Spanish present-tense table; falls back gracefully.)
 * ================================================================== */
const ES_VERBS: Array<{ inf: string; forms: Record<string, string> }> = [
  { inf: "hablar", forms: { yo: "hablo", tú: "hablas", "él/ella": "habla", nosotros: "hablamos" } },
  { inf: "comer", forms: { yo: "como", tú: "comes", "él/ella": "come", nosotros: "comemos" } },
  { inf: "vivir", forms: { yo: "vivo", tú: "vives", "él/ella": "vive", nosotros: "vivimos" } },
  { inf: "tener", forms: { yo: "tengo", tú: "tienes", "él/ella": "tiene", nosotros: "tenemos" } },
  { inf: "ir", forms: { yo: "voy", tú: "vas", "él/ella": "va", nosotros: "vamos" } },
  { inf: "querer", forms: { yo: "quiero", tú: "quieres", "él/ella": "quiere", nosotros: "queremos" } },
]

export const conjugationTap: ToolImpl = {
  id: "conjugation-tap",
  title: "Conjugation Tap",
  difficulty: 3,
  buildSpec: (ctx) => Promise.resolve(baseSpec("conjugation-tap", ctx, { rounds: 5 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      void host // built-in table; corpus not required
      let correct = 0
      let streak = 0
      const rounds = 5
      for (let r = 0; r < rounds; r++) {
        const verb = ES_VERBS[Math.floor(rnd() * ES_VERBS.length)]
        const pronouns = Object.keys(verb.forms)
        const pronoun = pronouns[Math.floor(rnd() * pronouns.length)]
        const answer = verb.forms[pronoun]
        const distractors = pronouns
          .filter((p) => p !== pronoun)
          .map((p) => verb.forms[p])
        const opts = shuffle([answer, ...sample(distractors, 3, rnd)], rnd)
        const ok = await new Promise<boolean>((resolve) => {
          clear(overlay.body)
          overlay.setPrompt(`${pronoun} ___`, S.verbHint(verb.inf))
          const grid = h("div", "wp-ch-grid wp-ch-grid--2")
          let answered = false
          opts.forEach((opt) => {
            const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
            btn.addEventListener("click", () => {
              if (answered) return
              answered = true
              const good = opt === answer
              btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
              if (!good)
                (grid.children[opts.indexOf(answer)] as HTMLElement)?.classList.add(
                  "wp-ch-tile--correct",
                )
              // wrong → linger on the revealed answer so it registers.
              setTimeout(() => resolve(good), good ? 560 : 1100)
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
        overlay.setScore(correct / rounds)
      }
      const score = correct / rounds
      setTimeout(() => overlay.complete(score, computeReward(3, score)), 360)
    })()
  },
}

/* ================================================================== *
 * rhyme-match — match words that share an ending sound.
 * ================================================================== */
export const rhymeMatch: ToolImpl = {
  id: "rhyme-match",
  title: "Rhyme Match",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("rhyme-match", ctx, {})),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const pairs = (await pickPairs(host, spec, 20)).filter((p) => p.target.length >= 3)
      // group by last-2 chars
      const byEnd = new Map<string, string[]>()
      for (const p of pairs) {
        const w = p.target.split(/\s+/).pop() ?? p.target
        const end = w.slice(-2).toLowerCase()
        if (!byEnd.has(end)) byEnd.set(end, [])
        if (!byEnd.get(end)!.includes(w)) byEnd.get(end)!.push(w)
      }
      const rhymeGroup = [...byEnd.entries()].find(([, v]) => v.length >= 2)
      const allWords = pairs.map((p) => p.target.split(/\s+/).pop() ?? p.target)
      let prompt: string
      let answer: string
      if (rhymeGroup) {
        ;[prompt, answer] = sample(rhymeGroup[1], 2, rnd)
      } else {
        prompt = allWords[0]
        answer = allWords[1] ?? allWords[0]
      }
      const end = (rhymeGroup?.[0] ?? "").toLowerCase()
      const distractors = sample(
        allWords.filter((w) => w !== prompt && w !== answer && !w.toLowerCase().endsWith(end)),
        3,
        rnd,
      )
      const opts = shuffle([answer, ...distractors], rnd)
      clear(overlay.body)
      overlay.setInstruction(S.whichRhymes(prompt))
      void overlay.speak(prompt)
      const grid = h("div", "wp-ch-grid wp-ch-grid--2")
      let answered = false
      opts.forEach((opt) => {
        const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
        btn.addEventListener("click", () => {
          if (answered) return
          answered = true
          const good = opt === answer
          btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
          if (good) void overlay.speak(answer)
          overlay.feedback(good ? "good" : "bad", good ? "✓" : undefined)
          const score = good ? 1 : 0
          setTimeout(() => overlay.complete(score, computeReward(2, score)), 600)
        })
        grid.appendChild(btn)
      })
      overlay.body.appendChild(grid)
    })()
  },
}

export const textToolList: ToolImpl[] = [
  wordScramble,
  buildSentence,
  fillTheBlank,
  dialogueFill,
  spotTypo,
  conjugationTap,
  rhymeMatch,
]
