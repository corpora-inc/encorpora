import test from "node:test";
import assert from "node:assert/strict";
import {
  geometryModelingCase,
  geometryModelingTemplates,
  geometryModelingVariantCounts,
} from "../src/math/geometry-modeling-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import type { GeneratedProblem } from "../src/math/contracts";

type Quantity = { value: number; pi: boolean };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Reads a numeric choice label such as $\frac{256}{3}\pi$ cm³, 11.3 kg or $12$ m. */
function read(label: string): Quantity | null {
  let t = label.replace(/\$/g, "").trim();
  t = t.replace(
    /\s*(L|kg|g|cm³|cm²|cubic meters|square meters|m|cm|cups|dollars|people per km²|g\/cm³)$/,
    "",
  );
  const pi = t.includes("\\pi");
  t = t.replace("\\pi", "");
  const frac = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(t);
  if (frac) return { value: Number(frac[1]) / Number(frac[2]), pi };
  if (t === "" && pi) return { value: 1, pi };
  if (/^\d+(\.\d+)?$/.test(t)) return { value: Number(t), pi };
  return null;
}
const choices = (p: GeneratedProblem) => {
  assert.equal(p.public.response.kind, "choice");
  if (p.public.response.kind !== "choice") throw new Error("choice");
  return p.public.response.options;
};
const correctLabel = (p: GeneratedProblem) =>
  choices(p).find((o) => o.id === p.answer)!.label;
const num = (s: string | undefined) => Number(s);

