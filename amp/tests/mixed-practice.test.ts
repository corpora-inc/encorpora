import { test } from "node:test";
import assert from "node:assert/strict";
import { planMixedPractice, reviewDueAt } from "../src/server/mixed-practice";
import { summarize } from "../src/server/progress";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import type { Outcome } from "../src/server/repository";
const now = Date.parse("2026-10-17T12:00:00Z");
function answer(
  templateId: string,
  index: number,
  correct = true,
  assisted = false,
  at = now + index * 60000,
): Outcome {
  const template = templates.find((entry) => entry.id === templateId)!;
  return {
    id: String(index).padStart(6, "0"),
    problemId: `problem-${index}`,
    requestId: `request-${index}`,
    templateId,
    skillId: template.skillId,
    correct,
    assisted,
    response: "1",
    answer: "1",
    explanation: [],
    createdAt: new Date(at).toISOString(),
  };
}
function plan(attempts: Outcome[], count = 3, seed = "fixed", time = now) {
  return planMixedPractice({
    templates,
    skills,
    attempts,
    count,
    seed,
    now: time,
    evidence: projectSkillEvidence(attempts),
  });
}
test("fresh sessions mix distinct strands and reserve different skills within a batch", () => {
  for (let seed = 0; seed < 100; seed++) {
    const choices = plan([], 3, String(seed));
    assert.equal(new Set(choices.map((choice) => choice.strand)).size, 3);
    assert.equal(
      new Set(choices.map((choice) => choice.template.skillId)).size,
      3,
    );
    assert.ok(choices.every((choice) => choice.template.gradeBand === "K–2"));
  }
  assert.deepEqual(plan([], 3, "same"), plan([], 3, "same"));
});
test("a mistake does not trap the learner in immediate same-family retry", () => {
  const attempts = [answer("integer-power", 0, false)];
  const choices = plan(attempts);
  assert.notEqual(choices[0].template.id, "integer-power");
  assert.ok(choices[0].strand !== "algebra");
});
test("independent success widens challenge sampling without granting prerequisite mastery", () => {
  const attempts = [
    answer("integer-power", 0),
    answer("ratio-missing", 1),
    answer("line-slope", 2),
  ];
  const choices = plan(attempts, 5);
  assert.ok(new Set(choices.map((choice) => choice.strand)).size >= 3);
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.gradeBand === "6–8" ||
        choice.template.gradeBand === "9–12",
    ),
  );
  assert.ok(choices.some((choice) => choice.reason === "explore"));
  assert.equal(summarize(attempts, ["powers-of-ten"])[0].attempts, 0);
});
test("spacing credits separated retrievals, not a burst of same-minute answers", () => {
  const burst = Array.from({ length: 5 }, (_, index) =>
    answer("multiply-facts", index),
  );
  assert.equal(
    reviewDueAt(burst),
    Date.parse(burst.at(-1)!.createdAt) + 6 * 3600000,
  );
  const spaced = [
    answer("multiply-facts", 0, true, false, now),
    answer("multiply-facts", 1, true, false, now + 86400000),
  ];
  assert.equal(reviewDueAt(spaced), now + 2 * 86400000);
  const assisted = [
    ...spaced,
    answer("multiply-facts", 2, true, true, now + 3 * 86400000),
  ];
  assert.equal(reviewDueAt(assisted), now + 3 * 86400000);
});
test("missed skills return after intervening work and successful old strands return for review", () => {
  const attempts = [
    answer("add-within-20", 0, false),
    answer("count-objects", 1),
    answer("bar-chart-total", 2),
  ];
  const choices = plan(attempts, 3);
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.skillId === "make-ten" &&
        choice.reason === "prerequisite",
    ),
  );
  const old = [
    answer("fraction-model", 0, true, false, now - 5 * 86400000),
    answer("integer-power", 1, true, false, now - 60000),
  ];
  assert.ok(
    plan(old, 5).some(
      (choice) =>
        choice.template.skillId === "fraction-model" &&
        choice.reason === "review",
    ),
  );
});
test("long independent-success sessions traverse strands and do not remain a single-topic drill", () => {
  const attempts: Outcome[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < 60; index++) {
    const choice = plan(
      attempts,
      1,
      `session-${index}`,
      now + index * 60000,
    )[0];
    if (index)
      assert.notEqual(choice.template.skillId, attempts.at(-1)!.skillId);
    seen.add(choice.strand);
    attempts.push(answer(choice.template.id, index));
  }
  // The data entry depends on an unimplemented categorical-data skill. Variety
  // must not silently treat that missing instruction as learned.
  assert.ok(seen.size >= 6, `Only visited ${[...seen]}`);
  assert.equal(
    attempts.some((attempt) => attempt.skillId === "picture-bar-graphs"),
    false,
  );
  // Sixty correct answers spread across strands do not establish high-school readiness.
  assert.ok(new Set(attempts.map((attempt) => attempt.skillId)).size >= 10);
});
test("mixed planning rejects invalid bounds and supports a one-template catalog", () => {
  assert.throws(() => plan([], 0), /batch size/);
  assert.throws(() => plan([], 6), /batch size/);
  const choices = planMixedPractice({
    templates: templates.slice(0, 1),
    skills,
    attempts: [],
    evidence: [],
    count: 3,
    seed: "only",
    now,
  });
  assert.equal(choices.length, 3);
});
test("remediation traverses unimplemented intermediate nodes and terminates cycles", () => {
  const target = templates.find((t) => t.id === "integer-power")!;
  const ancestor = templates.find((t) => t.id === "multiply-facts")!;
  const graph = [
    { id: target.skillId, strand: "algebra", prerequisites: ["gap"] },
    {
      id: "gap",
      strand: "algebra",
      prerequisites: ["cycle", ancestor.skillId],
    },
    { id: "cycle", strand: "algebra", prerequisites: ["gap"] },
    { id: ancestor.skillId, strand: "arithmetic", prerequisites: [] },
  ];
  const choices = planMixedPractice({
    templates,
    skills: graph,
    attempts: [answer(target.id, 0, false)],
    evidence: [],
    count: 3,
    seed: "ancestor",
    now,
  });
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.id === ancestor.id && choice.reason === "prerequisite",
    ),
  );
});

