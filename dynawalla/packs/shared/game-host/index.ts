// The adapter every arcade pack mounts against: a synchronous `Host` on the
// outside, the asynchronous pack SDK on the inside.
//
// **Why an adapter and not a rewrite.** FUSE and SIEGE both want a question the
// instant a tile spawns or a slab lands — inside a `requestAnimationFrame`
// loop, where there is no `await`. The SDK is a `MessagePort`, so every method
// on it is a promise. Bridging that in each game would mean two copies of a
// prefetch buffer written by two people at two times, and the game code would
// grow a loading state in its hot path.
//
// So this keeps a stocked pool, filled ahead of demand and topped up in the
// background, and hands it out synchronously. The games' own `Host` type is
// untouched, which is the point: the swap from the stub host to the real one is
// a change of two lines in an entry file and nothing in the game.
//
// **Why `items.reveal` is declared.** Both games have to *place the answer*
// before the child reaches it — SIEGE puts it on one of three slabs, FUSE makes
// a chip's face an expression worth exactly that chip's value. That is the
// sanctioned use of the capability, and it changes nothing about who judges: an
// attempt is still reported through `items.answer`, still recorded before the
// canonical value comes back, and the host's verdict is the one that counts.
// This module never compares a response to an answer.
//
// **Reporting is once per item.** An id that has already been reported, or that
// this module did not serve, is dropped. A pack that double-reports a chip
// would otherwise inflate a child's record, and the record only ever rises.

import type { Capability, HostClient, Item } from "../../sdk/src/index.ts"
import { connect } from "../../sdk/src/index.ts"

/** The shape both games declare locally. Kept structurally identical. */
export type Question = {
  id: string
  /** "15 − 8" */
  prompt: string
  /** "7" — exact, canonical, and never computed here. */
  answer: string
  distractors: string[]
  domain: string
  /** 0..1 */
  difficulty: number
}

export type HapticKind = "light" | "medium" | "heavy" | "success" | "failure"

export type GameHost = {
  next(): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(kind: HapticKind): void
  prefersReducedMotion(): boolean
  /** Optional host extension FUSE feature-detects: bias the stream by value. */
  focus(spec: { key: number; wanted: number[] }): void
}

/** Named cues. The game says what happened; the host owns the waveform. */
const HAPTIC: Record<HapticKind, "tick" | "seat" | "settle" | "refuse"> = {
  light: "tick",
  medium: "seat",
  heavy: "settle",
  success: "settle",
  failure: "refuse",
}

/**
 * How many questions to keep ahead of the game.
 *
 * FUSE pumps ten at a time when a level turns over, so the pool has to absorb a
 * burst without the loop ever seeing an empty one. Two round trips per question
 * (`items.next` then `items.reveal`) at 120 requests per second is far more
 * headroom than 64 items need.
 */
const POOL_TARGET = 64
const POOL_FLOOR = 32

/** A pack that has not seen a question in this long has been left running. */
const IDLE_MS = 5 * 60 * 1000

/** Answered questions that count as one sitting, for the progress hairline. */
const SESSION_ITEMS = 40

export type GameHostOptions = {
  /** Domain label the game shows or logs. Cosmetic; the host owns the skill. */
  readonly domain?: string
  /** Called with 0..1 whenever the game's own progress is known. */
  readonly onProgress?: (fraction: number) => void
}

export type MountedHost = {
  readonly host: GameHost
  readonly client: HostClient
  /** Awaited once before the game mounts, so `next()` is never empty. */
  warm(): Promise<void>
  dispose(): void
}

function questionFrom(item: Item, canonical: string, domain: string): Question {
  const distractors = (item.choices ?? [])
    .map((choice) => choice.text)
    .filter((text) => text !== canonical)
  return {
    id: item.id,
    prompt: item.prompt,
    answer: canonical,
    distractors,
    domain,
    // A level index the host chose, squashed into the 0..1 the games read for
    // pacing. Not a claim about difficulty; a monotone reading of the ladder.
    difficulty: Math.max(0, Math.min(1, item.level / 8)),
  }
}

/**
 * Connect to the host and build a synchronous game host over it.
 *
 * Rejects when there is no host — a pack opened directly in a browser tab
 * should say so on its own surface rather than showing a frozen loading state
 * forever, and the games' entry files render that message.
 */
