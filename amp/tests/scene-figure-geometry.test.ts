import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, templates } from "../src/math/engine.js";
import { galleryCases } from "../src/math/scene/gallery.js";
import { sceneV2Cases } from "../src/math/scene/gallery-v2.js";
import { thingsCases } from "../src/math/scene/gallery-things.js";
import type { Scene } from "../src/math/scene/index.js";
import {
  CONTAINERS,
  DESKTOP_CARD,
  OWN,
  PHONE_CARD,
  PHONE_PANEL,
  faults,
  type Container,
} from "./helpers/scene-geometry.js";

/**
 * Every figure the scene kit draws stays readable where it is drawn. QA
 * 2026-11-17 found a choice card whose number line stacked its numbers into
 * an unreadable column, so the question could not be answered fairly.
 *
 * The sweep lays out every reference scene (each component, over its
 * gallery's parameter ranges) and sampled problems of every template that
 * emits a scene: problem figures in the figure panel (wide screen and
 * print, and a 320 px phone), and figure-choice options in a choice card on
 * a 320 px phone and at 1280. A reference scene of a kind that is offered as
 * a choice is also checked in both cards. In each it asserts that no label
 * meets another label, a dot, an arrowhead or an arrow's stroke; that
 * everything lies inside the view box and the height it was given; and that
 * labels draw at a readable size once the figure is scaled to its box
 * (tests/helpers/scene-geometry.ts).
 *
 * KNOWN lists the faults of figures drawn by one template's own primitives
 * (or a reference scene that composes two components by hand). Each needs a
 * fix in that template. The list only shrinks: an entry that no longer
 * fails must be removed, and any other fault fails the test.
 */
const KNOWN = new Set([
  // Hand-placed labels and points in math units: they collide once the
  // figure is laid out at a phone's width.
  "cavalieri-sphere-argument figure | panel 320 | label/label",
  "circle-equation figure | panel 320 | label/arrow",
  "circle-equation figure | panel 320 | label/label",
  "circle-equation figure | panel 320 | label/mark",
  "circle-equation figure | panel/print | label/arrow",
  "circle-equation figure | panel/print | label/label",
  "circle-equation figure | panel/print | label/mark",
  "circle-estimate-blanks figure | panel 320 | label/label",
  "decimal-model-written-method figure | panel 320 | label/label",
  "protractor-ray-choice figure | panel 320 | label/mark",
  "tangent-construct-justify figure | panel 320 | label/label",
  "tangent-construct-justify figure | panel/print | label/label",
  "two-column-congruence-proof figure | panel 320 | label/mark",
  "two-column-congruence-proof figure | panel/print | label/mark",
  // Two triangles placed a fixed math distance apart: their facing vertex
  // names meet at a phone's width.
  "similar-triangle-side figure | panel 320 | label/label",
  // Tables wider than a phone: their text scales below 12 px.
  "decimal-rename-chain figure | panel 320 | text size",
  "signed-changes-sum figure | panel 320 | text size",
  "two-way-share figure | panel 320 | text size",
  // Dot stacks taller than the shortest choice-card figure (160 px).
  "distribution-match-description option | choice card 1280 | container",
  "gallery: Line plot: amounts shared equally (lesson) | choice card 1280 | container",
  "gallery: Two dot plots: MADs laid across the gap between means (lesson) | choice card 1280 | container",
  // Reference scenes squeezed into a 160 px card or a phone.
  "gallery: Dot plot: quartiles and the box over the data (lesson) | choice card 1280 | label/label",
  "gallery: Box with a missing edge, and a stepped solid | choice card 1280 | label/label",
  "gallery: Box with a missing edge, and a stepped solid | choice card 320 | label/label",
  "gallery: Box with a missing edge, and a stepped solid | panel 320 | label/label",
]);

const SEEDS = 4;
type Item = {
  src: string;
  scene: Scene;
  reveal?: boolean;
  boxes: Container[];
};
function items() {
  const out: Item[] = [];
  for (const t of templates)
    for (let i = 0; i < SEEDS; i++) {
      let p;
      try {
        p = generateProblem(t.id, `sweep-${i}`).public;
      } catch {
        continue; // A seed a template rejects; other seeds cover it.
      }
      if (p.figure?.kind === "scene")
        out.push({
          src: `${t.id} figure`,
          scene: p.figure.scene,
          boxes: [OWN, PHONE_PANEL],
        });
      if (p.response.kind === "figure-choice")
        for (const o of p.response.options)
          out.push({
            src: `${t.id} option`,
            scene: o.scene,
            boxes: [PHONE_CARD, DESKTOP_CARD],
          });
    }
  const offered = new Set(
    out
      .filter((i) => i.src.endsWith(" option"))
      .flatMap((i) => i.scene.elements.map((e) => e.type)),
  );
  for (const c of [...galleryCases, ...sceneV2Cases, ...thingsCases])
    out.push({
      src: `gallery: ${c.name}`,
      scene: c.scene,
      reveal: "reveal" in c ? c.reveal : undefined,
      boxes: c.scene.elements.every((e) => offered.has(e.type))
        ? CONTAINERS
        : [OWN, PHONE_PANEL],
    });
  return out;
}

test("every scene-kit figure is readable in every box it is drawn in", () => {
  const all = items();
  assert.ok(all.length > 1000, `${all.length} figures swept`);
  const found = new Map<string, string>();
  for (const it of all)
    for (const box of it.boxes)
      for (const f of faults(it.scene, box, it.reveal).faults) {
        const key = `${it.src} | ${box.name} | ${f.rule}`;
        if (!found.has(key)) found.set(key, f.detail);
      }
  const fresh = [...found].filter(([k]) => !KNOWN.has(k));
  assert.deepEqual(
    fresh.map(([k, d]) => `${k}: ${d}`),
    [],
    "new figure faults",
  );
  const fixed = [...KNOWN].filter((k) => !found.has(k));
  assert.deepEqual(fixed, [], "fixed: remove these from KNOWN");
});
