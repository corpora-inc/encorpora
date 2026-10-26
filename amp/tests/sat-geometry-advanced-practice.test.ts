import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { satGeometryAdvancedCase } from "../src/math/sat-geometry-advanced-practice";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { buildSatCoverage } from "../src/curriculum/sat-coverage";

const expected: Record<
  string,
  { skill: string; kind: "choice" | "number"; tags: string[] }
> = {
  "corresponding-angle-transfer": {
    skill: "similarity-proofs",
    kind: "choice",
    tags: [
      "similar-scale",
      "similar-third",
      "similar-right",
      "congruent-direct",
      "congruent-right",
    ],
  },
  "crossing-segment-similarity": {
    skill: "similarity-proofs",
    kind: "number",
    tags: ["crossing-side", "crossing-near", "crossing-base"],
  },
  "angle-chase-chain": {
    skill: "triangle-angle-theorems",
    kind: "number",
    tags: ["vertical-sameside", "triangle-parallel", "right-parallel"],
  },
  "angle-claim-reasoning": {
    skill: "angle-relationships",
    kind: "choice",
    tags: [
      "triangle-possible",
      "triangle-impossible",
      "compare-adjacent",
      "compare-vertical",
      "sum-impossible",
    ],
  },
  "circle-radii-triangle": {
    skill: "circle-theorems",
    kind: "number",
    tags: [
      "base-angle",
      "base-angle-arc",
      "central-from-base",
      "chord-perimeter",
      "radius-perimeter",
    ],
  },
  "shifted-polynomial-features": {
    skill: "function-transformations",
    kind: "number",
    tags: ["quad-extreme", "cubic-zero-sum", "cubic-vertical-value"],
  },
  "radical-side-entry": {
    skill: "pythagorean-theorem",
    kind: "number",
    tags: ["hyp-radicand", "hyp-coefficient", "decimal-leg"],
  },
  "special-triangle-in-figure": {
    skill: "special-right-triangles",
    kind: "number",
    tags: [
      "acute-angle",
      "equilateral-altitude",
      "square-in-circle",
      "equilateral-circumradius",
    ],
  },
};
const ids = Object.keys(expected);
const seeds = Array.from({ length: 400 }, (_, i) => `sga:${i}`);
const numbers = (text: string) => new Set(text.match(/\d+(?:\.\d+)?/g) ?? []);

test("each family is deterministic, reaches every variant and has one exact answer", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (const seed of seeds) {
      const generated = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), generated);
      const direct = satGeometryAdvancedCase(id, seed);
      assert.equal(direct.problem.answer, generated.answer);
      assert.equal(generated.public.skillId, expected[id]!.skill);
      assert.ok(
        generated.hint.length > 40 && generated.explanation.length >= 3,
        `${id} ${seed}`,
      );
      const response = generated.public.response;
      if (expected[id]!.kind === "choice") {
        assert.equal(response.kind, "choice");
        if (response.kind !== "choice") throw new Error("choice expected");
        const labels = response.options.map((o) => o.label);
        assert.equal(new Set(labels).size, 4, `${id} ${seed} ${labels}`);
        assert.equal(
          response.options.filter((o) => o.id === generated.answer).length,
          1,
        );
        const correct = response.options.find(
          (o) => o.id === generated.answer,
        )!.label;
        assert.ok(
          !generated.hint.includes(correct) || correct.length < 4,
          `${id} ${seed}: hint contains ${correct}`,
        );
        for (const option of response.options)
          if (option.id !== generated.answer)
            assert.ok(
              generated.choiceFeedback?.[option.id],
              `${id}: missing feedback`,
            );
      } else {
        assert.equal(response.kind, "number");
        assert.match(generated.answer, /^-?\d+(\.\d+)?$/, `${id} ${seed}`);
        // The hint must not hand over the answer as a new number.
        if (
          !numbers(generated.public.prompt).has(
            generated.answer.replace("-", ""),
          )
        )
          assert.ok(
            !new RegExp(
              `=\\s*${generated.answer.replace("-", "-?").replace(".", "\\.")}(?![\\d.])`,
            ).test(generated.hint),
            `${id} ${seed}: hint states answer`,
          );
      }
      seen.add(direct.tag);
    }
    assert.deepEqual([...seen].sort(), [...expected[id]!.tags].sort(), id);
  }
});

