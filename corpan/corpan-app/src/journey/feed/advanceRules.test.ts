// Advance-rule table tests (feed-ux §3.2): auto never fires on failed or
// manual-only cards; listening-run arms auto in swipe mode; blockIntro /
// checkpoint / rare / poster are manual-only.

import { test } from "node:test"
import assert from "node:assert/strict"
import { advanceRule, isListeningCard, isListeningRunStart } from "./advanceRules.ts"
import type { FeedCard, PreparedExercise } from "../types.ts"
import type { EngineCard } from "../engine/index.ts"
import type { ResolvedItem } from "../content/resolve.ts"

const engineCard = (activityType: string): EngineCard => ({
  spec: { specId: "s1", activityType, itemRefs: [], targetLang: "en" },
  meta: {
    pool: "due",
    strand: "language",
    form: 0,
    estSec: 10,
    provider: "native",
    celebration: "normal",
    coolDownCandidate: false,
  },
})

const exercise = (activityType: string, params?: Record<string, unknown>): FeedCard => {
  const ec = engineCard(activityType)
  const spec = { ...ec.spec, params }
  const prepared: PreparedExercise = { spec, engine: ec, items: [], distractors: null }
  return { kind: "exercise", cardId: "s1", spec, prepared }
}

test("choice_pick: swipe in swipe mode, auto+2200 in auto (default) mode", () => {
  assert.deepEqual(advanceRule(exercise("choice_pick"), "swipe"), { kind: "swipe" })
  assert.deepEqual(advanceRule(exercise("choice_pick"), "auto"), { kind: "auto", delayMs: 2200 })
})

const withMeaning = (activityType: string): FeedCard => {
  const c = exercise(activityType)
  if (c.kind === "exercise") {
    // An explanationNative only exists on an L1 stack — carry the native lang so
    // the native-safe selector actually picks the Spanish paragraph.
    c.spec = { ...c.spec, nativeLang: "es" }
    c.prepared.spec = c.spec
    c.prepared.items = [
      {
        kind: "word",
        target: { text: "welcome" },
        extras: { kind: "word", explanationNative: "Del inglés antiguo wilcuma…" },
      } as unknown as ResolvedItem,
    ]
  }
  return c
}

test("word card with a meaning/etymology waits for a swipe — never auto-advances", () => {
  // A 50-word etymology must not be yanked away on the 2.2s timer; the learner
  // reads and swipes on. Holds across exercise types, even in auto mode.
  assert.deepEqual(advanceRule(withMeaning("choice_pick"), "auto"), { kind: "swipe" })
  assert.deepEqual(advanceRule(withMeaning("listen_type"), "auto"), { kind: "swipe" })
  assert.deepEqual(advanceRule(withMeaning("speak_echo"), "auto"), { kind: "swipe" })
  // A word with no meaning still auto-advances fast (no regression).
  assert.deepEqual(advanceRule(exercise("choice_pick"), "auto"), { kind: "auto", delayMs: 2200 })
  // A speak card carrying a meaning still waits for a deliberate action (it is
  // already button-advance below, but the meaning branch must not regress it to
  // an auto-yank).
  assert.deepEqual(advanceRule(withMeaning("speak_echo"), "auto"), { kind: "swipe" })
})

test("ES→EN word with ONLY English etymology does NOT hold (no (?) shows)", () => {
  // The English paragraph is never surfaced to a non-English native, so the card
  // is a plain answer-tap card — it must auto-advance, not stall on swipe.
  const c = exercise("choice_pick")
  if (c.kind === "exercise") {
    c.spec = { ...c.spec, nativeLang: "es" }
    c.prepared.spec = c.spec
    c.prepared.items = [
      {
        kind: "word",
        target: { text: "one" },
        extras: { kind: "word", explanationTarget: "from Old English an…" },
      } as unknown as ResolvedItem,
    ]
  }
  assert.deepEqual(advanceRule(c, "auto"), { kind: "auto", delayMs: 2200 })
})

test("failed cards never auto-advance", () => {
  assert.deepEqual(advanceRule(exercise("choice_pick"), "auto", { failed: true }), { kind: "swipe" })
})

test("listen cards: listening run arms auto even in swipe mode", () => {
  assert.deepEqual(advanceRule(exercise("listen_pick"), "swipe"), { kind: "swipe" })
  assert.deepEqual(advanceRule(exercise("listen_pick"), "swipe", { listeningRun: true }), {
    kind: "auto",
    delayMs: 2200,
  })
})

test("speak_echo is button-advance in every mode — the card's own Continue settles + advances", () => {
  // The cap-pronounce round stays open for unlimited re-records; the learner
  // reads the per-word + score feedback, then presses Continue. A low score
  // must never fall back to the double-swipe skip brick — so even a "failed"
  // speak resolves to an explicit action, not an auto-yank.
  assert.deepEqual(advanceRule(exercise("speak_echo"), "swipe"), { kind: "button" })
  assert.deepEqual(advanceRule(exercise("speak_echo"), "auto"), { kind: "button" })
})

test("intro_echo + flip_recall + speak_echo are button-advance in every mode (explicit press)", () => {
  for (const type of ["intro_echo", "flip_recall", "speak_echo"] as const) {
    assert.deepEqual(advanceRule(exercise(type), "swipe"), { kind: "button" }, type)
    assert.deepEqual(advanceRule(exercise(type), "auto"), { kind: "button" }, type)
  }
})

test("manual-only cards stay manual in every mode", () => {
  const checkpoint: FeedCard = {
    kind: "checkpoint",
    cardId: "c1",
    engine: engineCard("checkpoint_summary"),
    summary: { skillIds: [], itemCount: 0, passScore: 0 },
  }
  const blockIntro: FeedCard = { kind: "blockIntro", cardId: "b1", modelNeeds: ["stt"], blockLen: 3 }
  const base = exercise("choice_pick")
  const rare: FeedCard =
    base.kind === "exercise" ? { ...base, rare: "delight" } : base
  for (const mode of ["swipe", "auto"] as const) {
    assert.equal(advanceRule(checkpoint, mode).kind, "manual")
    assert.equal(advanceRule(blockIntro, mode).kind, "manual")
    assert.equal(advanceRule(rare, mode).kind, "manual")
  }
})

test("match_pairs text-audio axis counts as a listening card", () => {
  const card = exercise("match_pairs", { axis: "text-audio" })
  assert.equal(isListeningCard(card), true)
  assert.equal(isListeningCard(exercise("match_pairs")), false)
})

test("listening-run start needs two consecutive listen cards", () => {
  assert.equal(isListeningRunStart(exercise("listen_pick"), exercise("listen_type")), true)
  assert.equal(isListeningRunStart(exercise("listen_pick"), exercise("cloze")), false)
  assert.equal(isListeningRunStart(exercise("listen_pick"), null), false)
})
