import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];
const key = (p: P) => options(p).find((o) => o.id === p.answer)!.label;

const singular: Record<string, string> = {
  miles: "mile",
  feet: "foot",
  meters: "meter",
  kilometers: "kilometer",
  yards: "yard",
  inches: "inch",
  hours: "hour",
  minutes: "minute",
  seconds: "second",
  days: "day",
  mile: "mile",
  foot: "foot",
  meter: "meter",
  kilometer: "kilometer",
  yard: "yard",
  inch: "inch",
  hour: "hour",
  minute: "minute",
  second: "second",
  day: "day",
};
test("rate unit chain: units cancel to the key", () => {
  checkTemplate("rate-unit-chain", {
    variants: ["length-0-time-0", "length-3-time-3"],
    axes: { order: ["length-first", "time-first"] },
    hintsMin: 12,
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("rate-unit-chain", `u:${i}`);
    const fr = [
      ...p.public.prompt.matchAll(
        /\\frac\{(\d+)\\ \\text\{(\w+)\}\}\{(\d+)\\ \\text\{(\w+)\}\}/g,
      ),
    ];
    assert.equal(fr.length, 3);
    const up: string[] = [];
    const down: string[] = [];
    for (const f of fr) {
      up.push(singular[f[2]!]!);
      down.push(singular[f[4]!]!);
    }
    for (const u of [...up]) {
      const j = down.indexOf(u);
      if (j >= 0) {
        down.splice(j, 1);
        up.splice(up.indexOf(u), 1);
      }
    }
    assert.equal(up.length, 1);
    assert.equal(down.length, 1);
    const [n, d] = key(p)
      .replaceAll("$", "")
      .replace("\\text{", "")
      .replace("}", "")
      .split(" per ");
    assert.equal(singular[n!], up[0]);
    assert.equal(singular[d!], down[0]);
  }
});

test("negative monomial power", () => {
  checkTemplate("negative-monomial-power", {
    variants: ["odd-power", "even-power"],
    axes: { power: ["odd", "even"], letter: ["x", "y", "a", "n"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("negative-monomial-power", `n:${i}`);
    const m = p.public.prompt.match(/\(-(\d+)(\w)\^\{(\d+)\}\)\^\{(\d+)\}/)!;
    const [c, v, e, k] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])];
    const expected = `$${(-c) ** k! < 0 ? "-" : ""}${Math.abs((-c) ** k!)}${v}^{${e! * k!}}$`;
    assert.equal(key(p), expected);
    assert.equal(options(p).filter((o) => o.label === expected).length, 1);
  }
});

const radicalValue = (text: string) => {
  let total = 0;
  for (const m of text.replaceAll("$", "").matchAll(/(\d*)\\sqrt\{(\d+)\}/g))
    total += (m[1] === "" ? 1 : Number(m[1])) * Math.sqrt(Number(m[2]));
  return total;
};
test("combine radicals", () => {
  checkTemplate("combine-unlike-radicals", {
    variants: ["s-2", "s-3", "s-4", "s-5"],
    axes: { order: ["like-first", "unlike-first"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("combine-unlike-radicals", `r:${i}`);
    const target = radicalValue(p.public.prompt);
    for (const o of options(p))
      assert.equal(
        Math.abs(radicalValue(o.label) - target) < 1e-9,
        o.id === p.answer,
        `${p.public.prompt} ${o.label}`,
      );
    // Key has two unlike simplified radicals.
    assert.match(key(p), /\\sqrt\{\d+\} \+ \d*\\sqrt\{\d+\}/);
  }
});

test("complete the square", () => {
  checkTemplate("complete-square-equation", {
    variants: ["negative-middle", "positive-middle"],
    axes: { form: ["zero-form", "constant-on-right"] },
    hintsMin: 12,
  });
  const num = (s: string | undefined) =>
    s === undefined ? 0 : s === "" ? 1 : Number(s);
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("complete-square-equation", `c:${i}`);
    const eq = p.public.prompt.match(
      /solutions as \$x\^2 ([+-]) (\d*)x(?: ([+-]) (\d+))? = (-?\d+)\$/,
    )!;
    const b = (eq[1] === "+" ? 1 : -1) * num(eq[2]);
    const c = eq[3] ? (eq[3] === "+" ? 1 : -1) * Number(eq[4]) : 0;
    const rhs = Number(eq[5]);
    const target = (x: number) => x * x + b * x + c - rhs;
    const disc = b * b - 4 * (c - rhs);
    for (const o of options(p)) {
      const m = o.label.match(/\(x ([+-]) (\d+)\)\^2 = (-?\d+)/)!;
      const h = (m[1] === "+" ? 1 : -1) * Number(m[2]);
      const k = Number(m[3]);
      // (x+h)^2 = k has the same solutions iff x^2+2hx+h^2-k is x^2+bx+c-rhs.
      const same = 2 * h === b && h * h - k === c - rhs;
      assert.equal(same, o.id === p.answer, `${eq[0]} ${o.label}`);
      void target;
      void disc;
    }
  }
});

test("completing-square step property", () => {
  checkTemplate("complete-square-step-property", {
    variants: ["h-1", "h-6"],
    axes: { step: ["add-square", "move-constant", "divide-leading"] },
    hintsMin: 15,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("complete-square-step-property", `p:${i}`);
    const want =
      p.variant?.axes?.step === "divide-leading"
        ? "Multiplication property of equality"
        : "Addition property of equality";
    assert.equal(key(p), want);
  }
});

function polyFeatures(label: string) {
  const terms = [
    ...label.replaceAll("$", "").matchAll(/([+-]?) ?(\d*)(x?)(?:\^(\d+))?/g),
  ]
    .filter((m) => m[0].trim() !== "")
    .map((m) => ({
      sign: m[1] === "-" ? -1 : 1,
      mag: m[2] === "" ? 1 : Number(m[2]),
      exp: m[3] ? (m[4] ? Number(m[4]) : 1) : 0,
    }));
  const degree = Math.max(...terms.map((t) => t.exp));
  const lead = terms.find((t) => t.exp === degree)!;
  const constant = terms.find((t) => t.exp === 0);
  return {
    degree,
    lead: lead.sign * lead.mag,
    constant: constant ? constant.sign * constant.mag : 0,
  };
}
test("polynomial structure", () => {
  checkTemplate("polynomial-structure", {
    variants: ["degree-3", "degree-4", "degree-5"],
    axes: { ask: ["three-features", "degree-and-constant"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("polynomial-structure", `s:${i}`);
    const d = Number(p.public.prompt.match(/degree of (\d+)/)![1]);
    const lc = p.public.prompt.match(/leading coefficient of (-?\d+)/);
    const c = Number(p.public.prompt.match(/constant term of (-?\d+)/)![1]);
    for (const o of options(p)) {
      const f = polyFeatures(o.label);
      const ok =
        f.degree === d && f.constant === c && (!lc || f.lead === Number(lc[1]));
      assert.equal(ok, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
  }
});
