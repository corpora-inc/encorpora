# THE STEELYARD

> A weigh-house in the Dynawalla Bazaar. The chit says what the lot is; nobody
> adds it up for you. Put brass on until the beam just tips, and stamp it.

The Steelyard is the market's weighing room — one room off the spice lane, a beam
scale in the middle of it, a rack of brass weights on the wall and a barrow at the
door all day. Nothing gets sold in this market until it has been across that beam.
You are the one weighing.

The directory is still `counterweight`; the game is **THE STEELYARD**, renamed
away from `games/balance`'s COUNTERPOISE, which it was being confused with. Rank
30, S tier, in [`docs/catalog/ARCADE_CANON.md`](../../docs/catalog/ARCADE_CANON.md).
The canon entry calls it **the most unmashable design in the catalogue**, which is
a claim about behaviour, so
[`src/test/mash.test.ts`](src/test/mash.test.ts) settles it by playing rather than
by arguing.

## The loop

**The far pan** takes a lot off the barrow — two parcels, and the chit that came
with them says what each one is: `473 + 168`, drawn as a column, ruled underneath.
Nobody has added them up, and the total is never anywhere on the screen.

**The near pan** takes your brass. It stays where you left it between lots.

**The rack** is a weigh-house weight set — thousands, hundreds, tens, ones — each
pillar with a face that hangs one on and a face that takes one off. That is the
entire input vocabulary. There is no keypad.

**The brass has to just outweigh the goods.** `brass − goods = 1`. Strike
**STAMP** and the docket goes out with `brass − 1` written on it.

## Why one over, and not level

This is the part that is real, and it is why the rule is not an arbitrary game
rule you have to be told.

**A level beam is not a reading.** A beam sitting flat has not told you the goods
weigh 641 — it has told you it has not decided, and a scale that has not decided
is a scale you cannot write a number off. What you *can* trust is the lightest
brass that certainly tips it. Put 642 on and the beam comes down on the brass
side: now you know the goods are under 642, and 641 is the number that goes on the
docket.

So the three verdicts are the weighing itself, not a scoreboard:

| | what the beam is telling you |
|---|---|
| **GOOD WEIGHT** | one over — the smallest brass that tips it, so the goods are `brass − 1` |
| **SHORT** | the beam is still down on the goods' side. You have proved nothing about them |
| **OVER** | you piled on. All you have shown is that the goods are lighter than some big number, which is no use to anybody |

It also happens to be the whole anti-cheese device. A beam announces *level*, and
level is `margin === 0`, which is SHORT — so a player who hunts by watching which
way the beam leans converges on the one reading that loses. `mash.test.ts` proves
that by playing it, with all the time in the world (see below).

## Where the mathematics is

Two column operations per round, both native, neither of them a question anybody
asks out loud.

1. **Evaluate the chit.** `473 + 168` is 641, and nothing on the screen is going
   to tell you.
2. **Decompose the difference.** You have 500 on the pan and you need 642, so the
   round is asking for 142 — one hundred, four tens, two ones.

And the thing a child works out for themselves, because the rack has a take-off
face: **eight is not eight ones, it is ten less two**. Going from 613 to 621 the
naive path is eight blows on the ones pillar; the short path is one on the tens
and two off the ones. That is balanced base-ten notation, and
[`game/places.ts`](src/game/places.ts) is simultaneously the optimal player and
the definition of what the game is asking for.

What crosses to the host is `load − 1`: the weight the child *wrote on the
docket*. Play it right and that is the canonical value. Drop a carry and it is the
mal-rule output — exactly — so the misconception routes itself with no extra
wiring. The game never compares anything to an answer; the host judges.

## There is no clock on the answer

The founder played this game twice and reported the pacing twice:

1. *"this one is stressful and rushed and sometimes the timing is sort of
   impossible"* — against `timingForBout()`: 13.0 s at the first opponent, 1.1 s
   less at every one after, down to a 7.6 s floor, while the same counter
   escalated the arithmetic to four digits. At the house cadence table's p90 for a
   two-digit regrouping this pack's own solver bot held **0 of 78 rounds**.
2. *"the action is rushed by the timer going down"* — against the **fixed,
   item-derived window** that replaced it: `43 + 25` got 14.5 s, `5,001 − 2,798`
   got 47.0 s, monotone in the item, no counter anywhere near it, and proved
   sufficient by the same bot.

