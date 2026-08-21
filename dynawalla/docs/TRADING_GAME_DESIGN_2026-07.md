# CARAVANSERAI — THE GAVEL becomes a trading game

**Status:** design, awaiting founder ratification. No game code changed by this document.
**Subject:** `dynawalla/games/gavel` (`dynawalla.gavel`, "THE GAVEL", 18 skills, the most
skill-covering pack in the fleet).
**Date:** 2026-07-30.

---

## 0. The brief

> *"'The gavel' - decent concept. ... we need a juicy, satisfying animation that can be
> addictive in itself. The gavel has potential with the items, the inventory ... maybe even
> a bit of a role-playing feel .. maybe the broker gives prices at different times instead
> of always putting a price down .. or that could be the 'liquidate now' price .. so you
> could make money right away or you could wait until the broker gives you a better price.
> This has potential as one of those early text games or BBS games .. maybe you go to the
> auction or the broker separately too and can keep stuff in your inventory .. like a
> peddler ... maybe there is more economic activity possible and it's like a more
> full-fledged text-based role-playing game potential .. you can go to different cities
> maybe even where prices tend to be different .. buy cheap cars in Mexico and sell them in
> Toronto ;) .. not that specifically .. but .. I think this game has more potential than we
> have implemented so far .. the auction action could just be one facet of a larger buy/sell
> role-playing game. Right now it's not fun enough though .. I think we should lean into the
> items (make them much cooler) and then have an inventory to go through and then different
> brokers and economic actors to work with ... let's expand on The Gavel to make it a real
> game with some fun where the current auction activity is just one thing."*

And separately: *"'the gavel' isn't clicking with me though."*

And the earlier idea this game was built from, which is still the best single sentence
anyone has written about it:

> *"with bidders 12+5, 3x5, 8x1, 15-2 and a resale of ~20, we should bid 16 and gain 4. If
> we bid over 20 we lose money, if we bid 15 or under we don't do anything."*

---

## 1. What THE GAVEL already got right

Read `games/gavel/src/game/auction.ts` and `lot.ts` before anything else. The engineering is
not the problem. Three things in there are worth building the whole trading game on:

**A price is never a numeral.** A rival holds up `12 + 5`, not `17`. The child cannot read
a price without producing it. That single decision is the difference between an economy
game and a shopping app with a quiz stapled to it, and **it generalises to every number in
a trading world**: rates, fees, weights, totals, margins.

**The reward is a difference, not a magnitude.** Coins are `offer − bid`, drawn from a fixed
band (`MIN_MARGIN = 2` … `MAX_MARGIN = 9`, `ladder.ts:87`), and that band deliberately does
*not* narrow as the run climbs. This is why THE GAVEL does not have FORGE's disease — see
§3, L2. It is already correct and it must stay correct.

**Precision pays a multiple, not a hair.** `KEEN_MULTIPLIER = 2` exists because without it a
child who never worked out a single sum could bid one under the broker's offer and take a
coin every time. `test/bots.test.ts` measures that an arithmetic-free bot earns between a
third and a ninth of a computing bot. **That test is the most valuable artefact in the
pack** and every new venue in this design owes one.

## 2. What is missing, stated plainly

One verb. One screen. Nothing you own. No consequence that outlives a lot.

- A lot you bought above the offer increments `storeroom` (`auction.ts:213`) and then does
  nothing forever. You cannot look at it, carry it, or sell it later.
- The broker is a number, not a person, and he always says the same kind of thing.
- The sixteen lot names (`lot.ts:236`) are strings. There is no picture of a singing ewer.
- There is exactly one decision shape, repeated: *max, plus one, under the offer*. It is a
  good decision shape. It is not a game.

The founder's word for the result is "not fun enough", and the metric that word is
measuring is [voluntary time-on-task](../../CLAUDE.md). Nobody opens this twice.

## 3. The thesis

**This is the fleet's natural home for the hardest end of the ladder.** Rate, ratio,
percent, unit cost and multi-step comparison are the arithmetic that resists gamification
everywhere else, because in every other genre they arrive as word problems. In a trading
game they are not word problems — **they are the interface**. `4 the mark × 5 marks − 6
road` is not a question about a merchant; it is the thing you do to decide whether to walk.

