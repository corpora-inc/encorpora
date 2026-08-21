import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MELODY_MAX_HZ,
  MELODY_MIN_HZ,
  MELODY_PEAK,
  Melody,
  TENSION_STEP,
  type Gesture,
  type Voice,
} from "./melody.ts"
import { modeById } from "./modes.ts"
import { centsBetween } from "./pitch.ts"
import { CALM, modeOf, pickSoundscape, type Soundscape } from "./soundscape.ts"

const scape = (seed: number, tension = CALM): Soundscape => pickSoundscape(seed, tension)

/** Every degree of the live mode, in cents, folded into one octave. */
function degreeSet(s: Soundscape): Set<number> {
  return new Set(modeOf(s).degrees.map((c) => Math.round(c * 1000)))
}

/** Where a frequency sits above the root, in cents, folded into one octave. */
function pitchClass(rootHz: number, f: number): number {
  const cents = centsBetween(rootHz, f)
  const within = ((cents % 1200) + 1200) % 1200
  return Math.round(within * 1000)
}

test("a run of taps is a phrase, not the same ding twelve times", () => {
  // The founder's complaint, as an assertion: THE STEELYARD plays one fixed
  // frequency per plate, so twelve strikes on the ones plate are twelve
  // identical sounds. One is not a melody and twelve of it is not either.
  for (let seed = 0; seed < 40; seed++) {
    const melody = new Melody(scape(seed))
    const heard = new Set<number>()
    for (let i = 0; i < 12; i++) {
      for (const v of melody.emit({ kind: "step", direction: 1 })) heard.add(Math.round(v.hz * 100))
    }
    assert.ok(heard.size >= 5, `seed ${seed} produced only ${heard.size} distinct pitches in 12 taps`)
  }
})

test("every note a game can cause is a degree of the live mode", () => {
  // The in-tune guarantee, exhaustively. If one gesture ever emits a pitch that
  // is not in the mode, it is a pitch that fights the drone, and the whole
  // premise of the module is gone.
  const gestures: Gesture[] = [
    { kind: "step", direction: 1 },
    { kind: "step", direction: -1, weight: 1 },
    { kind: "step", direction: 1, weight: 0.5 },
    { kind: "success" },
    { kind: "failure" },
    { kind: "levelComplete" },
    { kind: "refuse" },
    { kind: "arrive" },
    { kind: "collapse" },
    { kind: "collapse", weight: 0 },
  ]
  for (let seed = 0; seed < 60; seed++) {
    const s = scape(seed, seed % 2 === 0 ? 0 : 0.9)
    const melody = new Melody(s)
    const degrees = degreeSet(s)
    for (let round = 0; round < 6; round++) {
      for (const g of gestures) {
        for (const v of melody.emit(g)) {
          assert.ok(
            degrees.has(pitchClass(s.rootHz, v.hz)),
            `${s.modeId} seed ${seed}: ${v.hz.toFixed(3)} Hz is not a degree of the mode`,
          )
        }
      }
    }
  }
})

test("every voice is inside the register and the loudness budget", () => {
  for (let seed = 0; seed < 40; seed++) {
    const melody = new Melody(scape(seed, 0.7))
    const voices: Voice[] = []
    for (let i = 0; i < 30; i++) {
      voices.push(...melody.emit({ kind: "step", direction: i % 3 === 0 ? -1 : 1, weight: (i % 4) / 3 }))
    }
    voices.push(...melody.emit({ kind: "levelComplete" }))
    voices.push(...melody.emit({ kind: "failure" }))
    voices.push(...melody.emit({ kind: "refuse" }))
    voices.push(...melody.emit({ kind: "arrive" }))
    voices.push(...melody.emit({ kind: "collapse" }))
    voices.push(...melody.emit({ kind: "collapse", weight: 0 }))
    voices.push(...melody.emit({ kind: "success" }))
    for (const v of voices) {
      assert.ok(v.hz >= MELODY_MIN_HZ && v.hz <= MELODY_MAX_HZ, `${v.hz} Hz is outside the register`)
      assert.ok(v.gain > 0 && v.gain <= MELODY_PEAK, `gain ${v.gain} is outside the budget`)
      assert.ok(v.at >= 0 && Number.isFinite(v.at), `offset ${v.at} is not a time`)
      assert.ok(v.seconds > 0 && v.seconds <= 2, `duration ${v.seconds} is not a length`)
    }
  }
})