const bands = ["K–2", "3–5", "6–8", "9–12"] as const;
const probeTemplates = ["number", "algebra", "geometry"].flatMap((strand) =>
  bands.flatMap((gradeBand, level) =>
    [0, 1].map((variant) => ({
      ...templates[0],
      id: `${strand}-${level}-${variant}`,
      skillId: `${strand}-${level}-${variant}`,
      gradeBand,
    })),
  ),
);
const probeSkills = probeTemplates.map((template) => ({
  id: template.skillId,
  strand: template.id.split("-")[0],
  prerequisites: [],
}));
function probeAnswer(
  id: string,
  index: number,
  correct = false,
  assisted = false,
): Outcome {
  return {
    ...answer("count-objects", index, correct, assisted),
    templateId: id,
    skillId: id,
  };
}
function probePlan(
  attempts: Outcome[],
  band: (typeof bands)[number],
  candidates = probeTemplates,
  count = 3,
  seed = "probe",
) {
  return planMixedPractice({
    templates: candidates,
    skills: probeSkills,
    attempts,
    evidence: projectSkillEvidence(attempts),
    startingPoint: { band, policyVersion: 1, excludedStrands: [] },
    count,
    seed,
    now,
  });
}
test("an optional starting preference samples its range across untouched strands without evidence credit", () => {
  for (const band of bands)
    for (let seed = 0; seed < 40; seed++) {
      const choices = probePlan([], band, probeTemplates, 3, String(seed));
      assert.ok(choices.every((choice) => choice.template.gradeBand === band));
      assert.equal(new Set(choices.map((choice) => choice.strand)).size, 3);
    }
  assert.deepEqual(projectSkillEvidence([]), []);
});
test("before independent success, actual failed or assisted probes descend locally rather than resetting to kindergarten", () => {
  const candidates = probeTemplates.filter((template) =>
    template.id.startsWith("algebra"),
  );
  for (const assisted of [false, true]) {
    const attempts: Outcome[] = [];
    for (let level = 3; level > 0; level--) {
      attempts.push(
        probeAnswer(`algebra-${level}-0`, 4 - level, assisted, assisted),
      );
      const choice = probePlan(attempts, "9–12", candidates, 1)[0];
      assert.equal(choice.template.gradeBand, bands[level - 1]);
      assert.equal(
        projectSkillEvidence(attempts).filter(
          (entry) => entry.latestIndependent,
        ).length,
        0,
      );
    }
  }
});
test("a changed preference cannot reset an observed strand or raise its challenge floor", () => {
  const attempts = [
    probeAnswer("number-1-0", 1, true),
    probeAnswer("algebra-3-0", 2, true),
  ];
  for (const strand of ["number", "algebra"]) {
    const candidates = probeTemplates.filter((template) =>
      template.id.startsWith(strand),
    );
    assert.deepEqual(
      probePlan(attempts, "K–2", candidates, 1),
      probePlan(attempts, "9–12", candidates, 1),
    );
  }
  const choices = probePlan(attempts, "9–12", probeTemplates, 5);
  assert.ok(
    choices.some(
      (choice) =>
        choice.strand === "number" && choice.template.gradeBand === "3–5",
    ),
  );
  assert.ok(
    choices.some(
      (choice) =>
        choice.strand === "algebra" && choice.template.gradeBand === "9–12",
    ),
  );
});
test("independent recovery opens nearby challenge after an unsuccessful initial probe", () => {
  const candidates = probeTemplates.filter((template) =>
    template.id.startsWith("algebra"),
  );
  const attempts = [
    probeAnswer("algebra-3-0", 0),
    ...[1, 2, 3].map((index) =>
      probeAnswer(`algebra-1-${index % 2}`, index, true),
    ),
  ];
  const choice = probePlan(attempts, "K–2", candidates, 1)[0];
  assert.equal(choice.template.gradeBand, "6–8");
});
test("starting preferences fall back to available ranges and preserve due retrieval reservations", () => {
  const available = probeTemplates.filter(
    (template) => template.gradeBand === "3–5",
  );
  assert.ok(
    probePlan([], "9–12", available).every(
      (choice) => choice.template.gradeBand === "3–5",
    ),
  );
  const old = {
    ...probeAnswer("number-0-0", 0, true),
    createdAt: new Date(now - 86400000).toISOString(),
  };
  const attempts = [
    old,
    probeAnswer("algebra-3-0", 1, true),
    probeAnswer("geometry-3-0", 2, true),
  ];
  assert.ok(
    probePlan(attempts, "9–12").some(
      (choice) =>
        choice.template.id === old.templateId && choice.reason === "review",
    ),
  );
});

