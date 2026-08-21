/**
 * What POLARITY asks the host for, and what happens at the rung it cannot draw.
 *
 * Two failures live here, and the second is the one this file exists for.
 *
 * **The scale.** The host reads a request below 1 as a 0..1 fraction and 1..10
 * as a ladder index, and resolves `1` — the one value both scales claim — as the
 * BOTTOM. POLARITY sent `clamp(0.14 + stratum * 0.06, 0, 1)`, which reaches
 * exactly 1 at stratum 15, and meant the top. So the single number this game was
 * guaranteed to reach was the number that meant the opposite of what it wanted.
 *
 * **The soft-lock.** A pack that cannot print an answer must not offer it, and
 * this one declines correctly and loudly. But declining is per-ITEM and the host
 * serves by RUNG: ask again at the same difficulty and the same rung answers. So
 * a level whose every item is too wide is not a graceful degradation — the
 * Bearer refuses six times, cracks open having asked nothing, and the next one
 * does the same, forever, for the child who has climbed highest. That is what
 * `NUMERAL_WIDTH_BLOCKED_LEVELS` recorded, and `next({ maxDifficulty })` is the
 * seam that ends it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { Ask, Host, Question } from "../contract.ts";
import { LABEL_MAX_CHARS } from "../core/labels.ts";
import { tierByName } from "../core/tier.ts";
import { askShape, ladderScale, launchBoss, stepBoss } from "./seal.ts";
import { startRun } from "./sim.ts";
import type { Enemy } from "./types.ts";
import { makeWorld, type World } from "./world.ts";

/**
 * A host that serves by RUNG, which is the whole point.
 *
 * The clamp rules are transcribed from `createItemService.next` in
 * `dynawalla-app/src/packs/items.ts` — the request **rounds** to the nearest
 * rung because a pack asking for 0.5 wants the middle, the ceiling **floors**
 * because "the stream never goes above it" and rounding a cap can only round it
 * up — and the scale rule from `toUnit` in `packs/shared/game-host`. Reproduced
 * rather than imported because a game may not depend on the app; a transcription
 * that drifts is caught by the next person to read either file, where not
 * testing the rung behaviour at all is caught by nobody.
 */
type RungHost = { host: Host; asked: Question[]; flushed: { count: number } };

function rungHost(answers: readonly string[], opts: { reserve?: number } = {}): RungHost {
  const asked: Question[] = [];
  const span = Math.max(1, answers.length - 1);
  const flushed = { count: 0 };
  let target = 0;
  let ceiling = 1;
  let reserve = opts.reserve ?? 0;
  let n = 0;

  const toUnit = (value: number): number => {
    if (value < 1) return Math.max(0, value);
    return Math.min(1, (value - 1) / 9);
  };

  const host: Host = {
    next: (ask?: Ask) => {
      if (ask?.maxDifficulty !== undefined) ceiling = toUnit(ask.maxDifficulty);
      if (ask?.difficulty !== undefined) target = toUnit(ask.difficulty);
      const cap = Math.floor(ceiling * span);
      let index = Math.max(0, Math.min(span, cap, Math.round(target * span)));
      // The reserve a flush leaves behind. `packs/shared/game-host` keeps the
      // eight pooled questions closest to the new request rather than emptying
      // the pool — "an empty pool is not a pause, it is a question with no id" —
      // and if every one of them is above the ceiling it hands one over anyway,
      // because `distance` says an over-ceiling question "is still an answer
      // when nothing else does". So a ceiling can be answered by a rung above
      // it, for a couple of questions, and that is not hypothetical.
      if (reserve > 0) {
        reserve--;
        index = span;
      }
      const answer = answers[index] as string;
      n++;
      const q: Question = {
        id: `rung${String(index)}-${String(n)}`,
        prompt: `rung ${String(index)}`,
        answer,
        // Near-misses, so a rung whose answer is too wide has wrongs that are
        // too wide as well — which is what a real generator does.
        distractors: [String(Number(answer) + 1), String(Number(answer) + 2)],
        domain: "add-sub",
        // What the host reports back: where the rung it ACTUALLY used sits.
        difficulty: index / span,
      };
      asked.push(q);
      return q;
    },
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => true,
    flush: () => {
      flushed.count++;
      reserve = opts.reserve ?? 0;
    },
  };
  return { host, asked, flushed };
}

