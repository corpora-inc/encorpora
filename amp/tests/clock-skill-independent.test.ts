import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateProblem, templates } from "../src/math/engine.js";

// The independent clock-skill oracle reads only the public payload and key.
function review(lines: unknown[]) {
  return spawnSync("python3", ["scripts/clock_skill_oracle.py"], {
    input: lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
    encoding: "utf8",
    timeout: 60_000,
  });
}

test("every clock problem reads a time that fits its skill, and its key shows that time", () => {
  const clockTemplates = templates.filter(
    (t) => t.skillId.startsWith("clock-") || t.id.includes("clock"),
  );
  assert.ok(clockTemplates.length > 0);
  const result = review(
    clockTemplates.flatMap((t) =>
      Array.from({ length: 256 }, (_, index) => ({
        kind: "case",
        problem: generateProblem(t.id, `independent-${index}`),
      })),
    ),
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /clock-five-minutes/);
  assert.match(result.stdout, /"failures": 0/);
});

test("the clock-skill oracle rejects a five-minute problem that asks for 4:01", () => {
  const clocks = [
    { hour: 4, minute: 1, label: "A" },
    { hour: 1, minute: 20, label: "B" },
    { hour: 4, minute: 5, label: "C" },
  ];
  const result = review([
    {
      kind: "case",
      problem: {
        public: {
          templateId: "fixture",
          seed: "fixture",
          skillId: "clock-five-minutes",
          prompt: "Which clock shows 4:01?",
          figure: { kind: "analog-clocks", clocks },
          response: {
            kind: "choice",
            options: clocks.map((c, i) => ({ id: `o${i}`, label: c.label })),
          },
        },
        answer: "o0",
      },
    },
  ]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /FAIL .*clock-five-minutes problem reads 4:01/);
});
