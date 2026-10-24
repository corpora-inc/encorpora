import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { k8RepresentationCase } from "../src/math/k8-representations-practice";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";

const expected: Record<string, { skill: string; tags: string[] }> = {
  "proportional-graph": {
    skill: "proportional-relationships",
    tags: [
      "unit-rate",
      "point-meaning",
      "origin",
      "start-value",
      "is-proportional/through",
      "is-proportional/offset",
      "is-proportional/curve",
      "equation",
    ],
  },
  "story-graph-match": {
    skill: "qualitative-graphs",
    tags: [
      "graph-to-story",
      "story-to-description",
      "graph-to-description",
      "find-interval/up",
      "find-interval/flat",
      "find-interval/down",
      "fastest-slowest/fastest",
      "fastest-slowest/slowest",
    ],
  },
  "coordinate-context-points": {
    skill: "coordinate-first-quadrant",
    tags: [
      "read-meaning",
      "pair-from-story",
      "find-the-point",
      "compare-same-x",
    ],
  },
  "pattern-pair-relationship": {
    skill: "related-patterns",
    tags: [
      "nth-pair",
      "times-relationship",
      "plus-relationship",
      "predict-term",
    ],
  },
  "triangle-uniqueness": {
    skill: "triangle-construction",
    tags: [
      "ssa-two",
      "ssa-none",
      "ssa-right",
      "ssa-long",
      "ssa-obtuse",
      "which-set/sas",
      "which-set/asa",
      "which-set/sss",
    ],
  },
  "percent-applications": {
    skill: "percent-change",
    tags: [
      "tax-total",
      "tip-total",
      "commission-total",
      "markup-price",
      "markdown-price",
      "markdown-rate",
      "interest-amount",
      "interest-balance",
      "interest-rate",
      "percent-error",
    ],
  },
  "compound-event-simulation": {
    skill: "compound-probability",
    tags: [
      "sample-space/dice",
      "sample-space/coin-die",
      "sample-space/coins",
      "sample-space/spinners",
      "simulation/family",
      "simulation/free-throws",
      "experimental-vs-theoretical",
    ],
  },
};
const ids = Object.keys(expected);
const seeds = Array.from({ length: 400 }, (_, i) => `k8:${i}`);

function parts(id: string, seed: string) {
  const generated = generateProblem(id, seed);
  const response = generated.public.response;
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  const correct = response.options.find((o) => o.id === generated.answer)!;
  return { generated, response, labels, correct: correct.label, seed, id };
}
const tagOf = (id: string, seed: string) =>
  k8RepresentationCase(id, seed).tags.join("/");
const nums = (text: string) =>
  [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test("every family is deterministic, reaches every variant, and has one correct distinct choice", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (const seed of seeds) {
      const { generated, response, labels, correct } = parts(id, seed);
      assert.deepEqual(generateProblem(id, seed), generated);
      const direct = k8RepresentationCase(id, seed);
      assert.equal(direct.problem.answer, generated.answer);
      assert.equal(generated.public.skillId, expected[id]!.skill);
      assert.equal(new Set(labels).size, 4, `${id} ${seed}`);
      assert.equal(
        response.options.filter((o) => o.id === generated.answer).length,
        1,
      );
      assert.ok(
        generated.hint.length > 20 && generated.explanation.length >= 2,
      );
      assert.ok(
        !generated.public.prompt.includes(correct),
        `${id}: prompt leaks ${correct}`,
      );
      assert.ok(!generated.hint.includes(correct), `${id}: hint leaks`);
      for (const option of response.options)
        if (option.id !== generated.answer)
          assert.ok(
            generated.choiceFeedback?.[option.id],
            `${id}: missing feedback`,
          );
      seen.add(direct.tags.join("/"));
    }
    assert.deepEqual([...seen].sort(), [...expected[id]!.tags].sort(), id);
  }
});

test("templates, lessons, methods, principles and facet mappings are registered", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.equal(template?.skillId, expected[id]!.skill);
    assert.equal(template?.requiredResponseCapability, "single-choice-v1");
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      `${id} lesson`,
    );
    const view = problemLesson(id, "k8-lesson");
    assert.ok(
      view.intuition && view.method.length >= 3 && view.watch && view.principle,
    );
    assert.ok(view.example.steps.length >= 2);
    const mapping = actualFacetMappings.filter((m) => m.templateId === id);
    assert.equal(mapping.length, 1, `${id} facet mapping`);
    assert.equal(mapping[0]!.extent, "partial");
    assert.match(mapping[0]!.rationale, /Does not assess/);
  }
});

