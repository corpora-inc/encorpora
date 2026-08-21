/**
 * BZ-03 — the contrast gate, and BZ-LAW-8's honest limit on colour.
 *
 * Every pair the design actually uses is verified here, in both themes. The
 * ward table also publishes the three confusable pairs rather than pretending
 * they do not exist: lapis↔aubergine are 5.9 L* apart AND on the tritan axis,
 * which is why the street generator may never place them side by side.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { contrast, lstar } from "../util/color.ts";
import { MATERIALS, SEMANTIC, WARDS, STRIPES, type WardId } from "./palette.ts";
import { QUARTERS } from "../world/quarters.ts";
import { adjacentWardPairs, quarterTriples } from "../world/street.ts";

const m = MATERIALS;

test("BZ-03: text pairs meet WCAG AA or better, in both themes", () => {
  const pairs: [string, string, string, number][] = [
    ["ink on the day ground", m["ink-900"], m["sandstone-100"], 7],
    ["ink-muted on the day ground", m["ink-600"], m["sandstone-100"], 4.5],
    ["ink on a shaded wall", m["ink-900"], m["sandstone-400"], 4.5],
    ["sign ink on the board", m["cream-50"], m["walnut-600"], 7],
    ["ink engraved into brass", m["ink-900"], m["brass-400"], 4.5],
    ["focus cobalt on the day ground", m["lapis-700"], m["sandstone-100"], 3],
    ["night ink on the night ground", m["nightink-100"], m["nightground"], 7],
    ["night ink-muted on the night ground", m["nightink-400"], m["nightground"], 4.5],
    ["night ink on emissive brass", m["nightground"], m["brass-300"], 7],
    ["night focus brass on the night ground", m["brass-200"], m["nightground"], 3],
    ["sign ink on the night board", m["cream-50"], m["walnut-800"], 7],
  ];
  for (const [name, a, b, floor] of pairs) {
    const c = contrast(a, b);
    assert.ok(c >= floor, `${name}: ${c.toFixed(2)}:1 is under ${floor}:1`);
  }
});

test("BZ-03: every ward is ≥3:1 against its own ground", () => {
  for (const w of Object.values(WARDS)) {
    const day = contrast(w.day, SEMANTIC.light.ground);
    const night = contrast(w.night, SEMANTIC.night.ground);
    assert.ok(day >= 3, `${w.id} day ${day.toFixed(2)}:1`);
    assert.ok(night >= 3, `${w.id} night ${night.toFixed(2)}:1`);
  }
});

test("BZ-LAW-7: glaze never carries text — no ward colour is a text ground", () => {
  // Every ward colour fails at least one of the ink pairs, which is precisely
  // why the law exists and why signs are painted boards.
  for (const w of Object.values(WARDS)) {
    const withInk = contrast(m["ink-900"], w.day);
    const withCream = contrast(m["cream-50"], w.day);
    assert.ok(
      withInk < 7 || withCream < 7,
      `${w.id} would pass as a text ground, so the law needs revisiting`,
    );
  }
});

test("the three confusable ward pairs are the ones the spec names", () => {
  const l = (id: WardId, k: "day" | "night") => lstar(WARDS[id][k]);
  // lapis ↔ aubergine: 5.9 day, 5.7 night. Generator-constrained.
  assert.ok(Math.abs(l("lapis", "day") - l("aubergine", "day")) < 7);
  // turquoise ↔ hemp: close in L*, but cyan↔gold survives both protanopia and
  // deuteranopia, so it is allowed.
  assert.ok(Math.abs(l("turquoise", "day") - l("hemp", "day")) < 4);
  // madder ↔ aubergine at night: nearly identical L*, but orange↔violet
  // survives red-green CVD.
  assert.ok(Math.abs(l("madder", "night") - l("aubergine", "night")) < 2);
});

test("BZ-17: every quarter carries a distinct (ward, finial, fold) triple", () => {
  const triples = quarterTriples(QUARTERS);
  assert.equal(new Set(triples).size, triples.length, "two quarters share a triple");
});

test("BZ-17: lapis and aubergine are never adjacent, including on the wrap", () => {
  for (const [a, b] of adjacentWardPairs(QUARTERS)) {
    const bad =
      (a === "lapis" && b === "aubergine") || (a === "aubergine" && b === "lapis");
    assert.ok(!bad, `${a} sits next to ${b}`);
  }
});

test("no quarter repeats its neighbour's awning stripe", () => {
  for (let i = 0; i < QUARTERS.length; i++) {
    const a = QUARTERS[i]!;
    const b = QUARTERS[(i + 1) % QUARTERS.length]!;
    assert.notEqual(a.stripe % STRIPES.length, b.stripe % STRIPES.length);
  }
});

test("the saffron/white stripe is the one that needs its selvedge", () => {
  // 1.53:1 — invisible in greyscale, which is why a 1 px brass weft line sits
  // between every stripe in the bazaar rather than only on this pair.
  const pair = STRIPES.find((s) => s.id === "saffron-white")!;
  assert.ok(contrast(pair.a, pair.b) < 2);
  // …and every other authored pair clears 3:1 on its own.
  for (const s of STRIPES) {
    if (s.id === "saffron-white") continue;
    assert.ok(contrast(s.a, s.b) >= 3, `${s.id}: ${contrast(s.a, s.b).toFixed(2)}:1`);
  }
});
