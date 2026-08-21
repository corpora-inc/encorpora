// Nothing in MONUMENT takes anything away from a child for thinking.
//
// Three claims, and every one of them was true of this game's comments while
// being false of its code:
//
//   1. **The dither is gone.** `T.DITHER_*` made the sweep 16% faster every three
//      sweeps a child spent reading, compounding to 1.90×, and the last line of
//      the game's own manual is "Waiting never costs you anything". Measured on
//      the real sim at floor 0: 1.00× at three seconds, 1.16× at ten, 1.80× at
//      twenty, 1.90× at thirty. Deleted, not softened.
//   2. **What it was for is handled properly.** The one real thing it did was stop
//      a run sitting on an item forever — `place()` reports `clock − questionAt`,
//      so a stone set after a ten-minute interruption reached the curriculum as
//      ten minutes of failing to answer `7 + ? = 10`. An abandonment guard does
//      that now: derived from the item, refilled by any input, never drawn, and it
//      takes nothing when it fires.
//   3. **A wrong drop is not rushed past.** The completed sum used to be a flat
//      0.85 s — long enough to notice a mistake, not long enough to read the sum
//      it was about. It is now the shared pacing curve, patient at the calm end
//      and brief at the top, and it is the child who takes it down.
//
// Everything here runs the real `Sim`.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

import { Sim } from "./sim.ts";
import {
  ABANDON_FACTOR,
  MIN_GUARD_SECONDS,
  comprehensionSeconds,
  guardSecondsFor,
  needsRegrouping,
  widestColumn,
} from "./guard.ts";
import { T, perfectTol, revealDwell, sweepSpeed } from "./tuning.ts";
import type { Host, Question } from "../contract.ts";
import { createStubHost } from "../host/stub.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** The reveal MONUMENT shipped with, kept only to measure against. */
const OLD_REVEAL_SECONDS = 0.85;
/** …and the dither's ceiling, for the same reason. */
const OLD_DITHER_MAX = 1.9;

type Report = { questionId: string; correct: boolean; ms: number; answered: string };

function fixedHost(
  q: Partial<Question> = {},
): Host & { reports: Report[]; haptics: string[] } {
  let n = 0;
  const reports: Report[] = [];
  const haptics: string[] = [];
  return {
    reports,
    haptics,
    next(): Question {
      n++;
      return {
        id: `q${n}`,
        prompt: "7 + ? = 10",
        answer: "3",
        distractors: ["4", "2", "17"],
        domain: "bond-10",
        difficulty: 1,
        ...q,
      };
    },
    report(r) {
      reports.push(r as Report);
    },
    haptic(k) {
      haptics.push(k);
    },
    prefersReducedMotion() {
      return false;
    },
  };
}

/** Put the sweep exactly `delta` from true, with `value` showing. */
function aim(sim: Sim, delta: number, value: string): void {
  sim.dismissReveal();
  const i = sim.slots.indexOf(value);
  assert.notEqual(i, -1, `value ${value} not among slots ${sim.slots.join(",")}`);
  sim.slot = i;
  sim.holdLeft = 0;
  const axis = sim.axis;
  const centre = (axis === 0 ? sim.cx : sim.cz) + (axis === 0 ? sim.bendX(1) : sim.bendZ(1));
  sim.sweep = centre + delta;
}

/** `seconds` of a child doing absolutely nothing, at sixty frames a second. */
function idle(sim: Sim, seconds: number, from = 0): number {
  const dt = 1 / 60;
  let t = from;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.update(dt, t);
    t += dt;
  }
  return t;
}

/** Every production `.ts` in the pack, `*.test.ts` excluded. */
function productionFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
    }
  };
  walk(join(HERE, ".."));
  return out;
}