export async function createGameHost(options: GameHostOptions = {}): Promise<MountedHost> {
  const client = await connect()
  const domain = options.domain ?? "arith"
  const granted = new Set<Capability>(client.granted)

  const pool: Question[] = []
  /** Ids this module served and has not yet reported. */
  const live = new Set<string>()
  let wanted: number[] = []
  let filling = false
  let disposed = false
  let lastServed: Question | null = null
  let lastAsk = Date.now()
  let reported = 0

  const canReveal = granted.has("items.reveal")

  const fill = () => {
    if (filling || disposed) return
    filling = true
    void (async () => {
      try {
        while (!disposed && pool.length < POOL_TARGET) {
          if (Date.now() - lastAsk > IDLE_MS) break
          const item = await client.nextItem()
          if (item === null) break
          const canonical = canReveal ? await client.reveal(item.id) : ""
          if (canonical === "") {
            // No reveal grant means no placeable answer. Both games need one,
            // so this is loud rather than a silently duller game.
            console.error("[pack] items.reveal was not granted; questions cannot be placed")
            break
          }
          pool.push(questionFrom(item, canonical, domain))
          live.add(item.id)
        }
      } catch (error) {
        console.error("[pack] could not fill the question pool", error)
      } finally {
        filling = false
      }
    })()
  }

  const take = (): Question => {
    lastAsk = Date.now()
    // A value the game said it needs, if the pool happens to hold one: FUSE
    // asks for a chip worth exactly 7 and can then print an expression on it.
    // When nothing matches, the game gets the next question and draws a
    // numeral instead — which is what `focus` being optional means.
    if (wanted.length > 0) {
      const index = pool.findIndex((question) => wanted.includes(Number(question.answer)))
      if (index >= 0) {
        const [picked] = pool.splice(index, 1)
        if (picked) {
          lastServed = picked
          if (pool.length < POOL_FLOOR) fill()
          return picked
        }
      }
    }
    const next = pool.shift()
    if (pool.length < POOL_FLOOR) fill()
    if (next) {
      lastServed = next
      return next
    }
    // The pool ran dry. The game gets something drawable with no id, so the
    // report it produces is dropped rather than answering a served item twice.
    console.warn("[pack] the question pool ran dry")
    return lastServed
      ? { ...lastServed, id: "" }
      : { id: "", prompt: "", answer: "0", distractors: [], domain, difficulty: 0 }
  }

  const host: GameHost = {
    next: take,

    report: ({ questionId, correct, ms, answered }) => {
      if (questionId === "" || !live.has(questionId)) return
      live.delete(questionId)
      // The host draws the progress and the pack does not, so what a pack owes
      // it is a fraction. "How far into this sitting" is the only one a game
      // with no ending can honestly report, and it is the one a parent glancing
      // at a tablet wants: forty answered questions is a session.
      reported += 1
      void client.progress(Math.min(1, reported / SESSION_ITEMS)).catch(() => {})
      options.onProgress?.(Math.min(1, reported / SESSION_ITEMS))
      // The host judges. `correct` is what the game believes; it is not sent,
      // and it is not what is recorded.
      void client
        .answer({ itemId: questionId, response: answered, latencyMs: Math.max(0, Math.round(ms)) })
        .catch((error: unknown) => {
          console.error("[pack] an answer could not be reported", error)
        })
      void correct
    },

    haptic: (kind) => {
      if (!granted.has("haptics")) return
      void client.haptic(HAPTIC[kind]).catch(() => {
        // A device with no motor is not an error a child should hear about,
        // and the host has already logged anything that is.
      })
    },

    prefersReducedMotion: () => client.settings.reducedMotion,

    focus: ({ wanted: values }) => {
      wanted = values.slice(0, 32)
      if (pool.length < POOL_TARGET) fill()
    },
  }

  return {
    host,
    client,
    warm: async () => {
      // Awaited so the first frame the child sees is already stocked. Filling
      // in the background and hoping is how a game shows a blank chip once.
      for (let i = 0; i < POOL_FLOOR && !disposed; i++) {
        const item = await client.nextItem()
        if (item === null) break
        const canonical = canReveal ? await client.reveal(item.id) : ""
        if (canonical === "") break
        pool.push(questionFrom(item, canonical, domain))
        live.add(item.id)
      }
      fill()
    },
    dispose: () => {
      disposed = true
      client.dispose()
    },
  }
}

/**
 * The message a pack draws when it is not inside a host.
 *
 * Every pack needs one and none of them should invent it: opening `index.html`
 * from a file manager, or leaving a stale tab open after the host is gone, are
 * both states a child can reach, and a frozen loading screen is the worst
 * possible answer to either.
 */
export function renderNoHost(root: HTMLElement, name: string): void {
  root.innerHTML = ""
  const panel = document.createElement("div")
  panel.setAttribute("role", "status")
  panel.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "padding:2rem;text-align:center;font:500 1rem/1.5 system-ui,sans-serif;color:#e8e2d6"
  panel.textContent = `${name} runs inside Dynawalla.`
  root.appendChild(panel)
}
