import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { guessChance, guessChanceOf } from "../src/math/guess-chance";
import { simulatePlacement } from "./placement-simulation.fixture";

const noGuessing = () => 0;

test("simulated placement: no worse for typed-only learners, better with choice items mixed in", (t) => {
  const typed = templates.filter((template) => guessChance(template) === 0);
  const typedBefore = simulatePlacement({
    catalog: typed,
    guessOf: noGuessing,
  });
  const typedAfter = simulatePlacement({
    catalog: typed,
    guessOf: guessChanceOf,
  });
  const mixedBefore = simulatePlacement({
    catalog: templates,
    guessOf: noGuessing,
  });
  const mixedAfter = simulatePlacement({
    catalog: templates,
    guessOf: guessChanceOf,
  });
  for (const [name, result] of Object.entries({
    typedBefore,
    typedAfter,
    mixedBefore,
    mixedAfter,
  }))
    t.diagnostic(`${name} ${JSON.stringify(result)}`);
  // Typed answers keep full weight: the estimate is unchanged.
  assert.deepEqual(typedAfter, typedBefore);
  // Choice items are a real part of placement in this catalog.
  assert.ok(mixedAfter.choiceShare > 0.15, JSON.stringify(mixedAfter));
  const change = `${JSON.stringify(mixedBefore)} → ${JSON.stringify(mixedAfter)}`;
  // Lucky picks no longer inflate the strands they land in…
  assert.ok(
    mixedAfter.choiceStrandError < mixedBefore.choiceStrandError,
    change,
  );
  assert.ok(
    mixedAfter.worstOverestimate < mixedBefore.worstOverestimate,
    change,
  );
  assert.ok(mixedAfter.strandError <= mixedBefore.strandError, change);
  // …the estimate settles sooner, and the pooled level is no worse (it is
  // dominated by typed answers; 0.02 grade is within seed noise).
  assert.ok(mixedAfter.toPlace < mixedBefore.toPlace, change);
  assert.ok(mixedAfter.overallError <= mixedBefore.overallError + 0.02, change);
});