type GraphEl = {
  points?: { x: number; y: number; label?: string }[];
  curves?: { fn: { c: number[] } }[];
  segments?: { from: number[]; to: number[] }[];
};
const graphOf = (problem: ReturnType<typeof generateProblem>): GraphEl => {
  const figure = problem.public.figure as
    { kind: "scene"; scene: { elements: GraphEl[] } } | undefined;
  assert.equal(figure?.kind, "scene");
  return figure!.scene.elements[0]!;
};

test("proportional graphs agree with the plotted line and point", () => {
  let checked = 0;
  for (const seed of seeds) {
    const tag = tagOf("proportional-graph", seed);
    const { generated, correct, response } = parts("proportional-graph", seed);
    const g = graphOf(generated);
    const [b, m] =
      g.curves![0]!.fn.c.length === 2 ? g.curves![0]!.fn.c : [0, 0];
    if (tag === "unit-rate" || tag === "equation" || tag === "point-meaning") {
      const p = g.points![0]!;
      assert.equal(p.y, m! * p.x + b!);
      assert.equal(b, 0);
      if (tag === "unit-rate") assert.equal(nums(correct)[0], m);
      if (tag === "equation") assert.equal(nums(correct)[0], m);
      if (tag === "point-meaning") assert.deepEqual(nums(correct), [p.x, p.y]);
      checked++;
    }
    if (tag === "origin") assert.equal(b, 0);
    if (tag === "start-value") {
      assert.ok(b! > 0);
      assert.equal(g.points![0]!.y, b);
      assert.equal(nums(correct)[0], b);
    }
    if (tag.startsWith("is-proportional/")) {
      const proportional = g.curves![0]!.fn.c.length === 2 && b === 0;
      const says = correct.startsWith("Yes");
      assert.equal(says, proportional);
      assert.equal(response.options.length, 4);
    }
  }
  assert.ok(checked > 100);
});

test("story graphs: the right description follows the drawn segments", () => {
  const word = (d: number) =>
    d > 0 ? "increasing" : d < 0 ? "decreasing" : "constant";
  let described = 0;
  for (const seed of seeds) {
    const tag = tagOf("story-graph-match", seed);
    const { generated, correct, response } = parts("story-graph-match", seed);
    if (tag === "story-to-description") continue;
    const g = graphOf(generated);
    const deltas = g.segments!.map((s) => s.to[1]! - s.from[1]!);
    const x = g.segments!.map((s) => s.to[0]! - s.from[0]!);
    assert.ok(x.every((v) => v === 2));
    if (tag === "graph-to-description") {
      assert.equal(
        correct,
        `${deltas
          .map(word)
          .join(", then ")
          .replace(/^./, (c) => c.toUpperCase())}.`,
      );
      described++;
    }
    if (tag === "graph-to-story") {
      const phrases = [
        /away|fills|climbs/,
        /rest|same level|hovers/,
        /back|drains|descends/,
      ];
      const dir = (d: number) => (d > 0 ? 0 : d === 0 ? 1 : 2);
      const order = deltas.map(dir);
      let from = 0;
      for (const k of order) {
        const rest = correct.slice(from);
        const hit = phrases[k]!.exec(rest);
        assert.ok(hit, `${seed}: ${correct}`);
        from += hit!.index + hit![0].length;
      }
      // Other options must not describe the same order of directions.
      const same = response.options.filter((o) => {
        let at = 0;
        let ok = o.label.split(", then ").length === order.length;
        for (const k of order) {
          const hit = phrases[k]!.exec(o.label.slice(at));
          if (!hit) {
            ok = false;
            break;
          }
          at += hit.index + hit[0].length;
        }
        return ok;
      });
      assert.equal(same.length, 1);
    }
    if (tag.startsWith("find-interval/")) {
      const kind = tag.endsWith("up") ? 1 : tag.endsWith("down") ? -1 : 0;
      const matches = deltas.flatMap((d, i) =>
        Math.sign(d) === kind ? [i] : [],
      );
      assert.equal(matches.length, 1);
      const letters = ["O", "A", "B", "C", "D"];
      assert.equal(
        correct,
        `From ${letters[matches[0]!]} to ${letters[matches[0]! + 1]}`,
      );
    }
    if (tag.startsWith("fastest-slowest/")) {
      const mags = deltas.map(Math.abs);
      const target = tag.endsWith("fastest")
        ? Math.max(...mags)
        : Math.min(...mags.filter((v) => v > 0));
      const matches = mags.flatMap((v, i) => (v === target ? [i] : []));
      assert.equal(matches.length, 1);
      const letters = ["O", "A", "B", "C", "D"];
      assert.equal(
        correct,
        `From ${letters[matches[0]!]} to ${letters[matches[0]! + 1]}`,
      );
    }
  }
  assert.ok(described > 50);
});