test("the register bands never overlap and nothing is ever folded", () => {
  // The claim `MELODY_MIN_HZ`/`MELODY_MAX_HZ` are documented as a backstop for.
  // A band is one octave wide, so a weight of 0 must always be strictly above a
  // weight of 1/3, which must be above 2/3, which must be above 1 — in every
  // mode, on every root, at every point in the walk. If a note ever needed
  // folding the bands would start overlapping, and a heavy action would
  // sometimes sound lighter than a light one.
  for (let seed = 0; seed < 200; seed++) {
    const s = scape(seed, seed % 3 === 0 ? 1 : 0)
    const walkers = [0, 1 / 3, 2 / 3, 1].map(() => new Melody(s))
    for (let i = 0; i < 25; i++) {
      const heard = walkers.map((m, k) => {
        const v = m.emit({ kind: "step", direction: i % 4 === 3 ? -1 : 1, weight: k / 3 })[0]
        assert.ok(v)
        return v.hz
      })
      for (let k = 1; k < heard.length; k++) {
        assert.ok(
          (heard[k] ?? 0) < (heard[k - 1] ?? 0),
          `seed ${seed} step ${i}: weight ${k / 3} came out at ${heard[k]} Hz, not below ${heard[k - 1]}`,
        )
      }
      assert.ok((heard[0] ?? 0) <= MELODY_MAX_HZ && (heard[3] ?? 0) >= MELODY_MIN_HZ)
    }
  }
})

test("up walks up and down walks down", () => {
  // Direction is musical, not decorative: hanging a weight ascends the mode and
  // taking one off descends it, which is what makes the two sound like opposite
  // things rather than like two arbitrary noises.
  for (let seed = 0; seed < 100; seed++) {
    const up = new Melody(scape(seed))
    up.emit({ kind: "step", direction: 1 })
    assert.ok(up.position > 0, `seed ${seed}: an ascending step went to ${up.position}`)
    const down = new Melody(scape(seed))
    down.emit({ kind: "step", direction: -1 })
    assert.ok(down.position < 0, `seed ${seed}: a descending step went to ${down.position}`)
  }
})

test("a phrase comes to rest, over and over, and lands where it says it does", () => {
  // Gravity toward the mode's resting degrees is what makes a run of taps a
  // sentence. Without it the walk is a scale exercise that never arrives.
  //
  // Counted through `resolved` rather than by watching for the walker to be on
  // a rest degree: with three resting degrees out of seven, a walk that never
  // cadences at all still stands on one about four times in ten, so counting
  // those would pass on a module with the cadence deleted. This does not — and
  // it also checks that a claimed resolution really is on a resting degree,
  // which is the part that makes the count mean anything.
  for (let seed = 0; seed < 40; seed++) {
    const s = scape(seed)
    const melody = new Melody(s)
    const mode = modeOf(s)
    const rest = new Set(mode.rest)
    const size = mode.degrees.length
    let last = melody.resolved
    for (let i = 0; i < 60; i++) {
      melody.emit({ kind: "step", direction: i % 5 === 4 ? -1 : 1 })
      if (melody.resolved === last) continue
      last = melody.resolved
      const within = ((melody.position % size) + size) % size
      assert.ok(rest.has(within), `seed ${seed}: a cadence landed on degree ${within}, not a rest`)
    }
    // Phrases are 3..8 steps, so 60 taps is at least seven of them.
    assert.ok(melody.resolved >= 7, `seed ${seed} resolved only ${melody.resolved} times in 60 taps`)
    assert.ok(melody.resolved <= 20, `seed ${seed} resolved ${melody.resolved} times, which is not a phrase`)
  }
})

test("weight buys register and never buys a pitch", () => {
  // A heavy action is the same music, lower. THE STEELYARD's thousands plate
  // stays a low clang and its ones plate stays a bright tick — the property the
  // game already had, kept, and made musical.
  let lower = 0
  for (let seed = 0; seed < 100; seed++) {
    const light = new Melody(scape(seed))
    const heavy = new Melody(scape(seed))
    const a = light.emit({ kind: "step", direction: 1, weight: 0 })[0]
    const b = heavy.emit({ kind: "step", direction: 1, weight: 1 })[0]
    assert.ok(a && b)
    // The same walk — weight must not touch the degree.
    assert.equal(light.position, heavy.position, `seed ${seed}: weight moved the walker`)
    if (b.hz < a.hz) lower++
  }
  assert.ok(lower >= 95, `a heavy step was lower in only ${lower} of 100 soundscapes`)
})

test("tension is a dial, is silent, and is bounded", () => {
  const melody = new Melody(scape(7, 0.5))
  assert.deepEqual(melody.emit({ kind: "moreTension" }), [])
  assert.ok(Math.abs(melody.soundscape.tension - (0.5 + TENSION_STEP)) < 1e-9)
  assert.deepEqual(melody.emit({ kind: "lessTension" }), [])
  assert.ok(Math.abs(melody.soundscape.tension - 0.5) < 1e-9)
  for (let i = 0; i < 20; i++) melody.emit({ kind: "moreTension" })
  assert.equal(melody.soundscape.tension, 1)
  for (let i = 0; i < 40; i++) melody.emit({ kind: "lessTension" })
  assert.equal(melody.soundscape.tension, 0)
})

