import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  speedAt, readWindow, breather, beatTime, difficultyFor,
  gateDistance, deliveredWindow, comprehensionWindow, comprehensionFor,
  preReadLead, hazardLandsOnRead,
  READ_WINDOW_FLOOR, DELIVERED_WINDOW_FLOOR, DODGE_CORRIDOR_FLOOR,
  COMPREHENSION_FLOOR, RESOLVE_HOLD, RUNWAY_MAX,
  V_SURGE_BOOST_MAX, GATES_PER_STEP,
  V_START, V_TERMINAL, V_REDUCED_CAP,
  COST_WRONG_GATE, COST_HAZARD, GAIN_GATE, VOLT_BLEED, VOLT_MAX,
} from "./pacing.ts";
import { Rng } from "./rng.ts";
import { comprehensionTarget, MAX_TARGET } from "./comprehension.ts";

/* ------------------------- the spawn loop, headless ------------------------ */

/**
 * A replay of `mount.ts`'s gate/hazard scheduling with no WebGL under it.
 *
 * It is deliberately written from the *geometry* — gates and hazards are z
 * coordinates that scroll toward the player at the live speed, exactly as
 * `Entities.update` moves them — and not from any of the pacing functions'
 * own arithmetic. A hazard counts as arriving during a read when its z crosses
 * the answer plane on a frame where a gate is up. If the guard were to start
 * lying, this measurement would not follow it.
 */
const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const approachN = (v: number, t: number, rate: number, dt: number) =>
  v + (t - v) * (1 - Math.exp(-rate * dt));

type Sim = {
  gates: number;
  arrivalsWhileReading: number;
  arrivals: number;
  readingDuty: number;
  minDelivered: number;
  /**
   * The shortest time any gate's sum spent on the HUD before that gate reached
   * the answer plane — the pre-read corridor plus the gate's own window.
   */
  minComprehension: number;
};

function replay(opts: {
  until: number;
  from?: number;
  far: number;
  guard?: boolean;
  /**
   * Seconds the ITEM asks for, as `comprehensionTarget` would answer. 0 models a
   * host serving nothing but content the geometry already covers, which is what
   * this harness measured before the runway existed.
   */
  target?: number;
}): Sim {
  const { until, from = 0, far, guard = true, target = 0 } = opts;
  const rng = new Rng(1234);
  const dt = 1 / 60;
  const spawnZ = far * 0.88;
  let elapsed = 0, travel = 0, speed = V_START;
  let gate: { z: number } | null = null;
  let gateCooldown = 0.75;
  let nextBeatAt = 70;
  const hazards: number[] = [];
  let gates = 0, hit = 0, arrivals = 0, reading = 0, live = 0;
  let minDelivered = Infinity;
  let minComprehension = Infinity;
  /** `elapsed` when the sum for the *next* gate went on the HUD, or null. */
  let promptAt: number | null = null;

  while (elapsed < until) {
    elapsed += dt;
    speed = approachN(speed, speedAt(elapsed, false), 1.6, dt);
    const scroll = speed * dt;
    travel += scroll;

    if (gate) gate.z += scroll;
    for (let i = 0; i < hazards.length; i++) {
      const was = hazards[i] as number;
      hazards[i] = was + scroll;
      if (was < 0 && (hazards[i] as number) >= 0 && elapsed >= from) {
        arrivals++;
        if (gate) hit++;
      }
    }
    for (let i = hazards.length - 1; i >= 0; i--) if ((hazards[i] as number) > 26) hazards.splice(i, 1);

    if (elapsed >= from) {
      live += dt;
      if (gate) reading += dt;
    }

    if (gate && gate.z >= 0) {
      gate = null;
      gateCooldown = breather(travel);
      if (elapsed >= from) {
        gates++;
        if (promptAt !== null) minComprehension = Math.min(minComprehension, elapsed - promptAt);
      }
      promptAt = null;
    }
    if (!gate) {
      gateCooldown -= dt;
      // `preRead()`: the next sum goes on the HUD partway through the corridor,
      // and then lengthens the corridor to whatever the item asks for. Both halves,
      // in the order and with the arithmetic `mount.ts` uses.
      if (promptAt === null && gateCooldown <= breather(travel) - RESOLVE_HOLD) {
        promptAt = elapsed;
        gateCooldown = Math.max(gateCooldown, preReadLead(target));
      }
      if (gateCooldown <= 0) {
        const dist = gateDistance(speed, readWindow(travel, false), far);
        gate = { z: -dist };
        minDelivered = Math.min(minDelivered, dist / speed);
        // A corridor shorter than the hold hands the sum over with the gate.
        if (promptAt === null) promptAt = elapsed;
      }
    }

    if (travel >= nextBeatAt) {
      nextBeatAt = travel + speed * beatTime(travel);
      const blocked =
        guard &&
        hazardLandsOnRead({
          dist: spawnZ,
          elapsed,
          travel,
          speed,
          far,
          reduced: false,
          gateEndsIn: gate ? Math.max(0, -gate.z) / Math.max(1, speed) : null,
          cooldown: gateCooldown,
        });
      if (!blocked && rng.next() < clampN(0.42 + travel / 9000, 0.42, 0.78)) hazards.push(-spawnZ);
    }
  }
  return {
    gates,
    arrivalsWhileReading: hit,
    arrivals,
    readingDuty: reading / live,
    minDelivered,
    minComprehension,
  };
}

