import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  graphicalTemplates,
  generateGraphicalProblem,
} from "../src/math/graphical.js";
import {
  GraphicalFigure,
  type GraphicalFigureData,
} from "../src/web/GraphicalFigure.js";
import { graphicalLessons } from "../src/content/graphical-lessons.js";
import { skills } from "../src/curriculum/catalog.js";
function number(answer: string) {
  const [n, d = "1"] = answer.split("/");
  return Number(n) / Number(d);
}
function attributes(html: string, marker: string) {
  const tag = html.match(new RegExp(`<[^>]+${marker}[^>]*>`))?.[0];
  assert.ok(tag, marker);
  return Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("graphical families have valid catalog and lesson associations", () => {
  assert.equal(graphicalTemplates.length, 6);
  for (const template of graphicalTemplates) {
    assert.ok(skills.some((skill) => skill.id === template.skillId));
    assert.equal(
      graphicalLessons.filter((lesson) =>
        lesson.templateIds.includes(template.id),
      ).length,
      1,
    );
  }
});

test("independent answers follow displayed givens over varied deterministic seeds", () => {
  for (const template of graphicalTemplates)
    for (let seed = 0; seed < 150; seed++) {
      const problem = generateGraphicalProblem(template.id, `visual-${seed}`);
      assert.deepEqual(
        problem,
        generateGraphicalProblem(template.id, `visual-${seed}`),
      );
      const figure = problem.public.figure!;
      let expected: number;
      switch (figure.kind) {
        case "coordinate-plane": {
          assert.ok(
            figure.points.every(
              (p) =>
                p.x >= figure.xMin &&
                p.x <= figure.xMax &&
                p.y >= figure.yMin &&
                p.y <= figure.yMax,
            ),
          );
          if (template.id === "coordinate-point-reading")
            expected = problem.public.prompt.includes("x-coordinate")
              ? figure.points[0]!.x
              : figure.points[0]!.y;
          else {
            const [a, b] = figure.points;
            expected = (b!.y - a!.y) / (b!.x - a!.x);
            for (const point of figure.points)
              near(
                figure.lines![0]!.m * point.x + figure.lines![0]!.b,
                point.y,
              );
          }
          break;
        }
        case "bar-chart": {
          assert.equal(figure.categories.length, figure.values.length);
          if (template.id === "bar-chart-total")
            expected = figure.values.reduce((sum, value) => sum + value, 0);
          else {
            const names = /more (\w+) trees than (\w+) trees/.exec(
              problem.public.prompt,
            )!;
            expected =
              figure.values[figure.categories.indexOf(names[1]!)]! -
              figure.values[figure.categories.indexOf(names[2]!)]!;
            assert.ok(expected > 0);
          }
          break;
        }
        case "clock": {
          const end = /ends at (\d+):(\d+)/.exec(problem.public.prompt)!;
          expected =
            Number(end[1]) * 60 +
            Number(end[2]) -
            (figure.hour * 60 + figure.minute);
          assert.ok(expected >= 15 && expected <= 120);
          assert.ok(Number(end[1]) < 12);
          assert.ok(problem.public.prompt.includes("same morning"));
          break;
        }
        case "number-line":
          expected = Math.abs(figure.points[1]! - figure.points[0]!);
          break;
        default:
          assert.fail(`Unexpected graphical figure: ${figure.kind}`);
      }
      near(number(problem.answer), expected);
      assert.ok(problem.explanation.length >= 2);
    }
});

test("SVG coordinates and heights preserve mathematical positions and scales", () => {
  for (const template of graphicalTemplates)
    for (let seed = 0; seed < 20; seed++) {
      const figure = generateGraphicalProblem(template.id, `render-${seed}`)
        .public.figure as GraphicalFigureData;
      const html = renderToStaticMarkup(
        React.createElement(GraphicalFigure, { figure }),
      );
      assert.ok(html.includes('role="img"'));
      assert.ok(html.includes("aria-label="));
      assert.ok(!html.includes("NaN") && !html.includes("Infinity"));
      if (figure.kind === "coordinate-plane") {
        for (const point of figure.points) {
          const attr = attributes(html, `data-point="${point.label}"`);
          near(
            Number(attr.cx),
            70 + ((point.x - figure.xMin) * 180) / (figure.xMax - figure.xMin),
          );
          near(
            Number(attr.cy),
            220 - ((point.y - figure.yMin) * 180) / (figure.yMax - figure.yMin),
          );
        }
        if (figure.lines?.length) {
          const line = attributes(html, 'data-line="graph"');
          for (const suffix of ["1", "2"]) {
            const x =
              ((Number(line[`x${suffix}`]) - 70) / 180) *
                (figure.xMax - figure.xMin) +
              figure.xMin;
            const y =
              ((220 - Number(line[`y${suffix}`])) / 180) *
                (figure.yMax - figure.yMin) +
              figure.yMin;
            near(y, figure.lines[0]!.m * x + figure.lines[0]!.b);
            assert.ok(
              x >= figure.xMin - 1e-9 &&
                x <= figure.xMax + 1e-9 &&
                y >= figure.yMin - 1e-9 &&
                y <= figure.yMax + 1e-9,
            );
          }
        }
      } else if (figure.kind === "bar-chart") {
        const ceiling =
          2 * Math.max(5, Math.ceil(Math.max(...figure.values) / 10) * 5);
        for (let i = 0; i < figure.values.length; i++) {
          const attr = attributes(
            html,
            `data-category="${figure.categories[i]}"`,
          );
          near(Number(attr.height), (100 * figure.values[i]!) / ceiling);
          near(Number(attr.y) + Number(attr.height), 178);
        }
      } else if (figure.kind === "clock") {
        for (const hand of ["hour", "minute"]) {
          const attr = attributes(html, `data-hand="${hand}"`);
          const dx = Number(attr.x2) - 160,
            dy = 145 - Number(attr.y2);
          const angle =
            hand === "hour"
              ? (figure.hour % 12) * 30 + figure.minute / 2
              : figure.minute * 6;
          const length = hand === "hour" ? 58 : 77;
          near(dx, Math.sin((angle * Math.PI) / 180) * length);
          near(dy, Math.cos((angle * Math.PI) / 180) * length);
        }
      } else {
        for (const value of figure.points) {
          const attr = attributes(html, `data-mark="${value}"`);
          near(
            Number(attr.cx),
            24 + ((value - figure.min) * 272) / (figure.max - figure.min),
          );
        }
      }
    }
});

test("unknown templates and invalid seeds are rejected", () => {
  assert.throws(() => generateGraphicalProblem("not-a-template", "seed"));
  for (const seed of ["", "x".repeat(129)])
    assert.throws(() =>
      generateGraphicalProblem(graphicalTemplates[0]!.id, seed),
    );
});

test("sparse axis labels retain every unit interval and never annotate point answers", () => {
  const figure: GraphicalFigureData = {
    kind: "coordinate-plane",
    xMin: -6,
    xMax: 6,
    yMin: -4,
    yMax: 4,
    points: [{ x: 3, y: -2, label: "P" }],
  };
  const html = renderToStaticMarkup(
    React.createElement(GraphicalFigure, { figure }),
  );
  const lines = [...html.matchAll(/<line\s([^>]+)>/g)].map((m) =>
    Object.fromEntries(
      [...m[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [
        a[1]!,
        Number(a[2]),
      ]),
    ),
  );
  const vertical = lines.filter((line) => line.x1 === line.x2);
  const horizontal = lines.filter((line) => line.y1 === line.y2);
  assert.equal(vertical.length, 13);
  assert.equal(horizontal.length, 9);
  for (let i = 1; i < vertical.length; i++)
    near(vertical[i]!.x1! - vertical[i - 1]!.x1!, 15);
  for (let i = 1; i < horizontal.length; i++)
    near(horizontal[i - 1]!.y1! - horizontal[i]!.y1!, 22.5);
  const visibleText = [...html.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(visibleText, [
    "-6",
    "0",
    "6",
    "-4",
    "0",
    "4",
    "x",
    "y",
    "P",
  ]);
  const point = attributes(html, 'data-point="P"');
  near((Number(point.cx) - vertical[0]!.x1!) / 15 - 6, 3);
  near(4 - (Number(point.cy) - horizontal.at(-1)!.y1!) / 22.5, -2);
});

test("number line retains all integer ticks and truthful sparse labels", () => {
  const figure: GraphicalFigureData = {
    kind: "number-line",
    min: -12,
    max: 12,
    points: [-3, -2],
  };
  const html = renderToStaticMarkup(
    React.createElement(GraphicalFigure, { figure }),
  );
  const ticks = [...html.matchAll(/data-tick="(-?\d+)"/g)].map((m) =>
    Number(m[1]),
  );
  assert.deepEqual(
    ticks,
    Array.from({ length: 25 }, (_, i) => i - 12),
  );
  const labels = [...html.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(labels, [
    "-12",
    "-10",
    "-5",
    "0",
    "5",
    "10",
    "12",
    "-3",
    "-2",
  ]);
  for (const tick of ticks) {
    const attr = attributes(html, `data-tick="${tick}"`);
    near((Number(attr.x1) - 24) / (272 / 24) - 12, tick);
    assert.equal(attr.x1, attr.x2);
  }
});

test("unequal axis ranges omit crowded endpoint text without removing its unit gridline", () => {
  const figure: GraphicalFigureData = {
    kind: "coordinate-plane",
    xMin: -1,
    xMax: 9,
    yMin: -1,
    yMax: 10,
    points: [{ x: 3, y: 5, label: "P" }],
  };
  const html = renderToStaticMarkup(
    React.createElement(GraphicalFigure, { figure }),
  );
  const texts = [...html.matchAll(/<text([^>]*)>(.*?)<\/text>/g)].map((m) => ({
    text: m[2],
    attrs: Object.fromEntries(
      [...m[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!]),
    ),
  }));
  assert.deepEqual(
    texts.map((t) => t.text),
    ["0", "9", "0", "10", "x", "y", "P"],
  );
  for (const text of texts.filter((t) => /^\d+$/.test(t.text!))) {
    if (text.attrs.y === "249")
      near((Number(text.attrs.x) - 70) / 18 - 1, Number(text.text));
    else
      near(
        (220 - (Number(text.attrs.y) - 8)) / (180 / 11) - 1,
        Number(text.text),
      );
  }
  const lines = [...html.matchAll(/<line\s([^>]+)>/g)].map((m) =>
    Object.fromEntries(
      [...m[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [
        a[1]!,
        Number(a[2]),
      ]),
    ),
  );
  assert.equal(lines.filter((l) => l.x1 === l.x2).length, 11);
  assert.equal(lines.filter((l) => l.y1 === l.y2).length, 12);
  assert.ok(
    lines.some((l) => l.x1 === 70 && l.x2 === 70),
    "Unlabeled x=-1 boundary remains",
  );
  assert.ok(
    lines.some((l) => l.y1 === 220 && l.y2 === 220),
    "Unlabeled y=-1 boundary remains",
  );
  for (const [min, max] of [
    [1, 3],
    [-3, -1],
  ] as const) {
    const oneSided = renderToStaticMarkup(
      React.createElement(GraphicalFigure, {
        figure: {
          ...figure,
          xMin: min,
          xMax: max,
          yMin: min,
          yMax: max,
          points: [],
        },
      }),
    );
    assert.deepEqual(
      [...oneSided.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1]),
      [String(min), String(max), String(min), String(max), "x", "y"],
    );
  }
});
