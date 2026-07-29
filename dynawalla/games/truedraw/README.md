# THE TRUE DRAW

_after Wild Gunman (1974)_

A statement is cut into a slate across the dust.

    47 + 25 = 62

The street goes still. Then the slate lights.

**Draw if it is true. Hold if it is false.**

## The mechanic

One verb, one button, one beat.

| | |
|---|---|
| **hit** | drew at a true slate — it is struck, the numerals seat, and the round moves on at once |
| **bow** | let a false slate stand — the caller bows, and the slate **rolls itself right** in front of you |
| **wild** | drew at a false slate — **nothing happens.** No buzzer, no shake, no colour. The slate stays wrong, the caller does not move, nothing sounds, nothing buzzes. A shot goes dark in silence. |
| **slow** | let a true slate stand — the caller draws |

Being ignored is the punishment. That asymmetry is the design and it is enforced
in code: `game/energy.ts` asserts that a wrong draw has zero movers, zero gain
and no haptic, in both the full and the reduced-motion branch.

## Why it cannot be mashed

A GO/NO-GO task has a hard 50% ceiling for anyone who draws at everything. The
job is not to remove the ceiling; it is to make sure a child reads it as
failure. There is one honest way to do that: **never show an accuracy at all.**

A child shown "50%" reads a passing grade. A child shown **3** reads three.

So the run has no score and no percentage. It has a length — how many calls you
made before three shots went dark — and length is violently non-linear in care:

    expected calls = shots × p / (1 − p)

| per-round accuracy | expected run |
|---|---|
| 0.50 — draw at everything | **3 calls** |
| 0.75 | 9 |
| 0.90 | 27 |
| 0.97 | 97 |
| 1.00 | no end |

Never drawing is the same coin the other way up, and just as short. And mashing
does not even buy tempo: a wrong draw commits, but it **does not close the
window** — the slate stays lit to the last millisecond with the world declining
to react. Drawing correctly is the only thing in the game that makes time go
faster, and with a comprehension-sized window that is now a very large
difference indeed.

`src/game/inhibition.test.ts` plays these strategies out for thousands of runs
and asserts every claim on this page.

## Why the falsehoods are worth rejecting

The slate never lies with `answer ± 1`, which a child rejects by feel. It lies
with the item's own **mal-rule distractors** — what a child running a specific
broken procedure actually writes. `47 + 25 = 62` is every carry dropped;
`503 − 87 = 426` is the borrow travelling through the zero and the zero being
read as ten. Rejecting one means doing the arithmetic.

That also makes the reporting fall out for free: a wild draw reports the
mal-rule value, so the host records the miss **and names the misconception the
child just demonstrated.** No extra wiring.

It is also why the window is what it is. This game used to defend a 1.75–3.6 s
clamp with "verification is cheaper than computation — the ones column alone
rejects most mal-rules". `src/game/malRule.test.ts` proves that false: a dropped
carry reproduces the true ones digit *by construction* — 62 and 72 both end in
2 — and so does a borrow left at ten. A last-digit check accepts the falsehoods
this game most prefers to tell, so verifying costs what computing costs.

## The window is the child's time

`EXPERIENCE_DESIGN.md`: *"COMPREHENSION — not budgeted. The child's time.
Measured, never limited."* The draw window is now that document's own **p90 for
the item's class**, monotone non-decreasing in operand width and clamped by
nothing:

| item | p50 | p90 | window before | window now |
|---|---|---|---|---|
| `7 + 8 = 15` | 2.8 s | 6 s | 2.16 s | **6.0 s** |
| `47 + 25 = 72` | 6 s | 14 s | 2.59 s | **14.0 s** |
| `753 + 577 = 1330` | 11 s | 27 s | 3.45 s | **27.0 s** |
| `5001 − 2798 = 2203` | 16 s | 40 s | 3.60 s | **40.0 s** |

The old ceiling bit long before the difficulty did, so the *share* of the child's
measured need fell as the item got harder — 77% of a p50 for a single-digit fact,
23% for the widest class. The ramp was inverted by construction, and running out
of time on a true slate settles as a hold and spends a shot, so a child who could
not finish lost a shot half the time by pure arithmetic.

A long window costs the child nothing: a correct draw stops the clock the instant
they press. It is only spent in full by a correct hold — the standoff — and by a
wrong draw, which is the one thing in the game the world declines to react to.

**And a window that closed on an untouched screen is never sent to the ladder.**
The shot still goes dark, so a timeout costs exactly what an honest wrong draw
costs and refusing to call never dominates calling; but from inside this game "I
say that sum is wrong" and "I am still working it out" are the same event, and
betting on the first would demote a merely deliberate child. The obvious hole —
hold at everything, be credited on every false slate — is closed by the shot
budget: holding at everything is wrong half the time, and half is three calls.

## Domains

The statement builder reads `prompt`, `answer` and `distractors` and nothing
else, so it is domain-blind. Only `add` is active in the curriculum today; the
day `mul`, `frac`, `ns`, `div` or `alg` are promoted out of draft, this pack
covers them with no change. A claim is a claim.

## Running it

```
npm install
npm run dev      # http://127.0.0.1:4331 — playable against the stub host
npm test         # the rules, not the rendering
npm run tsc
npm run build:pack
```

`?seed=123`, `?level=0..7` and `?reduced=1` are honoured by the dev harness.

## Shape

    src/contract.ts     the host seam — must not drift
    src/game/           the rules: statement, schedule, response, run, round
    src/render/         the street: one slate, one caller, a gathering crowd
    src/audio/          asset-free Web Audio; there is no sound for a wrong draw
    src/stub/           a seeded local host — exact integers, mal-rule distractors
    src/test/harness.ts a headless player, so a run can be played 10,000 times
