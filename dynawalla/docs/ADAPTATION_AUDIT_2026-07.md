# Adaptation audit — can the games adapt to the child? 2026-07-29

Companion to `PACING_AUDIT_2026-07.md`. Nine agents read all 27 games against one
question: if we build a controller that raises and lowers difficulty with the child's
performance, what would it take to plug it in?

## The premise was wrong, in a good way

**Correctness is not the fleet blocker.** 25 of 27 games already compute the child's
verdict locally and correctly — usually before the host does — and most also have honest
latency and a ready-made streak counter.

**The blocker is that the wire throws it away and offers nothing back.**

- `GameHost.next(): Question` takes no arguments (`game-host/index.ts:48`)
- `Question.difficulty` is a READ-BACK — `item.level / 8` at `:124` — not a request
- `report()` ends in a literal `void correct` (`:236`)
- `HostClient.nextItem({ skillId? })` has no difficulty on the wire at all
- **Eight games already pass `{difficulty}` to `next()`. Every one is silently discarded.**
- `trebuchet` and `siege` feature-detect `setDifficulty`/`raiseFloor` the adapter never implemented
- A **32-64 item FIFO prefetch pool** sits behind it, so any change lands 32-64 questions later

So the eight games that tried to adapt have been talking into a dead wire.

## The second finding makes adoption cheap

Every game's difficulty function is **already pure and already takes exactly one scalar**.
It is just the wrong scalar — elapsed time, waves cleared, floors climbed, blocks finished —
and in **24 of 27 that scalar cannot go down**.

> The function is right. The argument is wrong.

Adoption is therefore mostly re-pointing an argument, not rewriting a game — *provided* it
is paired with sweeping the escalate-on-failure lines, or the controller is quietly cancelled
out: `guilty` speeds up on a wrong shot, `horde` ambushes you with nine enemies, `arena`
shrinks your answer window every time you miss, and `stack` advances its difficulty index on
a **wrong** answer and speeds up when you hesitate.

## The hazard nobody would have predicted

**The display ordinal is fused to the difficulty index in most games**, so lowering
difficulty counts backwards on screen — which *announces the adaptation*, the one thing the
brief forbids. `guilty` prints a literal `WAVE 25` and `wave % BOSS_EVERY` would re-trigger a
boss the child already beat. `claim`'s `levelIndex` is simultaneously palette, audio key, clear
bonus and HUD number. `mosaic`'s index is also the wall's **RNG seed**, so easing down replays
walls the child has already seen. `balance` fires a fanfare banner on any movement change —
including a decrease.

Every game needs a pressure index **separate from the number the child sees**.

## Games that BREAK when the maths gets easier

Not degrade — break, on the first ease-down:

- **`merge-idle`** — a merge board only goes up. Lower the requested answer from 1280 to 24
  and the shelf holds nothing that can ever become a 24; `p.value === v.answerValue` is
  unsatisfiable. The only clearing tool removes exactly the small polyps needed to rebuild a
  small answer. **Every choke reports `correct:false`, which pushes intensity down further** —
  a hard doom loop.
- **`trebuchet`** — easier maths makes the game *stop*. Answers outside `[14, 118]` are
  silently discarded behind a 200-iteration guard with no fallback and no log; serve
  single-digit facts and the rack is empty, and the game sits in `aim` forever with no error.
- **`forge`** — the payout *is* the answer's numeric value, against fixed exponential costs.
  Dropping `473+168` to `2+3` is a ~128× income cut, so the moment a child struggles the number
  they are watching stops growing and the FORGE MARK becomes permanently unreachable.
- **`horde`** — the director only adds; there is no cull path. Drop intensity with 700 enemies
  alive and they stay until the child kills every one.
- **`claim`** — cannot see success at all. Its single `report` is reachable only from
  `die() -> openGate()`, so the stream is failure-only.

## The five-year-old gap is motor, not maths

