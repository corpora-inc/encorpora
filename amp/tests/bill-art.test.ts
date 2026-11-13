import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { billValues, BILL_ASPECT } from "../src/math/scene/art.js";
import { layoutScene, type Scene } from "../src/math/scene/index.js";
import { IMAGE_EDGE } from "../src/math/scene/layout.js";
import {
  frameAt,
  missingTargets,
  type Step,
} from "../src/math/scene/timeline.js";
import { billFaceUrl } from "../src/web/scene/bill-art.js";
import { SceneSvg } from "../src/web/scene/SceneSvg.js";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    svg: string,
    options: { contentType: string },
  ) => {
    window: { document: Document };
  };
};

test("bill SVGs are small, self-contained vectors embedded exactly as on disk", () => {
  for (const value of billValues) {
    const name = value === 1 ? "one" : "five";
    const bytes = readFileSync(
      new URL(`../src/web/scene/bill-art/${name}.svg`, import.meta.url),
    );
    assert.ok(bytes.length < 40 * 1024, `${name}: ${bytes.length} bytes`);
    const [head, data] = billFaceUrl[value].split(",");
    assert.equal(head, "data:image/svg+xml;base64");
    assert.ok(
      Buffer.from(data!, "base64").equals(bytes),
      "run npx tsx scripts/build-bill-art.ts",
    );
    const doc = new JSDOM(bytes.toString(), { contentType: "image/svg+xml" })
      .window.document;
    assert.equal(doc.documentElement.getAttribute("viewBox"), "0 0 1228 522");
    assert.equal(
      doc.querySelectorAll("image, script, foreignObject, style").length,
      0,
    );
    // Every reference is local: no image, font or other external resource.
    for (const el of doc.querySelectorAll("*"))
      for (const attr of el.attributes) {
        if (attr.localName === "href")
          assert.ok(attr.value.startsWith("#"), attr.value);
        for (const ref of attr.value.matchAll(/url\((.*?)\)/g)) {
          assert.ok(ref[1]!.startsWith("#"), ref[0]);
          assert.ok(doc.getElementById(ref[1]!.slice(1)), ref[0]);
        }
      }
    assert.match(
      doc.querySelector("desc")!.textContent!,
      value === 1 ? /George Washington/ : /Abraham Lincoln/,
    );
    assert.ok(
      [...doc.querySelectorAll("text")].some(
        (t) => t.textContent === (value === 1 ? "ONE DOLLAR" : "FIVE DOLLARS"),
      ),
    );
  }
});

const scene: Scene = {
  v: 1,
  elements: [
    { type: "bill", id: "one", value: 1, at: [0, 0], width: 100 },
    { type: "bill", id: "five", value: 5, at: [112, 0], width: 100 },
  ],
};

test("a bill takes its rectangular footprint, including the edge, at the note's true aspect", () => {
  const layout = layoutScene({ ...scene, elements: [scene.elements[0]!] });
  const face = layout.items[0]!;
  assert.equal(face.k, "billImage");
  if (face.k !== "billImage") return;
  assert.equal(face.w / face.h, BILL_ASPECT);
  assert.equal(layout.width, Math.ceil(face.w + IMAGE_EDGE + 8));
  assert.equal(layout.height, Math.ceil(face.h + IMAGE_EDGE + 8));
  assert.equal(face.x, 4 + IMAGE_EDGE / 2);
  assert.equal(face.y, 4 + IMAGE_EDGE / 2);
});

test("bill ids support entrances, moves and highlights; focus never recolors the art", () => {
  const steps: Step[] = [
    { caption: "One dollar", actions: [{ do: "appear", target: "one" }] },
    {
      caption: "Move it",
      actions: [{ do: "move", target: "one", by: [20, 50] }],
    },
    { caption: "Five dollars", actions: [{ do: "highlight", target: "five" }] },
  ];
  const layout = layoutScene({ ...scene, steps });
  assert.deepEqual(missingTargets(layout, steps), []);
  assert.equal(frameAt(layout, steps, -1, 0).one?.opacity, 0);
  const states = frameAt(layout, steps, 2, 1);
  assert.equal(states.one?.opacity, 1);
  assert.equal(states.one?.dx, 20 * layout.scale);
  assert.equal(states.one?.dy, -50 * layout.scale);
  const plain = renderToStaticMarkup(
    React.createElement(SceneSvg, { layout, label: "Bills" }),
  );
  const lit = renderToStaticMarkup(
    React.createElement(SceneSvg, { layout, label: "Bills", states }),
  );
  assert.equal(plain.match(/<image /g)?.length, 2);
  assert.ok(!plain.includes("data-bill-lit"));
  assert.equal(lit.match(/data-bill-lit/g)?.length, 1);
  for (const value of billValues) {
    assert.ok(plain.includes(billFaceUrl[value]));
    assert.ok(lit.includes(billFaceUrl[value]));
  }
  assert.ok(!lit.includes("filter="));
  assert.match(lit, /stroke="var\(--color-figure-accent\)"/);
  // Movement stays in the frame the film and the app share.
  const face = layout.items.find((d) => d.id === "one")!;
  if (face.k !== "billImage") throw Error("missing bill");
  assert.ok(
    face.x + states.one!.dx! + face.w + IMAGE_EDGE / 2 <= layout.width - 4,
  );
  assert.ok(face.y + states.one!.dy! - IMAGE_EDGE / 2 >= 4 - 1e-8);
});
