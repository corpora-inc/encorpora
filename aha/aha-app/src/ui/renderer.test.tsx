import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMarkdown } from "./SafeMarkdown";
import { Visual, isSafeVisual } from "./Visual";

describe("untrusted lesson rendering", () => {
  it("does not expose HTML, remote assets, or navigable links", () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown>
        {
          '<script>alert(1)</script>\n\n[open](javascript:alert) ![track](https://attacker.test/pixel)\n\n<iframe src="tauri://localhost"></iframe>'
        }
      </SafeMarkdown>,
    );
    assert.doesNotMatch(html, /<(script|iframe|img|a)\b/);
    assert.ok(!html.includes("attacker.test"));
    assert.ok(!html.includes("javascript:"));
  });
  it("disables KaTeX trusted URL and HTML commands", () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown>
        {"$\\href{javascript:alert(1)}{click}$ $\\htmlClass{attack}{text}$"}
      </SafeMarkdown>,
    );
    assert.doesNotMatch(html, /<a\b/);
    assert.ok(!html.includes('class="attack"'));
  });
  it("bounds visual work and rejects invalid mathematical diagrams", () => {
    assert.equal(
      isSafeVisual({ type: "array", rows: 1000000, columns: 1000000 }),
      false,
    );
    assert.equal(
      isSafeVisual({ type: "fraction", numerator: 4, denominator: 3 }),
      false,
    );
    assert.equal(
      isSafeVisual({ type: "number-line", min: 0, max: 10, step: 0 }),
      false,
    );
    assert.equal(
      isSafeVisual({ type: "number-line", min: 0, max: Infinity }),
      false,
    );
    assert.equal(
      isSafeVisual({ type: "coordinates", points: [{ x: Infinity, y: 0 }] }),
      false,
    );
    assert.equal(
      isSafeVisual({ type: "cuboid", width: -1, height: 2, depth: 3 }),
      false,
    );
    const html = renderToStaticMarkup(
      <Visual spec={{ type: "array", rows: 1000000, columns: 1000000 }} />,
    );
    assert.ok(html.includes("could not be displayed"));
  });
  it("supplies equivalent accessible math descriptions", () => {
    const html = renderToStaticMarkup(
      <Visual spec={{ type: "fraction", numerator: 3, denominator: 8 }} />,
    );
    assert.ok(html.includes('aria-label="3 of 8 equal parts shaded"'));
    assert.equal((html.match(/class="filled"/g) ?? []).length, 3);
  });
  it("renders six-digit place values and wider validated coordinates without unbounded work", () => {
    const place = renderToStaticMarkup(
      <Visual spec={{ type: "place-value", value: 123456 }} />,
    );
    assert.ok(place.includes("hundred-thousands"));
    assert.ok(place.includes("ten-thousands"));
    assert.ok(
      isSafeVisual({ type: "coordinates", points: [{ x: -20, y: 20 }] }),
    );
    const line = renderToStaticMarkup(
      <Visual
        spec={{
          type: "number-line",
          min: -20,
          max: 20,
          step: 1,
          marks: [-19, 18],
        }}
      />,
    );
    assert.ok(!line.includes("could not be displayed"));
    assert.ok((line.match(/<text/g) ?? []).length <= 13);
    assert.equal(
      isSafeVisual({
        type: "number-line",
        min: 0,
        max: 100,
        step: Number.MIN_VALUE,
      }),
      false,
    );
  });
});
