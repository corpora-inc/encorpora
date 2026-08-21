// PHOTOSENSITIVITY. A safety gate, not a matter of taste.
//
// `camera.ts` claims in its own docstring that "full-screen luminance jumps are
// rate-capped to WCAG's three per second". That claim was a comment, and a
// comment is not a gate — a children's product may not carry a seizure-risk
// promise that nothing enforces. These tests are the enforcement.
//
// WCAG 2.3.1 (Three Flashes or Below Threshold) permits no MORE than three
// general flashes in any one-second period. Three is allowed; four is not.
//
// **What this covers, and what it does not.** `Camera.flash` is a full-screen
// additive white-out and it is what the cap governs. It is not the only source
// of a bright frame: `post.ts` composites a bloom chain over the scene, and a
// dense field of overlapping bright cores can drive that to clipped white with
// no rate limit anywhere. That is documented in the PR rather than silently
// retuned, because the fix for it is fewer things on screen, not less bloom.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Camera } from "./camera.ts"

/** The amplitude one `addFlash` call was actually granted. */
function grant(cam: Camera, amount: number): number {
  cam.flash = 0
  cam.addFlash(amount, 1, 1, 1)
  return cam.flash
}

test("no more than three full flashes are granted in any one second", () => {
  const cam = new Camera()
  const granted: number[] = []
  // Every call inside the same millisecond, which is the worst case the game
  // can actually produce: a resonance hit landing on the same frame as a kill
  // and a depth boundary.
  for (let i = 0; i < 12; i++) granted.push(grant(cam, 1))

  const full = granted.filter((g) => g > 0.05).length
  assert.ok(full <= 3, `${full} full-amplitude flashes were granted inside one second`)
  assert.equal(granted[0], 0.34, "the first flash must still be a real flash")
  assert.ok(
    (granted[3] as number) <= 0.05,
    `the fourth flash was granted ${granted[3]} — the WCAG limit is three`,
  )
  assert.equal(granted[6], 0, "past six calls in a second the flash must be switched off entirely")
  for (let i = 6; i < 12; i++) assert.equal(granted[i], 0)
})

test("no single flash can exceed the hard cap, however much is asked for", () => {
  const cam = new Camera()
  assert.equal(grant(cam, 1e9), 0.34, "an absurd request must be clamped, not honoured")
  const calm = new Camera()
  calm.reduced = true
  assert.equal(grant(calm, 1e9), 0.1, "reduced motion must clamp far harder still")
})

test("the counter counts CALLS, which is the conservative direction", () => {
  // Two calls a millisecond apart produce one perceived flash but consume two
  // budget slots. Erring that way is correct: the alternative is a counter that
  // under-counts, and under-counting a seizure risk is not a trade to make.
  const cam = new Camera()
  grant(cam, 1)
  grant(cam, 1)
  grant(cam, 1)
  assert.ok(grant(cam, 1) <= 0.05, "three calls did not consume the budget")
})

test("a flash decays inside a third of a second, so it is a flash and not a wash", () => {
  const cam = new Camera()
  cam.addFlash(1, 1, 1, 1)
  assert.equal(cam.flash, 0.34)
  // `update` is driven with REAL time, never the frozen simulation time, so a
  // hit-stop cannot hold a white frame on screen.
  for (let i = 0; i < 6; i++) cam.update(1 / 60, 0, 0, 0, 0, 400)
  assert.ok(cam.flash < 0.34, "the flash did not decay")
  for (let i = 0; i < 24; i++) cam.update(1 / 60, 0, 0, 0, 0, 400)
  assert.equal(cam.flash, 0, "half a second later the screen is still lit")
})

test("reduced motion removes travel and zoom but never removes the signal", () => {
  const cam = new Camera()
  cam.reduced = true
  cam.addTrauma(0.8)
  cam.update(1 / 60, 0, 0, 0, 0, 400)
  assert.equal(cam.shakeX, 0, "reduced motion still shook the camera")
  assert.equal(cam.shakeY, 0)
  assert.ok(cam.desat > 0, "reduced motion dropped the impact signal instead of translating it")

  cam.addAberration(0.01)
  assert.equal(cam.aberration, 0, "reduced motion still aberrated")
  cam.addRipple(0, 0, 1)
  assert.equal(cam.rippleAmp, 0)
})

test("hit-stop is bounded — the simulation can never be frozen for long", () => {
  const cam = new Camera()
  cam.addHitstop(10)
  assert.ok(cam.hitstop <= 0.14, `hit-stop of ${cam.hitstop}s would read as a dropped frame`)
  cam.addHitstop(0.05)
  assert.equal(cam.hitstop, 0.14, "hit-stop must take the maximum, not accumulate")
})
