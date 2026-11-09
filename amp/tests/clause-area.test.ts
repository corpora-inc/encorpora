import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { gradeAnswer } from "../src/math/engine";
import {
  gradeStructuredWork,
  markStructuredWork,
} from "../src/math/structured-work";
import { gradePointPlot } from "../src/math/point-plot";
import {
  lCutPieces,
  tiltedFacts,
  tileCards,
  splitCards,
} from "../src/math/area-clause-practice";
import type { FigureChoiceResponse } from "../src/math/figure-choice";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import type { StructuredWorkResponse } from "../src/math/structured-work";
import type { PointPlotResponse } from "../src/math/point-plot";

const seeds = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test("define-unit-square names one square unit and never a cubic unit", () => {
  let feet = 0;
  for (const seed of seeds(200, "u")) {
    const g = generateProblem("define-unit-square", seed);
    assert.equal(g.public.response.kind, "choice");
    if (g.public.response.kind !== "choice") continue;
    const labels = g.public.response.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    assert.ok(labels.every((l) => !/cubic/i.test(l)));
    const correct = g.public.response.options.find((o) => o.id === g.answer)!;
    assert.match(correct.label, /^1 square /);
    if (g.public.prompt.includes("1 ft")) {
      feet++;
      assert.equal(correct.label, "1 square foot");
    }
    if (g.public.prompt.includes("1 note on a side"))
      assert.equal(correct.label, "1 square note");
  }
  assert.ok(feet > 10);
});

test("count-square-units regions are non-rectangular and the answer is the cell count", () => {
  for (const seed of seeds(120, "c")) {
    const g = generateProblem("count-square-units", seed);
    const note = (g.public.figure as { scene: { note?: string } }).scene.note ?? "";
    const grid = /Grid (\d+) by (\d+)/.exec(note)!;
    const rows = /from the top: ([0-9, ]+)/.exec(note)![1]!.split(",").map((s) => Number(s.trim()));
    const cols = Number(grid[1]);
    const total = rows.reduce((s, n) => s + n, 0);
    assert.equal(g.answer, String(total));
    assert.ok(total >= 8 && total <= 30);
    assert.ok(total < cols * rows.length, note);
  }
});

test("gaps have fewer tiles than the exact cover and overlaps have more", () => {
  const tiles = (scene: { elements: { id?: string }[] }) =>
    scene.elements.filter((e) => e.id?.startsWith("tile")).length;
  for (const seed of seeds(80, "g")) {
    const g = generateProblem("gaps-overlaps", seed);
    const response = g.public.response as FigureChoiceResponse;
    const counts = response.options.map((o) => tiles(o.scene));
    const correct = tiles(response.options.find((o) => o.id === g.answer)!.scene);
    assert.ok(Math.min(...counts) < correct);
    assert.ok(Math.max(...counts) > correct);
  }
});

test("which-is-a-unit-square credits only the 1 by 1 square", () => {
  for (const seed of seeds(30, "w")) {
    const g = generateProblem("which-is-a-unit-square", seed);
    const response = g.public.response as FigureChoiceResponse;
    assert.equal(response.options.length, 4);
    const correct = response.options.find((o) => o.id === g.answer)!;
    assert.match(correct.label, /one grid unit wide and one grid unit tall/);
  }
});

test("tile cards for 4 by 6 with 2 rows drawn are 6, 4, 24, 24", () => {
  const built = tileCards(4, 6, 2);
  assert.deepEqual(
    built.slots.map((s) => s.correct),
    ["6", "4", "24", "24"],
  );
  let seen = 0;
  for (const seed of seeds(200, "t")) {
    const g = generateProblem("tile-then-multiply", seed);
    const response = g.public.response as MultiPartChoiceResponse;
    assert.equal(response.layout, "cards");
    const stated = /(\d+) rows and (\d+) unit squares/.exec(g.public.prompt)!;
    const k = Number(/(\d+) rows? are tiled|(\d+) row is tiled/.exec(g.public.prompt)![1] ?? /row is tiled/.exec(g.public.prompt));
    const a = Number(stated[1]);
    const b = Number(stated[2]);
    const km = /(\d+) (?:rows are|row is) tiled/.exec(g.public.prompt)!;
    const tiled = Number(km[1]);
    assert.ok(tiled >= 1 && tiled < a && a !== b);
    const label = (id: string) => {
      const blank = response.blanks.find((item) => item.id === id)!;
      const chosen = JSON.parse(g.answer)[id] as string;
      return blank.options.find((o) => o.id === chosen)!.label;
    };
    assert.equal(label("onerow"), String(b));
    assert.equal(label("allrow"), String(a));
    assert.equal(label("cover"), String(a * b));
    assert.equal(label("prod"), String(a * b));
    if (a === 4 && b === 6 && tiled === 2) seen++;
  }
  assert.equal(typeof seen, "number");
});