/**
 * A ladder whose answers grow one character a rung, past what POLARITY prints.
 *
 * A power of ten rather than a row of nines, so that the near-miss distractors
 * `rungHost` builds are the same width as the answer they miss. `999…9 + 1`
 * carries into an extra character, which would make a rung undrawable for a
 * second, different reason (its wrongs will not print, so it is not a question)
 * and would confuse what these tests are measuring — the real generators do not
 * do that: five digits times five digits is at most ten characters and its
 * mal-rules are smaller, not larger.
 */
function widthLadder(): string[] {
  const out: string[] = [];
  for (let chars = 2; chars <= LABEL_MAX_CHARS + 8; chars++) {
    out.push("1" + "0".repeat(chars - 1));
  }
  return out;
}

function world(host: Host): World {
  const w = makeWorld(host, tierByName("low"), 0x50147);
  startRun(w);
  return w;
}

/**
 * Run `count` Seal Bearers through the ask, one at a time.
 *
 * `bearerCount` is reset each time so `launchBoss` never rolls a Warden — the
 * Warden asks the curriculum nothing by design (`stepWarden`), so one in the
 * sample would be a Bearer that "asked nothing" for the right reason and would
 * make the assertions below mean nothing.
 */
function runBearers(w: World, count: number): void {
  for (let i = 0; i < count; i++) {
    w.bearerCount = 0;
    w.enemyN = 0;
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    for (let f = 0; f < 400 && e.phase === 0; f++) {
      w.t += 1 / 60;
      stepBoss(w, e, 1 / 60, 1);
    }
    assert.notEqual(e.phase, 0, "a Bearer never got as far as asking");
    w.bossActive = false;
    w.seal.state = "idle";
  }
}

test("the top of the ladder is asked for as the TOP of the ladder", () => {
  // `toUnit` reads 1 as the bottom. A game that reaches exactly 1 and means the
  // top has to say so on the unambiguous scale, and this is that scale: every
  // 0..1 position has exactly one spelling in 1..10 and none of them is
  // reachable by the fraction reading.
  assert.equal(ladderScale(0), 1);
  assert.equal(ladderScale(1), 10);
  assert.equal(ladderScale(0.5), 5.5);

  const w = world(rungHost(["1", "2"]).host);
  // Stratum 15 is where `clamp(0.14 + stratum * 0.06, 0, 1)` pins at 1 — about
  // seven and a half minutes of good play.
  w.stratum = 15;
  const ask = askShape(w);
  assert.equal(ask.difficulty, 10, "the hardest content in the product was asked for as the easiest");
  // And the round trip is exact, so nothing else in the request moved: the
  // opening question still asks for 0.14 of the ladder, as it always did.
  w.stratum = 0;
  assert.ok(Math.abs((askShape(w).difficulty - 1) / 9 - 0.14) < 1e-12);
});

test("a rung POLARITY cannot draw is asked once, not forever", () => {
  // THE soft-lock. The host is standing on a rung whose every answer is wider
  // than the numeral cell, and it will keep standing there — that is what
  // serving by rung means — until the pack says otherwise.
  const errors: string[] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => errors.push(String(a[0]));
  let w: World;
  let handle: ReturnType<typeof rungHost>;
  try {
    handle = rungHost(widthLadder());
    w = world(handle.host);
    w.stratum = 40; // far past the top: the game is asking for the hardest rung
    runBearers(w, 6);
  } finally {
    console.error = real;
  }

  assert.ok(
    w.stats.asked > 0,
    "six Seal Bearers arrived and not one of them asked a question — the child at the top of " +
      "the ladder was served silence",
  );
  // Everything it did ask, it could draw.
  for (const q of handle.asked.slice(-4)) {
    assert.ok(
      q.answer.length <= LABEL_MAX_CHARS,
      `it settled on "${q.answer}", which is ${String(q.answer.length)} characters`,
    );
  }
  // And it settled on the WIDEST rung it can draw, not on the bottom.
  const last = handle.asked[handle.asked.length - 1] as Question;
  assert.equal(
    last.answer.length,
    LABEL_MAX_CHARS,
    `it fell back to ${String(last.answer.length)} characters when it can print ${String(LABEL_MAX_CHARS)}`,
  );
  assert.ok(w.drawCeiling !== null, "nothing was capped, so the ceiling did nothing");
  assert.match(errors.join("\n"), /capping the stream/);
});