/** Independent expectations computed from the prompt text alone. */
function expected(p: GeneratedProblem): Quantity | string | undefined {
  const t = p.public.prompt;
  let m: RegExpExecArray | null;
  if (
    (m =
      /^A cylindrical tank has (a diameter|a radius) of (\d+) cm and a height of (\d+) cm\. One liter/.exec(
        t,
      ))
  ) {
    const r = m[1] === "a diameter" ? num(m[2]) / 2 : num(m[2]);
    return { value: (r * r * num(m[3])) / 1000, pi: true };
  }
  if (
    (m =
      /^A cone-shaped paper cup has a radius of (\d+) cm and a height of (\d+) cm\. A cylindrical jar has a radius of (\d+) cm and a height of (\d+) cm/.exec(
        t,
      ))
  )
    return {
      value: (num(m[3]) ** 2 * num(m[4])) / ((num(m[1]) ** 2 * num(m[2])) / 3),
      pi: false,
    };
  if (
    (m =
      /^A conical pile of gravel has a base radius of (\d+) m and a volume of (\d+)\$\\pi\$ m³/.exec(
        t,
      ))
  )
    return { value: (3 * num(m[2])) / num(m[1]) ** 2, pi: false };
  if ((m = /^A spherical water tank has a diameter of (\d+) m/.exec(t))) {
    const r = num(m[1]) / 2;
    return { value: (4 * r ** 3) / 3, pi: true };
  }
  if ((m = /^A silo .*radius of (\d+) m and a height of (\d+) m/.exec(t))) {
    const r = num(m[1]);
    return { value: r * r * num(m[2]) + (2 * r ** 3) / 3, pi: true };
  }
  if (
    (m =
      /^A glass pyramid has a square base with sides of (\d+) m and a height of (\d+) m/.exec(
        t,
      ))
  )
    return { value: (num(m[1]) ** 2 * num(m[2])) / 3, pi: false };
  if (
    (m =
      /^A cylindrical paint can has a radius of (\d+) cm and a height of (\d+) cm\. Use 3\.14/.exec(
        t,
      ))
  )
    return {
      value: Math.round((314 * num(m[1]) ** 2 * num(m[2])) / 10000) / 10,
      pi: false,
    };
  if (
    (m =
      /^A county has an area of (\d+) square kilometers and a population of (\d+) people/.exec(
        t,
      ))
  )
    return { value: num(m[2]) / num(m[1]), pi: false };
  if (
    (m =
      /^A solid block of \w+ has a volume of (\d+) cm³\. The density of \w+ is ([\d.]+) g\/cm³\. What is the block's mass, in (grams|kilograms)/.exec(
        t,
      ))
  )
    return {
      value: (num(m[1]) * num(m[2])) / (m[3] === "grams" ? 1 : 1000),
      pi: false,
    };
  if (
    (m =
      /^A sample of \w+ has a mass of (\d+) g\. The density of \w+ is ([\d.]+) g\/cm³/.exec(
        t,
      ))
  )
    return { value: num(m[1]) / num(m[2]), pi: false };
  if (
    (m =
      /^Block (\w) has a mass of (\d+) g and a volume of (\d+) cm³\. Block (\w) has a mass of (\d+) g and a volume of (\d+) cm³/.exec(
        t,
      ))
  ) {
    const first = num(m[2]) / num(m[3]);
    const second = num(m[5]) / num(m[6]);
    return first > second
      ? `Block ${m[1]}, ${first} g/cm³`
      : `Block ${m[4]}, ${second} g/cm³`;
  }
  if (
    (m =
      /^A rectangular nature reserve is (\d+) km long and (\d+) km wide, and (\d+) people/.exec(
        t,
      ))
  )
    return { value: num(m[3]) / (num(m[1]) * num(m[2])), pi: false };
  if (
    (m =
      /^A solid steel rod is a cylinder with a radius of (\d+) cm and a length of (\d+) cm/.exec(
        t,
      ))
  )
    return { value: 8 * num(m[1]) ** 2 * num(m[2]), pi: true };
  if (
    (m =
      /^A can of beans is modeled as a cylinder with a radius of (\d+) cm and a height of (\d+) cm/.exec(
        t,
      ))
  )
    return { value: 2 * num(m[1]) * num(m[2]), pi: true };
  if (
    (m =
      /^A pup tent .* base of (\d+) m and a height of (\d+) m, and the tent is (\d+) m long/.exec(
        t,
      ))
  )
    return { value: (num(m[1]) * num(m[2]) * num(m[3])) / 2, pi: false };
  if (
    (m =
      /^A soccer ball is modeled as a sphere with a diameter of (\d+) cm/.exec(
        t,
      ))
  )
    return { value: 4 * (num(m[1]) / 2) ** 2, pi: true };
  if (
    (m =
      /^A wall is (\d+) m wide and (\d+) m tall\. A window (\d+) m wide and (\d+) m tall .* costs? (\d+) dollars/.exec(
        t,
      ))
  )
    return {
      value: (num(m[1]) * num(m[2]) - num(m[3]) * num(m[4])) * num(m[5]),
      pi: false,
    };
  if (
    (m =
      /^An oblique \(slanted\) cylinder has circular bases of radius (\d+) cm\. Its perpendicular height is (\d+) cm/.exec(
        t,
      ))
  )
    return { value: num(m[1]) ** 2 * num(m[2]), pi: true };
  if (
    (m =
      /^(\d+) identical foam sheets, each a rectangle (\d+) cm by (\d+) cm and (\d+) cm thick/.exec(
        t,
      ))
  )
    return {
      value: num(m[1]) * num(m[2]) * num(m[3]) * num(m[4]),
      pi: false,
    };
  if (
    (m =
      /^Solids X and Y are both 10 cm tall\. .* area (\d+ times|\d+\/\d+) the area .* volume of ([\d]+) cm³/.exec(
        t,
      ))
  ) {
    const factor = m[1]!.endsWith("times")
      ? num(m[1]!.split(" ")[0])
      : num(m[1]!.split("/")[0]) / num(m[1]!.split("/")[1]);
    return { value: factor * num(m[2]), pi: false };
  }
  if ((m = /^A semicircle with radius (\d+) cm is rotated/.exec(t)))
    return { value: (4 * num(m[1]) ** 3) / 3, pi: true };
  if (
    (m =
      /^In right triangle ABC, .* AD = (\d+) and DB = (\d+)\. What is the length of CD\?/.exec(
        t,
      ))
  )
    return { value: Math.sqrt(num(m[1]) * num(m[2])), pi: false };
  if (
    (m =
      /^In right triangle ABC, .* AD = (\d+) and DB = (\d+)\. What is the length of leg AC\?/.exec(
        t,
      ))
  )
    return {
      value: Math.sqrt(num(m[1]) * (num(m[1]) + num(m[2]))),
      pi: false,
    };
  if (
    (m =
      /^In right triangle ABC, .* AC = (\d+) and AB = (\d+)\. What is the length of AD\?/.exec(
        t,
      ))
  )
    return { value: num(m[1]) ** 2 / num(m[2]), pi: false };
  if (
    (m =
      /^In triangle ABC, D is on AB .* AD = (\d+), DB = (\d+) and AE = (\d+)\. What is the length of EC\?/.exec(
        t,
      ))
  )
    return { value: (num(m[2]) * num(m[3])) / num(m[1]), pi: false };
  if (
    (m =
      /^In triangle ABC, D is on AB .* AD = (\d+), AE = (\d+) and EC = (\d+)\. What is the length of DB\?/.exec(
        t,
      ))
  )
    return { value: (num(m[1]) * num(m[3])) / num(m[2]), pi: false };
  return undefined;
}

/** The dashed axis in a rotation figure: vertical or horizontal. */
function axisOf(p: GeneratedProblem): "vertical" | "horizontal" {
  const figure = p.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene");
  const axis = figure.scene.elements.find(
    (e) => e.type === "segment" && e.dash === "dash",
  );
  assert.ok(axis && axis.type === "segment");
  if (!axis || axis.type !== "segment") throw new Error("axis");
  return axis.from[0] === axis.to[0] ? "vertical" : "horizontal";
}