That is the argument for building this instead of another arcade cabinet. Every other pack
in the fleet asks a question and pays for the answer. This one makes the answer *the reason
you wanted to know*.

The second thesis is the frame. `dynawalla/bazaar/` already ships ten named quarters —
**weighers, money-changers, tilers, rope-walk, astrolabists, waterworks, dyers,
kite-makers, clockmakers, millers** (`bazaar/src/world/quarters.ts`), each with a ward
colour, a finial and a fold. The founder's "different cities where prices tend to be
different" is already built, named and coloured. **This is the only game in the fleet whose
map is the frame itself**, and the Money-Changers' quarter is, unavoidably, where the
fractions broker lives.

---

## 4. The five laws

These are the anti-wrapper guarantees. An economy game's failure mode is that the
arithmetic becomes a toll gate between shopping decisions, and each of these exists to make
that impossible.

### L1 — No price is ever printed as a numeral

Every number the child needs to make a decision is the answer to a visible expression. The
only bare numerals in the game are (a) the purse, which is *their* money, and (b) coins
being counted out in front of them, which they watched arrive.

A rate board reads `brass 4 the mark`, and the mark count on the item reads `3 × 2` — so
"what is this worth here" is a sum whichever way you come at it.

### L2 — The game controls the DIFFERENCE, never the level

**This is the FORGE trap and it will kill this design if it is not designed against.**
`ADAPTATION_AUDIT_2026-07.md`: FORGE pays out the answer's numeric value against fixed
exponential costs, so dropping `473 + 168` to `2 + 3` is a ~128× income cut — *the moment a
child struggles, the number they are watching stops growing*. The pack inverts its own
brief on the first ease-down.

So: **the assembler picks weights and rates such that the achievable spread lands in a fixed
coin band (2–12 coins), independent of the rung.** Exactly as `marginFor` does today. Prices
may be large or small; **profit is band-controlled and rung-independent**, and a child who
eases down still earns the same money for the same quality of thinking.

A test enforces it: halving the magnitude of the rung's answers must not move the median
coins-per-lot by more than 15%.

### L3 — No hidden distributions

Certainty versus expected value is the founder's specific idea and it is the best decision
in the design — but a decision between a known number and a *gamble* is not arithmetic, it
is a coin flip with extra steps, and a child cannot reason their way to profit through it.

So **every broker's rule is printed on his stall**, and every rate board is fully visible
before you commit. "Wait for a better price" is implemented as *a larger price you can see,
which costs a road fee and a leg of work to reach*. The child computes both branches
exactly and picks. Waiting is not a gamble; it is a subtraction.

The one permitted uncertainty is **upside-only and never priced**: whether a Collector is
in the next quarter at all. When one appears, his offer is exact. Nothing in this game ever
takes coins away from a child for a thing they could not have computed.

### L4 — The blind-bot gate

For **every** venue, before it ships: a bot that plays it without doing arithmetic must
earn **≤ 1/3** of a computing bot, at every intensity, on every seed. The blind strategies
to beat are named per venue in §5. This is `test/bots.test.ts`'s existing standard applied
to each new surface; a venue that cannot pass it is not a venue, it is a menu.

### L5 — Patience is absolute, speed is paid in coins only

- **No clock, anywhere.** `advance()` already returns immediately while the child is
  deciding (`auction.ts:481`). Every new venue inherits that.
- **A miss holds until the child taps.** Not a long timer — *no timer*. When the asserted
  arithmetic was wrong, the completed sum stays on the slate until dismissed. This strictly
  extends MONUMENT's `revealDwell(streak)` (`games/stack/src/game/tuning.ts:171`), and it is
  the strongest available reading of the founder's rule that a child must be able to STUDY a
  revealed answer. A correct assertion keeps today's patient, skippable
  `revealHoldMs` (floor `MIN_REVEAL_MS = 900`).