test("a high algebra error reserves its nearest implemented prerequisite in an untouched lower-prior strand", () => {
  const attempts = [probeAnswer("algebra-3-0", 0)];
  const graph = probeSkills.map((skill) =>
    skill.id === "algebra-3-0"
      ? { ...skill, prerequisites: ["number-1-0"] }
      : skill,
  );
  const choices = planMixedPractice({
    templates: probeTemplates,
    skills: graph,
    attempts,
    evidence: projectSkillEvidence(attempts),
    startingPoint: { band: "K–2", policyVersion: 1, excludedStrands: [] },
    count: 3,
    seed: "cross-strand",
    now,
  });
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.id === "number-1-0" && choice.reason === "prerequisite",
    ),
  );
  assert.equal(
    projectSkillEvidence(attempts).some(
      (entry) => entry.skillId === "number-1-0",
    ),
    false,
  );
});

test("first-save enrollment excludes already observed strands and later edits cannot enroll them", () => {
  const attempts = [probeAnswer("number-1-0", 1)];
  const candidates = probeTemplates.filter((template) =>
    template.id.startsWith("number"),
  );
  const original = planMixedPractice({
    templates: candidates,
    skills: probeSkills,
    attempts,
    evidence: projectSkillEvidence(attempts),
    count: 1,
    seed: "preserve",
    now,
  });
  for (const band of bands) {
    const preferred = planMixedPractice({
      templates: candidates,
      skills: probeSkills,
      attempts,
      evidence: projectSkillEvidence(attempts),
      startingPoint: { band, policyVersion: 1, excludedStrands: ["number"] },
      count: 1,
      seed: "preserve",
      now,
    });
    assert.deepEqual(preferred, original);
  }
  const untouched = planMixedPractice({
    templates: probeTemplates.filter((template) =>
      template.id.startsWith("geometry"),
    ),
    skills: probeSkills,
    attempts,
    evidence: projectSkillEvidence(attempts),
    startingPoint: {
      band: "9–12",
      policyVersion: 1,
      excludedStrands: ["number"],
    },
    count: 1,
    seed: "new",
    now,
  });
  assert.equal(untouched[0].template.gradeBand, "9–12");
});

