import { reportEditorialLimit } from "./fixtures/editorial";
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import {
  measurementPrecisionGenerate,
  measurementPrecisionTemplates,
} from "../src/math/measurement-precision-report-practice";
import type { GeneratedProblem } from "../src/math/contracts";

/* Independent recomputation from the public prompt only. */
const nums = (text: string) =>
  (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const lead = (v: number) => Math.floor(Math.log10(v) + 1e-9);
const dp = (text: string) => (text.split(".")[1] ?? "").length;
function roundAt(v: number, e: number): string {
  const n = Math.round(v / 10 ** e + 1e-9);
  return e >= 0 ? String(n * 10 ** e) : (n * 10 ** e).toFixed(-e);
}
const sig = (text: string) => text.replace(".", "").replace(/^0+/, "").length;
const choices = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.ok(r.kind === "choice" || r.kind === "multi-select");
  return r.options;
};
const numberOf = (label: string) => /\$(-?[\d.]+)/.exec(label)![1]!;

const sweep = (id: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    measurementPrecisionGenerate(id, `m${i}`),
  );

// Step of each reading and the operation, by context (all stated in the prompt).
const contexts: Record<
  string,
  {
    steps: [number, number?];
    op: (a: number, b: number) => number;
    rule: "sf" | "dp";
  }
> = {
  "convert-cm-in": { steps: [1], op: (m) => m / 2.54, rule: "sf" },
  "convert-in-cm": { steps: [1], op: (m) => m * 2.54, rule: "sf" },
  "convert-mi-km": { steps: [0.1], op: (m) => m * 1.609344, rule: "sf" },
  "convert-km-mi": { steps: [0.1], op: (m) => m / 1.609344, rule: "sf" },
  "convert-lb-kg": { steps: [1], op: (m) => m * 0.45359237, rule: "sf" },
  "convert-kg-lb": { steps: [0.1], op: (m) => m / 0.45359237, rule: "sf" },
  "convert-gal-l": { steps: [0.1], op: (m) => m * 3.785411784, rule: "sf" },
  "convert-ft-m": { steps: [0.1], op: (m) => m * 0.3048, rule: "sf" },
  "combine-pack-mass": {
    steps: [0.1, 1],
    op: (a, b) => a + b / 1000,
    rule: "dp",
  },
  "combine-rope-length": {
    steps: [0.1, 1],
    op: (a, b) => a + b / 1000,
    rule: "dp",
  },
  "combine-board-difference": {
    steps: [0.1, 1],
    op: (a, b) => a - b / 1000,
    rule: "dp",
  },
  "combine-relay-time": {
    steps: [0.1, 0.001],
    op: (a, b) => a + b,
    rule: "dp",
  },
  "product-garden-area": { steps: [0.1, 0.1], op: (a, b) => a * b, rule: "sf" },
  "product-cart-speed": { steps: [1, 0.1], op: (a, b) => a / b, rule: "sf" },
  "product-density": { steps: [1, 1], op: (a, b) => a / b, rule: "sf" },
  "product-fuel-economy": { steps: [1, 0.1], op: (a, b) => a / b, rule: "sf" },
};

test("the same seed gives the same problem", () => {
  for (const t of measurementPrecisionTemplates)
    for (let i = 0; i < 30; i++)
      assert.deepEqual(
        generateProblem(t.id, `same-${i}`),
        generateProblem(t.id, `same-${i}`),
      );
});

