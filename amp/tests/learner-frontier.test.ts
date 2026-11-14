import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateFrontier,
  overallTrend,
  type Frontier,
} from "../src/learning/frontier";
import { trendCounts } from "../src/learning/level-check";
import { templates } from "../src/math/engine";
import {
  advanceLearnerFrontier,
  applyStrandRestart,
  decodeLearnerFrontier,
  encodeLearnerFrontier,
  estimatorFingerprint,
  frontierCatalog,
  isCurrentLearnerFrontier,
  newLearnerFrontier,
  readLearnerFrontier,
  type LearnerFrontierKey,
  type LearnerObservation,
} from "../src/server/learner-frontier";

// Typed families cost nothing to look up, and span grades and strands.
const families = templates
  .filter((t) => !t.requiredResponseCapability)
  .map((t) => t.id);
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
function history(
  length: number,
  seed: number,
  abilityAt: (i: number) => number,
): LearnerObservation[] {
  const rnd = random(seed);
  const gaps = [20_000, 60_000, 3_600_000, 86_400_000, 40 * 86_400_000];
  let at = 1_790_000_000_000;
  return Array.from({ length }, (_, i) => {
    at += gaps[Math.floor(rnd() * gaps.length)]!;
    const templateId = families[Math.floor(rnd() * families.length)]!;
    const grade = frontierCatalog.gradeOf(templateId) ?? 5;
    return {
      templateId,
      correct: rnd() < 1 / (1 + Math.exp(grade - abilityAt(i))),
      assisted: rnd() < 0.08,
      createdAt: new Date(at).toISOString(),
      practiceRevision: i < length / 2 ? 0 : 2,
      sequence: String(i + 1),
    };
  });
}
/** What every request used to compute: the whole history, every time. */
function replayed(
  key: LearnerFrontierKey,
  observations: readonly LearnerObservation[],
  now: number,
) {
  const frontier = estimateFrontier({
    start: key.start,
    fromAge: key.fromAge,
    observations,
    now,
    ...frontierCatalog,
  });
  for (const [strand, { level, revision }] of Object.entries(key.strandStarts))
    applyStrandRestart(
      frontier,
      strand,
      level,
      estimateFrontier({
        start: level,
        observations: observations.filter(
          (o) =>
            o.practiceRevision >= revision &&
            frontierCatalog.strandOf(o.templateId) === strand,
        ),
        now,
        ...frontierCatalog,
      }),
    );
  return frontier;
}
function assertClose(stored: Frontier, full: Frontier, label: string) {
  assert.deepEqual(stored.overall, full.overall, `${label}: overall`);
  assert.deepEqual(stored.anchor, full.anchor, `${label}: age anchor`);
  assert.deepEqual(stored.readout, full.readout, `${label}: readout`);
  assert.deepEqual(stored.restarted, full.restarted, `${label}: restarted`);
  assert.deepEqual(stored.adaptive, full.adaptive, `${label}: adaptive`);
  assert.deepEqual(
    stored.confirmation,
    full.confirmation,
    `${label}: confirmation`,
  );
  assert.deepEqual(
    Object.keys(stored.strands).sort(),
    Object.keys(full.strands).sort(),
  );
  for (const [strand, estimate] of Object.entries(full.strands)) {
    const got = stored.strands[strand]!;
    assert.equal(got.answered, estimate.answered, `${label}: ${strand}`);
    assert.equal(got.independent, estimate.independent, `${label}: ${strand}`);
    assert.ok(
      Math.abs(got.level - estimate.level) <= 0.0101 &&
        Math.abs(got.sd - estimate.sd) <= 0.0101,
      `${label}: ${strand} stored ${got.level}±${got.sd}, replayed ${estimate.level}±${estimate.sd}`,
    );
  }
}

const key = (strandStarts = {}, fromAge = false): LearnerFrontierKey => ({
  epoch: 0,
  start: 4,
  ...(fromAge ? { fromAge } : {}),
  strandStarts,
});
const scenarios: [string, (i: number) => number][] = [
  ["steady", () => 6],
  ["growing", (i) => 2 + i / 60],
  ["jumping", (i) => (i < 120 ? 2 : 11)],
  ["falling", (i) => (i < 120 ? 11 : 2)],
];
for (const [name, abilityAt] of scenarios)
  test(`a stored level tracks replaying the whole history: ${name}`, () => {
    const observations = history(480, name.length, abilityAt);
    const restartStrand = frontierCatalog.strandOf(families[0]!);
    for (const [starts, fromAge] of [
      [{}, false],
      [{ [restartStrand]: { level: 3, revision: 2 } }, false],
      [{}, true],
      [{ [restartStrand]: { level: 3, revision: 2 } }, true],
    ] as const) {
      const k = key(starts, fromAge);
      let state = newLearnerFrontier(k);
      observations.forEach((observation, i) => {
        state = advanceLearnerFrontier(state, [observation]);
        // Stored and reloaded at arbitrary points, as requests do.
        if (i % 25 === 24)
          state = decodeLearnerFrontier(encodeLearnerFrontier(state))!;
        if (i % 47 !== 46) return;
        const now = Date.parse(observation.createdAt!) + 7_200_000;
        assertClose(
          readLearnerFrontier(state, now),
          replayed(k, observations.slice(0, i + 1), now),
          `${name} after ${i + 1}`,
        );
      });
    }
  });

