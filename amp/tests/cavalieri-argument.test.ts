import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  STEPS,
  cavalieriArgumentGenerate as generate,
  cavalieriArgumentTemplates as templates,
} from "../src/math/cavalieri-argument-practice";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";

const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generate(id, `c${i}`));
const variants = (id: string, n = 400) => {
  const counts = new Map<string, number>();
  for (const p of sample(id, n))
    counts.set(p.variant!.id, (counts.get(p.variant!.id) ?? 0) + 1);
  return counts;
};

test("same seed, same problem; every problem meets the contract", () => {
  for (const t of templates)
    for (let i = 0; i < 60; i++) {
      const a = generate(t.id, `d${i}`);
      assert.deepEqual(generate(t.id, `d${i}`), a);
      assert.equal(a.public.skillId, "cavalieri-principle");
      generatedProblemSchema.parse(a);
    }
});

test("every family and sub-variant is reachable", () => {
  const sphere = variants("cavalieri-sphere-argument", 600);
  for (const v of [
    "justify-inner",
    "justify-slice",
    "justify-principle",
    "justify-volume",
    "next-step",
    "flaw-cylinder",
    "flaw-inverted-cone",
    "flaw-linear-radius",
    "flaw-heights",
    "flaw-two-heights",
    "complete",
  ])
    assert.ok((sphere.get(v) ?? 0) >= 20, `${v}: ${sphere.get(v)}`);
  const ks = new Set<number>();
  for (const p of sample("cavalieri-sphere-argument", 600))
    if (p.variant!.id === "next-step")
      ks.add(
        Math.max(
          ...[...p.public.prompt.matchAll(/Step (\d):/g)].map((m) =>
            Number(m[1]),
          ),
        ),
      );
  assert.deepEqual([...ks].sort(), [2, 3, 4, 5]);
  const slices = variants("cavalieri-slice-area-check");
  for (const v of [
    "sphere",
    "pyramid-cone",
    "hemisphere-cone",
    "sphere-volume",
  ])
    assert.ok((slices.get(v) ?? 0) >= 30, `${v}: ${slices.get(v)}`);
  const other = variants("cavalieri-other-solids-argument");
  for (const v of [
    "oblique-argument",
    "oblique-stack",
    "cone-reason",
    "cone-follows",
    "three-pyramids",
    "hypothesis",
    "flaw",
    "statement",
  ])
    assert.ok((other.get(v) ?? 0) >= 20, `${v}: ${other.get(v)}`);
});

/** The coefficient of π in a label such as "$\frac{64}{3}\pi$ cm³". */
function piCoefficient(label: string): number {
  const t = label.replace(/\$| cm[²³]/g, "").trim();
  const f = /^\\frac\{(\d+)\}\{(\d+)\}\\pi$/.exec(t);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = /^(\d*)\\pi$/.exec(t);
  assert.ok(n, label);
  return n[1] === "" ? 1 : Number(n[1]);
}
const keyed = (p: ReturnType<typeof generate>) => {
  const r = p.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(p.answer) as Record<string, string>;
  return (id: string) => {
    const b = r.blanks.find((x) => x.id === id)!;
    return {
      key: b.options.find((o) => o.id === key[id])!.label,
      all: b.options.map((o) => o.label),
    };
  };
};

