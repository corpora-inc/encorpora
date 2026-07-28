// THE CHAIN.
//
// Per-link escalation with named caps, and a hard snap-back. This is the piece
// of the design the canon singles out, so it is the piece with the most
// assertions: that every channel really does rise per link, that every one of
// them really does stop at the number it is named for, and that when the chain
// ends the whole apparatus is at rest *in one step* rather than sagging back
// over half a second.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BLOOM_BASE,
  BLOOM_CAP,
  CHAIN_CAP,
  CHAIN_WINDOW_MS,
  CHROMA_CAP_RPX,
  Escalation,
  HITSTOP_BASE_MS,
  HITSTOP_CAP_MS,
  HITSTOP_POOL_MS,
  REST,
  TIMESCALE_FLOOR,
  channelsAt,
} from "../game/escalation.ts"

test("every channel escalates per link, and none of them ever moves backwards", () => {
  let previous = channelsAt(1, false)
  assert.equal(previous.hitstopMs, HITSTOP_BASE_MS)
  assert.equal(previous.bloom, BLOOM_BASE)
  assert.equal(previous.timescale, 1)

  for (let links = 2; links <= CHAIN_CAP; links++) {
    const c = channelsAt(links, false)
    assert.ok(c.hitstopMs >= previous.hitstopMs, `hitstop fell at link ${links}`)
    assert.ok(c.bloom >= previous.bloom, `bloom fell at link ${links}`)
    assert.ok(c.chromaRpx >= previous.chromaRpx, `chroma fell at link ${links}`)
    assert.ok(c.timescale <= previous.timescale, `timescale rose at link ${links}`)
    previous = c
  }

  // And it really did climb, rather than sitting flat and passing a monotone
  // check by never moving.
  const one = channelsAt(1, false)
  const cap = channelsAt(CHAIN_CAP, false)
  assert.ok(cap.hitstopMs > one.hitstopMs)
  assert.ok(cap.bloom > one.bloom)
  assert.ok(cap.chromaRpx > one.chromaRpx)
  assert.ok(cap.timescale < one.timescale)
})

test("the caps are hard, and they are the numbers they are named for", () => {
  for (const links of [CHAIN_CAP, CHAIN_CAP + 1, 50, 5000]) {
    const c = channelsAt(links, false)
    assert.ok(c.hitstopMs <= HITSTOP_CAP_MS, `hitstop broke its cap at ${links} links`)
    assert.ok(c.bloom <= BLOOM_CAP, `bloom broke its cap at ${links} links`)
    assert.ok(c.chromaRpx <= CHROMA_CAP_RPX, `chroma broke its cap at ${links} links`)
    assert.ok(c.timescale >= TIMESCALE_FLOOR, `timescale broke its floor at ${links} links`)
  }
  // Pinned, not merely bounded: past the cap nothing moves at all.
  assert.deepEqual(channelsAt(CHAIN_CAP + 7, false), channelsAt(CHAIN_CAP, false))
})

test("a chain of nine reaches the cap on every channel, and no earlier", () => {
  const capped = channelsAt(CHAIN_CAP, false)
  assert.equal(capped.hitstopMs, HITSTOP_CAP_MS)
  assert.equal(capped.bloom, BLOOM_CAP)
  assert.equal(capped.chromaRpx, CHROMA_CAP_RPX)
  assert.equal(capped.timescale, TIMESCALE_FLOOR)
})

test("the snap-back is one step: after a release nothing is left leaning", () => {
  const chain = new Escalation(false)
  let now = 0
  for (let i = 0; i < 5; i++) chain.link((now += 300))
  assert.equal(chain.links, 5)
  const hot = chain.channels
  assert.ok(hot.bloom > 0 && hot.timescale < 1 && hot.chromaRpx > 0)

  const release = chain.cut()
  assert.ok(release)
  assert.equal(release.links, 5)
  assert.equal(release.broken, true)

  // Rest. Not "approaching rest", not "decaying to rest" — rest, on the very
  // next read, so a mark on the next frame starts from nothing.
  assert.deepEqual(chain.channels, REST)
  assert.equal(chain.links, 0)
  assert.equal(chain.alive, false)
  assert.equal(chain.fuse(now), 0)
})