test("coordinate points agree with the plotted points", () => {
  for (const seed of seeds) {
    const tag = tagOf("coordinate-context-points", seed);
    const { generated, correct } = parts("coordinate-context-points", seed);
    if (tag === "read-meaning") {
      const p = graphOf(generated).points![0]!;
      assert.deepEqual(nums(correct), [p.x, p.y]);
    }
    if (tag === "pair-from-story") {
      const story = nums(generated.public.prompt.split("Write")[0]!);
      assert.deepEqual(nums(correct), story);
    }
    if (tag === "find-the-point") {
      const g = graphOf(generated);
      const letter = correct.replace("Point ", "");
      const p = g.points!.find((q) => q.label === letter)!;
      const asked = nums(generated.public.prompt.split("situation:")[1]!);
      assert.deepEqual([p.x, p.y], asked);
      assert.equal(
        g.points!.filter((q) => q.x === asked[0] && q.y === asked[1]).length,
        1,
      );
    }
    if (tag === "compare-same-x") {
      const g = graphOf(generated);
      const [a, b] = g.points!;
      assert.equal(a!.x, b!.x);
      assert.equal(nums(correct)[0], b!.y - a!.y);
    }
  }
});

test("pattern relationships hold for every pair and for no wrong option", () => {
  for (const seed of seeds) {
    const tag = tagOf("pattern-pair-relationship", seed);
    const { generated, labels, correct } = parts(
      "pattern-pair-relationship",
      seed,
    );
    const prompt = generated.public.prompt;
    const rules = [...prompt.matchAll(/starts at (\d+) and adds (\d+)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    const term = (rule: readonly [number, number], n: number) =>
      rule[0] + (n - 1) * rule[1];
    if (tag === "nth-pair") {
      const n = Number(/the (\d+)th ordered pair/.exec(prompt)![1]);
      assert.deepEqual(nums(correct), [term(rules[0]!, n), term(rules[1]!, n)]);
    }
    if (tag === "times-relationship" || tag === "plus-relationship") {
      const holds = (label: string) => {
        const k = Number(/is (\d+) (times|more)/.exec(label)![1]);
        const times = label.includes("times");
        const aIsSecond = label.startsWith("Each term of A");
        for (let n = 1; n <= 12; n++) {
          const a = term(rules[0]!, n);
          const b = term(rules[1]!, n);
          const [x, y] = aIsSecond ? [b, a] : [a, b];
          if (times ? y !== k * x : y !== x + k) return false;
        }
        return true;
      };
      assert.deepEqual(labels.filter(holds), [correct]);
    }
    if (tag === "predict-term") {
      const n = Number(/the (\d+)th term of Pattern B/.exec(prompt)![1]);
      const k = Number(/is (\d+) times/.exec(prompt)![1]);
      assert.equal(Number(correct), k * term(rules[0]!, n));
    }
  }
});

type Count = 0 | 1 | 2 | "many";
/** Number of triangles with given parts, found by solving for the third side. */
function trianglesFor(text: string): Count {
  const angles = [...text.matchAll(/\\angle (\w) = (\d+)\^\\circ/g)].map(
    (m) => ({
      vertex: m[1]!,
      deg: Number(m[2]),
    }),
  );
  const sides = [...text.matchAll(/\$(\w)(\w) = (\d+)\$/g)].map((m) => ({
    ends: [m[1]!, m[2]!],
    len: Number(m[3]),
  }));
  if (sides.length === 3) {
    const [a, b, c] = sides.map((s) => s.len).sort((x, y) => x - y) as [
      number,
      number,
      number,
    ];
    return a + b > c ? 1 : 0;
  }
  if (angles.length === 3)
    return angles.reduce((s, x) => s + x.deg, 0) === 180 ? "many" : 0;
  if (angles.length === 2) {
    return angles[0]!.deg + angles[1]!.deg < 180 ? 1 : 0;
  }
  const [{ vertex, deg }] = angles as [{ vertex: string; deg: number }];
  const included = sides.every((s) => s.ends.includes(vertex));
  if (included) return deg < 180 ? 1 : 0;
  // Side adjacent to the angle (b) and side opposite it (a): a^2 = b^2 + c^2 - 2bc cos A.
  const adjacent = sides.find((s) => s.ends.includes(vertex))!.len;
  const opposite = sides.find((s) => !s.ends.includes(vertex))!.len;
  const cosA = Math.cos((deg * Math.PI) / 180);
  const disc = (adjacent * cosA) ** 2 - (adjacent ** 2 - opposite ** 2);
  if (disc < -1e-9) return 0;
  const roots =
    Math.abs(disc) < 1e-9
      ? [adjacent * cosA]
      : [adjacent * cosA + Math.sqrt(disc), adjacent * cosA - Math.sqrt(disc)];
  return roots.filter((c) => c > 1e-9).length as Count;
}
const countLabel: Record<string, Count> = {
  "No triangle": 0,
  "Exactly one triangle": 1,
  "Exactly two different triangles": 2,
  "Infinitely many triangles of different sizes": "many",
};

test("triangle counts agree with solving the third side independently", () => {
  for (const seed of seeds) {
    const tag = tagOf("triangle-uniqueness", seed);
    const { generated, correct, response } = parts("triangle-uniqueness", seed);
    if (tag.startsWith("which-set")) {
      const unique = response.options.filter(
        (o) => trianglesFor(o.label) === 1,
      );
      assert.deepEqual(
        unique.map((o) => o.label),
        [correct],
        seed,
      );
    } else {
      const given = generated.public.prompt
        .split("has ")[1]!
        .split(". Side")[0]!;
      assert.equal(
        countLabel[correct],
        trianglesFor(given),
        `${seed} ${given}`,
      );
    }
  }
});

const cents = (label: string) =>
  Math.round(Number(label.replace(/ dollars?$/, "")) * 100);
const frac = (label: string) => {
  const t = /\\frac\{(\d+)\}\{(\d+)\}/.exec(label);
  return t ? Number(t[1]) / Number(t[2]) : Number(label.replace(/\$/g, ""));
};
const percentValue = (label: string) => {
  const m = /^\$?(\d*)\\frac\{(\d+)\}\{(\d+)\}\\%\$$/.exec(label);
  if (m) return Number(m[1] || 0) + Number(m[2]) / Number(m[3]);
  return Number(label.replace("%", ""));
};

test("percent applications agree with exact integer arithmetic", () => {
  for (const seed of seeds) {
    const tag = tagOf("percent-applications", seed);
    const { generated, correct } = parts("percent-applications", seed);
    const p = generated.public.prompt;
    const n = nums(p);
    switch (tag) {
      case "tax-total":
      case "tip-total":
      case "markup-price": {
        const [price, rate] = n as [number, number];
        assert.equal(cents(correct), price * (100 + rate));
        break;
      }
      case "markdown-price": {
        const [price, rate] = n as [number, number];
        assert.equal(cents(correct), price * (100 - rate));
        break;
      }
      case "commission-total": {
        const [base, rate, sales] = n as [number, number, number];
        assert.equal(cents(correct), base * 100 + sales * rate);
        break;
      }
      case "markdown-rate": {
        const [orig, now] = n as [number, number];
        assert.equal(percentValue(correct), ((orig - now) / orig) * 100);
        break;
      }
      case "interest-amount":
      case "interest-balance": {
        const [principal, rate, years] = n as [number, number, number];
        const interest = (principal * rate * years) / 100;
        assert.equal(
          cents(correct),
          (tag === "interest-amount" ? interest : principal + interest) * 100,
        );
        break;
      }
      case "interest-rate": {
        const [principal, years, interest] = n as [number, number, number];
        assert.equal(percentValue(correct) * principal * years, interest * 100);
        break;
      }
      case "percent-error": {
        const [measured, actual] = n as [number, number];
        assert.ok(
          Math.abs(
            percentValue(correct) -
              (Math.abs(measured - actual) / actual) * 100,
          ) < 1e-9,
        );
        break;
      }
    }
  }
});

test("compound-event answers agree with direct counting and comparison", () => {
  const events: Record<string, (o: string[]) => boolean> = {
    "the sum is 5": (o) => +o[0]! + +o[1]! === 5,
    "the sum is at least 6": (o) => +o[0]! + +o[1]! >= 6,
    "the product is even": (o) => (+o[0]! * +o[1]!) % 2 === 0,
    "both dice show the same number": (o) => o[0] === o[1],
    "the coin shows heads and the die shows an even number": (o) =>
      o[0] === "H" && +o[1]! % 2 === 0,
    "the coin shows tails or the die shows 6": (o) =>
      o[0] === "T" || o[1] === "6",
    "the coin shows heads and the die shows at least 5": (o) =>
      o[0] === "H" && +o[1]! >= 5,
    "exactly 2 flips show heads": (o) =>
      o.filter((v) => v === "H").length === 2,
    "at least 1 flip shows tails": (o) => o.includes("T"),
    "all 3 flips show the same side": (o) => o.every((v) => v === o[0]),
    "the first and last flips are different": (o) => o[0] !== o[2],
    "spinner 1 lands on red and spinner 2 lands on an even number": (o) =>
      o[0] === "red" && +o[1]! % 2 === 0,
    "spinner 1 does not land on red and spinner 2 lands on a number greater than 2":
      (o) => o[0] !== "red" && +o[1]! > 2,
  };
  const spaces: Record<string, string[][]> = {};
  const all = (...sets: string[][]) =>
    sets.reduce<string[][]>(
      (acc, s) => acc.flatMap((o) => s.map((v) => [...o, v])),
      [[]],
    );
  const n = (k: number) => Array.from({ length: k }, (_, i) => `${i + 1}`);
  spaces["Two fair 4-sided"] = all(n(4), n(4));
  spaces["A fair coin is flipped and"] = all(["H", "T"], n(6));
  spaces["A fair coin is flipped 3"] = all(["H", "T"], ["H", "T"], ["H", "T"]);
  spaces["Spinner 1"] = all(["red", "blue", "green"], n(4));
  const spaceFor = (prompt: string) =>
    spaces[Object.keys(spaces).find((k) => prompt.startsWith(k))!]!;
  const eventIn = (prompt: string) =>
    Object.keys(events)
      .filter((e) => prompt.includes(e))
      .sort((a, b) => b.length - a.length)[0]!;
  let sims = 0;
  for (const seed of seeds) {
    const tag = tagOf("compound-event-simulation", seed);
    const { generated, correct, response } = parts(
      "compound-event-simulation",
      seed,
    );
    const prompt = generated.public.prompt;
    if (tag.startsWith("sample-space")) {
      const space = spaceFor(prompt);
      const hit = space.filter(events[eventIn(prompt)]!).length;
      assert.ok(
        Math.abs(frac(correct) - hit / space.length) < 1e-12,
        `${seed} ${prompt}`,
      );
      for (const o of response.options)
        if (o.label !== correct)
          assert.ok(frac(o.label) > 0 && frac(o.label) < 1);
    } else if (tag.startsWith("simulation")) {
      const trials = /trials: ([\d, ]+)\. Based/.exec(prompt)![1]!.split(", ");
      assert.equal(trials.length, 20);
      const digits = tag.endsWith("family") ? 3 : 2;
      const mark = tag.endsWith("family")
        ? (d: number) => d % 2 === 0
        : (d: number) => d <= 5;
      const test: Record<string, (m: number) => boolean> = {
        "the family has exactly 2 girls": (m) => m === 2,
        "the family has at least 2 girls": (m) => m >= 2,
        "the family has at least 1 girl": (m) => m >= 1,
        "all 3 children are the same": (m) => m === 0 || m === 3,
        "the player makes both shots": (m) => m === 2,
        "the player makes at least 1 shot": (m) => m >= 1,
        "the player makes exactly 1 shot": (m) => m === 1,
      };
      const key = Object.keys(test).find((k) => prompt.includes(`that ${k}?`))!;
      const hits = trials.filter((t) => {
        assert.equal(t.length, digits);
        return test[key]!([...t].map(Number).filter(mark).length);
      }).length;
      assert.ok(Math.abs(frac(correct) - hits / 20) < 1e-12);
      sims++;
    } else {
      const [obs, trials] = /happened (\d+) times|In (\d+) trials/.exec(prompt)
        ? [
            Number(/this happened (\d+) times/.exec(prompt)![1]),
            Number(/In (\d+) trials/.exec(prompt)![1]),
          ]
        : [0, 1];
      const theory = frac(
        /theoretical probability that .* is (\$\\frac\{\d+\}\{\d+\}\$|\$1\$)\./.exec(
          prompt,
        )![1]!,
      );
      const relation =
        obs / trials > theory + 1e-12
          ? "greater than"
          : obs / trials < theory - 1e-12
            ? "less than"
            : "equal to";
      assert.ok(correct.includes(`is ${relation} the theoretical`), `${seed}`);
    }
  }
  assert.ok(sims > 50);
});
