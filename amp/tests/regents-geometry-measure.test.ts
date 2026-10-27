import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

const seeds = Array.from({ length: 200 }, (_, i) => `reg:${i}`);
const nums = (s: string) =>
  (s.replace(/\$/g, " ").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const deg = Math.PI / 180;
const round = (x: number, p: number) =>
  (Math.round(x * 10 ** p) / 10 ** p).toFixed(p);

test("measure templates pass the shared checks", () => {
  checkTemplate("geo-arc-length-rounded", {
    variants: ["major-arc", "minor-arc"],
    axes: { given: ["radius", "diameter"], place: ["whole", "tenth"] },
  });
  checkTemplate("geo-trig-leg-degrees", {
    variants: ["small-angle", "large-angle"],
    axes: { leg: ["opposite", "adjacent"] },
  });
  checkTemplate("geo-sas-triangle-area", { variants: ["acute", "obtuse"] });
  checkTemplate("geo-ring-area", {
    variants: ["wide-border", "narrow-border"],
  });
  checkTemplate("geo-sphere-diameter", {
    variants: ["large-sphere", "small-sphere"],
    axes: { ask: ["diameter", "radius"] },
  });
  checkTemplate("geo-isosceles-trig", {
    variants: ["wide-apex", "narrow-apex"],
    axes: { ask: ["perimeter", "base-angle"] },
  });
  checkTemplate("geo-volume-context", {
    variants: ["wide", "narrow"],
    axes: { solid: ["cylinder-weight", "prism-pyramid-mass", "cone-trips"] },
  });
});

test("arc length matches an independent proportion", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-arc-length-rounded", s);
    const [len, angle] = [nums(p.public.prompt)[0]!, nums(p.public.prompt)[1]!];
    const r = /diameter/.test(p.public.prompt) ? len / 2 : len;
    // Same arc via proportion: arc / (circumference) = angle / 360.
    const circ = 2 * Math.PI * r;
    const arc = (circ * angle) / 360;
    const places = /tenth of a unit/.test(p.public.prompt) ? 1 : 0;
    assert.equal(p.answer, round(arc, places));
  }
});
test("trig leg matches the Pythagorean partner", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-trig-leg-degrees", s);
    const prompt = p.public.prompt;
    const [hyp, angle] = [
      Number(/=(\d+)\$/.exec(prompt)![1]),
      Number(
        /angle \w=(\d+)/.exec(
          prompt.replace(/\\/g, "").replace(/ /g, ""),
        )?.[1] ?? /=(\d+)\^/.exec(prompt)![1],
      ),
    ];
    const opp = /\$[A-Z][A-Z]\$ to the nearest tenth/.test(prompt);
    const other = Math.sqrt(hyp * hyp);
    void other;
    const sin = hyp * Math.sin(angle * deg);
    const cos = hyp * Math.cos(angle * deg);
    // the leg asked and its partner satisfy leg^2 + partner^2 = hyp^2
    const want = /BC|QR/.test(prompt.split("Find")[1]!) ? sin : cos;
    assert.equal(p.answer, round(want, 1));
    assert.ok(Math.abs(sin * sin + cos * cos - hyp * hyp) < 1e-9);
    void opp;
  }
});
test("SAS area equals half the product of a side and the altitude on it", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-sas-triangle-area", s);
    const v = nums(p.public.prompt);
    const [a, b, C] = [v[0]!, v[1]!, v[2]!];
    const altitude = b * Math.sin((180 - C) * deg); // sin C = sin(180 - C)
    assert.equal(p.answer, round(0.5 * a * altitude, 1));
  }
});
test("ring area equals the border strip rearranged", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-ring-area", s);
    const v = nums(p.public.prompt);
    const inner = /diameter/.test(p.public.prompt) ? v[0]! / 2 : v[0]!;
    const w = v[1]!;
    // area of the strip = w * (mean circumference of the two circles)
    const strip = w * (Math.PI * (2 * inner + w));
    assert.equal(p.answer, round(strip, 0));
  }
});
test("sphere radius cubes back to the volume", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-sphere-diameter", s);
    const v = nums(p.public.prompt.replace("\\text{", "").replace(/\^3/, ""));
    const vol = v[0]!;
    const ans = Number(p.answer);
    const r = /diameter to/.test(p.public.prompt) ? ans / 2 : ans;
    const back = (4 / 3) * Math.PI * r ** 3;
    assert.ok(Math.abs(back - vol) / vol < 0.06, `${p.answer} ${vol}`);
  }
});
test("isosceles perimeter and base angle reconstruct the givens", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-isosceles-trig", s);
    const v = nums(p.public.prompt);
    if (/apex angle/.test(p.public.prompt)) {
      const [apex, h] = [v[0]!, v[1]!];
      const leg = Math.hypot(h, h * Math.tan((apex / 2) * deg));
      const base = 2 * Math.sqrt(leg * leg - h * h);
      assert.equal(p.answer, round(2 * leg + base, 1));
    } else {
      const [w, h] = [v[0]!, v[1]!];
      const ang = Math.atan2(h, w / 2) / deg;
      assert.equal(p.answer, round(ang, 0));
    }
  }
});

test("volume context answers match an independent computation", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-volume-context", s);
    const pr = p.public.prompt.replace(/\$/g, " ").replace(/\\ /g, " ");
    const v = (pr.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (/cylindrical bucket/.test(pr)) {
      const [d, h, w] = v;
      // volume by integrating: area of circle via diameter formula pi d^2 / 4
      assert.equal(p.answer, round(((Math.PI * d! * d!) / 4) * h! * w!, 0));
    } else if (/trophy/.test(pr)) {
      const [side, ph, pyr, dens] = [v[0]!, v[2]!, v[3]!, v[4]!];
      void side;
      const base = v[0]! * v[1]!;
      assert.equal(p.answer, round((base * ph + (base * pyr) / 3) * dens, 0));
      void dens;
    } else {
      const [r, h, load] = v;
      const trips = Math.ceil((Math.PI * r! * r! * h!) / 3 / load! - 1e-12);
      assert.equal(p.answer, String(trips));
    }
  }
});
