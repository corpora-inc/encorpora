# FOUNDRY STREET

*after Final Fight (1989) — `ARCADE_CANON.md` rank 13, S tier*

The night shift comes up the street in a mob. You have two verbs, and both of
them are claims about a number.

**STRIKE a stud** — *"this number goes into them."* If it does, the crack runs
the length of the block at 2400 px/s and the mob comes apart into that many to a
rank: the same bodies, rearranged into a rectangle the child made. If it does
not, the crack rings off. The mob stands split into groups with the remainder
left over, and closes back up.

**SWING** — *"they are solid."* Fists work on a rank whose size is prime and
bounce off one that is not, because a composite rank has something to hold on to
and a prime rank has nothing.

## Why the mathematics is the mechanic

Nobody is told what a prime is.

A mob of thirteen refuses **every stud on the bar** — and the bar is complete,
so "nothing on the bar works" means "nothing works". Then it goes down in one
punch. The two rules are the same rule seen from both sides: *what will not
break is the thing you can hit.* Primeness is a wall you walk into, not a fact
you are given.

The rectangle is the array model, and the child builds it. Striking 3 at twelve
makes four ranks of three, in front of them, out of the same twelve people.
Knocking those ranks down one at a time is `3 + 3 + 3 + 3`, drawn.

The **hum** is the last piece: a mob drones at `humHz(n) = 264 · n^(−1/3)`,
which is the design entry's *"block hum pitch is log of the number"* written as
a power law. Every doubling of the crowd drops it exactly four semitones, so
halving a mob sounds like the same move whether it was twenty-four going to
twelve or four going to two. The child hears the number get smaller a frame
before the crack finishes crossing the street.

The fastest route through a wave is **strike the largest prime that goes into
them** — `minimumTaps(n) = 1 + n / largestPrimeFactor(n)`, which `factor.test.ts`
checks against a breadth-first search over real game states rather than against
the argument in the comment.

## The stake has no clock in it

The mob leans on you when you are wrong (`push.ts`) and gives ground when you
put a rank down. Six slips with no answer in between and it shoves you back a
block — the wave restarts with the smallest prime factor lit on the bar, and
**nothing built is taken**. Standing still and reading the mob costs exactly
nothing, because a child who is thinking must never be losing.

## What the host judges

The **shutter** between waves, and only that. A problem chalked on steel, four
rivets carrying the canonical answer and the host's mal-rule outputs, and the
rivet the child strikes is reported as-is. The game never marks it.

The factoring is the game's own arithmetic and is not reported — only `add` has
active curriculum rows, so a mob coming apart into ranks is not a question
anybody asked. `covers.skills` claims the shutter, and every id on it is an
`active` row of `dw.add`.

## Layout

| | |
|---|---|
| `src/game/factor.ts` | primality, seams, the optimal route. Exact integers only. |
| `src/game/crowd.ts` | `ranks × size`, and the two verbs. Pure. |
| `src/game/street.ts` | the phase machine, the clock, and the pause guards. |
| `src/game/shutter.ts` | the plate, and the one report per item. |
| `src/game/push.ts` | the stake. No durations anywhere in it. |
| `src/game/energy.ts` | reaction tiers; `energy(SLIP) < energy(SEAT)`. |
| `src/render/scene.ts` | canvas 2D. Draws the rectangles input reads. |
| `src/audio/tone.ts` | the hum law, as a pure function with a test. |

```
npm run dev            the game, wired to the stub host
npm run dev -- --open  ?seed=1&reduced=1&pause=1
npm test               97 tests, no canvas, no rAF, no clock
npm run build:pack     the installable pack
```

`?pause=1` puts a sheet over the frame for two seconds every time the game
reports a stopping point, which is what a real host does after a `transition`.
It is there because that is the state the pause guards exist for.