test("the ceiling is learned once and costs one Bearer, not one per Bearer", () => {
  const real = console.error;
  console.error = () => {};
  let w: World;
  let handle: ReturnType<typeof rungHost>;
  try {
    handle = rungHost(widthLadder());
    w = world(handle.host);
    w.stratum = 40;
    // Two Bearers to walk the ceiling down — the first starves, because eight
    // rungs of overshoot is more than `MAX_ASK_TRIES`, and that is the honest
    // cost of learning a ceiling from a refusal.
    runBearers(w, 2);
    const afterSettling = handle.asked.length;
    const askedWhileSettling = w.stats.asked;
    runBearers(w, 5);
    // Five more Bearers, five more questions, five host calls. No re-learning
    // and no second starve: this is the difference between a ceiling and a
    // per-item refusal.
    assert.equal(
      w.stats.asked - askedWhileSettling,
      5,
      "a later Bearer had to rediscover the ceiling",
    );
    assert.equal(
      handle.asked.length - afterSettling,
      5,
      `the host was asked ${String(handle.asked.length - afterSettling)} times for five questions`,
    );
  } finally {
    console.error = real;
  }
  assert.ok(w.drawCeiling !== null);
});

test("the ceiling only ever falls, and the pool is flushed when it does", () => {
  const real = console.error;
  console.error = () => {};
  let w: World;
  let handle: ReturnType<typeof rungHost>;
  try {
    handle = rungHost(widthLadder());
    w = world(handle.host);
    w.stratum = 40;
    runBearers(w, 2);
    const settled = w.drawCeiling;
    assert.ok(settled !== null);
    // A run that drops back down the strata must not lift the ceiling: what
    // POLARITY can draw is a property of POLARITY.
    w.stratum = 1;
    runBearers(w, 2);
    assert.ok((w.drawCeiling as number) <= settled, "the ceiling rose again");
    assert.ok(handle.flushed.count > 0, "a ceiling landed sixty-four questions late");
  } finally {
    console.error = real;
  }
});

test("a host with no ceiling to give is not made worse by asking for one", () => {
  // The whole shipping ladder fits inside the numeral budget, so `capBelow`
  // never fires in production and the request is pure overhead — it must
  // therefore be harmless. A host that ignores `maxDifficulty` entirely (an
  // older one, or the stub) still serves, and nothing is capped.
  const answers = ["7", "42", "137", "3916"];
  const handle = rungHost(answers);
  const w = world(handle.host);
  w.stratum = 20;
  runBearers(w, 4);
  assert.equal(w.stats.asked, 4);
  assert.equal(w.drawCeiling, null, "a ladder this game can draw entirely was still capped");
  assert.equal(handle.flushed.count, 0, "the pool was thrown away for nothing");
});

test("a ceiling is never raised by the stale question that outlived it", () => {
  // The guard inside `capBelow`, and the reason it is not belt-and-braces: a
  // flush leaves a reserve of up to eight pooled questions so the pool is never
  // empty, and when all of them are above the new ceiling the host hands one
  // over anyway. Read naively, that question's difficulty is a fresh piece of
  // evidence and the ceiling follows it back UP — and then the next refusal
  // walks it down again, forever, one Bearer at a time.
  const real = console.error;
  console.error = () => {};
  let w: World;
  try {
    const handle = rungHost(widthLadder(), { reserve: 3 });
    w = world(handle.host);
    w.stratum = 40;
    runBearers(w, 3);
    const settled = w.drawCeiling;
    assert.ok(settled !== null, "nothing was capped, so this proves nothing");
    for (let i = 0; i < 6; i++) {
      runBearers(w, 1);
      assert.ok(
        (w.drawCeiling as number) <= settled,
        `the ceiling climbed back to ${String(w.drawCeiling)} from ${String(settled)}`,
      );
    }
    assert.ok(w.stats.asked > 0, "the run stopped asking questions altogether");
  } finally {
    console.error = real;
  }
});

