import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";
import {
  fromRoots,
  roughSketchSentence,
} from "../src/math/quadratic-structure-practice.js";
import { quadraticFtaStatement } from "../src/math/complex-conics-practice.js";

test("the seeded factored polynomial falls at both ends and f(0) is 12", () => {
  const pairs = [
    { z: -3, m: 1 as const },
    { z: 1, m: 2 as const },
    { z: 4, m: 1 as const },
  ];
  assert.equal(
    roughSketchSentence(-1, pairs),
    "The right end falls. Touches at 1. Crosses at −3 and 4.",
  );
  const coeffs = fromRoots(
    -1,
    pairs.flatMap((p) => Array<number>(p.m).fill(p.z)),
  );
  assert.equal(coeffs[coeffs.length - 1], 12);
});

test("graph-from-factored-rule sketches are distinct and version 1 stays on the old prompt", () => {
  let sketches = 0;
  for (let i = 0; i < 80; i++) {
    const problem = generateProblem("zero-multiplicity", `clause-poly:${i}`);
    const old = generateProblem("zero-multiplicity", `clause-poly:${i}`, 1);
    assert.match(
      old.public.prompt,
      /How does the graph|Which equation|cubic graph touches/,
    );
    if (problem.public.prompt.includes("sketch a rough graph")) {
      sketches++;
      const labels = (
        problem.public.response as { options: { label: string }[] }
      ).options.map((o) => o.label);
      assert.equal(new Set(labels).size, 4);
      assert.ok(labels.every((label) => label.startsWith("The right end ")));
    }
  }
  assert.ok(sketches >= 15, `only ${sketches} sketches`);
});

test("quadratic FTA statements match the seeded quadratics", () => {
  // Typesetting only: the same discriminant sentences, with $...$ around the math.
  // The quadratic (b, c) and the kind are unchanged.
  assert.equal(
    quadraticFtaStatement(4, 13).sentence,
    "$D = -36 < 0$, so $x = -2 \\pm 3i$: two nonreal roots, which is two roots counting multiplicity.",
  );
  assert.equal(
    quadraticFtaStatement(-6, 13).sentence,
    "$D = -16 < 0$, so $x = 3 \\pm 2i$: two nonreal roots, which is two roots counting multiplicity.",
  );
  assert.equal(quadraticFtaStatement(-6, 13).kind, "negative");
  const repeated = quadraticFtaStatement(10, 25);
  assert.equal(repeated.kind, "zero");
  assert.match(repeated.sentence, /\$x = -5\$ is a root of multiplicity 2/);
});

test("quadratic-fta-argument options include one sound count of two", () => {
  let seen = 0;
  const kinds = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const problem = generateProblem(
      "polynomial-root-count",
      `clause-fta:${i}`,
    );
    const old = generateProblem(
      "polynomial-root-count",
      `clause-fta:${i}`,
      1,
    );
    assert.doesNotMatch(old.public.prompt, /exactly two complex roots/);
    if (problem.public.prompt.includes("exactly two complex roots")) {
      seen++;
      const options = (
        problem.public.response as { options: { id: string; label: string }[] }
      ).options;
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map((o) => o.label)).size, 4);
      const correct = options.find((o) => o.id === problem.answer);
      assert.ok(correct);
      assert.match(correct.label, /two roots/);
      // Typesetting only: strip $ so "$D = 0$" still classifies as the repeated root.
      const reading = correct.label.replaceAll("$", "");
      if (reading.includes("< 0")) kinds.add("negative");
      else if (reading.startsWith("D = 0")) kinds.add("zero");
      else kinds.add("positive");
    }
  }
  assert.ok(seen >= 15, `only ${seen} FTA items`);
  assert.deepEqual(kinds, new Set(["negative", "zero", "positive"]));
});

test("the polynomial oracles accept the new prompts", () => {
  const lines = ["clause-poly:0", "clause-fta:0"].flatMap((seed, index) => {
    const id = index === 0 ? "zero-multiplicity" : "polynomial-root-count";
    const problem = generateProblem(id, seed);
    return JSON.stringify({
      templateId: id,
      prompt: problem.public.prompt,
      answer: problem.answer,
      response: problem.public.response,
    });
  });
  const script = `
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path("scripts").resolve()))
from quadratic_structure_math_oracle import solve_quadratic_structure
from complex_conics_math_oracle import solve
for line in sys.stdin:
    row = json.loads(line)
    public = {"templateId": row["templateId"], "prompt": row["prompt"], "response": row["response"]}
    got = solve_quadratic_structure(public) if row["templateId"] == "zero-multiplicity" else solve(public)
    if got != row["answer"]:
        raise SystemExit(f'{row["templateId"]}: {got} != {row["answer"]}\\n{row["prompt"]}')
print("ok")
`;
  const run = spawnSync("python3", ["-c", script], {
    cwd: new URL("..", import.meta.url),
    input: lines.join("\n") + "\n",
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /ok/);
});
