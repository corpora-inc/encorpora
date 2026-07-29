// The hold, on its own, away from the sheet.
//
// `instructions.test.ts` proves the child-facing promise: open the manual and
// the game goes quiet. This file proves the machinery underneath it, because
// the interesting failures are the ones a screenshot cannot show — a context
// created before the wrap, a context closed while held, two holds nested, the
// webkit-prefixed constructor one game reads in preference to the standard one.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  installAudioHold,
  holdAudio,
  releaseAudio,
  isAudioHeld,
  forgetAudioContexts,
} from "./audioHold.ts"

class FakeAudioContext {
  state: "running" | "suspended" | "closed" = "running"
  suspends = 0
  resumes = 0
  args: unknown[]
  constructor(...args: unknown[]) {
    this.args = args
  }
  async resume(): Promise<void> {
    this.resumes += 1
    await Promise.resolve()
    if (this.state !== "closed") this.state = "running"
  }
  async suspend(): Promise<void> {
    this.suspends += 1
    await Promise.resolve()
    if (this.state !== "closed") this.state = "suspended"
  }
  async close(): Promise<void> {
    this.state = "closed"
  }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

type Globals = Record<string, unknown>

/** Install the hold over a fresh fake constructor, and put the world back after. */
function withAudio(
  fn: (make: () => FakeAudioContext) => Promise<void> | void,
  name = "AudioContext",
): () => Promise<void> {
  return async () => {
    const g = globalThis as Globals
    const prev = g[name]
    g[name] = FakeAudioContext
    installAudioHold()
    try {
      await fn(() => new (g[name] as new () => FakeAudioContext)())
    } finally {
      g[name] = prev
      forgetAudioContexts()
    }
  }
}

test(
  "a context made after the wrap is suspended by a hold and restored by the release",
  withAudio(async (make) => {
    const ctx = make()
    holdAudio()
    await settle()
    assert.equal(ctx.state, "suspended")
    releaseAudio()
    await settle()
    assert.equal(ctx.state, "running")
  }),
)

test(
  "the hold nests: an inner release does not give the sound back early",
  withAudio(async (make) => {
    const ctx = make()
    holdAudio()
    // Settled BETWEEN the two, deliberately. A second hold that re-derives the
    // game's intent from the context's state would read the silence the FIRST
    // hold caused as "this game did not want sound", and never give it back.
    await settle()
    holdAudio()
    await settle()
    assert.equal(ctx.state, "suspended")
    releaseAudio()
    await settle()
    assert.equal(ctx.state, "suspended", "the outer hold was ignored")
    assert.equal(isAudioHeld(), true)
    releaseAudio()
    await settle()
    assert.equal(ctx.state, "running")
    assert.equal(isAudioHeld(), false)
  }),
)

test(
  "an unmatched release is not a licence to make noise",
  withAudio(async (make) => {
    const ctx = make()
    await ctx.suspend()
    releaseAudio()
    releaseAudio()
    await settle()
    assert.equal(ctx.state, "suspended", "a stray release started a silent game")
    assert.equal(isAudioHeld(), false)
    // And it must not have driven the count below zero: a hold that has to
    // climb back out of a hole is a hold that does nothing on the next read.
    await ctx.resume()
    holdAudio()
    await settle()
    assert.equal(isAudioHeld(), true, "the next read was not held")
    assert.equal(ctx.state, "suspended", "the stray releases cost the next read its silence")
    releaseAudio()
    await settle()
  }),
)

test(
  "a context closed while held is not touched again",
  withAudio(async (make) => {
    // A pack can unmount mid-read: the host's exit chevron is in the host
    // document and the swallow cannot reach it. Resuming a closed context
    // throws in a real browser, which would be an unhandled rejection on the
    // way out of the game.
    const ctx = make()
    holdAudio()
    await settle()
    await ctx.close()
    const before = ctx.resumes
    releaseAudio()
    await settle()
    assert.equal(ctx.resumes, before, "the hold resumed a closed context")
    assert.equal(ctx.state, "closed")
  }),
)

test(
  "installing twice does not wrap the wrapper, and does not double-register",
  withAudio(async (make) => {
    // `createInstructions` installs at every mount and the module installs at
    // import, so this runs more than once by design. A wrapper wrapped in a
    // wrapper is a construct trap per layer, forever, for the life of the page.
    const once = (globalThis as Globals).AudioContext
    installAudioHold()
    installAudioHold()
    assert.equal((globalThis as Globals).AudioContext, once, "the wrapper was wrapped again")
    const ctx = make()
    holdAudio()
    await settle()
    assert.equal(ctx.suspends, 1, `the context was suspended ${ctx.suspends} times`)
    releaseAudio()
    await settle()
    assert.equal(ctx.resumes, 1, `the context was resumed ${ctx.resumes} times`)
  }),
)

test(
  "the wrap is transparent: constructor arguments and instanceof survive it",
  withAudio(async (make) => {
    // `pulse` and `rhythm` both pass `{ latencyHint: "interactive" }`, and a
    // timing game that silently lost its latency hint would be a worse bug than
    // the one being fixed here.
    const g = globalThis as Globals
    const Ctor = g.AudioContext as new (o: unknown) => FakeAudioContext
    const ctx = new Ctor({ latencyHint: "interactive" })
    assert.deepEqual(ctx.args, [{ latencyHint: "interactive" }], "the options were dropped")
    assert.ok(ctx instanceof FakeAudioContext, "the instance lost its prototype")
    void make()
  }),
)

test(
  "the webkit-prefixed constructor is wrapped too",
  withAudio(async (make) => {
    // `rhythm` reads `webkitAudioContext ?? window.AudioContext` — the opposite
    // order to every other game. Wrapping only the unprefixed name would hold
    // twenty-six games and leave the twenty-seventh playing.
    const ctx = make()
    holdAudio()
    await settle()
    assert.equal(ctx.state, "suspended", "webkitAudioContext was never wrapped")
    releaseAudio()
    await settle()
  }, "webkitAudioContext"),
)

test(
  "a read shorter than a suspend still ends with the sound on",
  async () => {
    // `suspend()` and `resume()` are promises and a child can open and shut the
    // sheet inside one frame. Issued in parallel, the resume can complete first
    // and the late suspend then lands on a game that is being played — silence
    // that never comes back, which is worse than the noise being fixed.
    class SlowSuspend {
      state: "running" | "suspended" | "closed" = "running"
      async resume(): Promise<void> {
        await Promise.resolve()
        if (this.state !== "closed") this.state = "running"
      }
      async suspend(): Promise<void> {
        for (let i = 0; i < 6; i++) await Promise.resolve()
        if (this.state !== "closed") this.state = "suspended"
      }
      async close(): Promise<void> {
        this.state = "closed"
      }
    }
    const g = globalThis as Globals
    const prev = g.AudioContext
    g.AudioContext = SlowSuspend
    installAudioHold()
    try {
      const ctx = new (g.AudioContext as new () => SlowSuspend)()
      holdAudio()
      releaseAudio()
      await settle()
      await settle()
      assert.equal(ctx.state, "running", "the game came back mute after a quick look")
    } finally {
      g.AudioContext = prev
      forgetAudioContexts()
    }
  },
)

/** A context whose two operations settle at different speeds, either way round. */
function skewed(suspendTicks: number, resumeTicks: number) {
  return class Skewed {
    state: "running" | "suspended" | "closed" = "running"
    async resume(): Promise<void> {
      for (let i = 0; i < resumeTicks; i++) await Promise.resolve()
      if (this.state !== "closed") this.state = "running"
    }
    async suspend(): Promise<void> {
      for (let i = 0; i < suspendTicks; i++) await Promise.resolve()
      if (this.state !== "closed") this.state = "suspended"
    }
    async close(): Promise<void> {
      this.state = "closed"
    }
  }
}

/** Install a skewed constructor, run, put the world back. */
async function withSkew(
  Ctor: ReturnType<typeof skewed>,
  fn: (ctx: { state: string }) => Promise<void>,
): Promise<void> {
  const g = globalThis as Globals
  const prev = g.AudioContext
  g.AudioContext = Ctor
  installAudioHold()
  try {
    await fn(new (g.AudioContext as new () => { state: string })())
  } finally {
    g.AudioContext = prev
    forgetAudioContexts()
  }
}

test("a second read opened before the first read's resume lands is still silent", async () => {
  // A child taps PLAY and taps "?" again in the same second, which they do
  // constantly. A resume is slower than a suspend on a real device — it has to
  // re-acquire the output — so the second read begins while the first read's
  // resume is still in the air. Deciding what the game wants by looking at the
  // context at that instant reads the not-yet-undone silence as "this game does
  // not want sound", holds nothing, and the resume lands: the game plays for
  // the whole of the second read.
  await withSkew(skewed(1, 6), async (ctx) => {
    holdAudio()
    await settle()
    assert.equal(ctx.state, "suspended")
    releaseAudio()
    holdAudio()
    for (let i = 0; i < 4; i++) await settle()
    assert.equal(ctx.state, "suspended", "the game played through the second read")
    releaseAudio()
    for (let i = 0; i < 4; i++) await settle()
    assert.equal(ctx.state, "running", "and never came back")
  })
})

test("a game pausing itself in the same frame the manual opens stays paused after it", async () => {
  // The other direction. A suspend can be slower than a resume, and a game that
  // pauses itself as the sheet goes up — its own pause screen, a phone call —
  // is still "running" for a moment afterwards. Believing that reading switches
  // a self-paused game back on when the manual closes.
  await withSkew(skewed(6, 1), async (ctx) => {
    const c = ctx as unknown as { suspend(): Promise<void> }
    void c.suspend()
    holdAudio()
    for (let i = 0; i < 4; i++) await settle()
    releaseAudio()
    for (let i = 0; i < 4; i++) await settle()
    assert.equal(ctx.state, "suspended", "closing the manual restarted a self-paused game")
  })
})

test(
  "a context that existed BEFORE the wrap is not held — and that is the known limit",
  withAudio(async () => {
    // Honest about the seam: the proxy can only see a `new` that goes through
    // it. Today every one of the twenty-seven builds its context lazily, on the
    // first sound, which is always after mount — so this case does not occur in
    // the shipped packs. A game that constructs one at module scope, before
    // `createInstructions` runs, would not be held, and would need its own line.
    const raw = new FakeAudioContext()
    holdAudio()
    await settle()
    assert.equal(raw.state, "running")
    releaseAudio()
    await settle()
  }),
)