test("beginner batches stay at roots or at most one immediate entry diagnostic", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  for (let seed = 0; seed < 200; seed++)
    for (const count of [1, 3, 5]) {
      const choices = plan([], count, `entry-${seed}`);
      let probes = 0;
      for (const { template } of choices) {
        const parents = nodes.get(template.skillId)!.prerequisites;
        if (parents.length) {
          probes++;
          assert.ok(
            parents.every((id) => nodes.get(id)!.prerequisites.length === 0),
          );
        }
      }
      assert.ok(probes <= (count === 1 ? 0 : 1));
      const preferred = planMixedPractice({
        templates,
        skills,
        attempts: [],
        evidence: [],
        count,
        seed: `entry-${seed}`,
        now,
        startingPoint: { band: "K–2", policyVersion: 1, excludedStrands: [] },
      });
      assert.deepEqual(preferred, choices);
      if (count === 3)
        assert.equal(new Set(choices.map((c) => c.strand)).size, 3);
    }
});
test("latest mistakes and assistance revoke successor support without rewriting history", () => {
  const source = templates.find((t) => t.id === "count-objects")!;
  const child = templates.find((t) => t.id === "join-within-10")!;
  for (const assisted of [false, true]) {
    const attempts = [
      answer(source.id, 0),
      answer(source.id, 1, assisted, assisted),
    ];
    const evidence = projectSkillEvidence(attempts);
    assert.ok(evidence[0]!.latestIndependent);
    const choices = planMixedPractice({
      templates: [source, child],
      skills,
      attempts,
      evidence,
      count: 3,
      seed: "revoke",
      now,
    });
    assert.ok(choices.every((c) => c.template.id === source.id));
    assert.equal(evidence[0]!.creditedRetrievals, 0);
  }
  assert.ok(
    planMixedPractice({
      templates: [source, child],
      skills,
      attempts: [answer(source.id, 0)],
      evidence: [],
      count: 1,
      seed: "advance",
      now,
    })[0]!.template.id === child.id,
  );
});
test("unimplemented and unsupported sibling prerequisites block promotion, while advanced anchors stay available", () => {
  const source = {
    ...templates[0]!,
    id: "anchor",
    skillId: "anchor",
    gradeBand: "9–12" as const,
  };
  const child = { ...source, id: "child", skillId: "child" };
  const root = {
    ...source,
    id: "entry",
    skillId: "entry",
    gradeBand: "K–2" as const,
  };
  const graph = [
    { id: "entry", strand: "number", prerequisites: [] },
    { id: "anchor", strand: "algebra", prerequisites: ["unknown-ancestor"] },
    {
      id: "child",
      strand: "algebra",
      prerequisites: ["anchor", "missing-sibling"],
    },
  ];
  const attempts = [
    { ...answer("integer-power", 0), skillId: "anchor", templateId: "anchor" },
  ];
  for (let i = 0; i < 40; i++) {
    const choices = planMixedPractice({
      templates: [source, child, root],
      skills: graph,
      attempts,
      evidence: [],
      count: 3,
      seed: `siblings-${i}`,
      now,
    });
    assert.ok(choices.some((c) => c.template.id === "anchor"));
    assert.ok(choices.every((c) => c.template.id !== "child"));
    assert.equal(projectSkillEvidence(attempts).length, 1);
  }
});
test("numeric-only legacy sessions do not borrow unsupported harder work for variety", () => {
  const legacy = templates.filter(
    (t) => !t.requiredResponseCapability && !t.requiredFigureCapability,
  );
  for (let i = 0; i < 50; i++) {
    const choices = planMixedPractice({
      templates: legacy,
      skills,
      attempts: [],
      evidence: [],
      count: 3,
      seed: `legacy-${i}`,
      now,
    });
    assert.ok(
      choices.every(
        (c) =>
          c.template.id === "count-objects" ||
          c.template.id === "join-within-10" ||
          c.template.id === "pairing-leftover",
      ),
    );
    assert.ok(
      choices.filter((c) => c.template.id !== "count-objects").length <= 1,
    );
  }
});