test("numeric answers agree with independent recomputation from the prompt", () => {
  for (const seed of seeds) {
    {
      const g = generateProblem("circle-radii-triangle", seed);
      const p = g.public.prompt;
      const ang = /measures? (\d+)°/.exec(p);
      if (/What is the measure, in degrees, of \$\\angle OAB\$/.test(p) && ang)
        assert.equal(Number(g.answer), (180 - Number(ang[1])) / 2, p);
      else if (
        /What is the measure, in degrees, of \$\\angle AOB\$/.test(p) &&
        ang
      )
        assert.equal(Number(g.answer), 180 - 2 * Number(ang[1]), p);
      const rad =
        /radius (\d+)\. The perimeter of triangle \$OAB\$ is (\d+)/.exec(p);
      if (rad)
        assert.equal(Number(g.answer), Number(rad[2]) - 2 * Number(rad[1]));
      const ch =
        /length (\d+)\. The perimeter of triangle \$OAB\$ is (\d+)/.exec(p);
      if (ch)
        assert.equal(Number(g.answer), (Number(ch[2]) - Number(ch[1])) / 2);
    }
    {
      const g = generateProblem("radical-side-entry", seed);
      const m = /legs have lengths (\d+) and (\d+)/.exec(g.public.prompt);
      if (m) {
        const c2 = Number(m[1]) ** 2 + Number(m[2]) ** 2;
        let out = 1,
          inside = c2;
        for (let f = 2; f * f <= inside; f++)
          while (inside % (f * f) === 0) {
            inside /= f * f;
            out *= f;
          }
        const wantsM = /value of \$m\$/.test(g.public.prompt);
        assert.equal(Number(g.answer), wantsM ? out : inside);
        assert.ok(out > 1 && inside > 1);
      } else {
        const d =
          /hypotenuse is ([\d.]+) centimeters? and one leg is ([\d.]+)/.exec(
            g.public.prompt,
          )!;
        const other = Math.sqrt(Number(d[1]) ** 2 - Number(d[2]) ** 2);
        assert.ok(Math.abs(other - Number(g.answer)) < 1e-9);
      }
    }
    {
      const g = generateProblem("crossing-segment-similarity", seed);
      const n = (k: string) =>
        Number(new RegExp(`\\$${k}=(\\d+)\\$`).exec(g.public.prompt)?.[1]);
      const ask = /length of segment \$(\w+)\$/.exec(g.public.prompt)![1]!;
      if (ask === "DE")
        assert.equal(Number(g.answer), (n("BE") * n("CE")) / n("AE"));
      if (ask === "BE")
        assert.equal(Number(g.answer), (n("AE") * n("DE")) / n("CE"));
      if (ask === "BD")
        assert.equal(Number(g.answer), (n("BE") * n("AC")) / n("AE"));
      assert.ok(Number.isInteger(Number(g.answer)));
    }
    {
      const g = generateProblem("angle-chase-chain", seed);
      const p = g.public.prompt;
      const tri =
        /\$\\angle A\$ measures (\d+)° and (?:\$\\angle B\$ measures (\d+)°|\$\\angle B\$ is a right angle)/.exec(
          p,
        );
      if (tri) {
        const a = Number(tri[1]);
        const b = tri[2] ? Number(tri[2]) : 90;
        assert.equal(Number(g.answer), a + b);
        assert.ok(a + b > 90);
      } else {
        const e =
          /measure \$\((\d*)x([+-]\d+)?\)\^\\circ\$ and \$\((\d*)x([+-]\d+)?\)\^\\circ\$/.exec(
            p,
          )!;
        const co = (s: string | undefined) => (s === "" ? 1 : Number(s));
        const [pp, q, s, u] = [
          co(e[1]),
          Number(e[2] ?? 0),
          co(e[3]),
          Number(e[4] ?? 0),
        ];
        const x = (u - q) / (pp - s);
        assert.ok(Number.isInteger(x) && x > 0);
        assert.equal(Number(g.answer), 180 - (pp * x + q));
      }
    }
  }
});

test("families have lessons, methods, principles, SAT rows and one lesson binding", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.equal(template?.skillId, expected[id]!.skill);
    assert.ok(methods[id] && methods[id]!.goal.length <= 140, id);
    assert.ok(principles[id], id);
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      id,
    );
  }
  const coverage = buildSatCoverage();
  assert.deepEqual((coverage as { errors?: string[] }).errors ?? [], []);
});