test("tension buys leaps and calm stays stepwise", () => {
  // What "chill" means mechanically: a calm soundscape walks by one degree
  // almost always. If this stops being true the module has stopped being chill
  // and nobody would notice from the types.
  //
  // Cadence steps are excluded, and that exclusion is the whole reason this
  // test is worth having: a cadence jumps the walker back to a resting degree,
  // and tension also lengthens phrases, so a naive average over every step
  // rises with tension even if the interval distribution never changes at all.
  // Measured that way this test passed against a module with the tension term
  // deleted from the interval weights.
  // The octave wrap is excluded for the same reason: a walk that runs past the
  // top of its range comes back down by a whole octave, which is a big number
  // that says nothing about the interval that was chosen. Both are excluded by
  // the same rule — every ascending step that is neither is a step UP, so any
  // step that went down is one of the two.
  const span = (tension: number): number => {
    let total = 0
    let steps = 0
    for (let seed = 0; seed < 60; seed++) {
      const melody = new Melody(scape(seed, tension))
      let last = melody.position
      let cadences = melody.resolved
      for (let i = 0; i < 20; i++) {
        melody.emit({ kind: "step", direction: 1 })
        if (melody.resolved === cadences && melody.position > last) {
          total += melody.position - last
          steps++
        }
        cadences = melody.resolved
        last = melody.position
      }
    }
    return total / steps
  }
  const calm = span(0)
  const wound = span(1)
  assert.ok(calm < 1.6, `calm averaged ${calm} degrees a step, which is not stepwise`)
  assert.ok(wound > calm + 0.3, `calm averaged ${calm} and wound-up averaged ${wound}`)
})

test("finishing something is the only big gesture, and it goes home", () => {
  const melody = new Melody(scape(3))
  for (let i = 0; i < 5; i++) melody.emit({ kind: "step", direction: 1 })
  const voices = melody.emit({ kind: "levelComplete" })
  assert.ok(voices.length >= 4, `a flourish of ${voices.length} voices is not a flourish`)
  for (let i = 1; i < voices.length; i++) {
    assert.ok((voices[i]?.at ?? 0) > (voices[i - 1]?.at ?? 0), "the flourish is not in order")
  }
  assert.equal(melody.position, 0, "the walker did not go home after a level")
})

test("a refusal is low, short and modelled rather than noise", () => {
  const melody = new Melody(scape(11))
  const voices = melody.emit({ kind: "refuse" })
  assert.equal(voices.length, 1)
  const v = voices[0]
  assert.ok(v)
  assert.equal(v.timbre, "rubble")
  assert.ok(v.seconds < 0.5, "a refusal that long is a telling-off")
  assert.ok(v.hz < 300, `a refusal at ${v.hz} Hz is a beep, not a crumble`)
})

test("a building coming down is masonry, staggered, and never a note anyone chose", () => {
  // The primitive this module did not have. A collapse is percussive and BIG,
  // and the only thing a game could reach for was `refuse` — a shelf of brass —
  // or, as TREBUCHET did, a band-passed noise burst in its own file.
  for (let seed = 0; seed < 30; seed++) {
    const melody = new Melody(scape(seed, seed % 2 === 0 ? 0 : 0.8))
    const voices = melody.emit({ kind: "collapse" })
    assert.ok(voices.length >= 2, `a collapse of ${voices.length} voice(s) lands all at once`)
    for (const v of voices) {
      assert.equal(v.timbre, "rubble", "a collapse must be modelled, never a noise burst")
      assert.ok(v.hz < 400, `a collapse at ${v.hz} Hz is a beep, not a building`)
    }
    const [face, rest] = voices
    assert.ok(face && rest)
    assert.ok(rest.at > face.at, "the whole building landed in the same instant")
    assert.ok(face.hz < rest.hz, "the heaviest part of the fall is not the lowest")
  }
})

test("a collapse is sized by its weight and leaves the phrase alone", () => {
  // Weight buys body, exactly as it does for `step` — and the walker is
  // untouched, so a game that celebrates in the same breath still cadences.
  const light = new Melody(scape(5))
  const heavy = new Melody(scape(5))
  for (let i = 0; i < 4; i++) {
    light.emit({ kind: "step", direction: 1 })
    heavy.emit({ kind: "step", direction: 1 })
  }
  const before = heavy.position
  const small = light.emit({ kind: "collapse", weight: 0 })[0]
  const big = heavy.emit({ kind: "collapse", weight: 1 })[0]
  assert.ok(small && big)
  assert.ok(big.seconds > small.seconds, "a keep falls no longer than a garden wall")
  assert.ok(big.gain > small.gain, "a keep falls no heavier than a garden wall")
  assert.equal(heavy.position, before, "the collapse moved the walker")
})