test("the chain dies when the light fades, and the release carries what was banked", () => {
  const chain = new Escalation(false)
  chain.link(1000)
  chain.link(1200)
  chain.link(1400)

  assert.equal(chain.expire(1400 + CHAIN_WINDOW_MS - 1), null, "the chain died early")
  assert.equal(chain.links, 3)

  const release = chain.expire(1400 + CHAIN_WINDOW_MS)
  assert.ok(release)
  assert.equal(release.links, 3)
  assert.equal(release.broken, false, "a chain that ran out of light was called broken")
  assert.deepEqual(chain.channels, REST)

  // And a second expire finds nothing: a release fires exactly once.
  assert.equal(chain.expire(9_000_000), null)
})

test("each link renews the window; the chain is a tempo, not a countdown", () => {
  const chain = new Escalation(false)
  chain.link(0)
  chain.link(CHAIN_WINDOW_MS - 100)
  // Without renewal the chain would be dead by now.
  assert.equal(chain.expire(CHAIN_WINDOW_MS + 100), null)
  assert.equal(chain.links, 2)
  assert.ok(chain.remainingMs(CHAIN_WINDOW_MS + 100) > 0)
})

test("a release with nothing in it is never emitted", () => {
  const chain = new Escalation(false)
  assert.equal(chain.cut(), null)
  assert.equal(chain.expire(1_000_000), null)
  assert.equal(chain.links, 0)
})

test("the longest chain is remembered across releases", () => {
  const chain = new Escalation(false)
  for (let i = 0; i < 4; i++) chain.link(i * 100)
  chain.cut()
  chain.link(9000)
  assert.equal(chain.longest, 4)
  assert.equal(chain.links, 1)
})

test("hitstop is pooled, so a multi-catch stays fluid instead of stuttering", () => {
  const chain = new Escalation(false)
  // Five stars taken by one mark, all inside a single frame.
  let spent = 0
  for (let i = 0; i < 5; i++) spent += chain.link(1000).hitstopMs
  assert.ok(
    spent <= HITSTOP_POOL_MS,
    `a multi-catch froze the world for ${spent}ms, past the ${HITSTOP_POOL_MS}ms pool`,
  )
  assert.ok(spent > 0, "a multi-catch had no weight at all")
})

test("the pool refills, so a chain paced over seconds is not starved", () => {
  const chain = new Escalation(false)
  const first = chain.link(0).hitstopMs
  assert.ok(first > 0)
  // A second link a full window later gets its own budget.
  const later = chain.link(1000).hitstopMs
  assert.ok(later > 0, "the pool never let go of the first link's spend")
})

test("reduced motion is a branch, and the link count survives it", () => {
  for (let links = 1; links <= CHAIN_CAP + 3; links++) {
    const c = channelsAt(links, true)
    assert.equal(c.hitstopMs, 0, "reduced motion froze the world")
    assert.equal(c.timescale, 1, "reduced motion slowed the world")
    assert.equal(c.chromaRpx, 0, "reduced motion split the colour")
  }

  // The information is re-routed, not deleted: the chain still counts, and the
  // count is what the astrolabe's rim draws.
  const chain = new Escalation(true)
  let now = 0
  for (let i = 0; i < 6; i++) chain.link((now += 200))
  assert.equal(chain.links, 6)
  assert.equal(chain.longest, 6)
  assert.ok(chain.fuse(now) > 0)
  const release = chain.cut()
  assert.equal(release?.links, 6)
})

test("a paused chain does not bleed out behind the host's sheet", () => {
  const chain = new Escalation(false)
  chain.link(1000)
  // Thirty seconds behind a sheet, then a tenth of a second of real time.
  chain.shift(30_000)
  assert.equal(chain.expire(31_100), null, "the sheet ate the chain")
  assert.equal(chain.links, 1)
  assert.equal(chain.expire(1000 + CHAIN_WINDOW_MS + 30_000)?.links, 1)
})