test("justified report: the key is the interval rule's report and both rules agree", () => {
  const seen = new Set<string>();
  let slips = 0,
    zeros = 0;
  const all = sweep("justified-report-from-measurements", 1500);
  for (const p of all) {
    const ctx = contexts[p.variant!.id];
    assert.ok(ctx, p.variant!.id);
    seen.add(p.variant!.id);
    assert.match(p.public.prompt, /first nonzero digit of the width/);
    const given = nums(p.public.prompt.split("Use this rule")[0]!);
    const shown = given.at(-1)!;
    const shownText =
      /\$([\d.]+)\$[^$]*$/.exec(
        p.public.prompt.split("Use this rule")[0]!,
      )?.[1] ?? /=([\d.]+)\$/.exec(p.public.prompt)![1]!;
    const isConvert = p.variant!.id.startsWith("convert");
    const a = given[0]!,
      b = isConvert ? 0 : given[1]!;
    const [ua, ub = 0] = ctx.steps;
    const central = ctx.op(a, b);
    assert.ok(Math.abs(central - shown) < 1e-6, `${p.public.prompt}`);
    // The result is monotone in each reading, so its range comes from the
    // corners of the readings' windows.
    const corners = [
      ctx.op(a - ua / 2, b - ub / 2),
      ctx.op(a - ua / 2, b + ub / 2),
      ctx.op(a + ua / 2, b - ub / 2),
      ctx.op(a + ua / 2, b + ub / 2),
    ];
    const lo = Math.min(...corners),
      hi = Math.max(...corners);
    const e = lead(hi - lo);
    assert.ok(e <= 0, "no placeholder zeros");
    const report = roundAt(central, e);
    assert.equal(report, roundAt((lo + hi) / 2, e));
    const frac = central / 10 ** e - Math.floor(central / 10 ** e);
    assert.ok(Math.abs(frac - 0.5) > 1e-7, "not a tie");
    assert.ok(
      dp(shownText) - Math.max(0, -e) >= 2,
      "two digits beyond the place",
    );
    // The classroom rule gives the same place.
    if (ctx.rule === "sf") {
      const sfA = sig(String(a)),
        sfB = isConvert ? Infinity : sig(String(b));
      const sf = Math.min(sfA, sfB);
      assert.equal(lead(central) - sf + 1, e, p.public.prompt);
    } else assert.equal(e, -1);
    const opts = choices(p);
    assert.equal(opts.length, 4);
    const correct = opts.find((o) => o.id === p.answer)!;
    assert.equal(numberOf(correct.label), report);
    const wrong = opts
      .filter((o) => o.id !== p.answer)
      .map((o) => numberOf(o.label));
    assert.ok(wrong.includes(shownText), "calculator display offered");
    assert.ok(
      wrong.includes(roundAt(central, e - 1)),
      "one place finer offered",
    );
    assert.equal(new Set([report, ...wrong]).size, 4);
    if (
      wrong.some((w) => w === `${report}${report.includes(".") ? "0" : ".0"}`)
    )
      zeros++;
    else slips++;
  }
  for (const id of Object.keys(contexts))
    assert.ok(seen.has(id), `unreached ${id}`);
  assert.ok(slips > 300 && zeros > 300, `${slips} slips, ${zeros} zeros`);
});

test("report meaning: every statement's truth is recomputed from its numbers", () => {
  const seen = new Set<string>();
  let exactly = 0;
  const all = sweep("measurement-report-meaning", 800);
  for (const p of all) {
    seen.add(p.variant!.id);
    const r = p.public.response;
    assert.equal(r.kind, "multi-select");
    if (r.kind !== "multi-select") continue;
    const tool = p.variant!.id.startsWith("tool");
    let step: number, R: number, Rtext: string;
    if (tool) {
      const m = /nearest \$([\d.]+)\$.*as \$([\d.]+)\$/.exec(p.public.prompt)!;
      step = Number(m[1]);
      Rtext = m[2]!;
      R = Number(Rtext);
      assert.equal(r.options.length, 5);
    } else {
      Rtext = /as \$([\d.]+)\$/.exec(p.public.prompt)![1]!;
      R = Number(Rtext);
      step = /nearest hundred/.test(p.public.prompt) ? 100 : 10 ** -dp(Rtext);
      assert.ok(r.options.length === 4 || r.options.length === 5);
    }
    const inWindow = (v: number) =>
      v >= R - step / 2 - 1e-9 && v < R + step / 2 - 1e-9;
    const truth = (label: string): boolean => {
      let m: RegExpExecArray | null;
      if (
        (m = /at least \$([\d.]+)\$ \S+ and less than \$([\d.]+)\$/.exec(label))
      )
        return (
          Math.abs(Number(m[1]) - (R - step / 2)) < 1e-9 &&
          Math.abs(Number(m[2]) - (R + step / 2)) < 1e-9
        );
      if ((m = /could be as high as \$([\d.]+)\$/.exec(label)))
        return inWindow(Number(m[1]));
      if ((m = /could be \$([\d.]+)\$/.exec(label)))
        return inWindow(Number(m[1]));
      if (/is exactly/.test(label)) return false;
      // One-sided claims fail for part of the window.
      if ((m = /is at least \$([\d.]+)\$ \S+\.$/.exec(label)))
        return Number(m[1]) <= R - step / 2 + 1e-9;
      if ((m = /is less than \$([\d.]+)\$ \S+\.$/.exec(label)))
        return Number(m[1]) >= R + step / 2 - 1e-9;
      if (/would claim more accuracy/.test(label)) return true;
      if (/same accuracy/.test(label)) return false;
      if ((m = /rounded to the nearest \$([\d.]+)\$/.exec(label)))
        return Math.abs(Number(m[1]) - step) < 1e-9;
      if ((m = /reads only to the nearest \$([\d.]+)\$/.exec(label)))
        return Number(m[1]) <= step + 1e-9;
      throw new Error(`Unread statement: ${label}`);
    };
    const keyed = new Set(JSON.parse(p.answer) as string[]);
    for (const o of r.options)
      assert.equal(keyed.has(o.id), truth(o.label), o.label);
    const k = keyed.size;
    assert.ok(tool ? k === 2 || k === 3 : k === 2);
    if (r.options.some((o) => /is exactly/.test(o.label))) exactly++;
    // Possible values are never on the window's edge.
    for (const o of r.options) {
      const m = /could be \$([\d.]+)\$/.exec(o.label);
      if (m) {
        const v = Number(m[1]);
        assert.ok(Math.abs(Math.abs(v - R) - step / 2) > 1e-9);
      }
    }
  }
  for (const id of [
    "tool-calipers",
    "tool-kitchen-scale",
    "tool-bathroom-scale",
    "tool-thermometer",
    "tool-cylinder",
    "tool-postal-scale",
    "tool-truck-scale",
    "tool-gps",
    "report-length",
    "report-time",
    "report-mass",
    "report-distance",
  ])
    assert.ok(seen.has(id), `unreached ${id}`);
  assert.ok(
    exactly / all.length <= 0.7,
    `"exactly" shown in ${exactly} of ${all.length}`,
  );
});

