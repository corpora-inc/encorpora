import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  axisNumberSpec,
  sameNumberSpec,
} from "../src/math/complex-conics-practice";
import {
  buildAxisNumberPlot,
  buildModulusViaConjugate,
  modulusParts,
} from "../src/math/complex-clause-items-practice";
import { gradePointPlot } from "../src/math/point-plot";
import type { PointPlotResponse } from "../src/math/point-plot";

const CLASSIC = {
  "complex-plane-forms":
    "8d9e2b50a3a2273bf0ef22a4672d1ced1f131e8bdb423eef8d7502431ef02c40",
  "complex-distance-midpoint":
    "971aeaffe422063c69339659c5b45e4396b39fdc7bcd9fdf5a302f50d2677e36",
  "complex-conjugate-division":
    "76e961d48a6f00c6dce41f4cec73f387312facae48ff801e6d4a147b74d54cf9",
} as const;

test("version 1 reprints the classic complex bytes", () => {
  for (const [id, expected] of Object.entries(CLASSIC)) {
    const hashes = [];
    for (let i = 0; i < 30; i++) {
      const problem = generateProblem(id, `classic-snap:${i}`, 1);
      assert.equal(problem.public.templateVersion, 1);
      assert.equal(problem.variant, undefined);
      hashes.push(createHash("sha256").update(JSON.stringify(problem)).digest("hex"));
    }
    const all = createHash("sha256").update(hashes.join("")).digest("hex");
    assert.equal(all, expected, id);
  }
});

test("modulus via conjugate matches the spec seeds and never uses a zero part", () => {
  const pyth = buildModulusViaConjugate(5, -12);
  const pythParts = modulusParts(5, -12);
  assert.equal(pythParts.conjugate, "$5 + 12i$");
  assert.equal(pythParts.product, "$169$");
  assert.equal(pythParts.modulus, "$13$");
  const modBlank = pyth.public.response;
  assert.equal(modBlank.kind, "multi-part-choice");
  if (modBlank.kind !== "multi-part-choice") return;
  const mod = modBlank.blanks.find((blank) => blank.id === "mod");
  const labels = mod!.options.map((option) => option.label);
  assert.ok(labels.includes("$169$"));
  assert.ok(labels.includes("$13\\,i$"));
  const joined = pyth.explanation.join("\n");
  assert.ok(joined.includes("z\\bar z=|z|^2"));
  assert.ok(joined.includes("\\sqrt{169}=13"));
  assert.equal(/\d/.test(pyth.hint), false);

  const radical = modulusParts(2, -4);
  assert.equal(radical.modulus, "$2\\sqrt{5}$");
  assert.deepEqual(
    [...radical.modulusWrongs].sort(),
    ["$20$", "$2\\sqrt{5}\\,i$", "$6$"].sort(),
  );

  let radicalCount = 0;
  for (let seed = 0; seed < 500; seed++) {
    const problem = generateProblem(
      "complex-modulus-via-conjugate",
      `mod:${seed}`,
    );
    const response = problem.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") continue;
    assert.equal(response.blanks.length, 3);
    const match = /Let \$z=([^$]+)\$/.exec(problem.public.prompt);
    assert.ok(match, problem.public.prompt);
    const body = match![1]!;
    assert.equal(body.includes("+ 0i") || body.endsWith(" 0i"), false);
    assert.notEqual(body, "0");
    assert.match(body, /i/);
    for (const blank of response.blanks) {
      const texts = blank.options.map((option) => option.label);
      assert.equal(new Set(texts).size, texts.length);
    }
    const mod = response.blanks.find((blank) => blank.id === "mod")!;
    const correct = mod.options.find(
      (option) => option.id === JSON.parse(problem.answer).mod,
    )!.label;
    if (correct.includes("\\sqrt")) radicalCount += 1;
    assert.equal(/\d/.test(problem.hint), false);
    assert.equal(problem.answer.includes("undefined"), false);
  }
  assert.ok(radicalCount > 40, `radical family ${radicalCount}`);
});