Ten of 27 fail a five-year-old today, and **the reason is almost never the arithmetic** — it
is motor demand. For six the demand is already relaxable with identified constants: `mosaic`
(`ballSpeed` 820→420, `paddleW` 156→320, both read live so it eases mid-wave), `serpent`
(orb ratio 10-of-3-good → 5-of-4-good, `baseSpeed` 0.42→0.22, which halves the turning circle
for free), `slice` (`heat` pinned to 0 collapses every density knob at once), `polarity`,
`counterweight`, `rhythm`.

`rhythm` deserves calling out: a five-miss charge budget against a per-note penalty means a
child who watches for ten seconds before joining in is **already in a breakdown**, and the only
refill paths are correct gates and 12 consecutive perfects — so the only way to recover from a
motor problem is to be good at the maths.

## Adoption order

**Wave 0 — packs/shared/game-host, packs/sdk (guest wire), packs/shared/curriculum (add domain), packs/shared/game-pacing (new)**

NOT GAMES, AND NOTHING ELSE SHOULD START. Widen `GameHost.next()` to take `{difficulty, maxDifficulty}`, add `flush()`, stop dropping `correct` (`void correct` at index.ts:236), and put `maxLevel` on `HostClient.nextItem`. Then author curriculum rungs below two digits — every active add row bottoms out at `plus(2,2,0)`, so the founder's '2+3' does not exist as content and wave 1 would be tuned against something unreachable. Then build `game-pacing`. Do this as three separate PRs with the curriculum one first, because it is the only one with a lead time (authoring, malrules, i18n keys, snapshots). Verification for the wire change is cheap and concrete: eight games already pass `{difficulty}` into `next()`, so the moment the signature widens you can assert end-to-end that a request changes what arrives.

**Wave 1 — coil, colossus, balance, lattice, skyledger**

REFERENCE ADOPTERS — cheapest, highest signal, and between them they exercise every corner of the API before it hardens. coil is the existing proof that a game can be walked back down: its `settle()` already adds slag on a miss and clears it on a hit, floored at zero, and the package has no localStorage, no level index, no spawn table and no monotone difficulty counter anywhere. colossus already responds bidirectionally to `q.difficulty` (`slabCount` switches the multiplication layer OFF below 0.3) so it validates the wire change with almost no game edit. balance is a pure `puzzleAt(index, seed)` that will generate index 2 after index 40 — and it forces the API to answer 'what happens when the controller cannot interrupt the current puzzle', which is a real constraint in six games. lattice validates the untimed, stateless-per-question case and forces the unusable-item fallback (its stall path leaves a spent resonator live and un-reported). skyledger forces the burst-dedupe requirement, because its multi-catch can emit 4-10 successes in one frame. Ship these with their hazards fixed, not deferred: coil's COURSE must be latched per-course, balance must debounce `report(false)` and suppress the movement banner on a decrease, lattice's stall must clear the field, colossus must re-arm its one-slab opening off intensity rather than off a `levelNo` that only rises.

**Wave 2 — rhythm, pulse, runner, stack, street, foundry, counterweight, truedraw**

ONE-KNOB GAMES — each already has a single pure function taking the wrong argument, so adoption is re-pointing it plus a named list of ratchets to sweep. rhythm is the most instructive in the fleet: it ALREADY has a continuous bidirectional performance scalar, and the asymmetry runs backwards (+0.34 up, -0.22 down, so a child at 50% drifts up); fix the ratio, delete `sector.bpmBias` from the tempo expression (a child at difficulty 1 in sector 5 plays at 112 bpm, not 98), and stop charging missed groove notes. pulse already steps DOWN on a stumble and has a real bug in that path — the lane-count decrease orphans up to a bar of already-scheduled notes into a lane that `laneAtPoint` can no longer produce, and each reaps as an unavoidable 5% health miss at exactly the moment the child was already failing. runner's `speedAt`/`readWindow`/`breather`/`beatTime` are four single-scalar pure functions and its `difficultyFor` already contains a downward relief term that the adapter discards. stack is eight pure functions in one tuning.ts, but do NOT decrement `floor` (it is the tower height and the camera target) and DO gate the dither, which speeds the sweep 16% per idle cycle precisely when a child hesitates. street, foundry and counterweight are single-table re-points; foundry needs its additive floors moved (a 3.2 s clamp and a five-tap minimum are not a calm end) and counterweight needs a pan re-seed when the target's magnitude collapses, or the child spends a calm round unwinding the previous intensity level. truedraw is small in code and honest about its limit: only `SHOTS` changes anything for a child who cannot verify, and its 50/50 truth bag is a defended product claim — do not touch it.

