import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateDiagram } from "../src/publishing/validate.js";
import { BookDiagram } from "../src/publishing/diagrams.js";
import { BookScreenFigure } from "../src/web/BookScreenFigure.js";
import { earlyNumberModels } from "./fixtures/early-number-models.js";
import type { Diagram } from "../src/publishing/schema.js";
const fixture = (id: string) =>
  structuredClone(earlyNumberModels.find((d) => d.id === id)!);
function rejects(id: string, patch: Record<string, unknown>) {
  assert.throws(() => validateDiagram({ ...fixture(id), ...patch } as Diagram));
}
test("early-number models validate across empty, full, exchange and conserved cases", () => {
  for (const d of earlyNumberModels) {
    validateDiagram(d);
    const print = renderToStaticMarkup(
      React.createElement(BookDiagram, { diagram: d }),
    );
    const screen = renderToStaticMarkup(
      React.createElement(BookScreenFigure, { diagram: d }),
    );
    assert.match(print, /<svg/);
    assert.equal(
      (print.match(/data-unit=/g) ?? []).length,
      (screen.match(/data-unit=/g) ?? []).length,
    );
  }
});
test("ten-frame occupied cells and emphasis cannot invent or duplicate units", () => {
  rejects("five-and-two", { occupied: [0, 0] });
  rejects("five-and-two", { occupied: [10] });
  rejects("five-and-two", { frames: 0 });
  rejects("five-and-two", { emphasized: [9] });
  rejects("five-and-two", { emphasisLabel: "" });
  rejects("empty-frame", { alt: "" });
  const svg = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: fixture("five-and-two") }),
  );
  assert.equal((svg.match(/data-unit=/g) ?? []).length, 7);
  assert.equal((svg.match(/data-emphasized="true"/g) ?? []).length, 2);
  assert.equal((svg.match(/width="48" height="48"/g) ?? []).length, 10);
});
test("base-ten exchange conserves unit area and supports reversible regrouping", () => {
  for (const id of ["twenty-four", "exchange-twenty-four"]) {
    const svg = renderToStaticMarkup(
      React.createElement(BookDiagram, { diagram: fixture(id) }),
    );
    const cells = [
      ...svg.matchAll(
        /<rect[^>]+data-unit="(?:ten|one)-cell"[^>]+width="(\d+)" height="(\d+)"/g,
      ),
    ];
    assert.equal(cells.length, 24);
    assert.equal(
      cells.reduce((sum, c) => sum + Number(c[1]) * Number(c[2]), 0),
      24 * 400,
    );
    assert.ok(cells.every((c) => c[1] === "20" && c[2] === "20"));
  }
  rejects("twenty-four", { ones: -1 });
  rejects("twenty-four", { tens: 7 });
  rejects("twenty-four", { ones: 20 });
  rejects("twenty-four", { emphasizedTens: [2], emphasisLabel: "To remove" });
});
test("collection arrangement preserves one-to-one units and explicit conservation", () => {
  rejects("same-seven", {
    panels: [
      { label: "A", cells: [] },
      { label: "B", cells: [{ column: 0, row: 0 }] },
    ],
  });
  rejects("empty-mat", {
    panels: [
      {
        label: "A",
        cells: [
          { column: 0, row: 0 },
          { column: 0, row: 0 },
        ],
      },
    ],
  });
  rejects("empty-mat", {
    panels: [{ label: "A", cells: [{ column: 6, row: 0 }] }],
  });
  rejects("empty-mat", {
    panels: [{ label: "A", cells: [], emphasized: [0], emphasisLabel: "New" }],
  });
  rejects("same-seven", {
    panels: [
      { label: "A", cells: [] },
      { label: "A", cells: [] },
    ],
  });
  const svg = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: fixture("empty-mat") }),
  );
  assert.match(svg, /width="304" height="116"/);
  assert.equal((svg.match(/data-unit=/g) ?? []).length, 0);
});
test("explicit finite hatching avoids pattern resources and labels are escaped", () => {
  const d = fixture("same-seven");
  if (d.kind !== "count-collection") throw Error();
  for (const p of d.panels) {
    p.emphasized = [0];
    p.emphasisLabel = "<img src=x>";
  }
  const svg = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: d }),
  );
  assert.ok(!svg.includes("<pattern"));
  assert.equal((svg.match(/data-hatching="true"/g) ?? []).length, 2);
  assert.ok((svg.match(/<path /g) ?? []).length < 24);
  assert.ok(!svg.includes("<img"));
  assert.match(svg, /&lt;img src=x&gt;/);
});

test("every decorative hatch endpoint lies inside its own counted unit", () => {
  let checked = 0;
  for (const id of [
    "five-and-two",
    "unbundle-remove",
    "emphasized-collection",
  ]) {
    const svg = renderToStaticMarkup(
      React.createElement(BookDiagram, { diagram: fixture(id) }),
    );
    for (const match of svg.matchAll(
      /<(rect|circle)([^>]*data-unit[^>]*)><\/\1><g data-hatching="true"[^>]*>(.*?)<\/g>/g,
    )) {
      const attrs = Object.fromEntries(
        [...match[2]!.matchAll(/\s([a-z]+)="([^"]+)"/g)].map((a) => [
          a[1],
          Number(a[2]),
        ]),
      );
      const paths = [
        ...match[3]!.matchAll(
          /d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/g,
        ),
      ];
      assert.ok(paths.length >= 3);
      for (const path of paths)
        for (const [x, y] of [
          [Number(path[1]), Number(path[2])],
          [Number(path[3]), Number(path[4])],
        ]) {
          if (match[1] === "circle")
            assert.ok(
              Math.hypot(x - attrs.cx!, y - attrs.cy!) <= attrs.r! + 1e-9,
            );
          else
            assert.ok(
              x >= attrs.x! - 1e-9 &&
                x <= attrs.x! + attrs.width! + 1e-9 &&
                y >= attrs.y! - 1e-9 &&
                y <= attrs.y! + attrs.height! + 1e-9,
            );
        }
      checked++;
    }
  }
  assert.equal(checked, 22); // two frame counters, sixteen base units, four collection counters.
});
