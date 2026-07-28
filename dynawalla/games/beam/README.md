# LATTICE RUNNER

> after *Beam Rider* (1983). Rank 23, S tier, wave 2 of `docs/catalog/ARCADE_CANON.md`.
>
> **Loop:** ride a divisor beam; only a beam that divides the automaton kills it.
> **Juice:** resonance lock as two waveforms phasing — division made audible.

## The rule

A lattice of five beams runs from a vanishing point down to the floor. Each beam is
tuned to a whole number. Automata walk down the lattice carrying whole numbers.

> A pulse fired up beam `b` destroys an automaton carrying `v`
> **if and only if `b` divides `v`.**

That sentence is `resonates()` in `src/sim/lattice.ts`, it is stated exactly once, and
`src/test/pulse.test.ts` asserts the biconditional over every readable beam against every
legible hull value. Nothing else in the package is allowed to have an opinion about
whether a kill lands.

The automata **step sideways** as they descend, so a number is reachable from several
beams at different moments. That is what makes divisibility a decision rather than a
lookup: 84 can be taken from 3, from 4, from 7, and the tight divisor pays double. The
economy is the pedagogy — the obvious read is always the cheapest one on the board.

A pulse that does not divide costs nothing but time: the automaton rings and is shoved
further down the lattice. Nothing is deducted and nothing is scolded.

## The resonance lock

While you are riding a beam, two oscillators run: the beam's tone and the automaton's,
detuned by the **phase offset** `(v mod b) / b`. Two tones a little apart beat against
each other, and the beat rate is the mismatch. When the beam divides the value the
mismatch is exactly zero, the beating stops, and the pair collapses into one pure tone.

The same two waveforms are drawn along the beam. At zero offset they are the same curve
and the eye sees one bright line; at any other offset the beam looks braided. The picture
and the sound carry identical information, so the game is fully playable with the volume
off.

It is deliberately **not** a verdict light. A remainder of one out of twelve is a slow,
almost-locked wobble — 83 and 85 both read as "one away from a multiple of 12", because a
phase is circular and that happens to be true. The ear narrows the field and never
finishes the job, so a child who can divide is always faster than a child waiting for the
tone to settle. The scaffold fades on its own.

## Where the curriculum enters

A **CORE** descends the middle of the lattice two seconds after the last one cleared,
carrying a problem the host served — `247 + 158` — and fractures into one automaton per
candidate value. Killing one hands it in.

The number that is tuned here is the **dead time**, not the thinking time: the gap plus
the core's approach is about four seconds, and the answering window — the candidates'
fall from the fracture line to the floor — is about ten seconds early in a run, closing
to six at full pressure. Comprehension is measured, never rationed; what was cut is the
time with nothing on the lattice to think about. A wave ends the moment it is answered,
so reading quickly is what buys the next problem.

So a submission costs four real steps, three of them mathematics:

1. do the column arithmetic, `247 + 158 = 405`;
2. find 405 among the candidates;
3. find a beam that divides 405 — on this board, 5;
4. ride there before the candidates land.

The divisibility rule is the **lock on the trigger**: you cannot hand in a number you
cannot factor. It is not decoration around a quiz, and it is not a quiz bolted onto a
shooter.

### What is declared, and what is not

`pack.json` declares the seven **active** `dw.add.*` rows and nothing else. Those are the
skills the host can actually serve today, and the CORE is the only thing in the game that
is reported.

No `dw.div.*` row is declared. Divisibility is native to this mechanic and it is what the
child does continuously — but every row in the `div` domain is `status: "draft"`, so
claiming one would advertise coverage the curriculum cannot serve. When `div` is promoted
this game gets better with **no code change**: the CORE takes whatever expression the
ladder hands it, and a quotient on the hull is the same object as a sum on the hull.

The stream of ordinary automata is the game's own mathematics — divisibility over numbers
the game itself made up. Nobody asked those questions, so nothing about them is reported.

### Items that are passed over

An answer with no divisor in the readable beam range — a prime like 83, or 169 — cannot
be killed on a lattice a child can read, so the item is passed over and the next one
drawn (up to eight attempts; measured pass rate is above 70%, so eight draws miss less
than once in ten thousand). A passed-over item is never shown and never reported.
Silence is honest; an unanswerable question is not.

The same filter closes a leak: if a beam had to be tuned to the answer's own number, the
label at the foot of the lattice would print the answer. `usableCoreValue()` requires a
divisor **strictly smaller** than the value, and `src/test/core.test.ts` asserts that no
beam label is ever equal to a candidate's number.

## Stakes

Three anchors. An ordinary automaton reaching the floor breaches one; at zero the lattice
goes dark. A wrong submission costs **no anchor** — it collapses the resonance multiplier
to one, which is the entire economy, and the true statement is shown once, plainly. Two
cores read relights an anchor, cumulatively, and that progress is never taken away.

Escalation is on the size of the run — elapsed time and total kills — and never on an
unbroken streak. `src/test/director.test.ts` asserts that two runs reaching the same
totals by different routes land on identical pressure.

## Running it

```sh
npm install
npm run dev          # http://127.0.0.1:4321 — playable against the seeded stub host
npm test             # rules, not rendering
npm run tsc
npm run build:pack   # → dist-pack/, which packs/build.mjs stages into the app
```

`?seed=1234` fixes the stub host's question stream; `?reduced=1` forces the reduced-motion
branch.

Controls: tap a beam to ride to it and fire on arrival; tap the beam you are on to fire
now; **drag** to ride without firing, which is the listening verb. Arrow keys and space
on a desktop.

## Reduced motion

A branch, not a degradation. The resonance traces stop travelling and are drawn as a
still figure of the same two waves — the phase relationship, which is the whole point, is
entirely legible standing still. No shake, no punch zoom, no hitstop, no flash. The
audio, which is not motion, is unchanged.

## Layout

| Path | What lives there |
|---|---|
| `src/sim/lattice.ts` | the kill rule, the phase, and lattice tuning |
| `src/sim/pulse.ts` | what a pulse does to what it meets — pure, and the biconditional's home |
| `src/sim/core.ts` | turning a served item into a wave |
| `src/sim/field.ts` | the automata and their walk down the lattice |
| `src/sim/director.ts` | pacing, the value stream, and the scoring gradient |
| `src/render/geom.ts` | the hall's perspective, pure and tested |
| `src/render/hall.ts` | drawing, including the phasing traces |
| `src/mount.ts` | the game: input, the frame loop, and the reporting seam |

## Two random streams

`rng` is the run — the numbers on the hulls, how the lattice tunes, which column a
candidate takes. `fx` is decoration — the angle a spark leaves at, and nothing else.

They were one stream, which was a defect and not an untidiness: every emitter draws once
per particle and the quality tier scales the particle count, so a cheap tablet spawning
45% of the sparks consumed a different number of draws and, from that frame on, played a
*different game* from the same seed than an expensive one. `the quality tier cannot
change the game` in `src/test/loop.test.ts` asserts the separation directly.
