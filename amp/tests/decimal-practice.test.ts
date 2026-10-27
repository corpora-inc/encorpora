import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { decimalTemplates } from "../src/math/decimal-practice";
import { decimal, fixed } from "../src/math/decimal-models";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { openerSlots, templateRole } from "../src/learning/placement";
import { skills } from "../src/curriculum/catalog";

const ids = decimalTemplates.map((t) => t.id);
/** Exact value of a written decimal in millionths. */
const exact = (s: string) => {
  const [w, d = ""] = s.split(".");
  return BigInt(w + d) * 10n ** BigInt(6 - d.length);
};

test("decimal families are deterministic, valid, distinct assessment items", () => {
  for (const id of ids) {
    assert.equal(templateRole(id), "assessment", id);
    const prompts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `dec-${i}`);
      assert.deepEqual(p, generateProblem(id, `dec-${i}`));
      generatedProblemSchema.parse(p);
      assert.ok(gradeAnswer(p, p.answer), `${id}: ${p.answer}`);
      prompts.add(JSON.stringify([p.public.prompt, p.public.figure]));
    }
    assert.ok(prompts.size >= 12, `${id} has ${prompts.size} distinct items`);
  }
});

test("decimals start in grade 4 and compare-decimals is in the opener pools", () => {
  const grade = (skillId: string) =>
    Number(skills.find((s) => s.id === skillId)!.gradeBand);
  for (const t of decimalTemplates) assert.ok(grade(t.skillId) >= 4, t.id);
  assert.equal(grade("decimal-fractions"), 4);
  assert.equal(grade("compare-decimals"), 4);
  const openers = openerSlots.flat(2);
  assert.ok(openers.includes("compare-decimals-hundredths"));
  assert.ok(openers.includes("compare-decimals-thousandths"));
  for (const id of ids)
    assert.ok(templates.some((t) => t.id === id && t.skillId));
});

test("decimal comparisons include shorter-but-greater pairs and pad to align", () => {
  for (const [id, places] of [
    ["compare-decimals-hundredths", 2],
    ["compare-decimals-thousandths", 3],
  ] as const) {
    let shorterGreater = 0;
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `dec-${i}`);
      const [, ask, a, b] =
        /^Which is (greater|less): ([\d.]+) or ([\d.]+)\?/.exec(
          p.public.prompt,
        )!;
      assert.notEqual(exact(a!), exact(b!));
      const [big, small] = exact(a!) > exact(b!) ? [a!, b!] : [b!, a!];
      assert.equal(p.answer, ask === "greater" ? big : small);
      if (big.split(".")[1]!.length < small.split(".")[1]!.length)
        shorterGreater++;
      const f = p.public.figure;
      assert.equal(f?.kind, "place-value-chart");
      if (f?.kind !== "place-value-chart") continue;
      assert.equal(f.places, places);
      assert.deepEqual(
        f.rows.map((r) => `${r.ones}.${r.decimals}`),
        [a, b],
      );
    }
    assert.ok(shorterGreater >= 60, `${id}: ${shorterGreater} of 300`);
  }
});

test("rounding, digit value and operations agree with exact integer arithmetic", () => {
  for (let i = 0; i < 300; i++) {
    const round = generateProblem("round-decimal", `dec-${i}`);
    const [, n, target] =
      /^Round ([\d.]+) to the nearest (whole number|tenth|hundredth)\.$/.exec(
        round.public.prompt,
      )!;
    const unit =
      10n **
      BigInt(6 - ["whole number", "tenth", "hundredth"].indexOf(target!));
    const v = exact(n!);
    const rounded = ((v + unit / 2n) / unit) * unit;
    assert.equal(exact(round.answer), rounded, round.public.prompt);

    const product = generateProblem("multidigit-decimal-product", `dec-${i}`);
    const [, x, y] = /^What is ([\d.]+) × ([\d.]+)\?$/.exec(
      product.public.prompt,
    )!;
    const px = x!.split(".")[1]!.length,
      py = y!.split(".")[1]!.length;
    const raw = Number(x!.replace(".", "")) * Number(y!.replace(".", ""));
    assert.equal(product.answer, decimal(raw, px + py));

    const quotient = generateProblem("multidigit-decimal-quotient", `dec-${i}`);
    // Positive quotients are written plainly; the sign axis adds one negative
    // operand (or two), typeset with a leading minus.
    const plainForm = /^What is ([\d.]+) ÷ ([\d.]+)\?$/.exec(
      quotient.public.prompt,
    );
    const signedForm =
      /^What is \$(-?)([\d.]+) \\div (?:\\left\(-([\d.]+)\\right\)|([\d.]+))\$\?$/.exec(
        quotient.public.prompt,
      );
    const dividend = (plainForm ? plainForm[1] : signedForm![2])!;
    const divisor = (
      plainForm ? plainForm[2] : (signedForm![3] ?? signedForm![4])
    )!;
    const negatives =
      (signedForm?.[1] ? 1 : 0) + (signedForm?.[3] !== undefined ? 1 : 0);
    assert.equal(quotient.answer.startsWith("-"), negatives === 1);
    assert.equal(
      exact(quotient.answer.replace("-", "")) * exact(divisor),
      exact(dividend) * 1000000n,
      quotient.public.prompt,
    );

    const sum = generateProblem("multidigit-decimal-sum", `dec-${i}`);
    const [, s, op, t] = /^What is ([\d.]+) ([+−]) ([\d.]+)\?$/.exec(
      sum.public.prompt,
    )!;
    assert.equal(
      exact(sum.answer),
      op === "+" ? exact(s!) + exact(t!) : exact(s!) - exact(t!),
    );
    assert.ok(exact(sum.answer) > 0n);
  }
  assert.equal(fixed(5, 2), "0.05");
  assert.equal(decimal(340, 2), "3.4");
});