const all = geometryModelingTemplates.map((t) => t.id);

test("every variant of every template is reachable and deterministic", () => {
  for (const id of all) {
    const seen = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const a = geometryModelingCase(id, `reach:${seed}`);
      const b = geometryModelingCase(id, `reach:${seed}`);
      assert.deepEqual(a.problem, b.problem);
      seen.add(a.variant);
    }
    assert.equal(seen.size, geometryModelingVariantCounts[id], id);
  }
});

test("choices are four distinct, one correct, each wrong choice has feedback", () => {
  for (const id of all)
    for (let seed = 0; seed < 400; seed++) {
      const { problem } = geometryModelingCase(id, `choices:${seed}`);
      const options = choices(problem);
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map((o) => o.label)).size, 4);
      assert.ok(options.some((o) => o.id === problem.answer));
      for (const o of options)
        if (o.id !== problem.answer)
          assert.ok(
            (problem.choiceFeedback?.[o.id] ?? "").length > 20,
            `${id} ${o.label}`,
          );
      const label = correctLabel(problem);
      // A plain number that is also a given in the prompt is a coincidence, not a leak.
      const token = /\d+(\.\d+)?/.exec(label)?.[0] ?? "";
      const bounded = (text: string, what: string) =>
        /[\\$]/.test(what)
          ? text.includes(what)
          : new RegExp(
              `(^|[^\\d.])${what.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
            ).test(text);
      const isGiven =
        !/[\\$]/.test(label) &&
        new RegExp(`(^|[^\\d.])${token}([^\\d]|$)`).test(problem.public.prompt);
      if (!isGiven) {
        assert.ok(
          !bounded(problem.public.prompt, label),
          `${id} prompt: ${label}`,
        );
        assert.ok(!bounded(problem.hint, label), `${id} hint: ${label}`);
      }
      assert.ok(problem.hint.length > 40);
      assert.ok(problem.explanation.length >= 2);
      for (const o of options)
        assert.ok(!/undefined|NaN|Infinity/.test(o.label));
    }
});

test("numeric answers match an independent computation from the prompt", () => {
  const recognized = new Set<string>();
  for (const id of all)
    for (let seed = 0; seed < 400; seed++) {
      const { problem } = geometryModelingCase(id, `oracle:${seed}`);
      const want = expected(problem);
      if (want === undefined) continue;
      recognized.add(problem.public.prompt.slice(0, 22));
      const label = correctLabel(problem);
      if (typeof want === "string") {
        assert.equal(label, want);
        continue;
      }
      const got = read(label);
      assert.ok(got, `unreadable ${label}`);
      assert.equal(got!.pi, want.pi, `${id}: ${label}`);
      assert.ok(
        near(got!.value, want.value),
        `${id}: ${problem.public.prompt} -> ${label}, expected ${want.value}`,
      );
      // No wrong choice carries the same value as the correct one.
      for (const o of choices(problem)) {
        if (o.id === problem.answer) continue;
        const other = read(o.label);
        if (other && other.pi === want.pi && !/g\/cm³/.test(o.label))
          assert.ok(!near(other.value, want.value), `${id}: ${o.label}`);
      }
    }
  // 23 prompt families have an independent oracle here.
  assert.ok(recognized.size >= 22, `only ${recognized.size} families checked`);
});

test("design answers are the true optimum among the listed options", () => {
  const area = (l: number, w: number) => l * w;
  for (let seed = 0; seed < 400; seed++) {
    let { problem } = geometryModelingCase(
      "geometric-design-constraint",
      `design:${seed}`,
    );
    const t = problem.public.prompt;
    let m: RegExpExecArray | null;
    const options = choices(problem).map((o) => ({ id: o.id, label: o.label }));
    let score: ((label: string) => number) | undefined;
    if ((m = /^You have (\d+) m of fencing/.exec(t))) {
      score = (label) => {
        const [l, w] = label.match(/\d+/g)!.map(Number);
        assert.equal(2 * (l! + w!), Number(m![1]));
        return area(l!, w!);
      };
    } else if ((m = /^A box must hold exactly (\d+) cm³/.exec(t))) {
      score = (label) => {
        const [l, w, h] = label.match(/\d+/g)!.map(Number);
        assert.equal(l! * w! * h!, Number(m![1]));
        return -2 * (l! * w! + l! * h! + w! * h!);
      };
    } else if (
      (m = /^A rectangular garden .* You have (\d+) m of fence/.exec(t))
    ) {
      score = (label) => {
        const [w, l] = label.match(/\d+/g)!.map(Number);
        assert.equal(2 * w! + l!, Number(m![1]));
        return w! * l!;
      };
    }
    if (!score) continue;
    const values = options.map((o) => score!(o.label));
    const best = Math.max(...values);
    assert.equal(values.filter((v) => v === best).length, 1);
    assert.equal(options[values.indexOf(best)]!.id, problem.answer);
    problem = undefined as never;
  }
});

test("revolution answers follow the axis drawn in the figure", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const { problem, variant } = geometryModelingCase(
      "section-revolution-solid",
      `rev:${seed}`,
    );
    const t = problem.public.prompt;
    let m: RegExpExecArray | null;
    if ((m = /^A rectangle (\d+) cm wide and (\d+) cm tall/.exec(t))) {
      const [w, h] = [Number(m[1]), Number(m[2])];
      const [radius, height] = axisOf(problem) === "vertical" ? [w, h] : [h, w];
      seen.add(`rect-${axisOf(problem)}`);
      const label = correctLabel(problem);
      if (variant === 0)
        assert.equal(
          label,
          `A cylinder with radius ${radius} cm and height ${height} cm`,
        );
      else {
        const got = read(label)!;
        assert.ok(got.pi && near(got.value, radius * radius * height), label);
      }
    } else if (
      (m = /^A right triangle has legs of (\d+) cm and (\d+) cm/.exec(t))
    ) {
      const [a, b] = [Number(m[1]), Number(m[2])]; // a is the vertical leg
      const [height, radius] = axisOf(problem) === "vertical" ? [a, b] : [b, a];
      seen.add(`triangle-${axisOf(problem)}`);
      const label = correctLabel(problem);
      if (variant === 1)
        assert.equal(
          label,
          `A cone with radius ${radius} cm and height ${height} cm`,
        );
      else {
        const got = read(label)!;
        assert.ok(
          got.pi && near(got.value, (radius * radius * height) / 3),
          label,
        );
      }
    }
  }
  for (const key of [
    "rect-vertical",
    "rect-horizontal",
    "triangle-vertical",
    "triangle-horizontal",
  ])
    assert.ok(seen.has(key), key);
});

test("figures show exactly the givens", () => {
  for (let seed = 0; seed < 200; seed++) {
    const { problem } = geometryModelingCase(
      "similarity-theorem-length",
      `fig:${seed}`,
    );
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    const texts = figure.scene.elements.flatMap((e) =>
      e.type === "text" ? [e.text] : [],
    );
    const prompt = problem.public.prompt;
    const numbers = (prompt.match(/[A-Z]{2} = \d+/g) ?? []).map(
      (s) => s.split(" = ")[1],
    );
    for (const n of numbers)
      assert.ok(texts.includes(n!), `${n} missing in ${texts}`);
    // Every numeric label in the figure is a given in the prompt.
    for (const text of texts.filter((x) => /^\d+$/.test(x)))
      assert.ok(numbers.includes(text), `${text} is not a given in: ${prompt}`);
    const unknowns = texts.filter((x) => x === "?").length;
    assert.ok(unknowns <= 1);
  }
  for (let seed = 0; seed < 100; seed++) {
    const { problem } = geometryModelingCase(
      "cavalieri-volume-reasoning",
      `fig:${seed}`,
      0,
    );
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    const texts = figure.scene.elements.flatMap((e) =>
      e.type === "text" ? [e.text] : [],
    );
    const [, radius, height, slant] =
      /radius (\d+) cm\. Its perpendicular height is (\d+) cm and its slanted side is (\d+) cm/
        .exec(problem.public.prompt)!
        .map(Number) as unknown as [unknown, number, number, number];
    assert.deepEqual(
      [...texts].sort(),
      [
        `diameter ${2 * radius}`.concat(" cm"),
        `${height} cm`,
        `${slant} cm`,
      ].sort(),
    );
  }
});

test("engine reaches every template and lessons are bound", () => {
  for (const id of all) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    const problem = generateProblem(id, "engine:1");
    assert.equal(problem.public.templateId, id);
    assert.equal(problem.public.skillId, template!.skillId);
    assert.equal(template!.requiredResponseCapability, "single-choice-v1");
    for (const mode of ["library", "practice"] as const) {
      const lesson = problemLesson(id, mode);
      assert.ok(lesson.intuition && lesson.method.length >= 3, id);
      assert.ok(lesson.watch && lesson.principle, id);
      assert.ok(lesson.example.steps.length >= 2, id);
    }
  }
  assert.deepEqual(
    new Set(geometryModelingTemplates.map((t) => t.skillId)),
    new Set([
      "solid-volume-models",
      "density-modeling",
      "geometric-modeling",
      "geometric-design",
      "cavalieri-principle",
      "sections-and-revolutions",
      "similarity-theorems",
    ]),
  );
});
