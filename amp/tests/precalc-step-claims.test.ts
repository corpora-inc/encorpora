import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";

const sample = (id: string, n = 60) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `claim-${i}`));

test("odd-sine-parameters: f(0) = D only when C = 0, and the slide is C/B", () => {
  for (const p of sample("odd-sine-parameters")) {
    for (const s of p.explanation)
      if (/f\(0\)=[^$]*D\$/.test(s) && /=D\$/.test(s))
        assert.match(s, /^With \$C=0\$/, s);
    const B = /\\sin\((\d)x-C\)/.exec(p.public.prompt)![1];
    assert.ok(
      p.explanation.some((s) => s.includes(`\\frac{C}{${B}}`)),
      "the sideways slide of sin(Bx − C) is C/B",
    );
  }
});

test("tangent-quadrant-cosine: the point used has the quadrant's signs and the given tangent", () => {
  const signs = { II: [-1, 1], III: [-1, -1], IV: [1, -1] } as const;
  for (const p of sample("tangent-quadrant-cosine")) {
    const quad = /Quadrant (III|IV|II)\b/.exec(
      p.public.prompt,
    )![1] as keyof typeof signs;
    const step = p.explanation.find((s) => s.includes("fits the point"))!;
    const m = /\$x=(-?\d+)\$, \$y=(-?\d+)\$/.exec(step)!;
    const [x, y] = [Number(m[1]), Number(m[2])];
    assert.equal(Math.sign(x), signs[quad][0], step);
    assert.equal(Math.sign(y), signs[quad][1], step);
    const t = /\\tan\\theta=(-?)(?:\\dfrac\{(\d+)\}\{(\d+)\}|(\d+))\$/.exec(
      p.public.prompt,
    )!;
    const tan =
      (t[1] ? -1 : 1) * (t[4] ? Number(t[4]) : Number(t[2]) / Number(t[3]));
    assert.ok(Math.abs(y / x - tan) < 1e-12, `${p.public.prompt} ${step}`);
  }
});

test("transform-point asks for the image of the given point, which is unique", () => {
  for (const p of sample("transform-point"))
    if (/is on the graph of \$y = f\(x\)\$\./.test(p.public.prompt))
      assert.match(p.public.prompt, /that point moves to/, p.public.prompt);
});