test("short histories match replaying them exactly, strands included", () => {
  const observations = history(60, 7, () => 5);
  const state = advanceLearnerFrontier(newLearnerFrontier(key()), observations);
  const now = Date.parse(observations.at(-1)!.createdAt!) + 1000;
  assert.deepEqual(
    readLearnerFrontier(state, now),
    replayed(key(), observations, now),
  );
});

test("a stored state survives encoding, and reading leaves it unchanged", () => {
  const observations = history(200, 3, () => 7);
  const state = advanceLearnerFrontier(newLearnerFrontier(key()), observations);
  const encoded = encodeLearnerFrontier(state);
  assert.deepEqual(decodeLearnerFrontier(encoded), state);
  readLearnerFrontier(state, Date.now());
  assert.equal(encodeLearnerFrontier(state), encoded);
});

test("stored size stops growing with the number of answers", () => {
  const size = (answers: number) =>
    encodeLearnerFrontier(
      advanceLearnerFrontier(
        newLearnerFrontier(key()),
        history(answers, 5, () => 6),
      ),
    ).length;
  const ten = size(10_000);
  assert.ok(ten < 200_000, `${ten} bytes for 10,000 answers`);
  assert.ok(size(20_000) < ten * 1.15, "doubling the history adds little");
});

test("a state is only reused for the same estimator, epoch, start, restarts and catalog facts", () => {
  const k = key({ number: { level: 3, revision: 1 } });
  const state = advanceLearnerFrontier(
    newLearnerFrontier(k),
    history(30, 2, () => 5),
  );
  assert.ok(isCurrentLearnerFrontier(state, k));
  assert.ok(!isCurrentLearnerFrontier(state, { ...k, epoch: 1 }));
  assert.ok(!isCurrentLearnerFrontier(state, { ...k, start: 5 }));
  assert.ok(
    !isCurrentLearnerFrontier(state, { ...k, fromAge: true }),
    "a start set by age has another prior",
  );
  const aged = advanceLearnerFrontier(
    newLearnerFrontier({ ...k, fromAge: true }),
    history(30, 2, () => 5),
  );
  assert.ok(isCurrentLearnerFrontier(aged, { ...k, fromAge: true }));
  assert.ok(!isCurrentLearnerFrontier(aged, k));
  // The flag survives storage, so a stored age-anchored state stays one.
  const reloaded = decodeLearnerFrontier(encodeLearnerFrontier(aged))!;
  assert.ok(isCurrentLearnerFrontier(reloaded, { ...k, fromAge: true }));
  assert.equal(reloaded.main.fromAge, true);
  assert.ok(!isCurrentLearnerFrontier(state, { ...k, strandStarts: {} }));
  assert.ok(
    !isCurrentLearnerFrontier(state, {
      ...k,
      strandStarts: { number: { level: 4, revision: 1 } },
    }),
  );
  assert.ok(
    !isCurrentLearnerFrontier({ ...state, fingerprint: "older" }, k),
    "a different estimator",
  );
  assert.ok(
    !isCurrentLearnerFrontier(
      { ...state, families: [...state.families, "a-new-fact"] },
      k,
    ),
    "different facts about the families answered",
  );
  assert.equal(estimatorFingerprint(), estimatorFingerprint());
});

test("an unreadable state reads as none, so the history is replayed", () => {
  assert.equal(decodeLearnerFrontier("{not json"), null);
});

test("one pass gives the same trend as estimating each prefix", () => {
  const observations = history(83, 11, (i) => 3 + i / 20);
  const now = Date.parse(observations.at(-1)!.createdAt!) + 3_600_000;
  const counts = trendCounts(observations.length);
  for (const fromAge of [false, true])
    assert.deepEqual(
      overallTrend(
        { start: 4, fromAge, observations, now, ...frontierCatalog },
        counts,
      ),
      counts.map((answered) => {
        const frontier = estimateFrontier({
          start: 4,
          fromAge,
          observations: observations.slice(0, answered),
          now,
          ...frontierCatalog,
        });
        const {
          level,
          sd,
          answered: counted,
        } = frontier.readout ?? frontier.overall;
        return { answered, level, sd, counted };
      }),
    );
});
