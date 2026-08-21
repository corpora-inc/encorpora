# THE COIL OF NINETY-SIX

**An articulated brass coil is a number written in place value. Shear the lit
number off it, and the machine does the arithmetic in front of you.**

After *Centipede* (1980): a segmented thing descends a lane, one shot splits it
in two, and the debris you leave behind is what makes the board hard.

```bash
npm install
npm run dev        # http://127.0.0.1:4396 — playable standalone, stub Host included
npm test           # 79 tests
npm run tsc
npm run build:pack # what installs on a tablet: pack.html only, no stub Host
```

`?seed=7` pins the question stream, `?rung=0..5` pins the stub's difficulty,
`?reduced=1` forces the reduced-motion branch.

---

## The coil

A link is a place. A **bead** is one, a ribbed **drum** is ten, a pierced
**ring** is a hundred, a notched **tower** is a thousand, and each place above
that adds a notch. A coil is the links a number is made of, biggest first — so
the coil *is* the numeral, with the positions made physical instead of implied.

```
 72  →  ▮▮▮▮▮▮▮ ● ●              seven tens and two ones
403  →  ◎◎◎◎ ● ● ●               four hundreds and three ones — and no tens link at all
```

A zero digit is the **absence of a link**. That is why borrowing across a zero
is something a child can see rather than a rule they are told.

## The loop

The wall carves the problem the curriculum served and lights one operand. The
whole instruction is four words: **shear off the lit number.**

| the wall says | the coil is | you shear off | what the machine does |
|---|---|---|---|
| `72 − 25` | **72**, the minuend | `25` | the piece is carried away, and **what crawls on is 47** |
| `47 + 25` | stock — a coil of ninety-six | `25` | the piece is **welded onto an ingot of 47**, and the ingot reads 101 |

You never subtract and you never add. You regroup and you take, and the answer
comes out of the machine — which is the number reported to the host.

**The shear makes one cut, at one joint, and takes the tail.** That is the whole
of the difficulty, and it is exact:

> Twenty-five is two tens and five ones. A coil of seventy-two ends in *two*
> ones, so there is no joint anywhere on it worth twenty-five. Crack a ten open
> — right where the jaws are — and ten ones drop into the chain between the tens
> you keep and the tens you give away. Now walk the cut back through them.

That is the borrow. It is not a rule about digits and there is no other way to
do it.

## Where the math lives

**Native, and impossible to fake.** A cut at joint `k` is a partition
`N = k + (N − k)`, and the number the host is judged against is the *length of a
piece of brass*, computed by counting links. There is no keypad, no multiple
choice, and nothing the game can round.

Three things fall out of that, and each is a test:

1. **A wrong cut produces the number that cut is worth.** Shearing two tens and
   the two loose ones off seventy-two — the greedy take that skips the borrow —
   leaves fifty, and fifty is reported. It is the smaller-from-larger family of
   error, *performed* rather than typed.
2. **Every claim is a whole number.** `place.ts` is integer arithmetic on exact
   powers of ten from beginning to end; there is no float anywhere in an answer
   or a comparison.
3. **Breaking never changes what you are holding.** Cracking the link at the
   jaws leaves `suffixValue(links, cut)` untouched. A break buys resolution,
   never a different amount — so it is safe to explore.

### The one place the coil is stricter than the column

`64 − 31` regroups no column, and it still costs one break: three tens and one
one cannot be the *end* of a chain that finishes with four ones. `breaksNeeded`
measures how much change a demand needs, which is at least the column
algorithm's regroupings and sometimes one more. That is deliberate — cracking a
ten to make change is the physical act that regrouping is a rule *about*.

## The punishment is your own floor

There is no timer, no lamp, no buzzer and no life. Aiming is free, cracking is
free, and hesitating is free — punishing a child for thinking is the failure
mode this whole programme exists to avoid.

What a careless cut costs is **space**:

- A piece that is not the demand does not fit the wall. It falls in the lane as
  **slag**, and each lump takes two cells out of a lane that holds ninety-six.
- A coil longer than the cells it has left is **buried at the mouth**,
  head-first — which takes away exactly the big links you borrow from.
- Every break makes the coil nine links longer. **Crack everything open and you
  bury your own coil.**
- An **exact cut smashes two lumps** on its way to the wall. Play at half
  accuracy and the lane never gets ahead of you.

The escape is the **furnace**: melt every lump, at the cost of feeding the
current coil to it. Nothing is reported, nothing is recorded, and a choked lane
is a decision rather than a dead end.

And the wall itself **never regresses**. A miss costs slag; it never takes a
brick back out.

## What the host serves, and what this does with it

Only the `add` domain is active, so the stream is column addition and
subtraction — which is exactly what this game is. `round.ts` reads
`Item.prompt` (the `top ± bottom` shape `dynawalla-app/src/packs/items.ts`
emits, U+2212 included) together with the canonical answer from
`items.reveal`:

- `a − b = c`, consistent → **take**: coil `a`, demand `b`, claim `a − severed`.
- `a + b = c`, consistent → **fill**: coil `stockFor(b)`, cradle `a`,
  claim `a + severed`.
- anything else with a whole-number answer → **fill** with an empty cradle and
  the answer itself as the demand. A pack must never quietly play a different
  problem from the one the curriculum served, so an inconsistent prompt loses to
  the canonical answer.
- a fraction, a decimal, an empty pool → **refused**, never approximated. The
  item is skipped, the host is asked again, and nothing is recorded against a
  child for a question the pack declined to draw.

`items.reveal` is declared and is not optional: without it the shared adapter's
pool never fills and the pack serves nothing at all, silently.

## The register

**The forge alley of the bazaar, after dark.** Carved stone, brass that has been
handled, lapis on the hundreds, a girih lattice that is the wall the bricks are
laid into rather than wallpaper, and exactly one cold light — the recess.
Nothing glows for encouragement.

Every place is a **silhouette before it is a colour**, so the coil reads for a
colour-blind child by construction. A numeral is never coloured information;
what is lit on the wall is the *demand*, and it is lit by light, not by hue.

**Reduced motion is a branch**: the whip, the particles and the idle pulses are
pinned at rest and the flight collapses to 180 ms, while every readable state
stays exactly where it was.

**A slip is smaller than a seat**, on duration, gain, particle count and
animated elements, and `reactions.test.ts` asserts it. A wrong cut is a dull
lump of metal landing on stone and a quarter-second of oxide across the lane —
never a flash, never a shake, never a sound of refusal.

## Layout

```
src/game/place.ts      the coil as arithmetic: break, fuse, suffix, change
src/game/round.ts      a served item, read as a cut
src/game/board.ts      the lane: slag, burial, the jaws, the furnace
src/game/session.ts    rounds, the wall, one report per item
src/game/reactions.ts  the tier table and the two invariants
src/render/            layout (pure), scene, particles, palette
src/audio/audio.ts     procedural WebAudio, including the sonified partition
src/stubHost.ts        seeded column arithmetic with executable mal-rules
```

The partition is **heard** as well as carved: when the jaws close, the piece
that comes away plays as a rising note-run and the piece that stays plays as a
falling one, one note per link, pitched by place. Nothing in the game depends on
hearing it.