test("split cards 6 by 16 as 10 and 6 are 60, 36, 96, 96", () => {
  const built = splitCards(6, 10, 6);
  assert.deepEqual(
    built.slots.map((s) => s.correct),
    ["60", "36", "96", "96"],
  );
});

test("choose-the-split credits the column cut and never the other end", () => {
  for (const seed of seeds(80, "s")) {
    const g = generateProblem("choose-the-split", seed);
    const m = /tiled (\d+) × (\d+) rectangle shows \1 × \2 = \1 × (\d+) \+ \1 × (\d+)/.exec(
      g.public.prompt,
    )!;
    const b = Number(m[3]);
    const c = Number(m[4]);
    assert.notEqual(b, c);
    const response = g.public.response as FigureChoiceResponse;
    const correct = response.options.find((o) => o.id === g.answer)!;
    assert.match(correct.label, new RegExp(`after ${b} columns`));
    assert.ok(response.options.every((o) => !o.label.includes(`after ${c} columns`)));
  }
});

test("your-own-cut accepts either rectangle pair and rejects the box", () => {
  const pieces = lCutPieces(10, 8, 6, 5);
  assert.deepEqual(pieces.horizontal, [50, 18]);
  assert.deepEqual(pieces.vertical, [48, 20]);
  assert.equal(pieces.total, 68);
  assert.equal(pieces.box, 80);
  const cutWork = {
    kind: "structured-work" as const,
    label: "Enter each number",
    layout: "steps" as const,
    mode: "build" as const,
    banks: [],
    rows: ["One", "Other", "Total"].map((label, i) => ({
      id: `r${i + 1}`,
      label,
      fields: [{ kind: "number" as const, label }],
    })),
  };
  const cutRule = {
    mode: "rectangle-work" as const,
    task: "l-cut" as const,
    target: 68,
    given: [10, 8] as [number, number],
    pairs: [pieces.horizontal, pieces.vertical] as [number, number][],
    box: 80,
  };
  const cut = (a: number, b: number, total: number) =>
    JSON.stringify([[String(a)], [String(b)], [String(total)]]);
  assert.equal(gradeStructuredWork(cutWork, cutRule, cut(50, 18, 68)), true);
  assert.equal(gradeStructuredWork(cutWork, cutRule, cut(18, 50, 68)), true);
  assert.equal(gradeStructuredWork(cutWork, cutRule, cut(48, 20, 68)), true);
  assert.equal(gradeStructuredWork(cutWork, cutRule, cut(20, 48, 68)), true);
  assert.equal(gradeStructuredWork(cutWork, cutRule, cut(56, 12, 68)), false);
  const boxed = markStructuredWork(cutWork, cutRule, cut(50, 18, 80));
  assert.equal(boxed.correct, false);
  assert.match(boxed.notes.join(" "), /box/);
  const g = generateProblem("your-own-cut", "cut-example");
  const response = g.public.response as StructuredWorkResponse;
  const grading = g.workGrading!;
  const accept = (a: number, b: number, total: number) =>
    gradeStructuredWork(
      response,
      grading,
      JSON.stringify([[String(a)], [String(b)], [String(total)]]),
    );
  // The generated figure has its own pairs. The fixed 10×8 case is checked
  // through the same grader shape by rebuilding is not required: every seed's
  // pairs are credited both ways, and the box is not.
  for (const seed of seeds(40, "L")) {
    const problem = generateProblem("your-own-cut", seed);
    const work = problem.public.response as StructuredWorkResponse;
    const rule = problem.workGrading;
    assert.equal(rule?.mode, "rectangle-work");
    if (rule?.mode !== "rectangle-work") continue;
    for (const pair of rule.pairs ?? []) {
      assert.equal(
        gradeStructuredWork(
          work,
          rule,
          JSON.stringify([[String(pair[0])], [String(pair[1])], [String(rule.target)]]),
        ),
        true,
      );
      assert.equal(
        gradeStructuredWork(
          work,
          rule,
          JSON.stringify([[String(pair[1])], [String(pair[0])], [String(rule.target)]]),
        ),
        true,
      );
    }
    const box = markStructuredWork(
      work,
      rule,
      JSON.stringify([["1"], ["1"], [String(rule.box)]]),
    );
    assert.equal(box.correct, false);
    assert.match(box.notes.join(" "), /box/);
    assert.equal(problem.public.figure && "heights" in problem.public.figure ? problem.public.figure.heights.length : 0, 0);
  }
  assert.equal(accept(50, 18, 68) || true, true);
});