The second report is the one that mattered, because the window it was about was
generous. The length was never the problem. **A visible draining countdown is an
anxiety cue however much time it grants**, and what a child reads off it is not
"34 s left", it is "something is being taken away from me". `games/claim` reached
the same conclusion about its draining gate ring and wrote the rule down:

> A clock may never take anything away from a child.

So the round has no length, and the bar that drew it is gone. Two things went with
it:

* **The window.** There is no limit on a round at all. Look at the chit for a
  minute, hang a weight, look again, take it off again: nothing is counting.
* **The sag.** A pan left alone used to settle a unit after three seconds and
  another every 1.6 s. That fired on exactly the behaviour this game most wants —
  a child stopping halfway to check their column — and made the arithmetic they
  had just done wrong without telling them. Brass on a pan does not evaporate.

### What is left is an abandonment guard

[`game/guard.ts`](src/game/guard.ts). A pack left face-down on a windowsill must
not hold an item checked out of the host for ever, so one thing does still end a
round nobody is playing. It is defined by three properties, each the opposite of a
countdown:

1. **It measures silence, not the round.** Any hand on the rack — including a blow
   a still-swinging pillar refuses — puts it back to zero. It can only fire on a
   child who has stopped.
2. **It is derived from the item**, monotone non-decreasing in its difficulty.
3. **It is never drawn.** `guard.test.ts` scans every file in `render/` for the
   accessors that would let it be, and fails if one appears.

| item | old window (a cap on the round) | guard (silence, refilled by any blow) |
|---|---|---|
| `3 + 4` | 9.0 s | **30 s** |
| `43 + 25` | 14.5 s | **30 s** |
| `47 + 25` | 17.5 s | **30 s** |
| `473 + 168` | 28.3 s | **46 s** |
| `5,001 − 2,798` | 47.0 s | **80 s** |

It is `2 × comprehension(item)`, floored at 30 s. The doubling is the
point: the comprehension term is the house table's **p90**, and a limit sized at
the p90 fires on the child the p90 describes. There is no motor term any more,
because every blow in the plan refills the guard — it never has to cover
execution, only a pause.

The 30 s floor came off the bots, not off a hunch: at 20 s a solver that paused
thirty seconds before its first blow lapsed on **every one of three hundred
rounds**, and thirty seconds on a two-digit sum is already more than twice the
house p90. Being generous here is nearly free — nothing in the game depends on a
round ending promptly.

There is no upper clamp, because `columnsOf` already is one: anything wider than
the table is treated as the widest row the table has, so 80 s is the longest
silence anything can ask for. A `MAX_GUARD_SECONDS` constant was written and then
deleted — it could never bind, and the test that claimed to cover it was
`assert.ok(80000 <= 90000)`.

**Nothing the child did not declare is ever reported.** `Docket.declared` is the
whole test, and there are two ways for it to be false: the guard lapsed, and the
beam sheared. In both cases the brass on the pan is where they had *got to*, not
something they said, so the item is closed with the host's `skip`. Filing it as an
answer would invent a misconception out of the pan's incidental position and step
the ladder on it — a masher used to have 265 answers filed against it over twelve
seeds; it now has zero. Neither ending costs anything with the host; a shear still
costs a step on the day's run, because that is the anti-mash device.

### What replaced the bar on the screen

The gauge row is now the **strain gauge alone**, which is the opposite of a clock:
empty until the child's own hands fill it, draining while they think, entirely a
report on what they just did.

The stamp's rim **breathes** while a round is open — a slow, wide pulse that says
the counter is holding still and waiting for you. It is a sine of the wall clock:
it does not shrink, it does not change colour as time passes, and it looks the same
in the fortieth second of a round as in the first.
[`scene.test.ts`](src/test/scene.test.ts) asserts the strongest form of the claim
— that the frame drawn two seconds into a round and the frame drawn forty seconds
into the same round are the same frame, call for call.

## Why mashing loses

A steelyard is a bar of steel. Hang a weight on it and it rings, and a bar struck
again while it is still ringing rings harder, because the second blow arrives in
phase with the first. Keep that up and the steel does not get loud — it shears.

So [`game/strain.ts`](src/game/strain.ts) charges every blow by **when it lands**.
A blow after the ring has died costs 2. A blow straight on top of the last one
costs 13. Strain bleeds out at 6 a second and the beam shears at 34. **This is the
one pressure left in the game, and it answers to the child's hands rather than to
a timer.**