/**
 * The dry pool must not be mistaken for a rung this game cannot draw.
 *
 * `orbValues` says no for two reasons and only one of them is the rung's. An
 * unprintable ANSWER is a rung fact — the numeral budget is a constant, so every
 * item from that rung is equally undrawable. **Too few distractors is an ITEM
 * fact**, and capping on it ended the session.
 *
 * `packs/shared/game-host` answers an empty pool with
 * `{ id: "", prompt: "", answer: "0", distractors: [], difficulty: 0 }`. That
 * answer parses and prints perfectly; it simply yields one value. So one
 * transient empty pool read as "difficulty 0 cannot be drawn", pinned the
 * ceiling at 0 where the monotone guard made it unraisable, and `startRun`
 * deliberately does not reset it — so every question for the rest of the mount
 * was the easiest rung in the product. That is worse than the soft-lock this
 * file exists to fix, because it is silent and it looks like adaptation.
 *
 * The pool runs dry for reasons that have nothing to do with POLARITY:
 * `createItemService.next` has four `return null` paths and `warm()` swallows a
 * throw with a `break`.
 */
test("one dry pool does not pin the run to the bottom rung for the rest of the mount", () => {
  const real = console.error;
  console.error = () => {};
  try {
    const handle = rungHost(["12", "34", "56", "78", "90"]);
    let dry = 1;
    const host: Host = {
      ...handle.host,
      next: (ask?: Ask): Question => {
        if (dry > 0) {
          dry -= 1;
          // Byte-for-byte the sentinel at game-host/index.ts:681-684.
          return { id: "", prompt: "", answer: "0", distractors: [], domain: "add", difficulty: 0 };
        }
        return handle.host.next(ask);
      },
    };
    const w = world(host);
    w.stratum = 12;
    runBearers(w, 1);

    assert.equal(
      w.drawCeiling,
      null,
      `a dry pool capped the stream at ${String(w.drawCeiling)} — every question after this is the easiest rung in the product`,
    );

    const before = handle.asked.length;
    runBearers(w, 4);
    const after = handle.asked.slice(before);
    assert.ok(after.length > 0, "the run stopped asking after the dry Bearer");
    assert.ok(
      after.some((q) => q.difficulty > 0),
      `every rung served after the dry pool was the bottom one: ${after.map((q) => q.difficulty.toFixed(3)).join(", ")}`,
    );
  } finally {
    console.error = real;
  }
});

/**
 * A difficulty that is not a number caps nothing.
 *
 * `clamp` is NaN-transparent, so a NaN difficulty used to set `drawCeiling` to
 * NaN — which `readScale` discards as "not a difficulty", leaving the ceiling
 * inert AND `drawCeiling <= capped` permanently false, so every later refusal
 * re-logged and re-flushed for the life of the run.
 */
test("a NaN difficulty is not a ceiling", () => {
  const real = console.error;
  console.error = () => {};
  try {
    const handle = rungHost(["12", "34"]);
    const wide = "1".repeat(LABEL_MAX_CHARS + 4);
    const host: Host = {
      ...handle.host,
      next: (): Question => ({
        id: "nan",
        prompt: "?",
        answer: wide,
        distractors: [`${wide}2`, `${wide}3`],
        domain: "add",
        difficulty: Number.NaN,
      }),
    };
    const w = world(host);
    runBearers(w, 1);
    assert.ok(
      w.drawCeiling === null || Number.isFinite(w.drawCeiling),
      `the ceiling is ${String(w.drawCeiling)}, which readScale discards while the monotone guard treats it as set`,
    );
  } finally {
    console.error = real;
  }
});
