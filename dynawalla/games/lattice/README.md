# THE LATTICE

A twin-stick arena strung on a mass-spring grid that tears and re-knits.

Composite **husks** drift on the sheet. A shot cracks one along a factor pair —
72 becomes 8 and 9, the 8 becomes 2 and 4, the 4 becomes 2 and 2 — and **a shot
at a prime is refused**, because a prime does not go. So the field grinds itself
down into primes, and primes are what the ship sweeps. What is swept shows in a
**factor tile bar**: `2·2·3` with a running 12 beside it, changing the instant a
mote is taken.

Hanging in the middle of it is a **resonator** with a problem on its face, and
it opens for exactly one thing.

*After* Geometry Wars: Retro Evolved 2 (2005) — rank 2, S tier, in
`docs/catalog/ARCADE_CANON.md`.

---

## The two layers, and which one is the learning

The canon is explicit about this pack, and it is worth repeating in full:

> Honest caveat: the passive layer is absorption, not reasoning; the
> target-product resonance is where the thinking is and it must ship on.

### The passive layer — absorption

Shooting husks apart and sweeping the primes up. A child sees `2·2·3` become 12
hundreds of times in a sitting, with a sound and a colour attached, and never
answers a question to do it. That is worth having. It is not reasoning: nothing
is chosen, and a child who does it perfectly has not decided anything.

It ships as the *default*. You can fly the arena, shoot everything and sweep,
and the game is a game.

### The target-product resonance — the thinking, and it shipped

The resonator carries a problem the curriculum drew — `47 + 25`. It opens for a
hold whose **primes multiply to the answer**, and nothing else. To open it a
child has to:

1. work out that `47 + 25` is 72;
2. decide *which* primes on the field multiply to 72 — 2·2·2·3·3;
3. crack the husks that are holding those primes, and no others;
4. sweep exactly them, and **nothing else**, because the hold is exact.

Sweeping a stray 5 on the way past is a real cost. It does not scold and it does
not end anything — but the hold now reads 360 and the resonator does not
resonate. The way out is to **tap your own tile bar**, which throws the hold back
onto the field as motes, and start the hold again. Nothing the child worked for
is ever destroyed.

Flying into the resonator asserts `product(hold)`. That value — an exact integer
the child assembled on purpose — is what goes to the host, and the host judges
it. The game never decides whether an answer was right.

**Primeness is a wall.** When the answer is prime, no amount of sweeping smaller
numbers reaches it: the only hold that opens a prime `p` is the single mote `p`,
which has to be found drifting on the field. It is the same property `foundry
street` relies on, and it is asserted exhaustively in `resonance.test.ts`.

---

## What is reported, and what is the game's own mathematics

Following the `slice` precedent. Only the `add` curriculum domain is active
(`alg`, `div`, `frac`, `mul`, `ns` are all `draft`), and `covers` is a request
rather than an instruction — the host serves whole-number column arithmetic
regardless. So:

* **Reported:** the product the child asserted at the resonator, as a string,
  against the question id the resonator was carrying. Exact, integer, and
  judgeable by the host with no interpretation. Once per question — a refusal
  spends the id, and the resonator then stays as a goal the child can still
  open.
* **Not reported:** everything about the factoring. Cracking 72 into 8 and 9 is
  arithmetic the child performs with a trigger, not a question anybody asked.

`pack.json` declares the seven **active** `dw.add.*` skills, each checked by hand
against `packs/shared/curriculum/src/graph/domains/add.ts`. There is deliberately
no `dw.mul.*` row: the multiplication domain is 100% `draft`, and declaring one
would imply coverage the curriculum cannot serve.

Distractors are load-bearing rather than decorative. When a resonator is armed,
the field is seeded with the primes of the answer **plus** the extra primes one
of the host's mal-rule answers needs — so a child who dropped a carry can
assemble their own mistake, and the misconception routes back to the host with
no extra wiring.

---

## Controls

Twin-stick, on every input a child might have. Tablet and desktop are equal
targets.

| | Move | Aim / fire | Drop the hold |
|---|---|---|---|
| Touch | left thumb, anywhere on the left half | right thumb | tap the tile bar |
| Keyboard | `WASD` | arrow keys, or `space` to fire straight ahead | `Escape` |
| Mouse | `WASD` | the cursor aims, the button fires | tap the tile bar |

---

## The frame this game does not own

