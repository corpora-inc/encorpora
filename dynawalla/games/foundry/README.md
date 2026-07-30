# THE GRAPPLE FOUNDRY

> Four seconds, two pedals, one exact total, and a referee who is already
> counting.

A wrestling pin you escape with arithmetic. Rank 4, S tier, in
[`docs/catalog/ARCADE_CANON.md`](../../docs/catalog/ARCADE_CANON.md), after
*Pro Wrestling / WWF Superstars* (1986).

## The loop

You are on your back with a leverage bar across your chest. Above the ring, a
slate board carries a sum. Two pedals hang off the frame — one light, one heavy,
each stamped with a whole number — and every tap drops that plate's weight onto
the bar.

Work out what the board is asking, build that **exact** number out of the two
plates, and the bar tips and you kick out.

Three ways the fall ends badly, and each of them is a different piece of
mathematics:

| | what happened | why it is the right punishment |
|---|---|---|
| **TOO MUCH** | the bar went one over | mashing loses instantly, so the escape has to be planned before the first tap |
| **NO WAY OUT** | the remainder cannot be made from these two plates | the coin problem's real structure — `7+7+7` on a target of 24 leaves three, and nothing makes three out of fours and sevens |
| **THREE** | the count ran out | the child's time is measured, and here it is also spent |

And one more, which is the point of the whole thing: **WAVED OFF**. Land the bar
on the exact value a broken procedure produces and the hall comes up, half the
building thinks you are out, and the referee waves it off.

Below the target that costs count and nothing else — the bar passes through, the
fall goes on, and escaping *after* one is the biggest reaction in the game.
Above it the bar can only arrive by going over, so the fall is already lost when
it lands; the child is still told which number was refused rather than just that
something was. That second case is the only one subtraction has, because every
mal-rule for a difference comes out *larger* than the difference: `52 − 27 = 25`,
and 35 is what you write if you take the smaller digit from the larger in each
column.

The three procedures are ported from
[`malrules/columnOp.ts`](../../packs/shared/curriculum/src/malrules/columnOp.ts)
along with their `applies()` guards, so a rule that would coincide with the
correct procedure emits nothing at all.

## Where the arithmetic comes from

The host serves an item from the curriculum's `add` domain — the only active one,
seven live rows, all whole-number column addition and subtraction. Its canonical
value becomes the target. **The answer is never shown.** The board carries
`4,003 − 87` and the bar has to reach 3,916, so a fall asks two questions back to
back: evaluate the column sum, then decompose it.

The plates themselves are the game's own. `game/plates.ts` cuts a pair for
whatever target it is handed, preferring a round heavy plate, a single-digit
light one, coprime denominations, an escape around five taps, and — importantly —
a pair with more than one way out, because 24 from 4s and 7s has exactly one
escape and that is a cliff rather than a puzzle. Nothing about the decomposition
is reported: it is arithmetic the child performs with their thumbs, not a
question anybody asked.

The count is a function of the **work**, never of the run. A longer sum and a
longer decomposition both buy more time; winning six falls in a row buys none.
A single-digit sum with a short escape lands at almost exactly the canon's four
seconds; a four-digit borrow gets nearly eight.

## Running it

```sh
npm install
npm run dev          # http://127.0.0.1:4321 — playable against the stub host
npm test             # the rules and the surface; 111 cases, no Math.random
npm run tsc
npm run build:pack   # → dist-pack/, what a tablet installs
```

Dev-harness query parameters: `?seed=123` replays a card, `?level=7` pins the
ladder at a rung, `?reduced=1` forces the reduced-motion branch.

Controls are the whole screen: left half is the light plate, right half the
heavy one. `A`/`D` and the arrow keys work too, and `M` mutes.

## Layout

```
src/
  contract.ts      the Host interface — byte-identical in shape across games
  stubHost.ts      seeded column add/sub with real mal-rule distractors
  mount.ts         surface, loop, input and juice. Decides nothing.
  manual.ts        how-to-play, with every term this game invents defined at
                   first use — a child who does not know what a "fall" is
                   cannot use any rule that mentions one
  audio.ts         procedural Web Audio; silence is a cue, not an absence
  core/            rng · feel (screenshake, hitstop, flash) · quality tiers
  game/
    plates.ts      the two-denomination exact-target problem
    bout.ts        the rules: lockup → pin → kickout | pinfall
    reaction.ts    tier picker, with no run-length input and a test that says so
    save.ts        the belt, monotone, and safe on an opaque origin
  render/          layout · crowd · ring · decals · particles · hud · palette
  test/
    rig.ts         a canvas that records marks in screen space and throws
                   exactly where the 2D spec throws
```

`game/` holds every rule and every integer. `render/` draws state and judges
nothing. That split is why the tests are about the game and not about pixels.

The one thing `render/` still has to get right is that its colour helpers
compose. `heatColor` *is* `mix`, and six call sites hand its output straight back
to `withAlpha` or `mix`, so the output form is a rule: hex in, hex out. It was
`rgb(...)` once, `withAlpha` parsed hex, and the first kick-out of a session put
`rgba(NaN,11,37,0.3)` into a gradient stop — which throws, inside `drawMat`,
before the wrestlers and the referee and the whole HUD. `frame()` re-arms its rAF
on its first line, so the loop stayed alive and repainted the crowd, the far posts
and the mat and nothing else, over and over, with the audio still running.
`palette.test.ts` asserts the property; `test/rig.ts` is why a bout test can fail
for a colour now.
