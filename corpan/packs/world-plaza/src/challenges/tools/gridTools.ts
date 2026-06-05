/**
 * Grid / memory family of micro-challenges: picture↔word match, memory-pairs
 * concentration, category sort, countdown recall, and a word-search-lite.
 */

import type { ChallengeSpec } from "@world-plaza/contracts"
import type { ChallengeRuntimeHost, ChallengeEntry } from "../host"
import { entryPair } from "../host"
import {
  baseSpec,
  computeReward,
  h,
  clear,
  mulberry32,
  sample,
  seedOf,
  shuffle,
  type ToolImpl,
} from "./_shared"
import { challengeStrings } from "./strings"

/**
 * Emoji map for picture-match. Picture-match ONLY makes sense for picturable
 * single-word nouns that have a real glyph (apple → 🍎). The corpus is mostly
 * phrases/sentences with no emoji, so we map BOTH the target and the native
 * surface forms of common concrete nouns to a shared glyph, then SELECT only
 * the entries that resolve to one. Anything not here is treated as
 * "not picturable" and excluded from the round (see `pictureMatch`).
 */
const EMOJI: Record<string, string> = {
  bread: "🍞", pan: "🍞", coffee: "☕", café: "☕", cafe: "☕",
  water: "💧", agua: "💧", apple: "🍎", manzana: "🍎",
  cheese: "🧀", queso: "🧀", milk: "🥛", leche: "🥛",
  egg: "🥚", huevo: "🥚", market: "🏪", mercado: "🏪",
  money: "🪙", dinero: "🪙", ferry: "⛴️", ferri: "⛴️",
  road: "🛣️", camino: "🛣️", map: "🗺️", mapa: "🗺️",
  ticket: "🎫", billete: "🎫", basket: "🧺", cesta: "🧺",
  fig: "🍯", station: "🚉", estación: "🚉", estacion: "🚉",
  table: "🍽️", mesa: "🍽️", price: "🏷️", precio: "🏷️",
  // common concrete nouns the corpus may surface
  house: "🏠", casa: "🏠", car: "🚗", coche: "🚗", carro: "🚗",
  dog: "🐶", perro: "🐶", cat: "🐱", gato: "🐱",
  book: "📖", libro: "📖", key: "🔑", llave: "🔑",
  door: "🚪", puerta: "🚪", phone: "📱", teléfono: "📱", telefono: "📱",
  fish: "🐟", pez: "🐟", pescado: "🐟", chicken: "🐔", pollo: "🐔",
  wine: "🍷", vino: "🍷", beer: "🍺", cerveza: "🍺",
  tea: "🍵", té: "🍵", te: "🍵", sugar: "🍬", azúcar: "🍬", azucar: "🍬",
  rice: "🍚", arroz: "🍚", soup: "🍲", sopa: "🍲",
  fruit: "🍓", fruta: "🍓", orange: "🍊", naranja: "🍊",
  banana: "🍌", plátano: "🍌", platano: "🍌",
  tomato: "🍅", tomate: "🍅", potato: "🥔", patata: "🥔", papa: "🥔",
  salt: "🧂", sal: "🧂", flower: "🌸", flor: "🌸",
  tree: "🌳", árbol: "🌳", arbol: "🌳", sun: "☀️", sol: "☀️",
  moon: "🌙", luna: "🌙", star: "⭐", estrella: "⭐",
  clock: "🕐", reloj: "🕐", bag: "👜", bolsa: "👜", bolso: "👜",
  shoe: "👟", zapato: "👟", hat: "🎩", sombrero: "🎩",
  bed: "🛏️", cama: "🛏️", chair: "🪑", silla: "🪑",
  hand: "✋", mano: "✋", eye: "👁️", ojo: "👁️",
  heart: "❤️", corazón: "❤️", corazon: "❤️",
}

/** Strip a leading article and lowercase. */
function nounKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/^(el|la|los|las|un|una|the|a|an)\s+/, "")
    .trim()
}

/**
 * Resolve a glyph for an entry IF it is a single, picturable noun. Returns null
 * when the text is multi-word OR has no known emoji — the caller excludes those
 * from picture-match so the picture and answer can never desync.
 */
function pictureGlyph(text: string): string | null {
  const key = nounKey(text)
  if (!key || /\s/.test(key)) return null // single word only
  return EMOJI[key] ?? null
}