test("slice areas are exact and recompute from the prompt's own numbers", () => {
  for (const p of sample("cavalieri-slice-area-check", 400)) {
    const nums = [...p.public.prompt.matchAll(/(\d+) cm/g)].map((m) =>
      Number(m[1]),
    );
    const part = keyed(p);
    const v = p.variant!.id;
    if (v === "sphere") {
      const [R, , , y] = nums as [number, number, number, number];
      assert.notEqual(2 * y, R, "y is never half of r");
      // The hemisphere's slice: points of the sphere x² + z² + y² ≤ R² at height y.
      const hemi = R * R - y * y;
      // The ring: the cylinder's disk minus the cone's, whose radius equals its height.
      const coneRadius = (y * R) / R;
      const ring = R * R - coneRadius * coneRadius;
      assert.equal(piCoefficient(part("hemi").key), hemi);
      assert.equal(piCoefficient(part("ring").key), ring);
      for (const id of ["hemi", "ring"]) {
        const values = part(id).all.map(piCoefficient);
        assert.equal(new Set(values).size, values.length, p.public.prompt);
        assert.deepEqual(
          [...values].sort((a, b) => a - b),
          [hemi, (R - y) ** 2, R * R, y * y].sort((a, b) => a - b),
        );
      }
      assert.match(part("means").key, /every height/);
    } else if (v === "pyramid-cone") {
      const [B, h, y] = nums as [number, number, number];
      const area = (B * (h - y) ** 2) / h ** 2;
      assert.ok(Number.isInteger(area));
      for (const id of ["pyr", "cone"]) {
        assert.equal(Number(part(id).key.replace(" cm²", "")), area);
        const values = part(id).all.map((l) => Number(l.replace(" cm²", "")));
        assert.ok(values.every(Number.isInteger));
        assert.equal(new Set(values).size, 4);
      }
      assert.match(part("means").key, /every height/);
    } else if (v === "hemisphere-cone") {
      const R = nums[0]!;
      assert.equal(R % 2, 0);
      assert.equal(piCoefficient(part("hemi").key), R * R - (R / 2) ** 2);
      assert.equal(piCoefficient(part("cone").key), (R - R / 2) ** 2);
      assert.match(part("means").key, /^No/);
    } else {
      const R = nums[0]!;
      const c = R ** 3;
      assert.equal(piCoefficient(part("cyl").key), c);
      assert.ok(Math.abs(piCoefficient(part("cone").key) - c / 3) < 1e-9);
      assert.ok(Math.abs(piCoefficient(part("hemi").key) - (2 * c) / 3) < 1e-9);
      assert.ok(
        Math.abs(piCoefficient(part("sphere").key) - (4 * c) / 3) < 1e-9,
      );
      for (const id of ["cyl", "cone", "hemi", "sphere"]) {
        const values = part(id).all.map(piCoefficient);
        assert.equal(new Set(values).size, values.length);
      }
    }
  }
});

test("the sphere argument's slice claims hold at every height, and the volumes integrate to the formulas", () => {
  for (const r of [3, 5, 8, 13]) {
    let hemi = 0,
      ring = 0,
      cone = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const y = ((i + 0.5) / n) * r;
      // Sphere: the slice at height y has radius² = r² − y².
      const a = Math.PI * (r * r - y * y);
      // Cylinder minus a cone with tip at the base center: inner radius y.
      const b = Math.PI * r * r - Math.PI * y * y;
      assert.ok(Math.abs(a - b) < 1e-9);
      hemi += (a * r) / n;
      ring += (b * r) / n;
      // A cone standing on its base: radius r − y.
      cone += (Math.PI * (r - y) ** 2 * r) / n;
      // The inverted cone (tip on top) leaves a ring that differs off y = r/2.
      const inverted = Math.PI * r * r - Math.PI * (r - y) ** 2;
      if (Math.abs(y - r / 2) > r / 50)
        assert.ok(Math.abs(inverted - a) > 1e-6);
    }
    assert.ok(Math.abs(hemi - (2 / 3) * Math.PI * r ** 3) < 1e-3 * r ** 3);
    assert.ok(
      Math.abs(ring - (Math.PI * r ** 3 - (1 / 3) * Math.PI * r ** 3)) <
        1e-3 * r ** 3,
    );
    assert.ok(Math.abs(cone - (1 / 3) * Math.PI * r ** 3) < 1e-3 * r ** 3);
    // Halfway up, the hemisphere and the cone differ: ¾πr² and ¼πr².
    assert.ok(
      Math.abs(Math.PI * (r * r - (r / 2) ** 2) - 0.75 * Math.PI * r * r) <
        1e-9,
    );
    assert.ok(Math.abs(Math.PI * (r / 2) ** 2 - 0.25 * Math.PI * r * r) < 1e-9);
  }
  // Pyramid and cone: slices B((h − y)/h)² integrate to Bh/3.
  for (const [B, h] of [
    [36, 12],
    [25, 10],
    [27, 6],
  ] as const) {
    let v = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const y = ((i + 0.5) / n) * h;
      v += (B * ((h - y) / h) ** 2 * h) / n;
    }
    assert.ok(Math.abs(v - (B * h) / 3) < 1e-3 * B * h);
  }
});