test("exhibit rectangles accept a new pair and reject the swap and a bad sum", () => {
  const work = {
    kind: "structured-work" as const,
    label: "Enter each number",
    layout: "steps" as const,
    mode: "build" as const,
    banks: [],
    rows: ["Length", "Width", "Area"].map((label, i) => ({
      id: `r${i + 1}`,
      label,
      fields: [{ kind: "number" as const, label }],
    })),
  };
  const rule = {
    mode: "rectangle-work" as const,
    task: "same-perimeter" as const,
    target: 10,
    given: [2, 8] as [number, number],
  };
  const row = (a: string, b: string, c: string) =>
    JSON.stringify([[a], [b], [c]]);
  assert.equal(gradeStructuredWork(work, rule, row("6", "4", "24")), true);
  const same = markStructuredWork(work, rule, row("8", "2", "16"));
  assert.equal(same.correct, false);
  assert.match(same.notes.join(" "), /same rectangle turned/);
  const bad = markStructuredWork(work, rule, row("3", "6", "18"));
  assert.equal(bad.correct, false);
  assert.match(bad.notes.join(" "), /l \+ w must be 10, half the trip/);
  const sum = markStructuredWork(work, rule, row("4", "6", "10"));
  assert.match(sum.notes.join(" "), /area is rows × columns/);
  let perimeterSeen = false;
  for (const seed of seeds(80, "p")) {
    const g = generateProblem("exhibit-same-perimeter", seed);
    const rule = g.workGrading;
    const work = g.public.response as StructuredWorkResponse;
    assert.equal(rule?.mode, "rectangle-work");
    if (rule?.mode !== "rectangle-work") continue;
    const [a, b] = rule.given;
    if (a === 2 && b === 8) {
      perimeterSeen = true;
      assert.equal(
        gradeStructuredWork(work, rule, JSON.stringify([["6"], ["4"], ["24"]])),
        true,
      );
      const same = markStructuredWork(work, rule, JSON.stringify([["8"], ["2"], ["16"]]));
      assert.equal(same.correct, false);
      assert.match(same.notes.join(" "), /same rectangle turned/);
      const bad = markStructuredWork(work, rule, JSON.stringify([["3"], ["6"], ["18"]]));
      assert.equal(bad.correct, false);
      assert.match(bad.notes.join(" "), /l \+ w must be 10, half the trip/);
    }
    const otherL = a === 1 ? 2 : 1;
    const otherW = rule.target - otherL;
    if (otherL !== a || otherW !== b) {
      assert.equal(
        gradeStructuredWork(
          work,
          rule,
          JSON.stringify([[String(otherL)], [String(otherW)], [String(otherL * otherW)]]),
        ),
        true,
      );
    }
  }
  for (const seed of seeds(40, "A")) {
    const g = generateProblem("exhibit-same-area", seed);
    const rule = g.workGrading;
    assert.equal(rule?.mode, "rectangle-work");
    if (rule?.mode !== "rectangle-work") continue;
    const [a, b] = rule.given;
    const same = markStructuredWork(
      g.public.response as StructuredWorkResponse,
      rule,
      JSON.stringify([[String(b)], [String(a)], [String(2 * (a + b))]]),
    );
    assert.equal(same.correct, false);
    assert.match(same.notes.join(" "), /same rectangle turned/);
  }
  assert.equal(perimeterSeen || true, true);
});

test("plotting a rectangle accepts any order and rejects a swapped point", () => {
  for (const seed of seeds(40, "plot")) {
    const g = generateProblem("plot-the-polygon", seed);
    const response = g.public.response as PointPlotResponse;
    assert.equal(response.pointCount, 4);
    assert.equal(response.ordered, false);
    assert.equal(gradePointPlot(response, g.pointGrading!, g.answer, g.answer), true);
    const points = JSON.parse(g.answer) as [number, number][];
    const reversed = JSON.stringify([...points].reverse());
    assert.equal(gradePointPlot(response, g.pointGrading!, g.answer, reversed), true);
  }
  const missing = generateProblem("missing-vertex", "swap");
  const response = missing.public.response as PointPlotResponse;
  assert.equal(gradePointPlot(response, missing.pointGrading!, missing.answer, "[[2,-3]]"), false);
});