async function pairs(
  host: ChallengeRuntimeHost,
  spec: ChallengeSpec,
  n: number,
): Promise<Array<{ target: string; native: string; entry: ChallengeEntry }>> {
  const entries =
    spec.entryIds && spec.entryIds.length
      ? await host.getEntriesByIds(spec.entryIds)
      : await host.getRandomEntries(n + 4)
  const out: Array<{ target: string; native: string; entry: ChallengeEntry }> = []
  for (const e of entries) {
    const p = entryPair(e, spec.language, spec.nativeLanguage)
    if (p) out.push({ target: p.target, native: p.native, entry: e })
  }
  return out
}

/* ================================================================== *
 * picture-match — match an emoji card to its word.
 * ================================================================== */
export const pictureMatch: ToolImpl = {
  id: "picture-match",
  title: "Picture Match",
  difficulty: 1,
  buildSpec: (ctx) => Promise.resolve(baseSpec("picture-match", ctx, { rounds: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      // Pull a generous batch, then SELECT only picturable single-noun entries:
      // its TARGET word must resolve to a real glyph. We carry the glyph WITH the
      // pair so the picture and the correct answer are bound together for life —
      // they can never drift apart round-to-round.
      type PicPair = { target: string; native: string; glyph: string | null }
      const all: PicPair[] = (await pairs(host, spec, 20)).map((p) => ({
        target: p.target,
        native: p.native,
        glyph: pictureGlyph(p.target),
      }))
      const picturable = all
        .filter((p) => p.glyph != null)
        // de-dupe by glyph so two tiles never show the same picture's word
        .filter((p, i, arr) => arr.findIndex((q) => q.glyph === p.glyph) === i)

      // Need the answer + ≥3 distinct distractors, each its own word. If the
      // corpus can't supply that many picturable nouns, fall back to a plain
      // word-match round (no emoji) rather than show a broken/empty picture.
      const usePictures = picturable.length >= 4
      const pool = usePictures ? picturable : all
      if (pool.length < 2) {
        overlay.complete(0, computeReward(1, 0))
        return
      }

      let correct = 0
      let streak = 0
      const rounds = sample(pool, Math.min(4, pool.length), rnd)
      for (const p of rounds) {
        const distractors = sample(
          pool.filter((q) => q.target !== p.target),
          3,
          rnd,
        ).map((q) => q.target)
        const opts = shuffle([p.target, ...distractors], rnd)
        // INVARIANT: the displayed glyph belongs to THIS round's correct answer.
        const glyph = usePictures ? p.glyph : null
        if (glyph && pictureGlyph(p.target) !== glyph) {
          console.error(
            `[wp-challenge] picture-match desync: glyph ${glyph} != ${pictureGlyph(
              p.target,
            )} for "${p.target}"`,
          )
        }
        const ok = await new Promise<boolean>((resolve) => {
          clear(overlay.body)
          overlay.setInstruction(
            glyph ? S.pictureMatchHint : S.pictureMatchWordHint(p.native),
          )
          if (glyph) {
            const pic = h("div", "wp-ch-mem-pic", glyph)
            overlay.body.appendChild(pic)
          }
          const grid = h("div", "wp-ch-grid wp-ch-grid--2")
          let answered = false
          opts.forEach((opt) => {
            const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
            btn.addEventListener("click", () => {
              if (answered) return
              answered = true
              const good = opt === p.target
              btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
              if (good) void overlay.speak(p.target)
              else
                (grid.children[opts.indexOf(p.target)] as HTMLElement)?.classList.add(
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
      setTimeout(() => overlay.complete(score, computeReward(1, score)), 360)
    })()
  },
}

/* ================================================================== *
 * memory-pairs — concentration: match target ↔ native cards.
 * ================================================================== */
export const memoryPairs: ToolImpl = {
  id: "memory-pairs",
  title: "Memory Pairs",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("memory-pairs", ctx, { pairs: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const ps = sample(await pairs(host, spec, 8), 4, rnd)
      if (ps.length < 2) {
        overlay.complete(0, computeReward(2, 0))
        return
      }
      type Card = { key: number; text: string; speak?: string }
      const cards: Card[] = []
      ps.forEach((p, i) => {
        cards.push({ key: i, text: p.target, speak: p.target })
        cards.push({ key: i, text: p.native })
      })
      const deck = shuffle(cards, rnd)

      clear(overlay.body)
      overlay.setInstruction(S.memoryFind)
      const grid = h("div", "wp-ch-grid wp-ch-grid--3")
      overlay.body.appendChild(grid)
      // A quiet "tap to continue" affordance, only shown while a mismatch is
      // parked open. It never reserves space (absolute over the grid gap area).
      const hint = h("div", "wp-ch-mem-hint", S.memoryStudy)
      hint.style.display = "none"
      overlay.body.appendChild(hint)

      let first: { card: Card; el: HTMLElement } | null = null
      // `lock` = board frozen on a mismatch, waiting for the player to flip back.
      let lock = false
      // The parked mismatch pair (both face-up) that the next tap clears.
      let parked: { a: HTMLElement; b: HTMLElement } | null = null
      let fallback: ReturnType<typeof setTimeout> | null = null
      let matched = 0
      let mistakes = 0

      /** Gently settle the two mismatched cards back to "?" and unlock. */
      const flipParkedBack = () => {
        if (!parked) return
        const { a, b } = parked
        parked = null
        if (fallback) {
          clearTimeout(fallback)
          fallback = null
        }
        hint.style.display = "none"
        ;[a, b].forEach((el) => {
          el.classList.remove("wp-ch-mem--up", "wp-ch-mem--miss")
          el.classList.add("wp-ch-mem--settle")
          el.textContent = "?"
          // clear the one-shot settle class after it plays
          setTimeout(() => el.classList.remove("wp-ch-mem--settle"), 320)
        })
        first = null
        lock = false
      }

      // A tap ANYWHERE on the board (including the two revealed cards) clears a
      // parked mismatch — the player drives the tempo, nothing auto-flips fast.
      // Handled on a CAPTURE-phase `click` so it runs BEFORE any card's own
      // handler and swallows that tap (a tap on a revealed card flips the pair
      // back rather than counting as a new pick). `click` covers mouse, touch,
      // synthetic taps, and keyboard Enter/Space on a focused card button — one
      // path, no pointerdown/click double-fire race.
      grid.addEventListener(
        "click",
        (e) => {
          if (lock && parked) {
            e.stopPropagation()
            flipParkedBack()
          }
        },
        true,
      )

      deck.forEach((card) => {
        const btn = h("button", "wp-ch-mem", "?")
        btn.addEventListener("click", () => {
          // While a mismatch is parked, the first tap just flips it back (handled
          // by the grid pointerdown); swallow this click so it doesn't also pick.
          if (lock) return
          if (btn.classList.contains("wp-ch-mem--done") || btn.classList.contains("wp-ch-mem--up"))
            return
          btn.classList.add("wp-ch-mem--up")
          btn.textContent = card.text
          if (card.speak) void overlay.speak(card.speak)
          if (!first) {
            first = { card, el: btn }
            return
          }
          if (first.card.key === card.key && first.el !== btn) {
            first.el.classList.add("wp-ch-mem--done")
            btn.classList.add("wp-ch-mem--done")
            overlay.feedback("good", "✓")
            matched++
            first = null
            overlay.setScore(matched / ps.length)
            if (matched === ps.length) {
              const score = Math.max(0.4, 1 - mistakes * 0.08)
              setTimeout(() => overlay.complete(score, computeReward(2, score)), 500)
            }
          } else {
            // MISMATCH: keep BOTH cards revealed and freeze the board. The player
            // studies them as long as they like; the next tap flips them back.
            lock = true
            mistakes++
            overlay.feedback("bad")
            const a = first.el
            a.classList.add("wp-ch-mem--miss")
            btn.classList.add("wp-ch-mem--miss")
            parked = { a, b: btn }
            hint.style.display = ""
            // Generous safety net so the board can never get stuck if the player
            // walks away — far longer than the old 700ms snap, and user-driven.
            fallback = setTimeout(flipParkedBack, 6000)
          }
        })
        grid.appendChild(btn)
      })
    })()
  },
}

/* ================================================================== *
 * category-sort — sort words into two labelled baskets.
 * ================================================================== */
export const categorySort: ToolImpl = {
  id: "category-sort",
  title: "Category Sort",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("category-sort", ctx, {})),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const entries = await host.getRandomEntries(30)
      const byDomain = new Map<string, ChallengeEntry[]>()
      for (const e of entries) {
        const d = e.domains[0] ?? "misc"
        if (!byDomain.has(d)) byDomain.set(d, [])
        byDomain.get(d)!.push(e)
      }
      const twoDomains = [...byDomain.entries()].filter(([, v]) => v.length >= 3).slice(0, 2)
      if (twoDomains.length < 2) {
        overlay.complete(0, computeReward(2, 0))
        return
      }
      const [da, db] = twoDomains
      const text = (e: ChallengeEntry) => entryPair(e, spec.language, spec.nativeLanguage)?.target ?? ""
      const items = shuffle(
        [
          ...sample(da[1], 3, rnd).map((e) => ({ text: text(e), cat: 0 })),
          ...sample(db[1], 3, rnd).map((e) => ({ text: text(e), cat: 1 })),
        ].filter((x) => x.text),
        rnd,
      )

      clear(overlay.body)
      overlay.setInstruction(S.sortPrompt)
      const current = h("div", "wp-ch-prompt")
      current.style.fontSize = "26px"
      overlay.body.appendChild(current)
      const buckets = h("div", "wp-ch-grid wp-ch-grid--2")
      const bA = h("button", "wp-ch-tile wp-ch-tile--lg", S.sortHint(da[0]))
      const bB = h("button", "wp-ch-tile wp-ch-tile--lg", S.sortHint(db[0]))
      buckets.appendChild(bA)
      buckets.appendChild(bB)
      overlay.body.appendChild(buckets)

      let idx = 0
      let correct = 0
      const showNext = () => {
        if (idx >= items.length) {
          const score = correct / items.length
          setTimeout(() => overlay.complete(score, computeReward(2, score)), 300)
          return
        }
        current.textContent = items[idx].text
      }
      const choose = (cat: number, btn: HTMLElement) => {
        if (idx >= items.length) return
        const good = items[idx].cat === cat
        if (good) correct++
        btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
        overlay.feedback(good ? "good" : "bad", good ? "✓" : undefined)
        setTimeout(() => {
          btn.classList.remove("wp-ch-tile--correct", "wp-ch-tile--wrong")
          idx++
          overlay.setScore(correct / items.length)
          showNext()
        }, 420)
      }
      bA.addEventListener("click", () => choose(0, bA))
      bB.addEventListener("click", () => choose(1, bB))
      showNext()
    })()
  },
}

/* ================================================================== *
 * countdown-recall — memorise N words, then recall them before the bell.
 * ================================================================== */
export const countdownRecall: ToolImpl = {
  id: "countdown-recall",
  title: "Countdown Recall",
  difficulty: 3,
  buildSpec: (ctx) => Promise.resolve(baseSpec("countdown-recall", ctx, { count: 4 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const ps = sample(await pairs(host, spec, 10), 4, rnd)
      if (ps.length < 3) {
        overlay.complete(0, computeReward(3, 0))
        return
      }
      // Phase 1: show the list. The player studies at their own pace — a
      // "Ready" button advances when THEY choose; a generous timer is only a
      // fallback so it can't dead-end. Words speak staggered (not all at once)
      // so the TTS is intelligible, and rows fade in in sequence.
      clear(overlay.body)
      overlay.setInstruction(`${S.memorizeTitle} · ${S.memorizeSub}`)
      const list = h("div", "wp-ch-grid")
      ps.forEach((p, i) => {
        const row = h("div", "wp-ch-tile wp-ch-recall-row", `${p.target} — ${p.native}`)
        row.style.cursor = "default"
        row.style.animationDelay = `${i * 90}ms`
        list.appendChild(row)
        setTimeout(() => void overlay.speak(p.target), i * 900)
      })
      overlay.body.appendChild(list)

      await new Promise<void>((resolve) => {
        let done = false
        const go = () => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve()
        }
        const ready = h("button", "wp-ch-btn", S.ready)
        ready.style.alignSelf = "center"
        ready.addEventListener("click", go)
        const actions = h("div", "wp-ch-actions")
        actions.appendChild(ready)
        overlay.body.appendChild(actions)
        // Generous fallback: ~1s/word + a base, so a 4-word list parks ~6s.
        const timer = setTimeout(go, 2500 + ps.length * 900)
      })

      // Phase 2: recall — for each native prompt, tap the right target among distractors.
      const distractorPool = (await pairs(host, spec, 12)).map((q) => q.target)
      let correct = 0
      let streak = 0
      for (const p of ps) {
        const distractors = sample(
          distractorPool.filter((t) => t !== p.target),
          3,
          rnd,
        )
        const opts = shuffle([p.target, ...distractors], rnd)
        const ok = await new Promise<boolean>((resolve) => {
          clear(overlay.body)
          overlay.setInstruction(S.whichMeant(p.native))
          const grid = h("div", "wp-ch-grid wp-ch-grid--2")
          let answered = false
          opts.forEach((opt) => {
            const btn = h("button", "wp-ch-tile wp-ch-tile--lg", opt)
            btn.addEventListener("click", () => {
              if (answered) return
              answered = true
              const good = opt === p.target
              btn.classList.add(good ? "wp-ch-tile--correct" : "wp-ch-tile--wrong")
              if (!good)
                (grid.children[opts.indexOf(p.target)] as HTMLElement)?.classList.add(
                  "wp-ch-tile--correct",
                )
              // wrong → linger on the revealed answer so it registers.
              setTimeout(() => resolve(good), good ? 540 : 1100)
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
        overlay.setScore(correct / ps.length)
      }
      const score = correct / ps.length
      setTimeout(() => overlay.complete(score, computeReward(3, score)), 360)
    })()
  },
}

/* ================================================================== *
 * word-search — find target words hidden in a small letter grid (lite).
 * Words are placed horizontally; tap the first then last letter to claim.
 * ================================================================== */
export const wordSearch: ToolImpl = {
  id: "word-search",
  title: "Word Search",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("word-search", ctx, { size: 7 })),
  run: (overlay, spec, host) => {
    const S = challengeStrings(spec.nativeLanguage ?? spec.language)
    void (async () => {
      const rnd = mulberry32(seedOf(spec))
      const ps = (await pairs(host, spec, 14)).filter(
        (p) => /^[a-záéíóúñü]+$/i.test(p.target.split(/\s+/)[0]) && p.target.split(/\s+/)[0].length <= 6,
      )
      const words = sample(
        ps.map((p) => p.target.split(/\s+/)[0].toLowerCase()),
        Math.min(3, ps.length),
        rnd,
      )
      if (!words.length) {
        overlay.complete(0, computeReward(2, 0))
        return
      }
      const size = Math.max(7, Math.max(...words.map((w) => w.length)) + 1)
      const grid: string[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ""),
      )
      const placements: { word: string; row: number; col: number }[] = []
      for (const w of words) {
        let placed = false
        let guard = 0
        while (!placed && guard++ < 40) {
          const row = Math.floor(rnd() * size)
          const col = Math.floor(rnd() * (size - w.length + 1))
          let fits = true
          for (let i = 0; i < w.length; i++) {
            const cur = grid[row][col + i]
            if (cur && cur !== w[i]) {
              fits = false
              break
            }
          }
          if (fits) {
            for (let i = 0; i < w.length; i++) grid[row][col + i] = w[i]
            placements.push({ word: w, row, col })
            placed = true
          }
        }
      }
      const alpha = "abcdefghijklmnopqrstuvwxyz"
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (!grid[r][c]) grid[r][c] = alpha[Math.floor(rnd() * 26)]

      clear(overlay.body)
      overlay.setInstruction(S.findHidden)
      const wordList = h("div", "wp-ch-grid wp-ch-grid--row")
      const chips = new Map<string, HTMLElement>()
      placements.forEach((p) => {
        const chip = h("span", "wp-ch-chip", p.word)
        chips.set(p.word, chip)
        wordList.appendChild(chip)
      })
      overlay.body.appendChild(wordList)

      const board = h("div", "wp-ch-ws")
      board.style.gridTemplateColumns = `repeat(${size}, auto)`
      overlay.body.appendChild(board)

      let anchor: { r: number; c: number } | null = null
      let found = 0
      const cellEls: HTMLElement[][] = []
      for (let r = 0; r < size; r++) {
        cellEls[r] = []
        for (let c = 0; c < size; c++) {
          const cell = h("button", "wp-ch-ws-cell", grid[r][c])
          cell.addEventListener("click", () => {
            if (cell.classList.contains("wp-ch-ws-cell--found")) return
            if (!anchor) {
              anchor = { r, c }
              cell.classList.add("wp-ch-ws-cell--sel")
              return
            }
            // second tap: must be same row, to the right
            const a = anchor
            anchor = null
            cellEls[a.r][a.c].classList.remove("wp-ch-ws-cell--sel")
            if (a.r !== r || c < a.c) {
              overlay.feedback("bad")
              return
            }
            const picked = grid[r].slice(a.c, c + 1).join("")
            const match = placements.find((p) => p.word === picked && p.row === r && p.col === a.c)
            if (match) {
              for (let i = a.c; i <= c; i++) cellEls[r][i].classList.add("wp-ch-ws-cell--found")
              chips.get(match.word)?.classList.add("wp-ch-tile--correct")
              overlay.feedback("good", "✓")
              const p = ps.find((x) => x.target.split(/\s+/)[0].toLowerCase() === match.word)
              if (p) void overlay.speak(p.target)
              found++
              overlay.setScore(found / placements.length)
              if (found === placements.length) {
                setTimeout(() => overlay.complete(1, computeReward(2, 1)), 400)
              }
            } else {
              overlay.feedback("bad")
            }
          })
          cellEls[r][c] = cell
          board.appendChild(cell)
        }
      }
    })()
  },
}

export const gridToolList: ToolImpl[] = [
  pictureMatch,
  memoryPairs,
  categorySort,
  countdownRecall,
  wordSearch,
]