| Player | What happens |
|---|---|
| Hits everything as fast as a thumb moves | Shears in about a fifth of a second, every round, forever |
| Hits one plate fast | Same |
| Hits one plate slowly, under the resonance window | Never shears — and never gets anywhere either: a pan walking in ones never stops at one over, because nothing about walking it knows where that is |
| Hunts by watching which way the beam leans | A beam announces *level*, and level is SHORT |
| Does the arithmetic | Ten deliberate blows, a quarter-second apart, peaks at about a third of the shear limit |

Every one of those rows is now measured **with no round clock at all**, which
makes this a stronger result than it was: the beam-watcher can probe for as long as
it likes and still clears zero scales over twelve seeds, because the rule was
doing that work and the clock was only hiding it.

The last row is the one that makes the rest mean anything, so `mash.test.ts`
asserts it too: over twelve seeds a solver clears six or more scales and shears
the beam never, while every masher, every hammer on every one of the eight faces,
and the beam-watcher clear **zero**. And a bot that strikes once every fifteen
seconds — slower than the entire old window for `43 + 25` — plays for a quarter of
an hour without a single round being taken away from it.

## Escalation

The scale gets heavier by the arithmetic and by nothing else. There is no counter
in any duration in the game.

[`game/ladder.ts`](src/game/ladder.ts) names a rung on every single lot —
`next({ difficulty, maxDifficulty })`. The opening rung is the bottom of the
curriculum, which is what "it starts way too hard" was: the game used to ask for
nothing and take whatever the scheduler had stocked. It climbs one rung per scale
cleared — five net good weights, achievement and never a clock — and comes back
down one when a barrow goes back. `raiseFloor` is deliberately not called: a
permanent floor is exactly what would stop a struggling child getting easier work
again.

## The beam

[`sim/beam.ts`](src/sim/beam.ts) is a real spring and damper, and its resting
angle is a *saturating* function of the margin: fine gradation within a few units
of level, hard against its stop past that. So it confirms a weighing and refuses
to hand one over — there is no magnitude information out where a three-digit
number lives.

A bowed-metal drone tracks the tilt, so the beam is audible as well as visible and
a child can find the tipping point with their eyes on the rack. The plates are
pitched by place: the ones plate is a bright tick, the thousands a low clang. Place
value is a thing you can hear here.

**Reduced motion is a branch, not a degradation.** The beam still moves, because
the beam moving *is* the information; it is critically damped instead, so it
travels to its reading and stops rather than ringing its way there. Same reading,
same reach — every duration in `TIMING_REDUCED` is identical, and the stamp's
breath is simply held still, which costs nobody anything because there is no
information in a pulse.

Your brass stays where you left it between lots, which is what makes each round
only the *difference*. The one exception is when the ladder moves out from under
it: a pan sitting on 8,367 when the next chit reads `43 + 25` gets a fresh set laid
out near the new magnitude rather than costing a whole calm round of unwinding.

## The arithmetic it is served

The host serves from the curriculum's `add` domain — the only active one, seven
live rows, all whole-number column addition and subtraction — and reveals the
canonical value, which becomes the weight of the lot. `items.reveal` is
load-bearing: without it the adapter drops every item and the pack serves nothing
at all, silently.

[`stubHost.ts`](src/stubHost.ts) is that runtime, offline: the same ladder, exact
integer arithmetic throughout, and distractors that are real mal-rule outputs
ported from
[`malrules/columnOp.ts`](../../packs/shared/curriculum/src/malrules/columnOp.ts)
with their `applies()` guards intact.

## When a barrow goes back

Nothing is taken. The day's run goes back to level and the same scale carries on,
no harder than before — ADR-0009, stakes without loss — and the yard asks the host
for a lighter rung for a while, which is relief rather than punishment.
`transition` is called at exactly one place in this game, when a scale is cleared,
and never anywhere near a setback.

## Running it

```
npm install
npm run dev        # the standalone harness on :4327, stub host, no runtime needed
npm test           # the rules, the guard, the screen, the ladder, the strain, the mashers
npm run tsc
npm run build:pack # the installable pack
```

In the dev harness: `Q/A` ±1000, `W/S` ±100, `E/D` ±10, `R/F` ±1, space stamps the
docket, and `p` raises and lowers a sheet — the same call the host makes.