test("inverse rounding choices have one exact half-up answer across boundaries", () => {
  let lowerIncluded = 0;
  let upperExcluded = 0;
  let carry = 0;
  let largerHundredths = 0;
  for (let i = 0; i < 600; i++) {
    const p = generateProblem("inverse-round-decimal", `inverse-${i}`);
    const match =
      /^Which decimal rounds to (\d+\.\d+) to the nearest (tenth|hundredth)\?/.exec(
        p.public.prompt,
      );
    assert.ok(match, p.public.prompt);
    assert.equal(p.public.response.kind, "choice");
    if (p.public.response.kind !== "choice") continue;
    const target = exact(match[1]!);
    const unit = match[2] === "tenth" ? 100000n : 10000n;
    if (unit === 10000n && target >= 20_000_000n) largerHundredths++;
    const options = p.public.response.options;
    assert.equal(options.length, 4);
    assert.equal(new Set(options.map((option) => option.label)).size, 4);
    const correct = options.filter((option) => {
      const value = exact(option.label);
      const independentlyRounded = ((value + unit / 2n) / unit) * unit;
      const expected = independentlyRounded === target;
      assert.equal(gradeAnswer(p, option.id), expected, p.public.prompt);
      if (expected && value === target - unit / 2n) lowerIncluded++;
      if (!expected && value === target + unit / 2n) upperExcluded++;
      if (expected && target % 1000000n === 0n && value < target) carry++;
      return expected;
    });
    assert.equal(correct.length, 1, p.public.prompt);
    assert.equal(correct[0]!.id, p.answer);
  }
  assert.ok(lowerIncluded > 0, "lower halfway included");
  assert.ok(upperExcluded > 0, "upper halfway excluded");
  assert.ok(carry > 0, "rounding carries into a whole number");
  assert.ok(largerHundredths > 0, "hundredths include larger whole parts");
});

test("independent public-choice oracle verifies inverse rounding cases and fixtures", () => {
  const cases = Array.from({ length: 512 }, (_, i) =>
    generateProblem("inverse-round-decimal", `public-oracle-${i}`),
  );
  const review = spawnSync(
    "python3",
    [
      "-c",
      `import json,runpy,sys
sys.path.insert(0, 'scripts')
from inverse_rounding_math_oracle import self_test, review_problem
central = runpy.run_path('scripts/independent-math-review.py')
assert self_test()['rejectedMutations'] == 20
for problem in json.load(sys.stdin):
    assert review_problem(problem) == central['solve'](problem['public']) == problem['answer']
print('512 independent inverse-rounding cases passed')`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(review.status, 0, review.stderr || String(review.error));
  assert.match(review.stdout, /512 independent inverse-rounding cases passed/);
});

test("decimal lessons, illustrations and worksheets cover every family", () => {
  for (const id of ids) {
    const lesson = lessons.find((l) => l.templateIds.includes(id));
    assert.ok(lesson, id);
    assert.ok(
      [...lesson.sections, ...(lesson.closingSections ?? [])].some(
        (s) => s.illustration,
      ),
      lesson.id,
    );
  }
  const lesson = lessons.find((l) => l.id === "compare-decimals")!;
  const workbook = publicationHtml(lesson, "workbook");
  assert.equal((workbook.match(/Which is (greater|less)/g) ?? []).length, 12);
  assert.ok(!workbook.includes("Answer:"));
  // Distinct worksheets: no item repeats on the printed sheet.
  const items = [...workbook.matchAll(/<h2>\d+\. ([\s\S]*?)<\/h2>/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(items).size, items.length);
});

test("decimal animations fill a hundredths grid and align a comparison", () => {
  const kinds = new Set<string>();
  for (const id of [
    "decimal-grid-read",
    "compare-decimals-hundredths",
    "compare-decimals-thousandths",
  ])
    for (let i = 0; i < 80; i++) {
      const lesson = problemLesson(id, `dec-animation-${i}`);
      const model = animationModel(lesson);
      if (!model) {
        // Tenths strips keep the ordinary figure.
        assert.equal(id, "decimal-grid-read");
        continue;
      }
      kinds.add(model.kind);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      if (model.kind === "decimal-fill")
        assert.ok(
          frames[2]!.math.endsWith(
            `= 0.${String(model.shaded).padStart(2, "0")}$`,
          ),
        );
      if (model.kind === "decimal-align") {
        const [a, b] = model.figure.rows.map((r) => `${r.ones}.${r.decimals}`);
        const sign = exact(a!) > exact(b!) ? ">" : "<";
        assert.equal(frames[2]!.math, `$${a} ${sign} ${b}$`);
      }
    }
  assert.deepEqual([...kinds].sort(), ["decimal-align", "decimal-fill"]);
});