test("two collapses in the same key are not the same collapse", () => {
  // The defect the whole module exists to end: "nothing that happens changes
  // what the next sound is". A fall pinned to the tonic would be one fixed thud
  // forever however long a child plays — and reading the walker instead is the
  // same thud in any game whose other gestures all cadence home, which is why
  // this drives ONLY collapses.
  for (let seed = 0; seed < 20; seed++) {
    const melody = new Melody(scape(seed))
    const heard = new Set<number>()
    for (let i = 0; i < 14; i++) {
      const v = melody.emit({ kind: "collapse" })[0]
      assert.ok(v)
      heard.add(Math.round(v.hz * 100))
    }
    assert.ok(heard.size >= 2, `seed ${seed}: fourteen collapses were all the same pitch`)
  }
})

test("a collapse is reproducible from the seed", () => {
  // It consumes randomness, so it must consume it deterministically — otherwise
  // a reported bug cannot be replayed.
  const a = new Melody(scape(4))
  const b = new Melody(scape(4))
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(a.emit({ kind: "collapse" }), b.emit({ kind: "collapse" }))
    a.emit({ kind: "step", direction: 1 })
    b.emit({ kind: "step", direction: 1 })
  }
})

test("a failure is warm and never a buzzer", () => {
  for (let seed = 0; seed < 30; seed++) {
    const melody = new Melody(scape(seed))
    for (const v of melody.emit({ kind: "failure" })) {
      assert.equal(v.timbre, "bloom", "a failure must not be struck")
      assert.ok(v.gain <= 0.09, `a failure at gain ${v.gain} is louder than the music`)
    }
  }
})

test("the drone doubles the fifth only when the mode has one", () => {
  const root = 130.81
  const withFifth = new Melody({ modeId: "western.dorian", rootHz: root, seed: 1, tension: 0 })
  const drone = withFifth.drone()
  assert.equal(drone[0], root / 2)
  assert.equal(drone[1], root)
  assert.equal(drone.length, 3, "Dorian has a perfect fifth and the drone should take it")
  assert.ok(Math.abs(centsBetween(root, drone[2] ?? 0) - 700) < 3)

  // Whole tone has no perfect fifth at all. A fixed root-and-fifth drone would
  // put a pitch under it that is not in the scale, which is the specific clash
  // this branch exists to avoid.
  const wholeTone = modeById("western.wholeTone")
  assert.ok(wholeTone)
  assert.ok(!wholeTone.rest.some((i) => Math.abs((wholeTone.degrees[i] ?? 0) - 702) <= 25))
  const bare = new Melody({ modeId: "western.wholeTone", rootHz: root, seed: 1, tension: 0 })
  assert.equal(bare.drone().length, 2)
})

test("the same seed is the same music, forever", () => {
  const play = (): number[] => {
    const melody = new Melody(scape(4242))
    const out: number[] = []
    const script: Gesture[] = [
      { kind: "step", direction: 1 },
      { kind: "step", direction: 1, weight: 0.66 },
      { kind: "step", direction: -1 },
      { kind: "success" },
      { kind: "step", direction: 1, weight: 1 },
      { kind: "levelComplete" },
    ]
    for (const g of script) for (const v of melody.emit(g)) out.push(v.hz)
    return out
  }
  assert.deepEqual(play(), play())
})

test("retuning carries the line across instead of restarting it", () => {
  const melody = new Melody(scape(9))
  for (let i = 0; i < 4; i++) melody.emit({ kind: "step", direction: 1 })
  const before = melody.position
  melody.retune(scape(10))
  assert.equal(melody.position, before, "a key change threw the phrase away")
  assert.equal(melody.soundscape.seed, scape(10).seed)
})

test("an unknown mode is loud and still plays", () => {
  // The host and the pack can disagree about the corpus across a version skew.
  // That must be visible to a developer and inaudible to a child.
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]): void => {
    warnings.push(args)
  }
  try {
    const melody = new Melody({ modeId: "maqam.notathing", rootHz: 130.81, seed: 1, tension: 0 })
    const voices = melody.emit({ kind: "step", direction: 1 })
    assert.equal(voices.length, 1)
    assert.ok((voices[0]?.hz ?? 0) > 0)
  } finally {
    console.warn = original
  }
  assert.ok(warnings.length > 0, "an unknown mode was swallowed")
})