- **Speed is rewarded in coins and never in content.** A brisk day may pay a bonus. The
  learner model must never see latency spent: `observe()` continues to refuse `seconds`
  (`ladder.ts:129`, whose comment — *"a bonus that changes the content of the next question
  is a clock wearing a different hat"* — is the reason). A parent switch disabling
  latency-derived rewards must still leave the game whole.
- **Nothing is ever taken away.** A bad buy is not a penalty; it is *stock*. See §5.9.

---

## 5. Two directions, and a third that is the first increment

### Direction A — THE OPEN ROAD (a persistent trading world)

Cities with rate boards, a caravan you outfit, a day counter that runs for weeks, a purse
and a reputation that survive between sessions, standing orders from collectors, the auction
as one venue among six. The fullest reading of the brief.

**For:** it is what the founder described. Role-playing feel, real ownership, the
"one more day" hook of a persistent world. The largest possible home for rate/percent work.

**Against:**
- **Arithmetic density falls.** A persistent world spends minutes on navigation, packing and
  admin per sum. The product's metric is voluntary time-on-task, but the *guard* on that
  metric is that it must be real maths — a world sim can easily halve sums-per-minute.
- **Save-state anxiety.** A run you can lose is a run a child is afraid to start. FORGE
  already carries this weight and it is an idle game where the number only goes up.
- **It cannot ship in an afternoon.** The founder ships every few hours; a four-week design
  with no intermediate release is the wrong shape for this team.
- **It is not what the fleet is.** 28 packs are 5–10 minute sessions inside a bazaar you walk
  out of. A save-game RPG is a different product wearing a pack's clothes.

### Direction B — CARAVANSERAI (a trading *day*) ★ recommended

**A run is one day of trading along a circuit of quarters, and the day is the unit.** You
start at a caravanserai with a small purse and an empty cabinet. You walk to a quarter; each
quarter has a block (the auction), stalls (brokers), a rate board, and a road out. You buy,
you carry, you sell, you decide whether the next quarter is worth the road fee. At dusk the
day closes with a reckoning and the caravanserai keeps your best day and your cabinet of
things you have owned.

Sessions are 5–12 minutes and complete. Nothing is lost by stopping. The only persistent
state is a best-day record, an unlock or two, and the cabinet — a few hundred bytes.

**For:**
- Every stall is a decision with a sum in it, so arithmetic density stays where THE GAVEL
  has it today, and the *variety* of arithmetic goes up sharply.
- Roguelike-shaped: "one more day" is a stronger, cheaper hook than "load my save", and it
  is the hook the fleet already knows how to build.
- It is a strict superset of today's auction, so **it can be reached in four shippable
  stages**, each of which is a better game than the one before it.
- It grows into A later, without rework, by making the day a leg of a journey.

**Against:** the persistent-world fantasy is deferred. A child who wants an empire gets a
brilliant day instead. That is the right trade at this stage and it is reversible.

### Direction C — THE LEDGER (deepen the single screen)

Keep one screen. Add item art, a storeroom you can actually sell out of, and two or three
brokers who price the same lot by different printed rules. Two days of work.

**For:** ships immediately; risks nothing; answers "make the items cooler" and "juicy
animation" on its own.
**Against:** it does not answer the brief. The founder asked for a larger game.

### Recommendation

**Build B in stages, and Stage 0+1 of B *is* C.** That is the whole scheduling argument:
the smallest thing worth shipping this week is also the foundation of the largest thing
worth building. Nothing in Stage 0 is thrown away by Stage 3, and nothing in Stage 3 is
thrown away if Direction A is ever ratified.

---

## 6. CARAVANSERAI in detail

### 6.1 The shape of a day

```
  DAWN ─ the caravanserai: purse, cabinet, the road out
     │
     ├── a QUARTER ────────────────────────────────────┐
     │     THE BLOCK    an auction. 1–3 lots.          │
     │     THE STALLS   the brokers standing today.    │
     │     THE BOARD    this quarter's rates.          │  repeat 3–5×
     │     THE ROAD     what the next quarter pays,    │
     │                  and what the road costs.       │
     └──────────────────────────────────────────────────┘
     │
  DUSK ─ the reckoning: the day's ledger, totals blank.
```

Three to five quarters a day. The day ends when the road runs out, not when a clock does.

### 6.2 The four venues, and exactly where the maths lives

#### THE BLOCK — today's auction, unchanged

`max(sums) + 1`, bounded above by the broker's offer. Multi-step comparison, addition,
subtraction, multiplication, division facts. Shipped and correct.

*Blind strategies it must beat:* biggest-numeral, always-bid-one-under-the-offer,
always-fold. (Already tested.)

#### THE STALLS — brokers convert marks into coins by a printed rule

An item you own has a **mark count** — a small integer, 2…12, printed as a sum (`3 × 2`, not
`6`). Each broker standing in this quarter has one line on his stall:

| Broker | His line | The sum | Skill |
|---|---|---|---|
| **THE RUNNER** | *"Half the marks, now, no waiting."* | `marks ÷ 2` | halving, division facts |
| **THE ASSAYER** | *"Three coins the mark, weighed honestly."* | `3 × marks` | multiplication facts |
| **THE FACTOR** | *"Seven the mark, but I take a six-coin fee."* | `7 × marks − 6` | two-step |
| **THE COLLECTOR** | *"Eleven the mark — for the WATER CLOCK and nothing else."* | `11 × marks` | multiplication, and *which item* |
| **THE MONEY-CHANGER** | *"Seven eighths of the mark."* | `⁷⁄₈ × marks` | fractions — Stage 4 |

Two to four of them stand in any quarter. **THE RUNNER is always there** — he is the
"liquidate now" price, he is always the floor, and he is the reason every other offer is
legible as *better by this much*.

The child computes each broker's number and takes the best. **The decision is a comparison
of products, which is the sell-side twin of the founder's "outbid by exactly one".** THE
FACTOR's fee is what makes it non-trivial: he is the best offer only above a certain mark
count, and finding that crossing point is real reasoning a child can *discover* and then
reuse for the rest of their life in this game.

*Blind strategies it must beat:* always-take-the-biggest-rate (loses to THE FACTOR's fee at
low marks), always-liquidate, always-take-the-Collector.

#### THE BOARD and THE ROAD — travel

Every quarter posts what it pays for each material:

```
  CLOCKMAKERS' QUARTER            THE ROAD OUT
  ────────────────────            ────────────
  brass     4 the mark            to ASTROLABISTS   9 coins
  glass     2 the mark            to DYERS          5 coins
  lapis     7 the mark
  silver    5 the mark
  cedar     3 the mark
```

You hold 5 marks of lapis. Here it is `7 × 5 = 35`. The Astrolabists pay `9 the mark`, so
`9 × 5 = 45`, less the `9` road → `36`. **One coin better, and you had to compute two
two-step expressions to know it.** That is the hardest arithmetic a nine-year-old routinely
does, and here it is not a word problem — it is how you decide where to walk.

This is also, precisely, the founder's *"buy cheap cars in Mexico and sell them in
Toronto"*. The road fee is what stops it from being free money, and the fact that the fee is
*printed* is what stops it from being a gamble (L3).

*Blind strategies it must beat:* always-travel, never-travel, travel-to-the-highest-rate
(ignores the fee and the marks you actually hold).

#### THE RECKONING — the day's ledger, optional, paid

At dusk the slate shows the day's trades with the totals blank:

```
   THE BLOCK      bought      □
   THE STALLS     sold        □
   THE ROAD       paid        □
   ───────────────────────────────
   THE DAY                    □
```

Fill them in and the caravanserai pays a bonus. **Leave them and the slate fills itself in,
patiently, and you are paid for the day exactly as you earned it.** This is multi-addend
column addition — which is what the curriculum can actually serve today (§8) — and it is the
only venue that is entirely optional, because a bonus that gates the end of a day is a gate.

### 6.3 The items

Today: sixteen strings. The founder says lean in.

An item is **a number you own with a name and a face**:

```ts
type Piece = {
  name: string        // "PEACOCK BASIN" — al-Jazari and the Banū Mūsā, extended to ~40
  material: Material  // brass · glass · lapis · silver · cedar · salt
  marks: number       // 2…12, always shown as a sum, never a numeral
  provenance: string  // one line, typed on, pure flavour, never gates anything
}
```

**Material is what makes an item mechanically different rather than cosmetically
different**: it selects which column of the rate board you read, so "lapis is worth
carrying past the Dyers" is a real strategy a child builds out of arithmetic. Marks are the
item's mathematical body — a heavy piece is worth more *and* is a bigger multiplication.

**The art is procedural and there are no assets.** The fleet law is canvas 2D, no images to
decode. A small parametric vocabulary — `rim · body · spout · gnomon · dial · chain · bell ·
plate` — composed by a hash of the item id gives ~40 pieces that are visibly, memorably
distinct in perhaps 120 lines of geometry. The material tints the linework using the palette
that already exists (`render/palette.ts`: brass, lapis, cold, oxide). No gradients, no
glassmorphism, no lighting effect standing in for a material — the hostile reference board
in `EXPERIENCE_DESIGN.md` applies unchanged.

**THE CABINET.** Every piece you have ever owned is drawn on a shelf at the caravanserai;
ones you no longer hold are faint silhouettes. It is a collection, it costs a bitfield in
the save, it grants nothing, and it is the single cheapest reason to come back tomorrow.
(`BZ-LAW-12`: nothing that responds to idle touch may grant anything. The cabinet grants
nothing. It is just yours.)

### 6.4 The inventory

Six slots at Stage 2, more later. **Scarcity is what turns a marginal deal into a bad
deal** — with a full cabinet, buying a lot worth four coins costs you the slot you needed
for the lapis, and *that* comparison is a subtraction the game never has to ask for out
loud.

The cabinet filling is also the game's only rising tension, and it is audible: see §6.7.

### 6.5 The BBS slate, rendered premium

The founder wants the early-text-game feel. Retro-for-its-own-sake would be ASCII
box-drawing on black, and it would look cheap next to the bazaar. The reconciliation:

**the terminal is a physical object in a lit room.** A brass-framed slate stands on the
counter of the stall. The type is incised into it — the platform monospace stack (no
webfonts, ever — `AESTHETIC.md` Deviation 3), `font-variant-numeric: tabular-nums`,
INK on STONE, wide letter-spacing on the labels. Rules are hairlines in `INCISE`, not `───`
characters. Choices are lettered lines with 44 px hit rows:

```
   ┌ THE CLOCKMAKERS' QUARTER ─────────────┐
   │                                        │
   │   A   THE BLOCK        2 lots standing │
   │   B   THE STALLS       3 dealers       │
   │   C   THE BOARD        today's rates   │
   │   D   THE ROAD OUT                     │
   │                                        │
   └────────────────────────────────────────┘
```

...drawn as carved stone with brass letters, with the gallery visible behind and above it.
It reads as a BBS because of the *grammar* — lettered options, monospace, a ruled table, a
prompt — and it reads as premium because it is a lit object with a material, which is what
this product's art direction has always been.

**Prose types on at ~28 characters a second and a tap completes it. Numbers never type
on.** A rate board, a mark count and a completed sum appear instantly and stay. The type-on
is for a provenance line and a broker's greeting, and nothing a child needs to compute is
ever withheld for a moment (L5). This is the same contract as `Auction.nudge()`.

### 6.6 The juice: THE STRIKE AND THE POUR

The founder wants the moment of a good deal to be addictive in itself. There are two
signature moments and they share a spine.

**THE STRIKE** (a lot settles):

1. The hammer falls. **120 ms of true silence** — every voice released, the drone ducked.
   Silence is the cheapest juice there is and nothing in the fleet uses it.
2. Every tablet in the gallery turns over *at once* and **completes its own sum**:
   `12 + 5 = 17`, held, in brass-lit. Not just the marked one — the whole room resolves, so
   the comparison the child made is checkable in one glance.
3. Your bid slides in beside the highest.
4. An **incised bracket** is carved between your bid and the broker's offer. *The bracket's
   width is your margin.* You can see the money before you are paid it.
5. **The pour.** Coins are counted out along the bracket, one at a time, into the purse —
   and each coin is one `step{ direction: 1 }` gesture with a rising weight, so **a nine-coin
   margin is a nine-note ascending phrase and a keen bid is that phrase at double length.**
6. On the keen bid the phrase **resolves**: a final `success` gesture, the walker goes home
   to the tonic. Perfect play *sounds finished*.
7. The purse numeral rolls up in tabular-nums brass on brass.

**The size of your win is the length and the shape of the melody.** That is the addictive
loop the founder is asking for, it costs no assets, and it is exactly what
`packs/shared/game-soundscape` was built to do.

**THE WEIGHING** (a sale) is the same spine on a balance: the piece goes on the pan, the
broker's rate is stamped beside it as a live sum (`4 × 5`), the pan tips, and the pour runs
for **the spread you captured over THE RUNNER's standing offer** — so choosing the right
broker is the thing that makes the melody long.

Both are interruptible by a tap. Neither is a clock. Under `prefersReducedMotion` the
tablets cross-fade instead of turning, the coins arrive as a counted numeral, and **the
audio is identical** — the reduced-motion child gets the same melody.

Flash discipline: `FLASH_MAX_ALPHA 0.24`, `FLASH_MIN_GAP_MS 260` (`stack/src/game/tuning.ts`).
Nothing in the pour exceeds it.

### 6.7 Audio, against the shared soundscape

`packs/shared/game-soundscape` gives eight gestures and **a game may never name a pitch**.
All eight map onto real state here, which is a good sign the design is coherent:

| Gesture | When |
|---|---|
| `step { direction: 1, weight }` | each coin of a pour; weight ramps across the pour so it ascends registers |
| `step { direction: -1 }` | each coin of a road fee or a purchase leaving the purse |
| `success` | the keen bid; the best broker chosen; a reckoning total filled correctly |
| `failure` | a miss — three low, warm `bloom` voices under the completing sum. Never a buzzer. |
| `levelComplete` | dusk; the day closes |
| `refuse` | no slot free, cannot pay the road, a bid below the room |
| `arrive` | walking into a quarter |
| `moreTension` | each slot of the cabinet filled past half — **the drone tightens as you get heavy** |
| `lessTension` | each sale — selling down relaxes it |

The pack keeps its own brass-and-coin timbres and its own `AudioContext`, routed through
`createSafetyBus` as today. `currentSoundscape()` returning `null` means *keep your own
sounds*, never *go quiet*, so the existing cues stay underneath as the fallback — the
`if (this.speak(g)) return` pattern from `games/counterweight/src/audio.ts`. The gesture
mapping goes in its own `tune.ts` so it is testable in Node with no `AudioContext`, as
THE STEELYARD does.

**Open question for the soundscape owner (do not assume):** may a game *request* a mode
per quarter, so the Dyers' quarter sounds different from the Clockmakers'? Today the app
chooses the key and the pack only emits gestures. If a quarter could carry a mode, travel
would be audible, which would be lovely — but the rule as written is the app's, and this
design does not depend on it.

### 6.8 The miss

Unchanged in principle from `games/stack` (MONUMENT), which is the reference:

- The marked tablet **completes its sum** — `12 + 5 = 17` — with the `= 17` in the accent,
  in the same colour the unknown was in, so the eye lands on the thing that changed
  (`stack/src/ui/hud.ts:272`).
- The child's own number is shown quietly beneath, unmarked. No red. No "WRONG". No buzzer.
  The palette's only failure colour is `OXIDE`, whose docblock already says *"Never red, and
  never a buzzer."*
- **The hold has no timer.** It stays until tapped (L5). `advance(1e9)` must not clear it.
- The blank glyph contract is `□` U+25A1 and substitution goes through a replacer
  *function*, never a string — see `games/stack/src/blank.ts` and the bug it was written
  against.

### 6.9 The failure model: a mistake becomes stock

Today a lot bought above the offer increments a counter and is gone. In CARAVANSERAI it goes
**into your cabinet**, and a piece in your cabinet can be sold to any broker in any quarter
for the rest of the day. A bad buy is not a punishment; it is an awkward thing you now have
to find a home for — and finding that home is more arithmetic, freely chosen.

That is COLOSSUS's failure shape (*"a wrong strike adds two floors of stone — more work,
visible and countable, no life lost, no buzzer, no score penalty"*) expressed
economically, and it is a much better story than a counter going up.

There is no loss state, no streak counter and no countdown anywhere in this design
(`ACCEPTANCE_CRITERIA.md` P-09).

### 6.10 Persistence

`capabilities` gains `"storage"`. The pattern is FORGE's, verbatim
(`games/forge/src/pack.ts:29-58`): a `SaveSlot` seam hydrated **before** `mount` so the game
loop stays synchronous, the in-memory copy authoritative for the session so a failed write
never rolls a child back mid-day, and a loud `console.error` if the capability was not
granted.

One key, `dynawalla.caravanserai.save.v1`, versioned so a schema change orphans rather than
mis-reads. Compact arrays, not nested objects:

```
{ v:1, b: bestDay, k: "<cabinet bitfield, hex>", s: daysPlayed }
```

**Nothing about the current day is persisted.** A day is a run; a run that can be resumed is
a run a child can be afraid to lose. **Nothing about questions is persisted** — the host owns
the learner model and always will.

Budget: the host's real limits are `MAX_STORAGE_VALUE_LENGTH = 16 KiB`,
`MAX_STORAGE_KEYS = 200` (`dynawalla-app/src/packs/bridge.ts:51`), and all of it JSON-nests
into one `localStorage` entry on the app origin shared with every other store — which is
where the ~5 MB origin budget actually gets spent. Estimated payload here: **~120 bytes**,
with a test asserting the serialized save stays under **2048 characters** with a full
cabinet. Rate boards, item art, provenance lines and broker rosters are all derived from a
`(day, quarter)` seed and **never stored**.

---

## 7. The name

Collisions checked against the 28 built packs and all 234 designs in
`docs/catalog/ARCADE_CANON.md`. "Ledger" and "Vault" are heavily spent (SKY LEDGER is
*built*; the canon has nine more). "Caravan" appears in six canon designs as *"The Caravan
X"*. "Bazaar Circuit" is canon #63, and "bazaar" is the frame's own name and should not be
colonised by one stall.

| | Name | For | Against |
|---|---|---|---|
| ★ | **CARAVANSERAI** | One word. The inn on the trade road where merchants stop, stable their goods and deal — inventory, brokers, travel and rest in a single image. Exactly the minaret-punk register, and it is *architecture*, which is what this art direction is, rather than any of the orientalist clichés `AESTHETIC.md` refuses. Reads premium. No collision anywhere. | Four syllables a nine-year-old has to learn. (The fleet also ships THE COIL OF NINETY-SIX and COUNTERPOISE.) |
| | **THE PEDDLER** | The founder's own word. Plainest, most sayable, immediately tells a child what they do. | Names a person; the fleet names things, places and offices. Feels smaller than the game. |
| | **BRASS & SALT** | The two goods; evokes a ledger and a road at once. | The fleet has no ampersand name; "salt" recurs three times in the canon. |
| | **THE LONG ROAD** | Travel-forward, plain, warm. | Generic. Could be any game. |
| | **THE FACTOR** | A factor is the historical name for a merchant's agent who buys and sells on commission — *and* it is a maths word. | Collides conceptually with THE LATTICE, whose whole subject is factor trees. Would confuse a child mid-multiplication. |

**Recommendation: CARAVANSERAI.** Directory `caravanserai`, id `dynawalla.caravanserai`,
display name `CARAVANSERAI`. THE FACTOR survives as the name of the fee-charging broker,
where the double meaning is a joke for the adults and no maths is at stake.

**Rename in Stage 0, not later.** The pack id keys `dynawalla-app/src/catalog/art.ts`
(one line) and the pass ledger's daily rest record — both cheap today. Once `"storage"`
ships in Stage 1, renaming the id orphans a child's cabinet. Do it while it is free.

---

## 8. Curriculum

| Venue | Skills |
|---|---|
| THE BLOCK | `dw.add.facts.*`, `dw.add.column.*`, `dw.add.regroup.*`, `dw.mul.facts.*`, `dw.mul.multidigit.*`, `dw.div.facts.*`, `dw.div.whole.*`, comparison — 18 skills, as today |
| THE STALLS | `dw.mul.facts.*`, `dw.mul.multidigit.times-one-digit`, `dw.div.facts.division-facts` (halving), and two-step `rate × marks − fee` |
| THE BOARD / THE ROAD | two-step comparison; unit rate; multi-digit multiplication |
| THE RECKONING | `dw.add.column.*` multi-addend, `dw.add.regroup.*`, differences |
| Stage 4 | fractions of a quantity, percent premiums, ratio and proportion |

**Dependency, stated plainly:** `ADAPTATION_AUDIT_2026-07.md` Phase 0b reports **7 of 37
curriculum nodes currently ACTIVE, all column addition**. A pack that claims fractions and
percent is claiming content the host cannot serve. Stages 0–3 are therefore built on
addition, subtraction, multiplication and division facts — content that exists — and
**Stage 4 is explicitly gated on curriculum activation**, not scheduled against it. If this
design is ratified, that is the single strongest argument for prioritising the
multiplication and fraction rungs, because this is the pack that will use them hardest.

---

## 9. The staged plan

Each stage ships alone, is a better game than the one before it, and adds exactly one verb.

### Stage 0 — THE NAME AND THE POUR *(~1 day, one PR)*

The rename. ~40 items with procedural brass art, materials and provenance lines. THE
STRIKE AND THE POUR. Soundscape wired onto today's events. **No new economy, no new verbs,
no new capabilities.** This is entirely an increment on today's auction and on its own it
answers "make the items much cooler" and "juicy, satisfying animation".

*Ships:* a game that is fun to lose an afternoon in, with the same rules it has now.

### Stage 1 — THE CABINET *(~1 day)*

`storeroom` becomes an inventory of six pieces you can look at. THE RUNNER stands at the
block and will liquidate anything at a printed rule. `"storage"` capability and the save.
The cabinet at the caravanserai.

*Adds the verb:* **sell.** *Adds the maths:* halving and division facts, and the first
genuine certainty-versus-more decision.

### Stage 2 — THE STALLS *(~2 days)*

Between lots you may walk to the stalls. Three or four brokers with printed rules, one of
whom charges a fee and one of whom wants a named piece. The BBS slate is built here.
Slots become scarce, so a marginal lot becomes a bad lot.

*Adds the verb:* **choose your buyer.** *Adds the maths:* comparison of products, and the
crossing point where a fee stops mattering.

### Stage 3 — THE ROAD *(~2–3 days)*

The bazaar's ten quarters, rate boards, a road fee, the day, the reckoning. This is
Direction B complete.

*Adds the verb:* **travel.** *Adds the maths:* two-step comparison, unit rate — the hardest
and most valuable arithmetic in the design.

### Stage 4 — THE LONG ROAD *(gated, later)*

Condition as a fraction of the marks. THE MONEY-CHANGER. Percent premiums. Standing orders
that outlive a day. Multi-day journeys — the point at which Direction A becomes available
without rework.

*Gated on:* curriculum activation of the fraction and percent rungs, and on founder
ratification of a persistent world.

---

## 10. The gates

No stage merges without its own row here.

| # | Gate | Where |
|---|---|---|
| G1 | **Blind-bot ≤ 1/3** for every venue, at every intensity, on every seed | `test/bots.test.ts`, one case per venue |
| G2 | **Anti-mash**: a whole day at 8 s/decision and at 0.2 s/decision gives byte-identical purse, tallies and reported answers | `test/antimash.test.ts` |
| G3 | **Magnitude independence (L2)**: halving the rung's answer magnitude moves median coins-per-lot by < 15% | new `test/income.test.ts` |
| G4 | **The miss has no timer**: `advance(1e9)` does not clear a miss reveal; only a tap does | `test/failure.test.ts` |
| G5 | **Save size**: serialized save < 2048 chars with a full cabinet | new `test/save.test.ts` |
| G6 | **Ledger integrity**: every question drawn across a whole day is either reported or skipped, exactly once — including across travel | `test/report.test.ts` |
| G7 | **Legibility**: every numeral a child must read renders ≥ `MIN_NUMERAL_PX` (13) at 320 px | `test/layout.test.ts` |
| G8 | **No latency in the model**: `observe()` still takes no `seconds`, and no coin bonus reaches the ladder | `test/ladder.test.ts` |
| G9 | **Flash**: nothing in the pour exceeds α 0.24 or a 260 ms gap | `test/layout.test.ts` |

## 11. Risks

- **Sprawl.** Four venues is three more than today. Mitigation: the stages, and the rule that
  each adds exactly one verb. If Stage 2 is not fun on its own, Stage 3 does not save it.
- **Arithmetic dilution.** The named failure mode. Mitigation: G1 on every venue, and a
  measured sums-per-minute floor at parity with today's auction before Stage 3 merges.
- **The rename costs a little goodwill** with anyone who has THE GAVEL on a home screen.
  It costs much more after Stage 1. Do it now.
- **The reckoning could feel like homework.** It is optional, it is paid, and the slate
  fills itself in if you walk away. If playtest says it still feels like a worksheet, cut
  it — nothing depends on it.
- **Stage 4 is not schedulable** until the curriculum serves fractions and percent. Do not
  put it on a calendar.