/** Every draw distance in `tiers.ts`, smallest first. */
const FARS = [300, 380, 440, 520];

/* --------------------------------- pacing --------------------------------- */

test("speed rises monotonically and is bounded by terminal velocity", () => {
  let prev = -1;
  for (let t = 0; t <= 1800; t += 5) {
    const v = speedAt(t, false);
    assert.ok(v >= prev - 1e-9, `speed went backwards at ${t}s`);
    assert.ok(v >= V_START - 1e-9 && v <= V_TERMINAL, `speed ${v} out of range at ${t}s`);
    prev = v;
  }
});

test("the run feels fast inside a five-minute free session", () => {
  // The business model gives a child 5-10 minutes. If terminal velocity is not
  // reached inside that, most players never see the game's top gear.
  assert.ok(speedAt(90, false) > 48, `only ${speedAt(90, false).toFixed(1)} u/s at 90 seconds`);
  assert.ok(speedAt(300, false) > 0.92 * V_TERMINAL, "not near terminal velocity at five minutes");
});

test("reduced motion caps speed without stopping the world", () => {
  for (const t of [0, 60, 600]) {
    const v = speedAt(t, true);
    assert.ok(v <= V_REDUCED_CAP, `reduced motion hit ${v} u/s`);
    assert.ok(v > 20, "reduced motion must still be a runner, not a slideshow");
  }
});

test("nothing to dodge arrives while a gate is being read", () => {
  // The promise in `emitBeat`. It was written as a comment over a comparison
  // between a hazard's spawn z (-334) and a gate's live z (never past -102), so
  // it never fired once: measured on origin/main this was 1.47 hazards per
  // reading window in the first ninety seconds and 2.03 from ninety seconds on,
  // identical to the numbers with the guard deleted entirely.
  for (const far of FARS) {
    const early = replay({ until: 90, far });
    const late = replay({ until: 300, from: 90, far });
    for (const [phase, r] of [["first 90s", early], ["90s-300s", late]] as const) {
      assert.ok(r.gates > 8, `${far}/${phase}: only ${r.gates} gates, nothing was measured`);
      const per = r.arrivalsWhileReading / r.gates;
      assert.ok(
        per <= 0.02,
        `far=${far} ${phase}: ${per.toFixed(2)} hazards arrive per reading window ` +
          `(${r.arrivalsWhileReading} across ${r.gates} gates)`,
      );
    }
  }
});