test("diagnostic support descends after a same-band miss or assisted result", () => {
  const make = (id: string) => ({
    ...templates[0]!,
    id,
    skillId: id,
    gradeBand: "3–5" as const,
  });
  const candidates = [make("a"), make("b"), make("c")];
  const graph = [
    { id: "a", strand: "operations", prerequisites: [] },
    { id: "b", strand: "operations", prerequisites: ["a"] },
    { id: "c", strand: "operations", prerequisites: ["b"] },
  ];
  const outcome = (id: string, index: number, assisted = false) => ({
    ...answer("count-objects", index, assisted, assisted),
    skillId: id,
    templateId: id,
  });
  const select = (attempts: Outcome[], count = 3) =>
    planMixedPractice({
      templates: candidates,
      skills: graph,
      attempts,
      evidence: [],
      count,
      seed: "descend",
      now,
    });
  const first = select([outcome("c", 0)]);
  assert.equal(first.filter((c) => c.template.id === "b").length, 1);
  for (const assisted of [false, true]) {
    const next = select([outcome("c", 0), outcome("b", 1, assisted)]);
    assert.ok(
      next.some((c) => c.template.id === "a" && c.reason === "prerequisite"),
    );
    assert.ok(
      next.every((c) => c.template.id !== "b" && c.template.id !== "c"),
    );
  }
});
test("sparse diagnostic fallback shrinks rather than filling a batch and rejects malformed ancestry", () => {
  const t = templates.find((t) => t.id === "integer-power")!;
  const input = {
    templates: [t],
    skills,
    attempts: [],
    evidence: [],
    count: 5,
    seed: "sparse",
    now,
  };
  assert.equal(planMixedPractice(input).length, 1);
  assert.equal(planMixedPractice({ ...input, strictCeiling: true }).length, 0);
  const malformed = [
    { id: t.skillId, strand: "algebra", prerequisites: ["cycle"] },
    { id: "cycle", strand: "algebra", prerequisites: [t.skillId] },
  ];
  assert.equal(planMixedPractice({ ...input, skills: malformed }).length, 0);
  assert.equal(
    planMixedPractice({
      ...input,
      skills: malformed,
      startingPoint: { band: "9–12", policyVersion: 1, excludedStrands: [] },
    }).length,
    0,
  );
});

test("failed sparse probes and cyclic remediation cannot bypass descent through fallback", () => {
  const t = templates.find((t) => t.id === "integer-power")!;
  const input = {
    templates: [t],
    skills,
    attempts: [answer(t.id, 0, false)],
    evidence: [],
    count: 3,
    seed: "sparse-failed",
    now,
  };
  assert.equal(planMixedPractice(input).length, 0);
  const b = { ...t, id: "cyclic-b", skillId: "cyclic-b" };
  const graph = [
    { id: t.skillId, strand: "algebra", prerequisites: [b.skillId] },
    { id: b.skillId, strand: "algebra", prerequisites: [t.skillId] },
  ];
  assert.equal(
    planMixedPractice({ ...input, templates: [t, b], skills: graph }).length,
    0,
  );
});