/**
 * A file with its comments taken out.
 *
 * The history of the dither is written down all over this pack on purpose — that
 * is how the next author learns why it may not come back — so a scan for its
 * identifiers has to read the code and not the prose.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

// ── 1. the dither, deleted ──────────────────────────────────────────────────

test("nothing named a dither survives anywhere in the source", () => {
  // The deletion, held open. `DITHER_CYCLES`, `DITHER_STEP`, `DITHER_MAX`, the
  // `dither` field and the `cyclesIdle` counter that armed it were the mechanism's
  // whole surface. None of them may come back under any name, in any file — a
  // scan of `tuning.ts` alone would sail straight past the same thing rebuilt in
  // `sim.ts`.
  const files = productionFiles();
  assert.ok(files.length >= 20, `only ${files.length} production files — this scan has gone stale`);
  for (const file of files) {
    const code = codeOf(readFileSync(file, "utf8"));
    for (const banned of ["DITHER_CYCLES", "DITHER_STEP", "DITHER_MAX", "dither", "cyclesIdle"]) {
      assert.ok(!code.includes(banned), `${file} has \`${banned}\` in it — the dither is back`);
    }
  }
});

test("the sweep speed is a function of the floor and of nothing else", () => {
  // `sweepSpeed(floor, dither)` took a multiplier. The parameter is gone rather
  // than defaulted to one, so nothing can quietly start passing it again: the
  // arity is the assertion.
  assert.equal(sweepSpeed.length, 1, "sweepSpeed takes a second argument again");
  const call = sweepSpeed as unknown as (a: number, b?: number) => number;
  for (const floor of [0, 1, 7, 20, 60]) {
    assert.equal(call(floor, 1.9), call(floor), `floor ${floor} still listens to a second argument`);
  }
});

test("thinking never moves the stone, however long it goes on", () => {
  // The measurement, on the real sim. `|Δsweep| / dt` is the stone's actual speed,
  // frame by frame, and over three unbroken minutes of a child doing nothing it
  // may never once exceed the speed the floor alone says it should be.
  const rows: Array<Record<string, string>> = [];
  const dt = 1 / 60;
  for (const floor of [0, 8, 30]) {
    const sim = new Sim(fixedHost());
    // Climb to the floor under test the only way there is.
    for (let i = 0; i < floor; i++) {
      aim(sim, 0, "3");
      assert.ok(sim.place(i), `could not reach floor ${floor}`);
    }
    assert.equal(sim.floor, floor);
    const want = sweepSpeed(floor);
    let worst = 0;
    let t = 0;
    for (let i = 0; i < 60 * 180; i++) {
      const before = sim.sweep;
      sim.update(dt, t);
      t += dt;
      // A turnaround, or the guard putting the item back, both jump the sweep.
      const moved = Math.abs(sim.sweep - before);
      if (moved <= want * dt * 1.5) worst = Math.max(worst, moved / dt);
    }
    rows.push({
      floor: String(floor),
      "sweep u/s": want.toFixed(3),
      "fastest seen in 180s of hesitating": worst.toFixed(3),
      "old ceiling after 30s": (want * OLD_DITHER_MAX).toFixed(3),
    });
    assert.ok(
      worst <= want + 1e-9,
      `floor ${floor}: three minutes of thinking took the stone to ${worst.toFixed(3)} u/s against ${want.toFixed(3)}`,
    );
  }
  console.table(rows);
});

// ── 2. the abandonment guard ────────────────────────────────────────────────

test("the guard measures abandonment, not thought", () => {
  const host = fixedHost();
  const sim = new Sim(host);
  const guard = sim.guardSeconds;
  assert.ok(
    guard >= MIN_GUARD_SECONDS,
    `the guard on the easiest item in the game is only ${guard}s`,
  );

  // A child fiddling with the screen every few seconds keeps the item open for
  // ever. Twenty-four rounds of it, each one nearly the whole budget.
  const item = sim.question.id;
  let t = 0;
  for (let i = 0; i < 24; i++) {
    t = idle(sim, guard - 1, t);
    sim.nudge();
    assert.equal(sim.question.id, item, `a hand on the glass did not put the budget back (nudge ${i})`);
  }
  assert.ok(t > guard * 20, "the item was not actually held open for very long");
  assert.deepEqual(host.reports, [], "and none of that reached the ladder");

  // Genuinely walk away, though, and the item goes back — with nothing reported,
  // because nobody set a stone.
  const width = sim.width;
  const floor = sim.floor;
  idle(sim, guard + 2, t);
  assert.notEqual(sim.question.id, item, `an abandoned item must go back after ${guard}s`);
  assert.deepEqual(host.reports, [], "not answering is still not answering wrong");
  assert.equal(sim.width, width, "the guard took width off the tower");
  assert.equal(sim.floor, floor, "the guard moved the run");
  assert.equal(sim.phase, "sweep", "the guard ended the run");
});

test("the guard never bills a walk-away to the curriculum", () => {
  // What the dither was really covering for. `ms` on every report is
  // `clock − questionAt`; a five-minute interruption used to reach the ladder as
  // five minutes of a child failing an item they never saw.
  const host = fixedHost();
  const sim = new Sim(host);
  const t = idle(sim, 300);
  aim(sim, 0, "3");
  assert.ok(sim.place(t));
  assert.equal(host.reports.length, 1);
  const r = host.reports[0] as Report;
  assert.ok(
    r.ms < sim.guardSeconds * 1000,
    `five minutes away was billed as ${(r.ms / 1000).toFixed(0)}s of thinking`,
  );
});

test("the guard is derived from the item and the stone, never a constant", () => {
  const easy = { prompt: "7 + ? = 10", answer: "3" };
  const carry = { prompt: "47 + ? = 72", answer: "25" };
  const wide = { prompt: "5001 - ? = 2203", answer: "2798" };
  assert.ok(
    guardSecondsFor(wide, 4) > guardSecondsFor(carry, 4),
    `"5001 − ?" got ${guardSecondsFor(wide, 4)}s against "47 + ?"'s ${guardSecondsFor(carry, 4)}s`,
  );
  // Width, isolated from the faces. `7 + ? = 10` is not the narrower item it looks
  // like — the sum is two columns wide, and the widest thing on the plate is what
  // the child has to read.
  assert.equal(widestColumn(easy), 2);
  assert.ok(
    comprehensionSeconds(wide, 4) > comprehensionSeconds(carry, 4),
    "a wider column is worth no more patience than a narrower one",
  );
  assert.ok(
    comprehensionSeconds(wide, 4) > comprehensionSeconds(wide, 2),
    "four faces to scan is worth no more patience than two",
  );
  // Regrouping, isolated from width — and read off the *completed* sum, because
  // MONUMENT's prompts carry the blank and `473 + ?` has no second operand until
  // the answer goes back into it. A version of this that read the prompt alone
  // failed to parse every item in the game and handed them all the same figure.
  const borrows = { prompt: "473 + ? = 641", answer: "168" };
  const clean = { prompt: "412 + ? = 635", answer: "223" };
  assert.equal(needsRegrouping(borrows), true);
  assert.equal(needsRegrouping(clean), false);
  assert.ok(
    comprehensionSeconds(borrows, 2) > comprehensionSeconds(clean, 2),
    `carrying got ${comprehensionSeconds(borrows, 2)}s against a clean column's ${comprehensionSeconds(clean, 2)}s`,
  );
  assert.ok(guardSecondsFor(borrows, 4) > guardSecondsFor(clean, 4));
  // And it clears the arithmetic's own p90 on everything, which is the property a
  // limit sized *at* a p90 can never have.
  for (const item of [easy, carry, wide]) {
    for (const faces of [2, 3, 4]) {
      assert.ok(
        guardSecondsFor(item, faces) >= ABANDON_FACTOR * comprehensionSeconds(item, faces),
        `"${item.prompt}" with ${faces} faces gets under ${ABANDON_FACTOR}× its own p90`,
      );
    }
  }
});

test("the guard is monotone, and nothing can pin an item open", () => {
  let previous = 0;
  for (const digits of [1, 2, 3, 4, 5]) {
    const n = "9".repeat(digits);
    const s = guardSecondsFor({ prompt: `${n} + ? = ${n}`, answer: n }, 4);
    assert.ok(s >= previous, `${digits} digits got ${s}s after ${previous}s`);
    previous = s;
  }
  // There is no MAX_GUARD_SECONDS and none is needed: the table's own clamp is the
  // ceiling. Anything wider than it is treated as its widest row.
  const widest = guardSecondsFor({ prompt: "5001 - ? = 2203", answer: "2798" }, 4);
  for (const absurd of [
    { prompt: "123456789 + ? = 1111111110", answer: "987654321" },
    { prompt: "a bag of dates and a bag of figs", answer: "" },
    { prompt: "", answer: "" },
  ]) {
    const s = guardSecondsFor(absurd, 4);
    assert.ok(s <= widest, `"${absurd.prompt}" asked for ${s}s, past the table's widest row`);
    assert.ok(s >= MIN_GUARD_SECONDS, `"${absurd.prompt}" got less than the floor: ${s}s`);
  }
  // An unreadable prompt is given the LONGER silence, never the shorter.
  assert.equal(needsRegrouping({ prompt: "3/4 + ? = 1", answer: "1/4" }), true);
  assert.equal(widestColumn({ prompt: "47 + ? = 72", answer: "25" }), 2);
});

test("nothing that draws can read the guard, so nothing can draw it", () => {
  // The third property, held structurally. A guard a child can watch is a
  // countdown with a different name, and MONUMENT has a HUD and a whole `view/`
  // that could put one on screen.
  for (const dir of ["view", "ui"]) {
    const at = join(HERE, "..", dir);
    const files = readdirSync(at).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    assert.ok(files.length >= 2, `only ${files.length} files in ${dir}/ — this scan has gone stale`);
    for (const file of files) {
      const src = readFileSync(join(at, file), "utf8");
      for (const banned of ["guardSeconds", "idleSeconds"]) {
        assert.ok(
          !src.includes(banned),
          `${dir}/${file} reads \`${banned}\` — the guard is being drawn`,
        );
      }
    }
  }
});

// ── 3. the marinate beat ────────────────────────────────────────────────────

test("the completed sum is patient at the bottom and brief at the top", () => {
  // The shared pacing curve, spent backwards: `revealCalmMs × (1 − intensity)²`,
  // floored so the top gets a brief beat rather than none at all. The rung is the
  // run of true values the child was carrying in — see `revealDwell` for why it is
  // that and not the height of the tower or the clock.
  const rows = [0, 1, 2, 3, 4, 5, 8, 20].map((streak) => ({
    "true values in a row": streak,
    "sum held (s)": revealDwell(streak).toFixed(2),
    "shipped (s)": OLD_REVEAL_SECONDS.toFixed(2),
  }));
  console.table(rows);

  assert.ok(
    revealDwell(0) > OLD_REVEAL_SECONDS * 4,
    `a standing start gets ${revealDwell(0).toFixed(2)}s against the ${OLD_REVEAL_SECONDS}s it shipped with`,
  );
  assert.ok(revealDwell(0) > revealDwell(T.REVEAL_STREAK), "the reveal is not adaptive at all");
  // Monotone: more mastery is never MORE patience.
  let previous = Infinity;
  for (let streak = 0; streak <= 120; streak++) {
    const v = revealDwell(streak);
    assert.ok(v <= previous + 1e-9, `the sum was held LONGER at a run of ${streak}`);
    assert.ok(v >= T.REVEAL_MIN - 1e-9, `a run of ${streak} would tear the sum down in ${v.toFixed(2)}s`);
    previous = v;
  }
});

test("the brief reveal cannot be reached by a child who is struggling", () => {
  // The asymmetry that ruled out both tenure signals. A run of nothing but wrong
  // values must get the *most* patient reveal there is, every single time, however
  // long it goes on and however tall the tower already was. Measured on the real
  // sim: the height of the tower took this from 4.20 s to 2.21 s over eleven wrong
  // drops, which is patience being withdrawn from the one child who needed it.
  const sim = new Sim(fixedHost());
  let drops = 0;
  const dwells: number[] = [];
  while (sim.phase === "sweep" && drops < 200) {
    aim(sim, 0.02, "4");
    assert.ok(sim.place(drops), "a wrong drop was refused");
    if (sim.phase === "sweep") dwells.push(sim.revealLeft);
    drops++;
  }
  assert.ok(drops > 3, "the run ended before anything was measured");
  assert.equal(sim.phase, "over", "a run of nothing but wrong values never ended");
  for (const d of dwells) {
    assert.equal(d, revealDwell(0), `a struggling child was held for only ${d.toFixed(2)}s`);
  }

  // And a tall tower does not change that: the same child, ten true courses in,
  // still gets the patient version the moment they make two mistakes.
  const tall = new Sim(fixedHost());
  for (let i = 0; i < 10; i++) {
    aim(tall, 0, "3");
    assert.ok(tall.place(i));
  }
  aim(tall, 0.02, "4");
  tall.place(50);
  const first = tall.revealLeft;
  aim(tall, 0.02, "4");
  tall.place(51);
  assert.equal(
    tall.revealLeft,
    revealDwell(0),
    `a second mistake at floor ${String(tall.floor)} got ${tall.revealLeft.toFixed(2)}s`,
  );

  // …and the anti-vacuity half: the curve really does shorten, for somebody who
  // has just earned it. `first` is the reveal after a run of ten true values.
  assert.ok(
    first < revealDwell(0) * 0.3,
    `ten true values in a row still bought a ${first.toFixed(2)}s reveal`,
  );
});

test("the completed sum waits for the child, and one tap takes it down", () => {
  const host = fixedHost();
  const sim = new Sim(host);
  aim(sim, 0.05, "4");
  sim.place(1);
  assert.equal(sim.revealPrompt, "7 + ? = 10");
  assert.equal(sim.revealAnswer, "3");

  // Read it for as long as the beat allows, one frame at a time. Nothing turns
  // over, nothing moves and no guard runs underneath it.
  const parked = sim.sweep;
  const slots = sim.slots.join("|");
  const dwell = sim.revealLeft;
  assert.ok(dwell > OLD_REVEAL_SECONDS * 4, `only ${dwell.toFixed(2)}s to read the sum`);
  const t = idle(sim, dwell * 0.9, 2);
  assert.equal(sim.revealPrompt, "7 + ? = 10", "the sum went before its own beat was up");
  assert.equal(sim.sweep, parked, "the stone moved while the sum was being read");
  assert.equal(sim.slots.join("|"), slots, "the item turned over behind the sum");
  assert.equal(sim.idleSeconds, 0, "the abandonment guard ran while the child was reading");

  // And one tap ends it — nothing else.
  const floor = sim.floor;
  assert.equal(sim.dismissReveal(), true, "the tap did not land on the sum");
  assert.equal(sim.revealPrompt, null);
  assert.equal(sim.floor, floor, "the dismissing tap also set a stone");
  assert.equal(host.reports.length, 1, "the dismissing tap was reported as an answer");
  // The stone is moving again in the very next frame: nobody is held.
  idle(sim, 1 / 60, t);
  assert.equal(sim.holdLeft > 0 || sim.sweep !== parked, true, "the game did not start again");
  assert.equal(sim.dismissReveal(), false, "a second tap dismissed a sum that was not there");
});

test("the sum is not an answering window, and reading it is billed to nobody", () => {
  const host = fixedHost();
  const sim = new Sim(host);
  aim(sim, 0.05, "4");
  sim.place(1);
  const floor = sim.floor;
  const width = sim.width;

  // The sweep is parked out past the tower's edge while the sum is up, so a tap
  // that got through here used to be a guaranteed miss — a second bite out of the
  // tower for having read the lesson.
  assert.equal(sim.place(2), null, "a stone was set inside the reveal");
  assert.equal(sim.floor, floor);
  assert.equal(sim.width, width);
  assert.equal(host.reports.length, 1, "the reveal reported a second answer");

  // And the next item's clock does not start until the sum is down.
  const t = idle(sim, sim.revealLeft + 0.1, 2);
  aim(sim, 0, "3");
  sim.place(t + 5);
  const r = host.reports[host.reports.length - 1] as Report;
  assert.ok(r.correct);
  assert.ok(
    r.ms < 5200,
    `the seconds spent reading the completed sum were billed to the next item: ${r.ms}ms`,
  );
});

test("a wrong drop is completed, never corrected", () => {
  // The tone rule. A wrong value gets the stone-cracking it earned — this game's
  // one readable variable is the width of the tower and it may not lie — and then
  // the sum finishes itself. What it must never get is a verdict: no `failure`
  // cue for arithmetic, and the completed part drawn in the colour a correct
  // answer is celebrated in rather than in a red one.
  const host = fixedHost();
  const sim = new Sim(host);
  aim(sim, 0.05, "4");
  sim.place(1);
  assert.deepEqual(host.haptics, ["heavy"], `a wrong sum was answered with ${host.haptics.join(",")}`);
  idle(sim, sim.revealLeft + 1, 2);
  assert.deepEqual(host.haptics, ["heavy"], "the completed sum fired a cue of its own");

  const hud = readFileSync(join(HERE, "..", "ui", "hud.ts"), "utf8");
  const fill = /\.mn-prompt \.fill \{ color:([^;]+); \}/.exec(hud);
  assert.ok(fill, "the completed part of the sum is no longer styled on its own");
  assert.equal(
    fill[1],
    "var(--ac)",
    `the completed sum is drawn in ${fill[1]} — it must be the accent a correct answer celebrates in`,
  );
  assert.ok(
    /\.mn-true \{[^}]*color:var\(--ac\)/.test(hud),
    "the celebration stopped using the accent, so the line above no longer means anything",
  );
});

test("the whole thing holds up under a real host, for a long run", () => {
  // A soak against the shipping question generator rather than one fixed item:
  // every guard the curriculum can ask for clears its floor, the reveal is always
  // within its own bounds, and a run of careful play never once reports a stone
  // it did not set.
  const reports: Report[] = [];
  const host = createStubHost({ seed: 0x51ab, onReport: (r) => reports.push(r as Report) });
  const sim = new Sim(host, 0x51ab);
  const dt = 1 / 60;
  let t = 0;
  let placed = 0;
  for (let i = 0; i < 60 * 600 && sim.phase === "sweep"; i++) {
    assert.ok(
      sim.guardSeconds >= MIN_GUARD_SECONDS,
      `floor ${sim.floor} got a ${sim.guardSeconds}s guard`,
    );
    assert.ok(sim.revealLeft <= revealDwell(0) + 1e-9, "a reveal outlasted the most patient one there is");
    sim.update(dt, t);
    t += dt;
    // A child who reads the completed sum for a beat, then plays on.
    if (sim.revealLeft > 0) {
      if (sim.revealLeft < revealDwell(0) * 0.4) sim.dismissReveal();
      continue;
    }
    if (sim.holdLeft > 0) continue;
    if (sim.value !== sim.question.answer) continue;
    const axis = sim.axis;
    const centre = (axis === 0 ? sim.cx : sim.cz) + (axis === 0 ? sim.bendX(1) : sim.bendZ(1));
    if (Math.abs(sim.sweep - centre) > perfectTol(sim.floor) * 0.6) continue;
    if (sim.place(t)) placed++;
  }
  assert.ok(placed > 20, `only ${placed} stones set in the soak, so nothing was measured`);
  assert.equal(reports.length, placed, "a report crossed the wire without a stone behind it");
  assert.ok(
    reports.every((r) => r.ms >= 0 && r.ms < 120_000),
    "a report carried an absurd thinking time",
  );
});