test("same-number check marks both parts, not length or arctan", () => {
  const match = sameNumberSpec({ r: 6, deg: 300, mode: "match" });
  assert.match(match.correct, /6\\cos \\frac\{5\\pi\}\{3\}=3/);
  assert.match(match.correct, /6\\sin \\frac\{5\\pi\}\{3\}=-3\\sqrt\{3\}/);
  assert.match(match.correct, /both name the point/);
  assert.equal(match.wrong.some(([label]) => label.includes("\\tan")), true);
  assert.equal(match.correct.includes("\\tan"), false);
  assert.equal(match.correct.includes("length"), false);
  const joined = match.explanation.join("\n");
  assert.match(joined, /false/i);
  assert.match(joined, /tan/);

  const mismatch = sameNumberSpec({ r: 6, deg: 60, mode: "mismatch" });
  assert.match(mismatch.prompt, /6\(\\cos \\frac\{\\pi\}\{3\}/);
  assert.match(mismatch.prompt, /3 - 3\\sqrt\{3\}/);
  assert.match(mismatch.correct, /different point/);
  assert.match(mismatch.correct, /3\\sqrt\{3\}/);
  assert.match(mismatch.correct, /-3\\sqrt\{3\}/);
  assert.equal(mismatch.correct.startsWith("Yes, both have length"), false);
  assert.match(mismatch.explanation.join("\n"), /wrong sign/);

  let same = 0;
  let axis = 0;
  let classic = 0;
  for (let seed = 0; seed < 400; seed++) {
    const problem = generateProblem("complex-plane-forms", `plane:${seed}`);
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const labels = response.options.map((option) => option.label);
    assert.equal(new Set(labels).size, 4);
    const correct = response.options.find((option) => option.id === problem.answer)!;
    assert.equal(problem.public.prompt.includes(correct.label), false);
    assert.equal(problem.hint.includes(correct.label), false);
    const family = problem.variant?.axes?.clause;
    if (family === "same-number-check") {
      same += 1;
      assert.equal(correct.label.includes("\\tan"), false);
      assert.equal(correct.label.includes("both have length"), false);
      assert.equal(correct.label.startsWith("Yes, both have length"), false);
      if (problem.public.prompt.includes("same number"))
        assert.match(problem.explanation.join("\n"), /false/i);
    } else if (family === "axis-numbers") {
      axis += 1;
      for (const line of problem.explanation)
        assert.equal(line.toLowerCase().includes("tan"), false, line);
      if (correct.label.includes("\\cos")) {
        assert.match(correct.label, /^\$\d+\\?\(/);
        assert.equal(correct.label.startsWith("$-"), false);
      }
    } else classic += 1;
  }
  assert.ok(same >= 40, `same-number ${same}`);
  assert.ok(axis >= 40, `axis ${axis}`);
  assert.ok(classic >= 160, `classic ${classic}`);
});

test("axis numbers keep a positive length and plot only the one point", () => {
  const neg = axisNumberSpec({ r: 4, axis: "neg-real", ask: "polar" });
  assert.equal(neg.correct, "$4(\\cos \\pi+i\\sin \\pi)$");
  const five = axisNumberSpec({ r: 5, axis: "pos-imag", ask: "polar" });
  assert.ok(five.wrong.some(([label]) => label === "$5(\\cos 0+i\\sin 0)$"));
  for (const line of [...neg.explanation, ...five.explanation])
    assert.equal(line.toLowerCase().includes("tan"), false);

  let positive = 0;
  for (let seed = 0; seed < 500; seed++) {
    const problem = generateProblem("complex-plane-forms", `axis:${seed}`);
    if (problem.variant?.axes?.clause !== "axis-numbers") continue;
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const correct = response.options.find((option) => option.id === problem.answer)!.label;
    if (correct.includes("\\cos")) {
      positive += 1;
      assert.match(correct, /^\$[1-9]\d*\(/);
    }
    for (const line of problem.explanation)
      assert.equal(line.toLowerCase().includes("tan"), false, line);
  }
  assert.ok(positive > 40);

  const plotted = buildAxisNumberPlot(0, -3);
  assert.equal(plotted.answer, "[[0,-3]]");
  const response = plotted.public.response as PointPlotResponse;
  assert.equal(
    gradePointPlot(response, plotted.pointGrading!, plotted.answer, "[[0,-3]]"),
    true,
  );
  assert.equal(
    gradePointPlot(response, plotted.pointGrading!, plotted.answer, "[[-3,0]]"),
    false,
  );
  for (const line of plotted.explanation)
    assert.equal(line.toLowerCase().includes("tan"), false);
  let plots = 0;
  for (let seed = 0; seed < 80; seed++) {
    const problem = generateProblem("complex-axis-number-plot", `plot:${seed}`);
    plots += 1;
    assert.equal(problem.public.response.kind, "point-plot");
    const swap = problem.answer === "[[0,-3]]" ? "[[-3,0]]" : null;
    if (swap)
      assert.equal(
        gradeAnswer(problem, swap),
        false,
      );
    for (const line of problem.explanation)
      assert.equal(line.toLowerCase().includes("tan"), false);
  }
  assert.equal(plots, 80);
});

test("midpoint ask stays common and the widened axis has a non-integer midpoint", () => {
  let mid = 0;
  let odd = 0;
  const n = 500;
  for (let seed = 0; seed < n; seed++) {
    const problem = generateProblem("complex-distance-midpoint", `mid:${seed}`);
    if (!problem.public.prompt.startsWith("Find the midpoint")) continue;
    mid += 1;
    if (problem.answer && /\\frac/.test(
      problem.public.response.kind === "choice"
        ? problem.public.response.options.find((option) => option.id === problem.answer)!.label
        : "",
    ))
      odd += 1;
  }
  assert.ok(mid / n >= 0.2, `midpoint rate ${mid}/${n}`);
  assert.ok(odd >= 1, `odd midpoints ${odd}`);

  let classicOdd = 0;
  for (let seed = 0; seed < 200; seed++) {
    const problem = generateProblem("complex-distance-midpoint", `mid:${seed}`, 1);
    if (!problem.public.prompt.startsWith("Find the midpoint")) continue;
    const response = problem.public.response;
    if (response.kind !== "choice") continue;
    const label = response.options.find((option) => option.id === problem.answer)!.label;
    if (label.includes("\\frac")) classicOdd += 1;
  }
  assert.equal(classicOdd, 0);
});

test("complex clause oracle agrees on the spec fixtures", () => {
  const run = spawnSync("python3", ["scripts/complex_clause_items_math_oracle.py"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const host = spawnSync("python3", ["scripts/complex_conics_math_oracle.py"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(host.status, 0, host.stderr || host.stdout);
});
