// ONE TAP, ONE THING.
//
// Reported from a device: "sometimes when I hit the 'tide' bubble, the tap goes
// through to an answer in the overlay." The tide bubble is drawn on the canvas
// and `Game.onDown` opens the tide gate from `pointerdown`, synchronously. The
// gate is a child of the same stage, so the four answer chips are laid out
// under the still-pressed finger before it lifts — and the `click` the browser
// then synthesises for that tap is delivered to whichever chip is now at that
// coordinate. One tap opened the gate and answered it. It was intermittent only
// because it needed the bubble to be over where a chip happened to land.
//
// These tests drive the exact event sequence a real touch emits, in the exact
// order the listeners see it — the pack-wide capture listeners on the root
// first, then the gate's own — and assert what got through.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TapGuard, type TapEvent } from './tapGuard.ts'

/**
 * A touch, as a browser actually delivers it.
 *
 * `openOn` names the event during which the surface appears; `undefined` means
 * it was already there. Returns the events the surface was allowed to act on.
 */
function tap(g: TapGuard, openOn?: 'pointerdown'): TapEvent[] {
  const acted: TapEvent[] = []
  g.pointerDown()
  if (openOn === 'pointerdown') g.open()
  // The finger comes up. The root sees it first, then the gate.
  g.pointerUp()
  if (g.accept('pointerup')) acted.push('pointerup')
  // ...and the browser synthesises the click from that same press.
  if (g.accept('click')) acted.push('click')
  return acted
}

test('the tap that opens the tide gate does not also answer it', () => {
  const g = new TapGuard()
  const acted = tap(g, 'pointerdown')
  assert.ok(
    !acted.includes('click'),
    `the opening tap reached the gate as ${acted.join(' + ')} — that click picks an answer`,
  )
})

test('the very next tap answers normally', () => {
  const g = new TapGuard()
  tap(g, 'pointerdown')
  // A child who taps a chip must be heard the first time. A guard that eats
  // two taps is a worse bug than the one it replaced.
  const acted = tap(g)
  assert.ok(acted.includes('click'), 'the answer tap after the gate opened was swallowed')
})

test('a gate that appears with no finger down is live immediately', () => {
  // The offline tide at launch, and the next question after a wrong answer.
  // Nobody is pressing anything; blocking there would cost the child a tap.
  const g = new TapGuard()
  g.open()
  assert.equal(g.blocking, false)
  assert.ok(tap(g).includes('click'), 'the first tap on an unprompted gate was swallowed')
})

test('a gesture that never produces its click does not veto the next one', () => {
  // A drag that turns into a scroll, or a pointercancel: the click we were
  // holding a veto for never arrives, and the veto must not outlive it.
  const g = new TapGuard()
  g.pointerDown()
  g.open()
  g.pointerUp() // no click follows
  const acted = tap(g)
  assert.ok(acted.includes('click'), 'a stale veto ate the next real tap')
})

test('a second finger cannot answer while the first is still opening', () => {
  // Children put more than one finger on a screen. While the opening finger is
  // still down the gate is `blocking`, and a `pointerdown` from another finger
  // must not reach a chip either.
  const g = new TapGuard()
  g.pointerDown()
  g.open()
  assert.equal(g.blocking, true)
  assert.equal(g.accept('pointerdown'), false, 'a second finger answered the gate it just opened')
  assert.equal(g.accept('click'), false, 'and its click got through')
})

test('closing and reopening guards again', () => {
  const g = new TapGuard()
  tap(g, 'pointerdown')
  tap(g)
  g.close()
  const acted = tap(g, 'pointerdown')
  assert.ok(!acted.includes('click'), 'the second tide bubble tapped straight through')
})