test("and the guard is actually wired into the beat that spawns them", () => {
  // The test above replays the loop rather than running `mount.ts`, which needs
  // a WebGL context. So it would still pass if `emitBeat` simply stopped
  // consulting the guard — which is *exactly* the shape of the bug being fixed
  // here: a promise written as a comment over a call that does nothing. The
  // count of places that decide whether a hazard spawns is the thing worth
  // pinning, so it is pinned.
  const src = readFileSync(new URL("./mount.ts", import.meta.url), "utf8");
  const beat = src.slice(src.indexOf("function emitBeat("), src.indexOf("/* ------------------------------ collisions"));
  assert.ok(beat.length > 200, "emitBeat has moved; this test needs re-aiming");
  assert.ok(
    beat.includes("hazardLandsOnRead("),
    "emitBeat must ask whether the hazard lands on a read before spawning one",
  );
  const call = beat.indexOf("hazardLandsOnRead(");
  const spawn = beat.indexOf("ents.spawnHazard(");
  assert.ok(spawn > call, "the question has to be asked before the hazard exists");
  assert.equal(
    (src.match(/ents\.spawnHazard\(/g) ?? []).length,
    (beat.match(/ents\.spawnHazard\(/g) ?? []).length,
    "every hazard in the game must come from the beat the guard covers",
  );
});

test("the corridor between gates is where the runner is still a runner", () => {
  // Relief comes from space and time. If the fix above were "delete the
  // hazards", this is what would notice: a run must still be dense with things
  // to dodge, they just all live between the gates now.
  for (const far of FARS) {
    const late = replay({ until: 300, from: 90, far });
    const perGate = late.arrivals / late.gates;
    assert.ok(perGate > 0.9, `far=${far}: only ${perGate.toFixed(2)} hazards per gate cycle — the world is empty`);
    assert.ok(
      late.readingDuty > 0.45 && late.readingDuty < 0.75,
      `far=${far}: reading is ${(late.readingDuty * 100).toFixed(0)}% of the clock — ` +
        "at 88% there is no corridor to put a pylon in, and at 40% it is not a maths game",
    );
  }
});

test("the reading window the child gets survives the draw distance", () => {
  // `readWindow` is a wish; a gate cannot spawn past the far plane. On the
  // smallest tier at full speed the clamp is what actually decides, so the
  // floor has to hold there or the promise is decoration.
  for (const far of FARS) {
    for (let speed = V_START; speed <= V_TERMINAL * V_SURGE_BOOST_MAX + 0.01; speed += 0.5) {
      for (const travel of [0, 2600, 20000, 1e6]) {
        const w = deliveredWindow(travel, speed, far, false);
        assert.ok(
          w >= DELIVERED_WINDOW_FLOOR - 1e-9,
          `far=${far} speed=${speed.toFixed(1)} travel=${travel}: only ${w.toFixed(2)}s to read`,
        );
      }
    }
    const late = replay({ until: 300, far });
    assert.ok(
      late.minDelivered >= DELIVERED_WINDOW_FLOOR - 1e-9,
      `far=${far}: a real run handed out a ${late.minDelivered.toFixed(2)}s window`,
    );
  }
  // And a gate is never spawned somewhere it cannot be drawn.
  for (const far of FARS) {
    assert.ok(gateDistance(1e6, 1e6, far) <= far, "a gate spawned beyond the far plane is invisible");
    assert.ok(gateDistance(0, 0, far) >= 68, "a gate on top of the player is not a question");
  }
});

test("the reading window answers to the cadence table, not to vibes", () => {
  // docs/EXPERIENCE_DESIGN.md: two-digit regrouping is instrumented at p50 6s /
  // p90 14s, and this pack's own pack.json claims
  // `dw.add.regroup.subtract-across-zero`. Three shown candidates is cheaper
  // than producing an answer cold — it is not four times cheaper, which is what
  // a 1.55s window assumed.
  assert.ok(READ_WINDOW_FLOOR >= 3, `a ${READ_WINDOW_FLOOR}s window is a coin toss with three faces`);
  assert.ok(readWindow(0, false) > 5, "the first gates must be generous");
  // The whole cycle — read it, then run the corridor — is the unit a child
  // actually spends on one question, and it should land near that 6s p50.
  const cycle = READ_WINDOW_FLOOR + DODGE_CORRIDOR_FLOOR;
  assert.ok(cycle >= 4.5 && cycle <= 9, `${cycle}s per question is outside the cadence table`);
});

test("the child has the sum before the gate that carries the answers", () => {
  // The pre-read. `deliveredWindow` is capped by the far plane at 3.20s at p50
  // however the pacing is tuned, and EXPERIENCE_DESIGN instruments a two-digit
  // regroup at p50 6s — so the sum goes on the HUD a corridor early and the
  // corridor becomes reading time too. This asserts the *combined* number, which
  // is the one a child experiences.
  for (const far of FARS) {
    for (let speed = V_START; speed <= V_TERMINAL * V_SURGE_BOOST_MAX + 0.01; speed += 0.5) {
      for (const travel of [0, 2600, 20000, 1e6]) {
        for (const reduced of [false, true]) {
          const c = comprehensionWindow(travel, speed, far, reduced);
          assert.ok(
            c >= COMPREHENSION_FLOOR - 1e-9,
            `far=${far} speed=${speed.toFixed(1)} travel=${travel} reduced=${String(reduced)}: ` +
              `only ${c.toFixed(2)}s with the question`,
          );
          // And it is genuinely more than the gate alone gives, everywhere. A
          // pre-read that collapses to the gate's own window is the bug back.
          assert.ok(
            c >= deliveredWindow(travel, speed, far, reduced) + DODGE_CORRIDOR_FLOOR - RESOLVE_HOLD - 1e-9,
            `far=${far} speed=${speed.toFixed(1)}: the pre-read added nothing`,
          );
        }
      }
    }
  }
  // Measured through the real scheduling loop rather than from the formula, with
  // the pre-read wired in exactly where `mount.ts` puts it.
  for (const far of FARS) {
    const late = replay({ until: 300, from: 90, far });
    assert.ok(late.gates > 8, `far=${far}: only ${late.gates} gates, nothing was measured`);
    assert.ok(
      late.minComprehension >= COMPREHENSION_FLOOR - 1e-9,
      `far=${far}: a real run gave a child ${late.minComprehension.toFixed(2)}s with a question`,
    );
    // The hazard-free part is untouched — that is the promise the pre-read must
    // not be allowed to quietly absorb, because pylons live in the corridor.
    assert.ok(
      late.minDelivered >= DELIVERED_WINDOW_FLOOR - 1e-9,
      `far=${far}: the gate's own window fell to ${late.minDelivered.toFixed(2)}s`,
    );
  }
});

test("and the pre-read is wired into the corridor, not just available", () => {
  // Same reason as the hazard guard below: the replay above is a model of the
  // loop, so it would still pass if `mount.ts` never called `preRead`. What is
  // pinned is that the corridor branch calls it, that it runs before the gate is
  // requested, and that the prompt is announced once rather than twice.
  const src = readFileSync(new URL("./mount.ts", import.meta.url), "utf8");
  const loop = src.slice(src.indexOf("if (!activeGate) {"), src.indexOf("if (travel >= nextBeatAt)"));
  assert.ok(loop.length > 80, "the corridor branch has moved; this test needs re-aiming");
  assert.ok(loop.includes("preRead()"), "the corridor must hand the child the next sum");
  assert.ok(
    loop.indexOf("preRead()") < loop.indexOf("requestGate()"),
    "the sum has to be on the HUD before the gate carrying its answers is spawned",
  );
  assert.ok(loop.includes("RESOLVE_HOLD"), "the corridor must still open with the answer just given");
  // One announcement per question: `requestGate` re-punches the prompt only when
  // the question was not pre-read.
  const req = src.slice(src.indexOf("function requestGate("), src.indexOf("function resolveGate("));
  assert.ok(req.includes("if (!announced) setPrompt("), "a pre-read sum must not be announced twice");
});

/* ---------------------- the window a question asks for --------------------- */

/** Everything the motion can be, which is what may not be allowed to matter. */
const MOTION: Array<[string, number, number, number, boolean]> = [];
for (const far of FARS) {
  for (const travel of [0, 600, 2600, 20000, 1e6]) {
    for (let speed = V_START; speed <= V_TERMINAL * V_SURGE_BOOST_MAX + 0.01; speed += 2.5) {
      for (const reduced of [false, true]) {
        MOTION.push([`far=${far} travel=${travel} speed=${speed.toFixed(1)} rm=${String(reduced)}`, travel, speed, far, reduced]);
      }
    }
  }
}

/** Every target the cadence table can produce, in order. */
const TARGETS = [2.8, 4.2, 6.0, 7.0, 10.0, 11.0, 14.0, 16.0, 20.0];

test("a harder question is never given less time than an easier one", () => {
  // `docs/PACING_AUDIT_2026-07.md`: "window(d) must be MONOTONE NON-DECREASING in
  // item difficulty." VOLTA was inverted — 8.00s for `5 − 2` on the opening gate
  // and 4.02s for a five-digit sum at terminal velocity on the smallest tier,
  // because the window was derived from the speed and the speed was the escalation
  // knob. Asserted at EVERY state of the world, not at a representative one.
  for (const [ctx, travel, speed, far, reduced] of MOTION) {
    let prev = -Infinity;
    for (const target of TARGETS) {
      const w = comprehensionFor(target, travel, speed, far, reduced);
      assert.ok(
        w >= prev - 1e-9,
        `${ctx}: a ${target}s question gets ${w.toFixed(2)}s, less than the ${prev.toFixed(2)}s an easier one got`,
      );
      prev = w;
    }
  }
});

test("the window is never shorter than the item asked for, in any state of the world", () => {
  // The other half, and the one that makes the invariant a floor rather than an
  // ordering: no combination of speed, distance travelled, draw distance or reduced
  // motion can take a question below its own target. Motion is on the left of a
  // `max` in `comprehensionFor` and nowhere else, so it can only ever add.
  for (const [ctx, travel, speed, far, reduced] of MOTION) {
    for (const target of TARGETS) {
      const w = comprehensionFor(target, travel, speed, far, reduced);
      assert.ok(w >= target - 1e-9, `${ctx}: a ${target}s question got ${w.toFixed(2)}s`);
    }
  }
});

test("the speed is untouched — the runway is what grows", () => {
  // The founder offered slowing down and then offered the better mechanism:
  // "the vehicle could still be racing but ... we maybe need some miles". So the
  // extra time has to arrive as distance, and the speed curve may not appear in
  // any of it. `preReadLead` takes one argument and it is the item's target, so
  // this is enforced by the signature; what is asserted here is that the seconds
  // it asks for are real road at the speed the world is actually moving.
  for (const target of TARGETS) {
    const lead = preReadLead(target);
    if (target <= DELIVERED_WINDOW_FLOOR) continue;
    assert.ok(lead > 0, `a ${target}s question bought no road at all`);
    for (const [ctx, , speed] of MOTION) {
      assert.ok(lead * speed > 0, `${ctx}: a ${target}s question bought no road`);
    }
  }
  assert.ok(
    preReadLead(16) * V_TERMINAL > 700,
    `16s at terminal velocity is only ${(preReadLead(16) * V_TERMINAL).toFixed(0)} units of road`,
  );
  // ...and the speed curve itself is untouched: the two ends of the run are the
  // same numbers they were before the runway existed.
  assert.equal(speedAt(0, false), V_START);
  assert.ok(Math.abs(speedAt(1e6, false) - V_TERMINAL) < 1e-6);
});

test("the runway ceiling is a guard, not a limiter", () => {
  // If `RUNWAY_MAX` ever binds, some item is being served less time than the table
  // says it needs and the clamp is hiding it. Raising the table without thinking
  // about the runway fails here.
  for (const target of [...TARGETS, MAX_TARGET]) {
    assert.ok(
      preReadLead(target) < RUNWAY_MAX - 1e-9,
      `a ${target}s question hit the ${RUNWAY_MAX}s ceiling: ${preReadLead(target).toFixed(2)}s of lead`,
    );
  }
  assert.ok(MAX_TARGET <= 20, `the table now tops out at ${MAX_TARGET}s; re-derive RUNWAY_MAX`);
});

test("the runway is road, not dead air: hazards keep arriving across it", () => {
  // A long corridor must not become a pause. Hazard beats are on their own cadence
  // — `beatTime` knows nothing about the gate cycle — so the longest runway the
  // table can ask for still has a dozen beats in it.
  for (const travel of [0, 2600, 20000]) {
    const lead = preReadLead(MAX_TARGET);
    const beats = lead / beatTime(travel);
    assert.ok(beats >= 8, `the longest runway at travel=${travel} holds only ${beats.toFixed(1)} hazard beats`);
  }
});

test("measured through the scheduler: the inversion the founder saw is gone", () => {
  // The replay, not the formula. `5 − 2` on the opening gate against the hardest
  // thing the table describes deep into a run on the smallest quality tier — the
  // exact two ends of his sentence.
  const easy = replay({ until: 40, far: 520, target: comprehensionTarget({ prompt: "5 − 2", answer: "3" }) });
  const hard = replay({ until: 300, from: 90, far: 300, target: comprehensionTarget({ prompt: "5001 − 2798", answer: "2203" }) });
  assert.ok(easy.gates > 3 && hard.gates > 3, "nothing was measured");
  assert.ok(
    hard.minComprehension > easy.minComprehension,
    `the hard question gets ${hard.minComprehension.toFixed(2)}s and the easy one ${easy.minComprehension.toFixed(2)}s`,
  );
  assert.ok(
    hard.minComprehension >= 16 - 1e-9,
    `a four-digit borrow across zero gets ${hard.minComprehension.toFixed(2)}s against the table's 16s`,
  );
  // And the gate's own hazard-free window is untouched by any of it.
  assert.ok(hard.minDelivered >= DELIVERED_WINDOW_FLOOR - 1e-9, `the gate's window fell to ${hard.minDelivered.toFixed(2)}s`);
});

test("measured through the scheduler: every rung of the table is delivered", () => {
  let prev = -Infinity;
  for (const target of TARGETS) {
    const sim = replay({ until: 400, from: 90, far: 300, target });
    assert.ok(sim.gates > 3, `${target}s: only ${sim.gates} gates`);
    assert.ok(sim.minComprehension >= target - 1e-9, `${target}s: a real run gave ${sim.minComprehension.toFixed(2)}s`);
    assert.ok(sim.minComprehension >= prev - 1e-9, `${target}s went backwards from ${prev.toFixed(2)}s`);
    assert.ok(sim.minDelivered >= DELIVERED_WINDOW_FLOOR - 1e-9, `${target}s: the gate's own window fell to ${sim.minDelivered.toFixed(2)}s`);
    prev = sim.minComprehension;
  }
});

test("and the runway is wired into the corridor, not just available", () => {
  // Same reason as the pre-read test above: the replay is a model, so it would
  // pass with `mount.ts` never applying the lead.
  const src = readFileSync(new URL("./mount.ts", import.meta.url), "utf8");
  const pre = src.slice(src.indexOf("function preRead("), src.indexOf("function requestGate("));
  assert.ok(pre.length > 80, "preRead has moved; this test needs re-aiming");
  assert.ok(pre.includes("comprehensionTarget(q)"), "the runway must be sized from the ITEM");
  assert.ok(pre.includes("preReadLead("), "the corridor must be lengthened for a hard question");
  assert.ok(pre.includes("gateCooldown = Math.max("), "the lead must reach the one number that schedules the gate");
  // And nothing in the scheduling may reach for the speed to size it.
  assert.ok(
    !/preReadLead\([^)]*speedAt/.test(src),
    "the runway is being sized from the speed curve, which is the defect it exists to remove",
  );
});

test("a hazard is still kept out of a read across the longer corridor", () => {
  // #665's guard is handed the LIVE cooldown, so a runway-lengthened corridor is
  // exact for the cycle a hazard is actually flying through. Asserted rather than
  // assumed, at the longest runway the table can produce.
  for (const far of FARS) {
    const sim = replay({ until: 400, from: 90, far, target: MAX_TARGET });
    assert.ok(sim.gates > 3, `far=${far}: nothing was measured`);
    assert.equal(
      sim.arrivalsWhileReading,
      0,
      `far=${far}: ${sim.arrivalsWhileReading} of ${sim.arrivals} hazards landed while a gate was up`,
    );
  }
});

test("the pre-read is still short of the cadence table, and that is written down", () => {
  // EXPERIENCE_DESIGN wants p50 6s. The pre-read reaches 4.79-4.80s and cannot
  // reach further: `readWindow` already sits at the largest floor the far plane
  // can honour, so the remaining second has to come from the low tier's draw
  // distance or from terminal velocity, and both of those are decisions about
  // frame rate and feel rather than about reading. Pinned as a band so that
  // shrinking the pre-read fails here, and so does reaching the target without
  // updating the note in `pacing.ts` and the README.
  const late = replay({ until: 300, from: 90, far: 300 });
  assert.ok(
    late.minComprehension >= COMPREHENSION_FLOOR && late.minComprehension < 6.0,
    `the worst comprehension window is now ${late.minComprehension.toFixed(2)}s — ` +
      "if that is 6s or more, the cadence table is met and the caveats should go",
  );
});

test("a hazard is only held back when it would actually land on a read", () => {
  // The projection on its own, in a steady state: deep into a run the speed
  // curve is flat, so a hazard's flight time is just distance over speed and
  // the answer can be worked out by hand.
  const base = {
    elapsed: 2000, travel: 200000, speed: V_TERMINAL,
    far: 380, reduced: false, cooldown: 0,
  };
  const w = deliveredWindow(base.travel, base.speed, base.far, false); // ~3.2s
  const b = breather(base.travel); // ~1.9s
  const unit = V_TERMINAL; // one second of flight, in world units

  // A gate resolving in 1s. Reading now..1s, corridor 1..1+b, then w again.
  const at = (seconds: number, gateEndsIn: number | null, cooldown = 0) =>
    hazardLandsOnRead({ ...base, cooldown, gateEndsIn, dist: seconds * unit });
  assert.equal(at(0.5, 1), true, "landing inside the live gate's own window");
  assert.equal(at(1 + b * 0.5, 1), false, "landing in the middle of the corridor");
  assert.equal(at(1 + b + w * 0.5, 1), true, "landing inside the next gate's window");
  assert.equal(at(1 + b + w + b * 0.5, 1), false, "and the corridor after that is open");

  // Nothing up yet, next gate requested in 1.5s.
  assert.equal(at(0.7, null, 1.5), false);
  assert.equal(at(1.5 + w * 0.5, null, 1.5), true);

  // Six seconds downrange — a whole cycle out — is still answered honestly.
  const cycle = w + b;
  assert.equal(at(1 + b + cycle + w * 0.5, 1), true, "two cycles out, mid-read");
  assert.equal(at(1 + b + cycle * 2 + w + b * 0.5, 1), false, "three cycles out, corridor");

  // Degenerate input must terminate rather than spin.
  assert.equal(typeof hazardLandsOnRead({ ...base, gateEndsIn: null, dist: 1e9 }), "boolean");
  assert.equal(typeof hazardLandsOnRead({ ...base, gateEndsIn: null, dist: 0 }), "boolean");
});

test("the reading window shrinks but never below its floor", () => {
  let prev = Infinity;
  for (let m = 0; m <= 60000; m += 50) {
    const w = readWindow(m, false);
    assert.ok(w <= prev + 1e-9, `reading window grew at ${m}m`);
    assert.ok(w >= READ_WINDOW_FLOOR - 1e-9, `reading window collapsed to ${w}s at ${m}m`);
    prev = w;
  }
  assert.ok(readWindow(0, false) > 3, "the first gates must be generous");
  assert.ok(readWindow(1e9, true) > readWindow(1e9, false), "reduced motion must buy extra reading time");
});

test("gate cadence and hazard beats stay positive and tighten with distance", () => {
  for (const [fn, name] of [[breather, "breather"], [beatTime, "beat"]] as const) {
    let prev = Infinity;
    for (let m = 0; m <= 40000; m += 100) {
      const v = fn(m);
      assert.ok(v > 0.15, `${name} collapsed to ${v}s at ${m}m`);
      assert.ok(v <= prev + 1e-9, `${name} grew at ${m}m`);
      prev = v;
    }
  }
});

test("a twenty-minute run keeps escalating rather than plateauing into nothing", () => {
  // Distance covered over twenty minutes, integrated at one-second steps.
  let travel = 0;
  for (let t = 0; t < 1200; t++) travel += speedAt(t, false);
  assert.ok(travel > 60000, `only ${Math.round(travel)}m in twenty minutes`);
  // The reading window at that distance is still at its floor, not below it.
  assert.equal(readWindow(travel, false) >= READ_WINDOW_FLOOR, true);
});

/* ------------------------------- difficulty ------------------------------- */

test("difficulty climbs on answers read correctly, and is clamped", () => {
  assert.ok(difficultyFor(1, 8, 0) < difficultyFor(1, 8, 8));
  assert.ok(difficultyFor(1, 100, 20) < difficultyFor(1, 100, 60));
  assert.ok(difficultyFor(9, 100, 100) <= 12);
  assert.ok(difficultyFor(1, 100, 0) >= 0, "difficulty must never go negative");
  // A step is worth a handful of gates, not a whole session and not one gate.
  assert.ok(GATES_PER_STEP >= 3 && GATES_PER_STEP <= 8);
});

test("surviving is not an achievement: distance alone never raises the maths", () => {
  // The bug this replaces: `1 + travel/900` handed a child a harder question
  // every fifteen seconds of *staying alive*, so a player who answered nothing
  // correctly and merely dodged well was escalated at anyway. Nothing in the
  // signature may be a proxy for run length — a run is a number of gates and a
  // number of them right, and only the second one is an achievement.
  assert.equal(difficultyFor.length, 3, "difficultyFor must not take a distance again");
  const src = readFileSync(new URL("./mount.ts", import.meta.url), "utf8");
  const call = /const difficulty = \(\)[^\n]*/.exec(src)?.[0] ?? "";
  assert.ok(call.includes("difficultyFor("), "the difficulty hint has moved; re-aim this test");
  assert.ok(!call.includes("travel"), `distance is back in the difficulty hint: ${call}`);
  const noneRight = [0, 4, 20, 60, 200].map((gates) => difficultyFor(1, gates, 0));
  const first = noneRight[0] as number;
  for (const d of noneRight) {
    assert.ok(d <= first, `a child answering nothing right was escalated to ${d}`);
  }
});

test("a child who is drowning gets relief, not more escalation", () => {
  const struggling = difficultyFor(1, 10, 4); // 40% right
  const cruising = difficultyFor(1, 10, 10);
  assert.ok(struggling < cruising - 1.5, "a bad patch must visibly ease the questions");
  // Fewer than four answered is not evidence of anything; do not punish it.
  assert.equal(difficultyFor(1, 3, 0), difficultyFor(1, 0, 0));
});

/* --------------------------------- economy -------------------------------- */

test("the damage economy survives mistakes but punishes guessing", () => {
  // Three lanes means a guesser is right a third of the time. Guessing must be
  // strictly worse than reading, and one mistake must not end a run.
  assert.ok(VOLT_MAX / COST_WRONG_GATE > 3, "fewer than three wrong gates ends a run");
  assert.ok(VOLT_MAX / COST_WRONG_GATE < 5, "wrong gates cost too little to matter");
  const perGuess = (1 / 3) * GAIN_GATE - (2 / 3) * COST_WRONG_GATE;
  assert.ok(perGuess < -10, `guessing nets ${perGuess.toFixed(1)} voltage per gate, which is survivable`);
  const perRead = GAIN_GATE;
  assert.ok(perRead > 0, "reading must be net positive");
  assert.ok(COST_HAZARD < COST_WRONG_GATE, "a reflex slip must cost less than a maths mistake");
});

test("the passive bleed is pressure, not a countdown", () => {
  // Doing nothing else, an untouched player survives well past the free tier's
  // ten minutes; the bleed only matters alongside mistakes.
  assert.ok(VOLT_MAX / VOLT_BLEED > 400, `bleed alone kills in ${(VOLT_MAX / VOLT_BLEED).toFixed(0)}s`);
});

/* ----------------------------------- rng ---------------------------------- */

test("the rng is deterministic, bounded and uniform enough to trust", () => {
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const seqA = Array.from({ length: 500 }, () => a.next());
  const seqB = Array.from({ length: 500 }, () => b.next());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, Array.from({ length: 500 }, () => c.next()));
  for (const v of seqA) assert.ok(v >= 0 && v < 1);

  const r = new Rng(7);
  const buckets = new Array(3).fill(0);
  for (let i = 0; i < 30000; i++) buckets[r.int(0, 2)]++;
  for (const n of buckets) assert.ok(n > 9000 && n < 11000, `lane bias: ${buckets.join("/")}`);

  // A zero seed must not collapse the generator to a constant.
  const z = new Rng(0);
  assert.notEqual(z.next(), z.next());
});

test("shuffle is a permutation, in place, and reproducible", () => {
  const r1 = new Rng(11), r2 = new Rng(11);
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const out = r1.shuffle(xs.slice());
  assert.deepEqual(out.slice().sort((a, b) => a - b), xs);
  assert.deepEqual(out, r2.shuffle(xs.slice()));
});
