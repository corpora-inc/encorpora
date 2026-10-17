import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  generateGraphicalProblem,
  graphicalTemplates,
} from "../src/math/graphical.js";
import {
  GraphicalFigure,
  type GraphicalFigureData,
} from "../src/web/GraphicalFigure.js";

function tags(
  html: string,
  name: string,
  attribute: string,
): Record<string, string>[] {
  return [
    ...html.matchAll(
      new RegExp(`<${name}\\b[^>]*\\b${attribute}="[^"]*"[^>]*>`, "g"),
    ),
  ].map((match) =>
    Object.fromEntries(
      [...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1]!,
        attribute[2]!,
      ]),
    ),
  );
}
function near(actual: number, expected: number, label: string): void {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9,
    `${label}: ${actual} != ${expected}`,
  );
}

test("rendered graphical geometry agrees with semantic givens across every graphical family", () => {
  const visits = new Map<string, number>();
  for (const template of graphicalTemplates)
    for (let index = 0; index < 256; index++) {
      const problem = generateGraphicalProblem(
        template.id,
        `independent-${index}`,
      );
      const figure = problem.public.figure as GraphicalFigureData;
      const html = renderToStaticMarkup(
        React.createElement(GraphicalFigure, { figure }),
      );
      assert.ok(html.startsWith("<svg"), template.id);
      assert.doesNotMatch(html, /NaN|Infinity/);
      switch (figure.kind) {
        case "coordinate-plane": {
          const points = tags(html, "circle", "data-point");
          assert.equal(points.length, figure.points.length);
          for (const point of figure.points) {
            const rendered = points.find(
              (item) => item["data-point"] === point.label,
            )!;
            assert.ok(rendered, "Missing named point");
            // Invert screen coordinates to recover the represented mathematical values.
            near(
              ((Number(rendered.cx) - 70) / 180) * (figure.xMax - figure.xMin) +
                figure.xMin,
              point.x,
              "point x",
            );
            near(
              ((220 - Number(rendered.cy)) / 180) *
                (figure.yMax - figure.yMin) +
                figure.yMin,
              point.y,
              "point y",
            );
          }
          const lines = tags(html, "line", "data-line");
          assert.equal(lines.length, figure.lines?.length ?? 0);
          for (const line of lines) {
            const x1 =
              ((Number(line.x1) - 70) / 180) * (figure.xMax - figure.xMin) +
              figure.xMin;
            const x2 =
              ((Number(line.x2) - 70) / 180) * (figure.xMax - figure.xMin) +
              figure.xMin;
            const y1 =
              ((220 - Number(line.y1)) / 180) * (figure.yMax - figure.yMin) +
              figure.yMin;
            const y2 =
              ((220 - Number(line.y2)) / 180) * (figure.yMax - figure.yMin) +
              figure.yMin;
            assert.ok(x2 > x1, "Line must have nonzero visible width");
            for (const value of [x1, x2])
              assert.ok(
                value >= figure.xMin - 1e-9 && value <= figure.xMax + 1e-9,
              );
            for (const value of [y1, y2])
              assert.ok(
                value >= figure.yMin - 1e-9 && value <= figure.yMax + 1e-9,
              );
            for (const point of figure.points)
              near(
                (point.x - x1) * (y2 - y1),
                (point.y - y1) * (x2 - x1),
                "point lies on rendered line",
              );
          }
          break;
        }
        case "bar-chart": {
          const bars = tags(html, "rect", "data-category");
          assert.equal(bars.length, figure.values.length);
          const units = Number(bars[0]!.height) / figure.values[0]!;
          assert.ok(units > 0);
          for (let index = 0; index < bars.length; index++) {
            const bar = bars[index]!;
            assert.equal(bar["data-category"], figure.categories[index]);
            near(
              Number(bar.height) / units,
              figure.values[index]!,
              "bar quantity",
            );
            near(Number(bar.y) + Number(bar.height), 178, "bar baseline");
            assert.ok(Number(bar.height) > 0 && Number(bar.y) >= 78);
            if (index)
              assert.ok(
                Number(bar.x) > Number(bars[index - 1]!.x),
                "Category order must match labels",
              );
          }
          break;
        }
        case "clock": {
          const hands = tags(html, "line", "data-hand");
          assert.equal(hands.length, 2);
          const hour = hands.find((hand) => hand["data-hand"] === "hour")!;
          const minute = hands.find((hand) => hand["data-hand"] === "minute")!;
          const angle = (hand: Record<string, string>): number => {
            near(Number(hand.x1), 160, "hand pivot x");
            near(Number(hand.y1), 145, "hand pivot y");
            return (
              ((Math.atan2(Number(hand.x2) - 160, 145 - Number(hand.y2)) *
                180) /
                Math.PI +
                360) %
              360
            );
          };
          near(angle(minute), figure.minute * 6, "minute-hand angle");
          near(
            angle(hour),
            ((figure.hour % 12) * 30 + figure.minute / 2) % 360,
            "hour-hand angle including partial hour",
          );
          assert.ok(
            Math.hypot(Number(hour.x2) - 160, Number(hour.y2) - 145) <
              Math.hypot(Number(minute.x2) - 160, Number(minute.y2) - 145),
          );
          break;
        }
        case "number-line": {
          const points = tags(html, "circle", "data-mark");
          assert.equal(points.length, figure.points.length);
          for (let index = 0; index < points.length; index++) {
            const point = points[index]!;
            near(
              ((Number(point.cx) - 24) / 272) * (figure.max - figure.min) +
                figure.min,
              figure.points[index]!,
              "number-line coordinate",
            );
            near(Number(point.cy), 64, "number-line baseline");
            assert.equal(Number(point["data-mark"]), figure.points[index]);
          }
          break;
        }
        default:
          assert.fail(
            "A new graphical representation needs an independent geometry check",
          );
      }
      visits.set(template.id, (visits.get(template.id) ?? 0) + 1);
    }
  assert.ok(visits.size > 0);
  for (const template of graphicalTemplates)
    assert.equal(visits.get(template.id), 256);
});
