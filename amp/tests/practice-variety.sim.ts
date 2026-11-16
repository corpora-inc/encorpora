import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulateTrial,
  trialLearners,
  varietyStats,
} from "./trial-simulation.fixture";

// `npm run test:placement-sim`. The free trial's first 100 problems through
// the production planner and estimator, for learners whose age puts them in
// grades 6–8, from a grade and a half below that level to two above.
test("the free trial interleaves: no template repeats soon, and the strands are broad", (t) => {
  // The planner is path-dependent: 4 seeds left ~0.023 sampling noise against a true support gap of ~0.075.
  const learners = trialLearners(16);
  const runs = learners.map((learner) => simulateTrial(learner));
  const stats = varietyStats(runs);
  t.diagnostic(JSON.stringify(stats));
  assert.equal(stats.backToBackTemplatePct, 0);
  assert.equal(stats.backToBackSkillPct, 0);
  // At most two of any template in any ten problems.
  assert.equal(stats.window10Over2Pct, 0);
  assert.equal(stats.window7TemplateTriplePct, 0);
  assert.ok(stats.minStrandsInFirst20 >= 6, `${stats.minStrandsInFirst20}`);
  // Adaptivity stays: learners below their age level get more support
  // (prerequisites, revisits, reviews) than learners above it.
  // Counted exactly: both groups see the same number of items, and the
  // pooled-evidence climb (#2157) confirms foundations for climbers too, so
  // the gap sits at its floor (24 of 480 items) where a float difference
  // would read 0.0499….
  const support = (offset: number) => {
    const items = runs
      .filter((_, i) => learners[i]!.level - learners[i]!.start === offset)
      .flat();
    return {
      count: items.filter((item) =>
        ["prerequisite", "revisit", "review"].includes(item.reason),
      ).length,
      of: items.length,
    };
  };
  const below = support(-1.5),
    above = support(2);
  assert.equal(below.of, above.of);
  assert.ok(
    (below.count - above.count) * 20 >= below.of,
    `at least 5 points more support below level: ${below.count}/${below.of} vs ${above.count}/${above.of}`,
  );
  assert.ok(below.count * 2 < below.of);
});