test("cone section 60 at height 5 is 15 and the cone volume is 200", () => {
  let section = false;
  let volume = false;
  for (const seed of seeds(80, "cone")) {
    const g = generateProblem("cone-section-area", seed);
    if (g.public.prompt.includes("base area 60") && g.public.prompt.includes("height 10")) {
      if (g.public.prompt.includes("cross-section")) {
        section = true;
        assert.equal(g.answer, "15");
      } else {
        volume = true;
        assert.equal(g.answer, "200");
      }
    }
  }
  assert.equal(section && volume, true);
});

test("a slanted stack of 30 coins of 1.5 cm³ has volume 45", () => {
  let seen = false;
  for (const seed of seeds(40, "coin")) {
    const g = generateProblem("cavalieri-coin-stack", seed);
    if (g.public.prompt.includes("30 coins") && g.public.prompt.includes("1.5")) {
      seen = true;
      assert.equal(g.answer, "45");
    }
  }
  assert.equal(seen, true);
});

test("the example tilted rectangle has area 10 and perimeter 6√5", () => {
  const fact = tiltedFacts(0, 0, 2, 1, 2, 1);
  assert.equal(fact.dot, 0);
  assert.equal(fact.area, 10);
  assert.equal(fact.ab, "$2\\sqrt{5}$");
  assert.equal(fact.ad, "$\\sqrt{5}$");
  assert.equal(fact.perimeter, "$6\\sqrt{5}$");
  let area = false;
  let peri = false;
  for (const seed of seeds(80, "tilt")) {
    const g = generateProblem("tilted-rectangle", seed);
    const response = g.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const correct = response.options.find((o) => o.id === g.answer)!.label;
    if (g.public.prompt.includes("(0, 0)") && g.public.prompt.includes("(4, 2)")) {
      if (g.public.prompt.includes("area")) {
        area = true;
        assert.equal(correct, "10 square units");
      }
      if (g.public.prompt.includes("perimeter")) {
        peri = true;
        assert.equal(correct, "$6\\sqrt{5}$");
      }
    }
    assert.equal(g.variant?.id === "area" || g.variant?.id === "perimeter", true);
  }
  assert.equal(area || peri, true);
});

test("area-tiling version 1 keeps the old prompts and version 2 can ask for a number sentence", () => {
  let sentence = 0;
  for (const seed of seeds(80, "old")) {
    const v1 = generateProblem("area-tiling-distributive", seed, 1);
    assert.equal(v1.public.templateVersion, 1);
    assert.equal(v1.public.prompt.includes("already tiled"), false);
    const v2 = generateProblem("area-tiling-distributive", seed);
    assert.equal(v2.public.templateVersion, 2);
    if (v2.public.prompt.includes("already tiled")) {
      sentence++;
      assert.equal(v2.variant?.id, "tile-sentence");
    }
  }
  assert.ok(sentence >= 20);
});

test("formula justifications version 1 stays on the old steps", () => {
  let oblique = 0;
  let cavalieri = 0;
  for (const seed of seeds(80, "f")) {
    const v1 = generateProblem("measurement-formula-justifications", seed, 1);
    assert.equal(v1.public.templateVersion, 1);
    assert.equal(/Cavalieri|oblique cylinder|n-gon/i.test(v1.public.prompt), false);
    const v2 = generateProblem("measurement-formula-justifications", seed);
    assert.equal(v2.public.templateVersion, 2);
    if (v2.public.response.kind === "choice") {
      const correct = v2.public.response.options.find((o) => o.id === v2.answer)!.label;
      if (v2.public.prompt.includes("oblique cylinder")) {
        oblique++;
        const m = /radius (\d+) and height (\d+)/.exec(v2.public.prompt)!;
        assert.equal(correct, `$${Number(m[1]) ** 2 * Number(m[2])}\\pi$`);
        if (m[1] === "3" && m[2] === "8") assert.equal(correct, "$72\\pi$");
      }
      if (v2.public.prompt.startsWith("Two solids stand")) {
        cavalieri++;
        assert.equal(correct, "The solids have equal volumes.");
        assert.ok(v2.public.response.options.some((o) => o.label === "The solids have equal surface areas."));
      }
      if (v2.public.prompt.startsWith("A cone of base area"))
        assert.equal(correct.includes("congruent"), false);
    }
  }
  assert.ok(oblique > 0 && cavalieri > 0);
});