**Wave 3 — guilty, siege, arena, serpent, mosaic, polarity, slice, merge, beam**

MODERATE — these need a second variable split from the display ordinal, plus a live-field relief path, and several need a design conversation before code. Common shape: a pressure index separate from the wave/level number the child sees (guilty's `bannerFor` prints 'WAVE 25' and `wave % BOSS_EVERY` would re-trigger a beaten boss; mosaic's index is also the wall's RNG SEED so lowering it replays walls; claim-style coupling in siege where the wave number is the narrative). guilty is the cheapest of the nine and has a dead gate ready to use — `bolts: wave >= 10` is computed and never read anywhere, so hostiles fire from wave 1; wiring it to intensity costs one `if`, and inverting `world.descent *= 1.14` to `*= 0.88` at the calm end makes 'shrink back down when you get something wrong' literally true inside one wave. arena, siege and beam each carry an explicit policy pin that contradicts the brief (arena's test-pinned clock escalation and depth ratchet, siege's `mathFloor` documented as 'never lowers where the child already is', beam's test asserting 'a mistake in the middle changes nothing') — put those three in front of the founder as a batch BEFORE writing code; they are reconcilable only if 'run length' and 'the child's performance' are formally distinguished. merge is moderate but carries the ADR-0013 trap: its only KEY-change path fires `transition()`, and it reports every stranded chip as WRONG on a purge, so a downward retune needs a wholly separate function. siege additionally needs its ember income decoupled from question difficulty or an ease-down starves the child's economy.

**Wave 4 — horde, forge, claim**

LARGE — new behaviour, not constants, and each has exactly one thing that must be built first. horde needs a cull path (fade the farthest-from-player enemies) before anything else matters: today the calm end is not reachable in bounded time from a bad moment, because the director only adds and the child must kill their way out of the crowd they were given. It also needs `runT` left alone — it is simultaneously the difficulty clock, the score, the persisted best and the anchor for every scheduled set-piece, so the scalar must be a new field. forge needs `payoutFor` re-based off answer magnitude before it can consume a downward scalar at all; until then, easing a struggling child makes the number they are watching stop growing, which is the emotional inverse of the brief. claim needs a success signal built (its only report is inside a death gate) AND its `levelIndex` split from palette, audio key and HUD, AND its goal band re-baselined only at level boundaries. Sequence these after wave 3 not because they are less important but because each is a week of design, and the shared API will have been proven against fourteen games by then.

**Wave 5 — merge-idle, trebuchet, mosaic (wall signal)**

REDESIGN. merge-idle and trebuchet both BREAK when the maths gets easier — not degrade, break: an unsatisfiable board and a permanent silent stall respectively, each reachable on the first ease-down. Neither is fixable inside the pacing work. merge-idle needs an inverse operation or a shelf-reset on a magnitude drop, and needs its persisted vent tier and magnitude taken off the difficulty path. trebuchet needs a field that can frame a five-metre target, which means the ruler, the camera and `pullQuestions` together, plus a fallback so a short rack is a visible state rather than a frozen game, plus `pause`/`resume` so its latency is trustworthy. mosaic's wall signal is here rather than in wave 3 because turning it on is not a wiring job: `rules.ts:14-17` states the design intent that you must not be punishable for a ricochet, and pierce/star/laser break tiles the child never chose, so it needs new bookkeeping that distinguishes a deliberate aim from a physics accident. Its PACE half — `ballSpeed` and `descentRate`, both read live every frame — should ship in wave 3 regardless; only the correctness half waits.

## Honest limits

Read-only source analysis. Nothing here has been in front of a child, and the per-game
constants are proposals derived from reading, not from measurement. The wire fix (Wave 0) is
the exception: it is a defect with a demonstrable failing test, not a tuning judgement.