The host paints an exit control in the top-LEFT corner and the shared
how-to-play button in the top-RIGHT, over every pack, and the pack declares
`viewport-fit=cover`, which opts the canvas into the notch and the home
indicator. A canvas cannot read `env()`.

So the world — the sheet, the husks, the motes, the ship, the resonator — still
uses every pixel, and the **chrome** is laid out by `render/hud.ts` inside the
safe rectangle from `packs/shared/game-chrome`, starting below the two 44px
corners. Chrome overlays rather than reserving a band: reserving one costs 67px,
which is 12% of a 568px phone.

How to play comes from the same shared module, so it looks and dismisses the
same way in every game. It is reachable **during** play, because the moment a
child needs the rules is never the title screen — and opening it holds the
world, on the same guards the host's sheet uses.

---

## Reduced motion is a branch, not a switch

Turning the sheet off would delete the only cue that says *where a number came
apart*. So the reduced branch keeps the whole simulation and changes its
character: the springs are stiff, the damping is at critical, the amplitude
ceiling is about a fifth, and there is no screen shake. The sheet dents and
returns in about a quarter of a second with no travelling wave and no ringing. A
strut still tears — it is drawn as a strut that has gone dark rather than as one
that has been flung.

`grid.test.ts` asserts all of it: the reduced branch must **move** (the test
fails if someone "fixes" it by switching the simulation off), must travel less
than half as far, and must turn around at most once, while the full branch rings.

---

## Layout

```
src/
  contract.ts     the Host↔game contract; mount(el, host) → { unmount, pause, resume }
  stubHost.ts     seeded, deterministic, exact-integer, mal-rule distractors
  main.ts         the dev harness entry (npm run dev); P raises a fake host sheet
  pack.ts         the pack entry; subscribes pause/resume, dispose
  mount.ts        canvas, clock, twin-stick input, event wiring
  core/rng.ts     mulberry32
  game/factor.ts     primes, splitting, husking — exact integers only
  game/resonance.ts  the rule the whole learning claim rests on
  game/bank.ts       the hold, and the factor tile bar
  game/arena.ts      the rules: husks, motes, the ship, the resonator
  game/best.ts       the longest chain, guarded for a pack frame
  sim/grid.ts     the mass-spring sheet that tears and re-knits
  render/         palette, scene, sparks
  render/hud.ts   where the chrome may be drawn: the safe area, minus two corners
  audio/audio.ts  asset-free Web Audio, C5–C6 pentatonic
  test/           94 tests: rules, wiring, and where the chrome lands
```

## Tests

```
npm test        94 tests
npm run tsc     0 errors
npm run build   the library build
npm run build:pack   the pack build → dist-pack/
```

The ones that matter:

* `resonance.test.ts` — a target is cleared **only** by a genuine prime
  factorisation of it (exhaustive over every multiset of small primes to six
  tiles against every target to 200); a prime target cannot be assembled from
  smaller factors (exhaustive); an empty hold asserts nothing.
* `bank.test.ts` — the tile bar is a true factorisation of the value beside it
  after **every** operation on **every** path, over a four-thousand-step seeded
  sitting.
* `factor.test.ts` — splitting conserves the product exactly for every composite
  under 2000; grinding a husk to exhaustion yields exactly its prime
  factorisation.
* `arena.test.ts` — the field can always supply the answer's factorisation; one
  question, one report; a refusal never raises a stopping point; a released mote
  is thrown clear rather than instantly re-swept.
* `pause.test.ts` — **verified to fail with every pause guard removed**, not by
  reading them.
* `loop.test.ts` — a scripted child plays the real arena through the real
  physics and opens resonators. The failure it catches is silent and total: a
  game where nothing throws and nothing can be beaten.
* `grid.test.ts` — no NaN, always returns to rest, always knits back, and the
  reduced-motion branch is a branch.
* `chrome.test.ts` — drives the real `Scene.draw` against a recording context at
  five viewports, with and without a notch, and asserts that every word the
  child reads is inside the safe area and clear of the host's two 44px corners,
  and that the tile bar — which is a touch target, because tapping it drops the
  hold — is reachable. **Verified to fail with the layout reverted**, not by
  reading it.
* `mount.test.ts` — the shell, including the one that got away: flying into the
  resonator asserts the hold. `Arena.enter` was covered exhaustively by the
  rules tests and **never called by the shell**, so the entire reasoning layer
  was unreachable in the shipped game while every test was green. It also
  asserts that reading the manual holds the world and that closing it lets go,
  because a manual that leaves a twin-stick arena running is a manual a child
  cannot afford to open.
