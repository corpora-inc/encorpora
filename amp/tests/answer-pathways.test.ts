import assert from "node:assert/strict";
import test from "node:test";
import {
  answerPathways,
  answersToStrength,
} from "../src/web/features/practice/answer-pathways";
import { projectSkillEvidence } from "../src/server/evidence";

test("the displayed next step agrees with the server's strength rule for every recent history", () => {
  for (let size = 0; size <= 5; size++) {
    for (let pattern = 0; pattern < 3 ** size; pattern++) {
      const recent = Array.from({ length: size }, (_, i) => {
        const digit = Math.floor(pattern / 3 ** i) % 3;
        return { correct: digit !== 0, assisted: digit === 2 };
      });
      const needed = answersToStrength(recent);
      const stateAfter = (more: number) =>
        projectSkillEvidence(
          [
            ...recent,
            ...Array.from({ length: more }, () => ({
              correct: true,
              assisted: false,
            })),
          ].map((answer, i) => ({
            ...answer,
            id: String(i),
            templateId: "sample",
            skillId: "sample",
            createdAt: new Date(i * 1000).toISOString(),
          })),
        ).at(-1)?.status;
      assert.equal(stateAfter(needed), "review-ready", `${size}/${pattern}`);
      if (needed > 0) assert.notEqual(stateAfter(needed - 1), "review-ready");
    }
  }
});

test("answer choices follow direct prerequisites and never offer unimplemented skills", () => {
  const skills = [
    { id: "count", title: "Count", prerequisites: [] },
    { id: "add", title: "Add", prerequisites: ["count", "unbuilt"] },
    { id: "multiply", title: "Multiply", prerequisites: ["add"] },
    { id: "divide", title: "Divide", prerequisites: ["multiply"] },
    { id: "unbuilt", title: "Unbuilt" },
    { id: "next-unbuilt", title: "Next unbuilt", prerequisites: ["add"] },
  ];
  const templates = ["count", "add", "multiply", "divide"].map((skillId) => ({
    id: skillId + "-problem",
    skillId,
  }));
  const paths = answerPathways("add", skills, templates);
  assert.deepEqual(
    paths.buildsOn.map((s) => s.templateId),
    ["count-problem"],
  );
  assert.deepEqual(
    paths.leadsTo.map((s) => s.templateId),
    ["multiply-problem"],
  );
  assert.deepEqual(answerPathways("absent", skills, templates), {
    skill: undefined,
    buildsOn: [],
    leadsTo: [],
  });
});

test("a self edge cannot offer the current skill, and multiple templates make one choice", () => {
  const skills = [
    { id: "a", title: "A", prerequisites: ["a", "b"] },
    { id: "b", title: "B", prerequisites: ["a"] },
  ];
  const paths = answerPathways("a", skills, [
    { id: "a1", skillId: "a" },
    { id: "b1", skillId: "b" },
    { id: "b2", skillId: "b" },
  ]);
  assert.deepEqual(
    paths.buildsOn.map((s) => s.templateId),
    ["b1"],
  );
  assert.deepEqual(
    paths.leadsTo.map((s) => s.templateId),
    ["b1"],
  );
});

test("higher-grade recovery includes reachable elementary foundations without replacing direct prerequisites", () => {
  const nodes = [
    { id: "facts", title: "Facts", gradeBand: "3", prerequisites: [] },
    {
      id: "fractions",
      title: "Fractions",
      gradeBand: "4",
      prerequisites: ["facts"],
    },
    {
      id: "ratios",
      title: "Ratios",
      gradeBand: "6",
      prerequisites: ["fractions"],
    },
    {
      id: "algebra",
      title: "Algebra",
      gradeBand: "algebra-1",
      prerequisites: ["ratios"],
    },
    { id: "unrelated", title: "Unrelated", gradeBand: "3", prerequisites: [] },
  ];
  const catalog = nodes.map((s) => ({ id: s.id + "-problem", skillId: s.id }));
  const choices = answerPathways("algebra", nodes, catalog).buildsOn;
  assert.equal(choices[0]!.id, "ratios");
  assert.deepEqual(
    choices.filter((c) => c.foundation).map((c) => c.id),
    ["fractions", "facts"],
  );
  assert.ok(!choices.some((c) => c.id === "unrelated"));
  assert.ok(
    !answerPathways("fractions", nodes, catalog).buildsOn.some(
      (c) => c.foundation,
    ),
  );
});