const visible = (label: string) =>
  label
    .replace(/\\times/g, "×")
    .replace(/[$\\{}]/g, "")
    .replace(/text/g, "").length;

test("critique: one complete option, matching the window, lengths balanced", () => {
  const seen = new Set<string>();
  let longest = 0;
  const all = sweep("precision-report-critique", 800);
  for (const p of all) {
    const id = p.variant!.id;
    seen.add(id);
    const opts = choices(p);
    assert.equal(opts.length, 4);
    const correct = opts.find((o) => o.id === p.answer)!.label;
    const lens = opts.map((o) => visible(o.label));
    const mean = lens.reduce((s, x) => s + x, 0) / lens.length;
    for (const l of lens)
      assert.ok(
        Math.abs(l - mean) <= 0.25 * mean,
        `${id}: ${lens} ${opts.map((o) => o.label).join(" | ")}`,
      );
    if (visible(correct) === Math.max(...lens)) longest++;
    for (const o of opts)
      reportEditorialLimit(
        o.label.length <= 120,
        `${p.public.templateId}: option exceeds 120 characters`,
      );
    const g = nums(
      p.public.prompt.split("Use this rule")[0]!.split("A good report")[0]!,
    );
    if (id === "overstated-product") {
      const [a, b] = g as [number, number];
      const lo = (a - 0.05) * (b - 0.05),
        hi = (a + 0.05) * (b + 0.05);
      const e = lead(hi - lo);
      const report = roundAt(a * b, e);
      assert.equal(lead(a * b) - 2 + 1, e, "two significant figures agree");
      assert.match(
        correct,
        new RegExp(`report \\$${report.replace(".", "\\.")}\\$`),
      );
      assert.match(
        correct,
        new RegExp(
          `from \\$${roundAt(lo, e - 1).replace(".", "\\.")}\\$ to \\$${roundAt(hi, e - 1).replace(".", "\\.")}\\$`,
        ),
      );
    } else if (id === "mismatched-sum") {
      const [big, , small] = g as [number, number, number];
      const report = roundAt(big + small, 1);
      assert.match(
        correct,
        new RegExp(`report \\$${report}\\$ g, to the nearest \\$10\\$ g`),
      );
      assert.match(
        correct,
        new RegExp(
          `about \\$${Math.round(big + small - 5.005)}\\$ to \\$${Math.round(big + small + 5.005)}\\$`,
        ),
      );
    } else if (id === "trailing-zero") {
      const [, t] = g as [number, number];
      assert.match(
        correct,
        new RegExp(`Report \\$${t.toFixed(1).replace(".", "\\.")}\\$ kg`),
      );
    } else {
      const t = /as \$([\d.]+)\$/.exec(p.public.prompt)![1]!;
      assert.match(
        correct,
        new RegExp(`Report \\$${t.replace(".", "\\.")}\\$`),
      );
    }
  }
  for (const id of [
    "overstated-product",
    "understated-calipers",
    "understated-thermometer",
    "understated-scale",
    "mismatched-sum",
    "trailing-zero",
  ])
    assert.ok(seen.has(id), `unreached ${id}`);
  assert.ok(
    longest / all.length <= 0.4,
    `correct option longest in ${longest} of ${all.length}`,
  );
});