test("flaw items key the step the student's text actually gets wrong; 'Nothing is wrong' is never the key", () => {
  const flawed: Record<string, number> = {
    "flaw-cylinder": 2,
    "flaw-inverted-cone": 3,
    "flaw-linear-radius": 2,
    "flaw-heights": 3,
    "flaw-two-heights": 4,
  };
  for (const id of [
    "cavalieri-sphere-argument",
    "cavalieri-other-solids-argument",
  ])
    for (const p of sample(id, 400)) {
      const r = p.public.response;
      if (r.kind !== "choice") throw new Error("choice");
      const key = r.options.find((o) => o.id === p.answer)!.label;
      assert.ok(!/^Nothing is wrong/.test(key), key);
      assert.ok(
        r.options.filter((o) => /^Nothing is wrong/.test(o.label)).length <= 1,
      );
      const step = flawed[p.variant!.id];
      if (step)
        assert.ok(key.startsWith(`Step ${step}:`), `${p.variant!.id}: ${key}`);
      if (p.variant!.id === "next-step") {
        const k = Math.max(
          ...[...p.public.prompt.matchAll(/Step (\d):/g)].map((m) =>
            Number(m[1]),
          ),
        );
        assert.equal(key, STEPS[k]);
      }
    }
});

test("every keyed statement of the principle names every height", () => {
  for (const id of [
    "cavalieri-sphere-argument",
    "cavalieri-other-solids-argument",
  ])
    for (const p of sample(id, 300)) {
      const r = p.public.response;
      if (r.kind !== "choice") continue;
      const key = r.options.find((o) => o.id === p.answer)!.label;
      if (
        ["justify-principle", "statement", "complete"].includes(p.variant!.id)
      )
        assert.match(key, /every (height|\$y\$)/, key);
    }
});

test("choices are four distinct options with feedback on each wrong one, spread over positions", () => {
  for (const id of [
    "cavalieri-sphere-argument",
    "cavalieri-other-solids-argument",
  ]) {
    const positions = new Map<string, number>();
    for (const p of sample(id, 400)) {
      const r = p.public.response;
      if (r.kind !== "choice") throw new Error("choice");
      assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
      assert.deepEqual(
        Object.keys(p.choiceFeedback!).sort(),
        r.options.map((o) => o.id).filter((x) => x !== p.answer),
      );
      positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    }
    for (const o of ["option-a", "option-b", "option-c", "option-d"])
      assert.ok(
        (positions.get(o) ?? 0) >= 60,
        `${id} ${o}: ${positions.get(o)}`,
      );
  }
});

test("the drawn plane sits at the prompt's height and the figure labels the prompt's values", () => {
  for (const p of sample("cavalieri-slice-area-check", 200)) {
    if (p.variant!.id !== "sphere" && p.variant!.id !== "hemisphere-cone")
      continue;
    const nums = [...p.public.prompt.matchAll(/(\d+) cm/g)].map((m) =>
      Number(m[1]),
    );
    const R = nums[0]!,
      y = nums.at(-1)!;
    const f = p.public.figure;
    if (f?.kind !== "scene") throw new Error("scene");
    const plane = f.scene.elements.find((e) => e.id === "plane");
    assert.ok(plane && plane.type === "segment");
    assert.equal(plane.from[1], y);
    const texts = f.scene.elements.flatMap((e) =>
      e.type === "text"
        ? [e.text]
        : e.type === "brace" && e.label
          ? [e.label]
          : [],
    );
    assert.ok(
      texts.includes(String(R)) && texts.includes(String(y)),
      texts.join(","),
    );
  }
});
