import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, pick, seeded, shuffle } from "./algebra-one-kit";
import type { Case, Choice, Random } from "./algebra-one-kit";
import { act, f, graph, step } from "./scene/author";
import type { Scene } from "./scene/spec";

/** Elementary and middle-school representation tasks: proportional graphs,
 * qualitative graphs of stories, first-quadrant points in context, paired
 * patterns, triangle uniqueness, percent applications and compound-event
 * simulation. Every answer is chosen from four options; each wrong option
 * is a specific misconception with feedback. */

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };

export const k8RepresentationTemplates: readonly TemplateMetadata[] = [
  {
    id: "proportional-graph",
    version: 1,
    title: "Read a proportional graph",
    skillId: "proportional-relationships",
    gradeBand: "6–8",
    difficultyOffset: 0.1,
    description:
      "Read the unit rate and the meaning of points, including (0, 0), from a graph; decide whether a graph shows a proportional relationship.",
    ...choice,
    ...scenes,
  },
  {
    id: "story-graph-match",
    version: 1,
    title: "Match a story to a graph",
    skillId: "qualitative-graphs",
    gradeBand: "6–8",
    difficultyOffset: 0,
    description:
      "Match a story to a graph without a scale by where the quantity increases, decreases or stays constant, and find where it changes fastest or slowest.",
    ...choice,
    ...scenes,
  },
  {
    id: "coordinate-context-points",
    version: 1,
    title: "Points in a real-world graph",
    skillId: "coordinate-first-quadrant",
    gradeBand: "3–5",
    difficultyOffset: 0.15,
    description:
      "Say what a first-quadrant point means in a situation, choose the point or ordered pair that fits a situation, and compare two points.",
    ...choice,
    ...scenes,
  },
  {
    id: "pattern-pair-relationship",
    version: 1,
    title: "Two patterns made from two rules",
    skillId: "related-patterns",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    description:
      "Build matching terms from two rules that may start above 0, write them as ordered pairs, and use the relationship between corresponding terms.",
    ...choice,
  },
  {
    id: "triangle-uniqueness",
    version: 1,
    title: "How many triangles fit these measures",
    skillId: "triangle-construction",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    description:
      "Decide whether two sides and a non-included angle, or other sets of measures, give no triangle, one triangle or two, and which set fixes exactly one.",
    ...choice,
  },
  {
    id: "percent-applications",
    version: 1,
    title: "Percent in tax, tips, sales and interest",
    skillId: "percent-change",
    gradeBand: "6–8",
    difficultyOffset: 0.05,
    description:
      "Solve exact one-step percent applications: sales tax, tips, commission, markup, markdown, simple interest and percent error.",
    ...choice,
  },
  {
    id: "compound-event-simulation",
    version: 1,
    title: "Sample spaces and simulations",
    skillId: "compound-probability",
    gradeBand: "6–8",
    difficultyOffset: 0.15,
    description:
      "Find a compound-event probability from its sample space, estimate one from random-digit trials, and compare experimental with theoretical probability.",
    ...choice,
  },
];

// ------------------------------------------------------------------ helpers
type Wrong = [label: string, feedback: string];
type Built = Case & { model: Record<string, unknown> };
const M = (t: string | number) => `$${t}$`;
/** Four options: the correct one and the first three distinct wrong ones. */
function options(correct: string, wrong: Wrong[]): Choice[] {
  const seen = new Set([correct]);
  const out: Choice[] = [];
  for (const [label, feedback] of wrong)
    if (!seen.has(label) && out.length < 3) {
      seen.add(label);
      out.push({ label, feedback });
    }
  if (out.length < 3)
    throw new Error(
      `Fewer than three distinct wrong options for ${correct}: ${wrong.map((w) => w[0]).join(" | ")}`,
    );
  return [{ label: correct, correct: true }, ...out];
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** A fraction in lowest terms as TeX. */
const fracTex = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? `${n / g}` : `\\frac{${n / g}}{${d / g}}`;
};
/** "1 week", "2 weeks". */
const u = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A nice gridline step and top value for a vertical axis reaching `max`. */
function yWindow(max: number) {
  const stepSize = max <= 12 ? 2 : max <= 30 ? 5 : 10;
  return { step: stepSize, max: Math.ceil(max / stepSize) * stepSize };
}
const hintPoint = (caption: string, target = "g.point.0") => [
  step(caption, act.highlight(target)),
];

// ============================================================ proportional-graph
type PropCtx = {
  story: string;
  xAxis: string;
  yAxis: string;
  per: string;
  one: string;
  at: (x: number, y: number) => string;
};
const propContexts: PropCtx[] = [
  {
    story: "A cyclist rides at a steady speed.",
    xAxis: "hours",
    yAxis: "miles",
    per: "miles per hour",
    one: "hour",
    at: (x, y) => `In ${u(x, "hour")} the cyclist rides ${u(y, "mile")}.`,
  },
  {
    story: "Apples are sold at one price for each pound.",
    xAxis: "pounds",
    yAxis: "dollars",
    per: "dollars per pound",
    one: "pound",
    at: (x, y) => `${u(x, "pound")} of apples cost ${u(y, "dollar")}.`,
  },
  {
    story: "A pump fills a tank at a steady rate.",
    xAxis: "minutes",
    yAxis: "liters",
    per: "liters per minute",
    one: "minute",
    at: (x, y) => `In ${u(x, "minute")} the pump adds ${u(y, "liter")}.`,
  },
  {
    story: "A printer prints at a steady rate.",
    xAxis: "minutes",
    yAxis: "pages",
    per: "pages per minute",
    one: "minute",
    at: (x, y) => `In ${u(x, "minute")} the printer prints ${u(y, "page")}.`,
  },
];
const startContexts = [
  {
    story:
      "A taxi charges a fixed fee when the ride starts plus a price for each mile.",
    xAxis: "miles",
    yAxis: "dollars",
    meaning: (b: number) =>
      `The fixed fee is ${u(b, "dollar")}, charged before any mile is driven.`,
    wrong: (b: number): Wrong[] => [
      [
        `Each mile costs ${u(b, "dollar")}.`,
        "A price for each mile is the steepness of the line. This point is at 0 miles, so it shows what is paid before any mile.",
      ],
      [
        "The ride costs nothing at 0 miles.",
        "The point is above 0 on the vertical axis, so there is already a cost at 0 miles.",
      ],
      [
        `The ride is ${u(b, "mile")} long.`,
        "The 0 is the number of miles. The second number is the cost.",
      ],
    ],
  },
  {
    story:
      "A gym charges a joining fee when you sign up plus a price for each month.",
    xAxis: "months",
    yAxis: "dollars",
    meaning: (b: number) =>
      `The joining fee is ${u(b, "dollar")}, paid before the first month.`,
    wrong: (b: number): Wrong[] => [
      [
        `Each month costs ${u(b, "dollar")}.`,
        "A price for each month is the steepness of the line. This point is at 0 months, so it shows what is paid at sign-up.",
      ],
      [
        "Nothing is paid at 0 months.",
        "The point is above 0 on the vertical axis, so a cost already exists at 0 months.",
      ],
      [
        `The membership lasts ${u(b, "month")}.`,
        "The 0 is the number of months. The second number is the cost.",
      ],
    ],
  },
];

function lineScene(
  ctx: { xAxis: string; yAxis: string },
  m: number,
  b: number,
  labeled: [number, number][],
  curved = false,
): Scene {
  const top = curved ? 0.5 * 36 : 6 * m + b;
  const w = yWindow(top);
  let g = graph({
    id: "g",
    x: [0, 6],
    y: [0, w.max],
    grid: [1, w.step],
    tick: [1, w.step],
    axisNames: [ctx.xAxis, ctx.yAxis],
  }).curve(curved ? f.poly(0.5, 0, 0) : f.poly(m, b), {
    domain: [0, 6],
    ends: ["none", "arrow"],
  });
  for (const [x, y] of labeled) g = g.point(x, y, `(${x}, ${y})`);
  return g.scene({ title: "A graph of a relationship" });
}

function proportionalGraph(r: Random): Built {
  const variant = pick(r, [
    "unit-rate",
    "point-meaning",
    "origin",
    "start-value",
    "is-proportional",
    "equation",
  ] as const);
  if (variant === "start-value") {
    const ctx = pick(r, startContexts);
    const m = r(2, 4),
      b = r(2, 6);
    const scene = lineScene(ctx, m, b, [[0, b]]);
    const correct = ctx.meaning(b);
    return {
      prompt: `${ctx.story} The graph shows the cost in ${ctx.yAxis} for different numbers of ${ctx.xAxis}. What does the labeled point ${M(`(0, ${b})`)} mean?`,
      choices: options(correct, ctx.wrong(b)),
      scene,
      explanation: [
        `The first number of a point is on the horizontal axis. Here it is 0 ${ctx.xAxis}.`,
        `The second number is ${b} ${ctx.yAxis}. So at 0 ${ctx.xAxis}, the cost is already ${b} ${ctx.yAxis}.`,
        correct,
      ],
      hint: `Read the labeled point as (${ctx.xAxis}, ${ctx.yAxis}). Say in words how many ${ctx.xAxis} it is, then what the graph says is already paid.`,
      hintCue: hintPoint("The labeled point is on the vertical axis."),
      tags: [variant],
      model: { m, b },
    };
  }
  if (variant === "is-proportional") {
    const ctx = pick(r, propContexts);
    const kind = pick(r, ["through", "offset", "curve"] as const);
    const m = r(2, 3),
      b = r(2, 6);
    const scene = lineScene(
      ctx,
      kind === "curve" ? 0 : m,
      kind === "offset" ? b : 0,
      [],
      kind === "curve",
    );
    const statements = {
      line: "Yes. It is a straight line through $(0, 0)$.",
      offset:
        "No. It is a straight line, but it does not pass through $(0, 0)$.",
      curve: "No. It passes through $(0, 0)$, but it is not a straight line.",
      rising: "Yes. The values go up as the horizontal values go up.",
    };
    const truth =
      kind === "through" ? "line" : kind === "offset" ? "offset" : "curve";
    const why: Record<string, Record<string, string>> = {
      through: {
        offset:
          "This line does pass through (0, 0): with 0 of the first quantity there is 0 of the second.",
        curve: "The graph is a straight line, not curved.",
        rising:
          "Going up is not the test. A proportional graph is a straight line through (0, 0), and this one is.",
      },
      offset: {
        line: "A straight line is proportional only if it also passes through (0, 0). This line crosses the vertical axis above 0.",
        curve:
          "The graph is a straight line. It fails because it misses (0, 0).",
        rising:
          "Going up is not the test. This line rises but starts above 0, so it is not proportional.",
      },
      curve: {
        line: "The graph is curved, not a straight line.",
        offset:
          "The graph does pass through (0, 0). It fails because it is curved.",
        rising:
          "Going up is not the test. This graph rises but is curved, so it is not proportional.",
      },
    };
    const wrong = (Object.keys(statements) as (keyof typeof statements)[])
      .filter((k) => k !== truth)
      .map((k): Wrong => [statements[k], why[kind]![k]!]);
    const answer = statements[truth];
    return {
      prompt: `The graph shows ${ctx.yAxis} compared with ${ctx.xAxis}. Is it a proportional relationship?`,
      choices: options(answer, wrong),
      scene,
      explanation: [
        "A relationship is proportional when its graph is a straight line that passes through (0, 0).",
        kind === "through"
          ? "This graph is a straight line and it passes through (0, 0)."
          : kind === "offset"
            ? `This graph is a straight line, but it crosses the vertical axis at ${b}, not at 0.`
            : "This graph passes through (0, 0) but bends, so it is not a straight line.",
        answer,
      ],
      hint: `Check two things about the graph of ${ctx.yAxis} against ${ctx.xAxis}: is it a straight line, and where does it meet the vertical axis?`,
      tags: [variant, kind],
      model: { kind, m, b },
    };
  }
  const ctx = pick(r, propContexts);
  const rate = r(2, 5),
    k = r(2, 5);
  const y = k * rate;
  const scene = lineScene(
    ctx,
    rate,
    0,
    variant === "origin" ? [[0, 0]] : [[k, y]],
  );
  if (variant === "origin") {
    const correct = `With 0 ${ctx.xAxis} there are 0 ${ctx.yAxis}.`;
    return {
      prompt: `${ctx.story} The graph shows ${ctx.yAxis} for different numbers of ${ctx.xAxis}. What does the labeled point ${M("(0, 0)")} mean?`,
      choices: options(correct, [
        [
          `The rate is 0 ${ctx.per}.`,
          "The rate is how steep the line is. The line rises, so the rate is not 0. This point only shows the start.",
        ],
        [
          `The relationship is not proportional because it starts at 0.`,
          "Starting at (0, 0) is what a proportional relationship does: none of the first quantity goes with none of the second.",
        ],
        [
          `A fixed amount of ${ctx.yAxis} is there before any ${ctx.xAxis}.`,
          "A fixed starting amount would put the point above 0 on the vertical axis. Here the second number is 0.",
        ],
      ]),
      scene,
      explanation: [
        `Read the point as (${ctx.xAxis}, ${ctx.yAxis}): 0 ${ctx.xAxis} and 0 ${ctx.yAxis}.`,
        `${correct} Every proportional graph includes this point.`,
      ],
      hint: `Say what each number of the point means: the first is ${ctx.xAxis}, the second is ${ctx.yAxis}. Then ask what that says about the start.`,
      hintCue: hintPoint("This point is where the two axes meet."),
      tags: [variant],
      model: { rate },
    };
  }
  const label = `(${k}, ${y})`;
  if (variant === "unit-rate") {
    const correct = `${rate} ${ctx.per}`;
    return {
      prompt: `${ctx.story} The graph shows ${ctx.yAxis} for different numbers of ${ctx.xAxis}. What is the unit rate, the number of ${ctx.yAxis} for 1 ${ctx.one}?`,
      choices: options(correct, [
        [
          `${y} ${ctx.per}`,
          `${y} is the ${ctx.yAxis} for ${k} ${ctx.xAxis}, not for 1.`,
        ],
        [
          `${k} ${ctx.per}`,
          `${k} is the number of ${ctx.xAxis} at the labeled point, not the amount for each 1.`,
        ],
        [
          `${y - k} ${ctx.per}`,
          "Subtracting the coordinates does not give a rate. Divide the second number by the first.",
        ],
        [
          `${rate + 1} ${ctx.per}`,
          "Divide the second number of the point by the first number to get the amount for 1.",
        ],
        [
          `${y + k} ${ctx.per}`,
          "Adding the coordinates does not give a rate. Divide the second number by the first.",
        ],
      ]),
      scene,
      explanation: [
        `The labeled point ${M(label)} means ${k} ${ctx.xAxis} go with ${y} ${ctx.yAxis}.`,
        `The unit rate is ${y} ÷ ${k} = ${rate}. The graph passes through ${M(`(1, ${rate})`)}.`,
        `The unit rate is ${correct}.`,
      ],
      hint: `The labeled point ${M(label)} shows how many ${ctx.yAxis} go with ${k} ${ctx.xAxis}. Share that amount equally among the ${k}.`,
      hintCue: hintPoint(`Use the labeled point ${label}.`),
      tags: [variant],
      model: { rate, k, y },
    };
  }
  if (variant === "point-meaning") {
    const correct = ctx.at(k, y);
    return {
      prompt: `${ctx.story} The graph shows ${ctx.yAxis} for different numbers of ${ctx.xAxis}. What does the labeled point ${M(label)} mean?`,
      choices: options(correct, [
        [
          ctx.at(y, k),
          "The first number is on the horizontal axis. Read the pair as (first quantity, second quantity).",
        ],
        [
          `The unit rate is ${y} ${ctx.per}.`,
          `${y} is a total for ${k} ${ctx.xAxis}. A unit rate is the amount for 1.`,
        ],
        [
          `Every ${ctx.xAxis.replace(/s$/, "")} adds ${k} ${ctx.yAxis}.`,
          `${k} is the number of ${ctx.xAxis} at this point, not the amount added by each 1.`,
        ],
        [ctx.at(k, y + k), `Read the second number exactly: it is ${y}.`],
      ]),
      scene,
      explanation: [
        `Read ${M(label)} as (${ctx.xAxis}, ${ctx.yAxis}).`,
        `The first number is ${k} ${ctx.xAxis}; the second is ${y} ${ctx.yAxis}.`,
        correct,
      ],
      hint: `The horizontal axis is ${ctx.xAxis} and the vertical axis is ${ctx.yAxis}. Say the first number with its unit, then the second.`,
      hintCue: hintPoint(`Read the labeled point ${label}.`),
      tags: [variant],
      model: { rate, k, y },
    };
  }
  const correct = M(`y = ${rate}x`);
  return {
    prompt: `${ctx.story} Let ${M("x")} be the number of ${ctx.xAxis} and ${M("y")} the number of ${ctx.yAxis}. Which equation matches the graph?`,
    choices: options(correct, [
      [
        M(`y = ${y}x`),
        `${y} is the value of ${M("y")} at the labeled point. The number that multiplies ${M("x")} is the amount for 1.`,
      ],
      [
        M(`y = \\frac{x}{${rate}}`),
        `This divides by the rate. At ${M(`x = ${k}`)} it gives ${fracTex(k, rate)}, not ${y}.`,
      ],
      [
        M(`y = x + ${rate}`),
        `A proportional graph multiplies ${M("x")}. This equation gives ${k + rate} at ${M(`x = ${k}`)}, not ${y}.`,
      ],
      [
        M(`y = ${k}x`),
        `Check the point: ${k} times ${k} is ${k * k}, not ${y}.`,
      ],
    ]),
    scene,
    explanation: [
      `The labeled point ${M(label)} gives the rate ${y} ÷ ${k} = ${rate} ${ctx.per}.`,
      `A proportional relationship has the form ${M("y = rx")} where ${M("r")} is the unit rate, so ${correct}.`,
      `Check: ${M(`${rate} \\cdot ${k} = ${y}`)}.`,
    ],
    hint: `A proportional relationship is ${M("y = rx")} for one fixed number ${M("r")}. Use the labeled point ${M(label)} to find ${M("r")}.`,
    hintCue: hintPoint(`Use the labeled point ${label}.`),
    tags: [variant],
    model: { rate, k, y },
  };
}

// ============================================================ story-graph-match
type Dir = "up" | "flat" | "down";
const dirOf = (d: number): Dir => (d > 0 ? "up" : d < 0 ? "down" : "flat");
const dirWord: Record<Dir, string> = {
  up: "increasing",
  flat: "constant",
  down: "decreasing",
};
const storyContexts = [
  {
    quantity: "distance from home",
    intro: "Ana",
    phrase: {
      up: "walks away from home",
      flat: "stops to rest",
      down: "walks back toward home",
    },
  },
  {
    quantity: "amount of water in a tub",
    intro: "A tub",
    phrase: {
      up: "fills with water",
      flat: "stays at the same level",
      down: "drains",
    },
  },
  {
    quantity: "height above the ground",
    intro: "A drone",
    phrase: { up: "climbs", flat: "hovers", down: "descends" },
  },
] as const;
const nodeNames = ["O", "A", "B", "C", "D"];

/** Heights at x = 0, 2, 4, … that change by −4, −2, 0, 2 or 4 each step. */
function walk(
  r: Random,
  n: number,
  ok: (deltas: number[]) => boolean,
): number[] {
  for (;;) {
    let y = r(0, 8);
    const ys = [y];
    const deltas: number[] = [];
    for (let i = 0; i < n; i++) {
      const d = pick(r, [-4, -2, 0, 2, 4]);
      if (y + d < 0 || y + d > 8) break;
      y += d;
      ys.push(y);
      deltas.push(d);
    }
    if (deltas.length === n && ok(deltas)) return ys;
  }
}
function pathScene(ys: number[], quantity: string, letters: boolean): Scene {
  let g = graph({
    id: "g",
    x: [0, 2 * (ys.length - 1)],
    y: [0, 8],
    grid: false,
    labels: "none",
    axisNames: ["time", quantity],
  });
  for (let i = 0; i + 1 < ys.length; i++)
    g = g.segment([2 * i, ys[i]!], [2 * i + 2, ys[i + 1]!]);
  if (letters) ys.forEach((y, i) => (g = g.point(2 * i, y, nodeNames[i])));
  return g.scene({ title: "A graph with no scale" });
}
const deltasOf = (ys: number[]) => ys.slice(1).map((y, i) => y - ys[i]!);
const adjacentDirsDiffer = (d: number[]) =>
  d.every((v, i) => i === 0 || dirOf(v) !== dirOf(d[i - 1]!));

/** All direction sequences of length n with different neighbors, but `seq`. */
function otherSequences(seq: Dir[]): Dir[][] {
  const all: Dir[][] = [[]];
  for (let i = 0; i < seq.length; i++) {
    const next: Dir[][] = [];
    for (const s of all)
      for (const d of ["up", "flat", "down"] as Dir[])
        if (s[i - 1] !== d) next.push([...s, d]);
    all.splice(0, all.length, ...next);
  }
  return all.filter((s) => s.join() !== seq.join());
}
function sequenceFeedback(seq: Dir[], wrong: Dir[]) {
  const i = wrong.findIndex((d, j) => d !== seq[j]);
  const ord = ["first", "second", "third", "fourth"][i]!;
  return `Check the ${ord} piece from the left. The graph is ${dirWord[seq[i]!]} there, but this choice says ${dirWord[wrong[i]!]}.`;
}

function storyGraphMatch(r: Random): Built {
  const variant = pick(r, [
    "graph-to-story",
    "story-to-description",
    "graph-to-description",
    "find-interval",
    "fastest-slowest",
  ] as const);
  const ctx = pick(r, storyContexts);
  const storyOf = (seq: Dir[]) =>
    `${ctx.intro} ${seq.map((d) => ctx.phrase[d]).join(", then ")}.`;
  const describe = (seq: Dir[]) =>
    `${cap(seq.map((d) => dirWord[d]).join(", then "))}.`;
  if (
    variant === "graph-to-story" ||
    variant === "story-to-description" ||
    variant === "graph-to-description"
  ) {
    const ys = walk(r, 3, (d) => adjacentDirsDiffer(d));
    const seq = deltasOf(ys).map(dirOf);
    const wrongs = shuffle(r, otherSequences(seq)).slice(0, 3);
    const asText = variant === "graph-to-story" ? storyOf : describe;
    const wrong: Wrong[] = wrongs.map((w) => [
      asText(w),
      sequenceFeedback(seq, w),
    ]);
    const showGraph = variant !== "story-to-description";
    const prompt =
      variant === "graph-to-story"
        ? `The graph shows the ${ctx.quantity} over time. Which story matches the graph?`
        : variant === "graph-to-description"
          ? `Which description fits the graph of the ${ctx.quantity} over time, read from left to right?`
          : `${storyOf(seq)} Which description fits the graph of the ${ctx.quantity} over time, read from left to right?`;
    const correct = asText(seq);
    return {
      prompt,
      choices: options(correct, wrong),
      ...(showGraph ? { scene: pathScene(ys, ctx.quantity, false) } : {}),
      explanation: [
        "Read the graph from left to right and name each piece: a line that goes up is increasing, level is constant, and going down is decreasing.",
        `In order, the pieces are ${seq.map((d) => dirWord[d]).join(", then ")}.`,
        `${correct}`,
      ],
      hint:
        variant === "story-to-description"
          ? `The story has ${seq.length} parts. For each part decide whether the ${ctx.quantity} goes up, stays the same or goes down, and keep the order.`
          : `The graph has ${seq.length} pieces. Starting at the left, describe each as going up, level or going down, and keep the order.`,
      tags: [variant],
      model: { seq },
    };
  }
  const rate = variant === "fastest-slowest";
  const slow = rate && r(0, 1) === 1;
  const kind = pick(r, ["up", "flat", "down"] as Dir[]);
  const ys = walk(r, 4, (d) => {
    if (!rate)
      return (
        adjacentDirsDiffer(d) && d.filter((v) => dirOf(v) === kind).length === 1
      );
    const mags = d.map(Math.abs);
    const target = slow ? 2 : 4;
    return (
      d.every((v, i) => i === 0 || v !== d[i - 1]) &&
      mags.filter((m) => m === target).length === 1 &&
      mags.some((m) => m !== 0 && m !== target)
    );
  });
  const deltas = deltasOf(ys);
  const target = rate ? (slow ? 2 : 4) : 0;
  const answerIndex = rate
    ? deltas.findIndex((d) => Math.abs(d) === target)
    : deltas.findIndex((d) => dirOf(d) === kind);
  const name = (i: number) => `From ${nodeNames[i]} to ${nodeNames[i + 1]}`;
  const partName = (i: number) =>
    `the part from ${nodeNames[i]} to ${nodeNames[i + 1]}`;
  const prompt = rate
    ? `The graph shows the ${ctx.quantity} over time. On which part is it changing ${slow ? "most slowly, but still changing" : "most quickly"}? Each part covers the same amount of time.`
    : `The graph shows the ${ctx.quantity} over time. On which part is it ${dirWord[kind]}?`;
  const wrong: Wrong[] = deltas
    .map((d, i): Wrong | null => {
      if (i === answerIndex) return null;
      const text = rate
        ? d === 0
          ? "The graph is level here, so nothing is changing."
          : `The line is ${Math.abs(d) === Math.abs(deltas[answerIndex]!) ? "as steep" : Math.abs(d) < Math.abs(deltas[answerIndex]!) ? "less steep" : "steeper"} here, so the ${ctx.quantity} changes ${Math.abs(d) < Math.abs(deltas[answerIndex]!) ? "more slowly" : "more quickly"} than ${slow ? "on the slowest part" : "on the part that changes fastest"}.`
        : `The graph is ${dirWord[dirOf(d)]} here, not ${dirWord[kind]}.`;
      return [name(i), text];
    })
    .filter((w): w is Wrong => w !== null);
  return {
    prompt,
    choices: options(name(answerIndex), wrong),
    scene: pathScene(ys, ctx.quantity, true),
    explanation: rate
      ? [
          "All four parts last the same time, so the steeper the line, the faster the quantity changes. A level part does not change.",
          `${slow ? "The gentlest slope that is not level" : "The steepest slope"} is on ${partName(answerIndex)}.`,
        ]
      : [
          `Check each part from left to right: a line going ${kind === "up" ? "up" : kind === "down" ? "down" : "level"} is ${dirWord[kind]}.`,
          `Exactly one part does that: ${partName(answerIndex)}.`,
        ],
    hint: rate
      ? `Compare how steep the four parts are. Equal time passes on each, so ${slow ? "look for the smallest slope that is not level" : "look for the biggest slope, up or down"}.`
      : `Go through the four labeled parts one at a time and say whether each goes up, stays level or goes down.`,
    hintCue: hintPoint("Start at the point labeled O.", "g.point.0"),
    tags: [variant, ...(rate ? [slow ? "slowest" : "fastest"] : [kind])],
    model: { deltas, answerIndex },
  };
}

// ====================================================== coordinate-context-points
type CoordCtx = {
  xAxis: string;
  yAxis: string;
  at: (x: number, y: number) => string;
  compare: (x: number) => string;
  unit: string;
};
const coordContexts: CoordCtx[] = [
  {
    xAxis: "weeks",
    yAxis: "height (cm)",
    at: (x, y) =>
      `after ${u(x, "week")}, the plant is ${u(y, "centimeter")} tall`,
    compare: (x) =>
      `Both plants are measured after ${u(x, "week")}. Point A shows the height of Plant A and point B shows the height of Plant B. How much taller is Plant B than Plant A?`,
    unit: "centimeter",
  },
  {
    xAxis: "weeks",
    yAxis: "dollars",
    at: (x, y) =>
      `after ${u(x, "week")}, the student has saved ${u(y, "dollar")}`,
    compare: (x) =>
      `Point A shows how much Mia has saved and point B shows how much Leo has saved, both after ${u(x, "week")}. How much more has Leo saved than Mia?`,
    unit: "dollar",
  },
  {
    xAxis: "blocks east",
    yAxis: "blocks north",
    at: (x, y) =>
      `the place is ${u(x, "block")} east and ${u(y, "block")} north of the school`,
    compare: (x) =>
      `Point A is the library and point B is the park. Both are ${u(x, "block")} east of the school. How much farther north is the park than the library?`,
    unit: "block",
  },
  {
    xAxis: "rounds",
    yAxis: "points",
    at: (x, y) => `after ${u(x, "round")}, the team has ${u(y, "point")}`,
    compare: (x) =>
      `Point A shows Team A's score and point B shows Team B's score, both after ${u(x, "round")}. How many more points does Team B have?`,
    unit: "point",
  },
];
function planeScene(
  ctx: CoordCtx,
  points: { x: number; y: number; label?: string }[],
): Scene {
  let g = graph({
    id: "g",
    x: [0, 10],
    y: [0, 10],
    grid: 1,
    tick: 1,
    axisNames: [ctx.xAxis, ctx.yAxis],
  });
  for (const p of points) g = g.point(p.x, p.y, p.label);
  return g.scene({ title: "A first-quadrant graph" });
}
const inRange = (v: number) => v >= 1 && v <= 9;

function coordinateContextPoints(r: Random): Built {
  const variant = pick(r, [
    "read-meaning",
    "pair-from-story",
    "find-the-point",
    "compare-same-x",
  ] as const);
  const ctx = pick(r, coordContexts);
  let a = r(1, 9),
    b = r(1, 9);
  while (a === b) b = r(1, 9);
  const sentence = (x: number, y: number) => `${cap(ctx.at(x, y))}.`;
  if (variant === "read-meaning") {
    const nudge = (v: number) => (v < 9 ? v + 1 : v - 1);
    const correct = sentence(a, b);
    return {
      prompt: `The graph has ${ctx.xAxis} on the horizontal axis and ${ctx.yAxis} on the vertical axis. What does the plotted point show?`,
      choices: options(correct, [
        [
          sentence(b, a),
          "The numbers are swapped. Go along the horizontal axis first, then up.",
        ],
        [
          sentence(nudge(a), b),
          "Count along the horizontal axis again: the point is over a different mark.",
        ],
        [
          sentence(a, nudge(b)),
          "Count up the vertical axis again: the point is at a different height.",
        ],
        [
          sentence(a - 1 >= 1 ? a - 1 : a + 2, b),
          "Count along the horizontal axis again: the point is over a different mark.",
        ],
      ]),
      scene: planeScene(ctx, [{ x: a, y: b }]),
      explanation: [
        `From the origin, the point is ${a} across (${ctx.xAxis}) and ${b} up (${ctx.yAxis}), so it is the ordered pair (${a}, ${b}).`,
        correct,
      ],
      hint: `Start at the origin. Count across to the point, then up. The first number belongs to ${ctx.xAxis} and the second to ${ctx.yAxis}.`,
      hintCue: hintPoint("Count across, then up, to this point."),
      tags: [variant],
      model: { a, b },
    };
  }
  if (variant === "pair-from-story") {
    const correct = M(`(${a}, ${b})`);
    return {
      prompt: `${sentence(a, b)} Write this situation as an ordered pair (${ctx.xAxis}, ${ctx.yAxis}). Which pair is correct?`,
      choices: options(correct, [
        [
          M(`(${b}, ${a})`),
          "The pair is in the order (horizontal axis, vertical axis). The numbers are swapped.",
        ],
        [M(`(${a}, ${b + 1})`), `The second number is ${b}.`],
        [M(`(${a + 1}, ${b})`), `The first number is ${a}.`],
        [M(`(${a + b}, ${b})`), `Do not add. The first number is just ${a}.`],
      ]),
      explanation: [
        `The horizontal axis shows ${ctx.xAxis}, so the first number is ${a}.`,
        `The vertical axis shows ${ctx.yAxis}, so the second number is ${b}.`,
        `The ordered pair is ${correct}.`,
      ],
      hint: `An ordered pair lists the horizontal value first, then the vertical value. Find which number in the sentence goes with ${ctx.xAxis}.`,
      tags: [variant],
      model: { a, b },
    };
  }
  if (variant === "find-the-point") {
    const b2 = b + pick(r, [-2, -1, 1, 2]);
    const a2 = a + pick(r, [-2, -1, 1, 2]);
    if (!inRange(b2) || !inRange(a2)) return coordinateContextPoints(r);
    const kinds = shuffle(r, [
      { key: "right", x: a, y: b },
      { key: "swap", x: b, y: a },
      { key: "high", x: a, y: b2 },
      { key: "side", x: a2, y: b },
    ]);
    const letters = ["A", "B", "C", "D"];
    const labeled = kinds.map((k, i) => ({ ...k, letter: letters[i]! }));
    const text = (k: (typeof labeled)[number]) => `Point ${k.letter}`;
    const right = labeled.find((k) => k.key === "right")!;
    const why: Record<string, string> = {
      swap: "The numbers are swapped here: the horizontal and vertical values are reversed.",
      high: "This point has the right horizontal value but the wrong height.",
      side: "This point has the right height but the wrong horizontal value.",
    };
    return {
      prompt: `Four points are labeled on the graph. Which point shows this situation: ${ctx.at(a, b)}?`,
      choices: options(
        text(right),
        labeled
          .filter((k) => k.key !== "right")
          .map((k): Wrong => [text(k), why[k.key]!]),
      ),
      scene: planeScene(
        ctx,
        labeled.map((k) => ({ x: k.x, y: k.y, label: k.letter })),
      ),
      explanation: [
        `The situation is the ordered pair (${a}, ${b}): ${a} on the ${ctx.xAxis} axis and ${b} on the ${ctx.yAxis} axis.`,
        `Point ${right.letter} is ${a} across and ${b} up.`,
      ],
      hint: `Find ${a} on the horizontal axis (${ctx.xAxis}). Then look up to the height ${b} on the vertical axis (${ctx.yAxis}).`,
      tags: [variant],
      model: { a, b, points: labeled },
    };
  }
  let y1 = r(2, 6),
    y2 = y1 + r(1, 3);
  while (y2 - y1 === a) {
    y1 = r(2, 6);
    y2 = y1 + r(1, 3);
  }
  const d = y2 - y1;
  const label = (n: number) => `${u(n, ctx.unit)}`;
  return {
    prompt: ctx.compare(a),
    choices: options(label(d), [
      [
        label(y2),
        `${y2} is the height of point B alone. Find how much greater it is than point A.`,
      ],
      [
        label(y1 + y2),
        "Adding the two values does not compare them. Subtract.",
      ],
      [
        label(a),
        `${a} is on the horizontal axis. Compare the vertical values.`,
      ],
      [label(d + 1), "Count the gap between the two vertical values again."],
      [
        label(y1),
        `${y1} is the height of point A alone. Find how much less it is than point B.`,
      ],
      [label(y2 + 1), `Read the vertical value of point B again: it is ${y2}.`],
    ]),
    scene: planeScene(ctx, [
      { x: a, y: y1, label: "A" },
      { x: a, y: y2, label: "B" },
    ]),
    explanation: [
      `Both points are at ${a} on the horizontal axis, so compare the vertical values.`,
      `Point A is at ${y1} and point B is at ${y2}. The difference is ${y2} − ${y1} = ${d}.`,
      label(d),
    ],
    hint: `The two points are straight above one another, so only the vertical values differ. Read the vertical value of A and of B, then find the gap.`,
    hintCue: [step("Read the height of A.", act.highlight("g.point.0"))],
    tags: [variant],
    model: { x: a, y1, y2, d },
  };
}

// ====================================================== pattern-pair-relationship
const seq = (start: number, add: number, n: number) =>
  Array.from({ length: n }, (_, i) => start + i * add);
const ordinal = (n: number) => `${n}th`;
function patternPairRelationship(r: Random): Built {
  const variant = pick(r, [
    "nth-pair",
    "times-relationship",
    "plus-relationship",
    "predict-term",
  ] as const);
  const rule = (name: string, start: number, add: number) =>
    `Pattern ${name} starts at ${start} and adds ${add} each time.`;
  if (variant === "nth-pair") {
    const sa = r(0, 3),
      da = r(1, 4),
      sb = r(0, 4);
    let db = r(2, 8);
    while (db === da) db = r(2, 8);
    const n = r(4, 6);
    const A = seq(sa, da, n + 1),
      B = seq(sb, db, n + 1);
    const pair = (x: number, y: number) => M(`(${x}, ${y})`);
    const correct = pair(A[n - 1]!, B[n - 1]!);
    return {
      prompt: `${rule("A", sa, da)} ${rule("B", sb, db)} Make ordered pairs (term of A, matching term of B). What is the ${ordinal(n)} ordered pair?`,
      choices: options(correct, [
        [
          pair(B[n - 1]!, A[n - 1]!),
          "The pair is written (term of A, term of B). The order is swapped.",
        ],
        [
          pair(A[n]!, B[n]!),
          `The first terms are the starts, ${sa} and ${sb}. Adding ${n} times gives the ${ordinal(n + 1)} terms, not the ${ordinal(n)}.`,
        ],
        [
          pair(A[n - 1]!, B[n]!),
          "Both terms must come from the same position in their patterns.",
        ],
        [
          pair(n * da, n * db),
          "Each pattern begins at its starting number, not at 0, so the start is part of each term.",
        ],
      ]),
      explanation: [
        `Pattern A: ${A.slice(0, n).join(", ")}. Pattern B: ${B.slice(0, n).join(", ")}.`,
        `The ${ordinal(n)} terms are ${A[n - 1]} and ${B[n - 1]}.`,
        `The ordered pair is ${correct}.`,
      ],
      hint: `Write out the first ${n} terms of each pattern, starting with ${sa} for A and ${sb} for B. The ${ordinal(n)} pair uses the ${ordinal(n)} term of each.`,
      tags: [variant],
      model: { A: A.slice(0, n), B: B.slice(0, n), n },
    };
  }
  const sa = r(0, 3),
    da = r(1, 4);
  if (variant === "times-relationship" || variant === "predict-term") {
    const k = r(2, 4);
    const sb = k * sa,
      db = k * da;
    const A = seq(sa, da, 4),
      B = seq(sb, db, 4);
    const pairsText = `The first pairs are ${A.map((x, i) => `(${x}, ${B[i]})`).join(", ")}.`;
    if (variant === "times-relationship") {
      const correct = `Each term of B is ${k} times the matching term of A.`;
      return {
        prompt: `${rule("A", sa, da)} ${rule("B", sb, db)} ${pairsText} How are the terms of B related to the matching terms of A?`,
        choices: options(correct, [
          [
            `Each term of B is ${k} more than the matching term of A.`,
            `Compare the first pair: ${B[1]} is not ${A[1]} + ${k}. The gap between matching terms grows.`,
          ],
          [
            `Each term of A is ${k} times the matching term of B.`,
            "The terms of B are the larger ones, so B is the multiple of A.",
          ],
          [
            `Each term of B is ${db} more than the matching term of A.`,
            `${db} is how much B grows each step. It does not describe the matching terms.`,
          ],
          [
            `Each term of B is ${k + 1} times the matching term of A.`,
            `Check a pair: ${A[1]} × ${k + 1} is ${A[1]! * (k + 1)}, but the pair has ${B[1]}.`,
          ],
        ]),
        explanation: [
          `Divide each B term by the matching A term: ${B.slice(1)
            .map((y, i) => `${y} ÷ ${A[i + 1]} = ${k}`)
            .join(
              ", ",
            )}${sa === 0 ? ". The first pair is (0, 0)." : `, and ${B[0]} ÷ ${A[0]} = ${k}.`}`,
          correct,
        ],
        hint: `Look at one pair, such as (${A[1]}, ${B[1]}), and ask how to get the second number from the first. Check it on the next pair.`,
        tags: [variant],
        model: { A, B, k },
      };
    }
    const n = r(8, 10);
    const An = sa + (n - 1) * da,
      Bn = k * An;
    return {
      prompt: `${rule("A", sa, da)} Pattern B has the rule: each term of B is ${k} times the matching term of A. What is the ${ordinal(n)} term of Pattern B?`,
      choices: options(`${Bn}`, [
        [
          `${An}`,
          `${An} is the ${ordinal(n)} term of A. B is ${k} times as much.`,
        ],
        [`${An + k}`, `B is ${k} times the term of A, not ${k} more.`],
        [
          `${k * (An + da)}`,
          `The ${ordinal(n)} term needs ${n - 1} additions to the start, not ${n}.`,
        ],
        [
          `${Bn - k * da}`,
          `The ${ordinal(n)} term of A is ${sa} plus ${n - 1} additions of ${da}.`,
        ],
      ]),
      explanation: [
        `The ${ordinal(n)} term of A is ${sa} + ${n - 1} × ${da} = ${An}.`,
        `Each B term is ${k} times the matching A term: ${k} × ${An} = ${Bn}.`,
      ],
      hint: `First find the ${ordinal(n)} term of Pattern A: start at ${sa} and add ${da} a total of ${n - 1} times. Then use the rule for B.`,
      tags: [variant],
      model: { sa, da, k, n, An, Bn },
    };
  }
  const c = r(2, 6);
  const A = seq(sa, da, 4),
    B = seq(sa + c, da, 4);
  const correct = `Each term of B is ${c} more than the matching term of A.`;
  return {
    prompt: `${rule("A", sa, da)} ${rule("B", sa + c, da)} The first pairs are ${A.map((x, i) => `(${x}, ${B[i]})`).join(", ")}. How are the terms of B related to the matching terms of A?`,
    choices: options(correct, [
      [
        `Each term of B is ${c} times the matching term of A.`,
        `Check a pair: ${A[1]} × ${c} is ${A[1]! * c}, but the pair has ${B[1]}.`,
      ],
      [
        `Each term of A is ${c} more than the matching term of B.`,
        "The terms of B are the larger ones.",
      ],
      [
        `Each term of B is ${da} more than the matching term of A.`,
        `${da} is how much both patterns grow each step. The matching terms differ by ${c}.`,
      ],
      [
        `Each term of B is ${c + da} more than the matching term of A.`,
        `Subtract a pair to check: ${B[1]} − ${A[1]} = ${c}.`,
      ],
    ]),
    explanation: [
      `Subtract each A term from the matching B term: ${B.map((y, i) => `${y} − ${A[i]} = ${c}`).join(", ")}.`,
      correct,
    ],
    hint: `Both patterns add ${da} each time. Subtract the A term from the B term in the first pair and then in the second pair.`,
    tags: [variant],
    model: { A, B, c },
  };
}

// ============================================================ triangle-uniqueness
const countOptions = [
  "No triangle",
  "Exactly one triangle",
  "Exactly two different triangles",
  "Infinitely many triangles of different sizes",
] as const;
type CountIdx = 0 | 1 | 2 | 3;
/** Number of triangles for angle A, side b = AC and side a = BC (opposite A). */
export function ssaCount(angleA: number, a: number, b: number): CountIdx {
  if (angleA >= 90) return a > b ? 1 : 0;
  const h = b / 2; // angleA is 30°: the shortest reach from C is half of AC.
  if (a < h) return 0;
  if (a === h) return 1;
  return a < b ? 2 : 1;
}
function triangleUniqueness(r: Random): Built {
  const variant = pick(r, [
    "ssa-two",
    "ssa-none",
    "ssa-right",
    "ssa-long",
    "ssa-obtuse",
    "which-set",
  ] as const);
  const [P, Q, R] = pick(r, [
    ["A", "B", "C"],
    ["P", "Q", "R"],
    ["X", "Y", "Z"],
  ] as const);
  if (variant === "which-set") {
    const goodKind = pick(r, ["sas", "asa", "sss"] as const);
    const badKinds = shuffle(r, [
      "aaa",
      "ssa-two",
      "sss-bad",
      "angles-bad",
    ] as const).slice(0, 3);
    const mk = (kind: string): [string, string] => {
      if (kind === "sas") {
        const x = r(4, 9),
          y = r(4, 9),
          ang = r(3, 12) * 10;
        return [
          `${M(`${P}${Q} = ${x}`)} cm, ${M(`\\angle ${P} = ${ang}^\\circ`)}, ${M(`${P}${R} = ${y}`)} cm`,
          "Two sides and the angle between them fix the third side and the other angles: exactly one triangle.",
        ];
      }
      if (kind === "asa") {
        const a1 = r(3, 8) * 10,
          a2 = r(3, 8) * 10,
          x = r(4, 9);
        return [
          `${M(`\\angle ${P} = ${a1}^\\circ`)}, ${M(`${P}${Q} = ${x}`)} cm, ${M(`\\angle ${Q} = ${a2}^\\circ`)}`,
          "Two angles and the side between them fix the third angle and the other sides: exactly one triangle.",
        ];
      }
      if (kind === "sss") {
        const longest = r(8, 14),
          s1 = r(5, longest - 1),
          s2 = r(longest - s1 + 1, longest);
        return [
          `${M(`${P}${Q} = ${s1}`)} cm, ${M(`${Q}${R} = ${s2}`)} cm, ${M(`${R}${P} = ${longest}`)} cm`,
          `${s1} + ${s2} is greater than ${longest}, so the sides close up, and three sides fix one triangle.`,
        ];
      }
      if (kind === "aaa") {
        const a1 = r(4, 7) * 10,
          a2 = r(4, 7) * 10;
        return [
          `${M(`\\angle ${P} = ${a1}^\\circ`)}, ${M(`\\angle ${Q} = ${a2}^\\circ`)}, ${M(`\\angle ${R} = ${180 - a1 - a2}^\\circ`)}`,
          "Three angles fix the shape but not the size. Enlarging the triangle keeps every angle, so many triangles fit.",
        ];
      }
      if (kind === "ssa-two") {
        const b = 2 * r(4, 8),
          a = r(b / 2 + 1, b - 1);
        return [
          `${M(`\\angle ${P} = 30^\\circ`)}, ${M(`${P}${R} = ${b}`)} cm, ${M(`${Q}${R} = ${a}`)} cm`,
          `Two sides and an angle that is not between them can swing two ways: here ${a} cm fits in two places, so two different triangles fit.`,
        ];
      }
      if (kind === "sss-bad") {
        const longest = r(10, 16),
          s1 = r(2, 5),
          s2 = r(2, longest - s1 - 1);
        return [
          `${M(`${P}${Q} = ${s1}`)} cm, ${M(`${Q}${R} = ${s2}`)} cm, ${M(`${R}${P} = ${longest}`)} cm`,
          `${s1} + ${s2} is not greater than ${longest}, so the two short sides cannot reach each other: no triangle.`,
        ];
      }
      const a1 = r(95, 120),
        a2 = r(180 - a1, 170);
      return [
        `${M(`\\angle ${P} = ${a1}^\\circ`)}, ${M(`\\angle ${Q} = ${a2}^\\circ`)}, ${M(`${P}${Q} = ${r(4, 9)}`)} cm`,
        `${a1} + ${a2} is not less than 180, so there is no room for a third angle: no triangle.`,
      ];
    };
    const [correct, why] = mk(goodKind);
    const wrongs = badKinds.map((k): Wrong => {
      const [text, reason] = mk(k);
      return [text, reason];
    });
    return {
      prompt: `Which set of measures determines exactly one triangle ${M(`${P}${Q}${R}`)}? Triangles with the same size and shape count as one.`,
      choices: options(correct, wrongs),
      explanation: [
        why,
        `Each of the other sets fails: ${wrongs.map(([, reason]) => reason).join(" ")}`,
      ],
      hint: "For each set, ask whether a triangle can be drawn at all and, if so, whether the measures leave any choice in its size or shape.",
      tags: [variant, goodKind],
      model: { goodKind },
    };
  }
  let angleA = 30,
    b: number,
    a: number;
  if (variant === "ssa-two") {
    b = 2 * r(4, 9);
    a = r(b / 2 + 1, b - 1);
  } else if (variant === "ssa-none") {
    b = 2 * r(4, 9);
    a = r(2, b / 2 - 1);
  } else if (variant === "ssa-right") {
    b = 2 * r(3, 9);
    a = b / 2;
  } else if (variant === "ssa-long") {
    b = 2 * r(3, 8);
    a = r(b, b + 6);
  } else {
    angleA = pick(r, [90, 100, 120, 135, 150]);
    b = r(5, 12);
    a = r(0, 1) ? r(b + 1, b + 7) : r(Math.max(2, b - 4), b);
  }
  const count = ssaCount(angleA, a, b);
  const answer = countOptions[count];
  const given = `${M(`\\angle ${P} = ${angleA}^\\circ`)}, ${M(`${P}${R} = ${b}`)} cm and ${M(`${Q}${R} = ${a}`)} cm`;
  const reason: string[] =
    angleA === 30
      ? [
          `Draw ${M(`\\angle ${P}`)} of 30° and mark ${R} on one ray so that ${M(`${P}${R} = ${b}`)} cm. Side ${M(`${Q}${R}`)} must reach from ${R} to the other ray.`,
          `The shortest way from ${R} to the other ray is straight across at a right angle. In a right triangle with a 30° angle, the side opposite 30° is half the hypotenuse (the longest side), so that shortest distance is ${b} ÷ 2 = ${b / 2} cm.`,
          count === 0
            ? `${a} cm is shorter than ${b / 2} cm, so the side cannot reach the ray: no triangle.`
            : count === 1 && a === b / 2
              ? `${a} cm equals ${b / 2} cm, so the side just touches the ray at one point: exactly one triangle.`
              : count === 2
                ? `${a} cm is longer than ${b / 2} cm, so the side reaches the ray in two places. Both places are on the ray because ${a} cm is shorter than ${b} cm: two different triangles.`
                : `${a} cm is at least ${b} cm, so only one of the two places where the side meets the line is on the ray: exactly one triangle.`,
        ]
      : [
          `${M(`\\angle ${P}`)} is ${angleA > 90 ? "obtuse" : "a right angle"}. The side opposite the largest angle is the longest side, so ${M(`${Q}${R}`)} must be longer than ${M(`${P}${R}`)}.`,
          count === 1
            ? `${a} cm is longer than ${b} cm, so exactly one triangle fits.`
            : `${a} cm is not longer than ${b} cm, so no triangle fits.`,
        ];
  const feedbackFor = (i: number) =>
    i === count ? undefined : reason[reason.length - 1]!;
  return {
    prompt: `A triangle ${M(`${P}${Q}${R}`)} has ${given}. Side ${M(`${Q}${R}`)} is opposite ${M(`\\angle ${P}`)}. How many different triangles fit these measures? Triangles with the same size and shape count as one.`,
    choices: options(
      answer,
      countOptions
        .map((label, i): Wrong | null =>
          i === count
            ? null
            : [
                label,
                i === 3
                  ? "Many sizes fit only when just the angles are given. Here two sides are fixed too."
                  : feedbackFor(i)!,
              ],
        )
        .filter((w): w is Wrong => w !== null),
    ),
    explanation: [...reason, `Answer: ${answer.toLowerCase()}.`],
    hint: `The angle ${M(P)} is not between the two given sides, so the measures can leave a choice. Draw ${M(`\\angle ${P}`)}, mark ${M(`${P}${R}`)} on one ray, and ask where a side of length ${a} cm from ${R} can land on the other ray.`,
    tags: [variant],
    model: { angleA, a, b, count },
  };
}

// ============================================================ percent-applications
const usd = (cents: number) => {
  const dollars = Math.floor(cents / 100),
    c = cents % 100;
  const body =
    c === 0 ? `${dollars}` : `${dollars}.${String(c).padStart(2, "0")}`;
  return `${body} ${cents === 100 ? "dollar" : "dollars"}`;
};
/** A percent value n/d as plain text or TeX, exact. */
function pct(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  const [p, q] = [n / g, d / g];
  let rest = q;
  for (const f of [2, 5]) while (rest % f === 0) rest /= f;
  if (rest === 1) return `${Number((p / q).toFixed(6))}%`;
  const whole = Math.floor(p / q);
  const rem = p - whole * q;
  return M(`${whole > 0 ? whole : ""}\\frac{${rem}}{${q}}\\%`);
}
function percentApplications(r: Random): Built {
  const variant = pick(r, [
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
  ] as const);
  const word = (c: number) => usd(c * 100);
  switch (variant) {
    case "tax-total": {
      const price = r(12, 96),
        rate = r(4, 9);
      const total = price * 100 + price * rate;
      return {
        prompt: `A jacket costs ${word(price)} before tax. The sales tax is ${rate}% of the price. What is the total cost, including tax?`,
        choices: options(usd(total), [
          [usd(price * rate), "That is only the tax. Add it to the price."],
          [
            usd(price * 100 - price * rate),
            "Tax is added to the price, not subtracted.",
          ],
          [
            word(price + rate),
            `${rate}% is ${rate} hundredths of the price, not ${rate} dollars.`,
          ],
          [
            word(price * rate),
            `Multiplying by ${rate} treats ${rate}% as ${rate} times the price. Use ${rate}/100.`,
          ],
        ]),
        explanation: [
          `Tax = ${rate}% of ${price} = ${price} × ${rate}/100 = ${usd(price * rate)}.`,
          `Total = ${word(price)} + ${usd(price * rate)} = ${usd(total)}.`,
        ],
        hint: `Find ${rate}% of ${price} dollars first, then decide whether tax is added to or taken from the price.`,
        tags: [variant],
        model: { cents: total },
      };
    }
    case "tip-total": {
      const bill = r(24, 120),
        rate = pick(r, [15, 18, 20, 25]);
      const total = bill * 100 + bill * rate;
      return {
        prompt: `A dinner bill is ${word(bill)}. You leave a tip of ${rate}% of the bill. How much do you pay in all, with the tip?`,
        choices: options(usd(total), [
          [
            usd(bill * rate),
            "That is only the tip. You pay the bill and the tip.",
          ],
          [
            usd(bill * 100 - bill * rate),
            "A tip is extra money added to the bill.",
          ],
          [
            word(bill + rate),
            `${rate}% of the bill is ${rate} hundredths of it, not ${rate} dollars.`,
          ],
          [
            usd(bill * rate * 10),
            `Check the decimal: ${rate}% means ${rate}/100, not ${rate}/10.`,
          ],
        ]),
        explanation: [
          `Tip = ${rate}% of ${bill} = ${bill} × ${rate}/100 = ${usd(bill * rate)}.`,
          `Total = ${word(bill)} + ${usd(bill * rate)} = ${usd(total)}.`,
        ],
        hint: `Work out ${rate}% of the ${bill}-dollar bill, then think about whether the tip is part of what you pay.`,
        tags: [variant],
        model: { cents: total },
      };
    }
    case "commission-total": {
      const base = 50 * r(4, 10),
        sales = 100 * r(8, 50),
        rate = pick(r, [2, 3, 4, 5, 6, 8, 10]);
      const comm = sales * rate;
      const total = base * 100 + comm;
      return {
        prompt: `A salesperson earns a base pay of ${word(base)} plus a commission of ${rate}% of the sales. This week the sales were ${word(sales)}. What is the total pay?`,
        choices: options(usd(total), [
          [usd(comm), "That is only the commission. Add the base pay."],
          [
            usd(base * 100 + base * rate),
            "The commission is a percent of the sales, not of the base pay.",
          ],
          [word(base + rate), `${rate}% of the sales is not ${rate} dollars.`],
          [
            word(base + sales),
            "The commission is a percent of the sales. Do not add all the sales.",
          ],
        ]),
        explanation: [
          `Commission = ${rate}% of ${sales} = ${sales} × ${rate}/100 = ${usd(comm)}.`,
          `Total pay = ${word(base)} + ${usd(comm)} = ${usd(total)}.`,
        ],
        hint: `The commission is a percent of the sales, not of the base pay. Find it, then add the base pay.`,
        tags: [variant],
        model: { cents: total },
      };
    }
    case "markup-price": {
      const cost = 2 * r(5, 45),
        rate = pick(r, [20, 25, 30, 40, 50, 60, 75]);
      const price = cost * 100 + cost * rate;
      return {
        prompt: `A store buys a lamp for ${word(cost)} and marks up the price by ${rate}% of the cost. What is the selling price?`,
        choices: options(usd(price), [
          [
            usd(cost * rate),
            "That is only the markup. The selling price is the cost plus the markup.",
          ],
          [
            usd(cost * 100 - cost * rate),
            "A markup raises the price. A markdown lowers it.",
          ],
          [word(cost + rate), `${rate}% of the cost is not ${rate} dollars.`],
          [
            usd(cost * rate * 2 + cost * 100),
            `Use ${rate}/100 of the cost for the markup.`,
          ],
        ]),
        explanation: [
          `Markup = ${rate}% of ${cost} = ${cost} × ${rate}/100 = ${usd(cost * rate)}.`,
          `Selling price = ${word(cost)} + ${usd(cost * rate)} = ${usd(price)}.`,
        ],
        hint: `The markup is a percent of the store's cost. Find that amount, then decide how it changes the price.`,
        tags: [variant],
        model: { cents: price },
      };
    }
    case "markdown-price": {
      const orig = 10 * r(2, 20),
        rate = pick(r, [10, 15, 20, 25, 30, 35, 40]);
      const sale = orig * 100 - orig * rate;
      return {
        prompt: `A bike costs ${word(orig)}. It is on sale for ${rate}% off. What is the sale price?`,
        choices: options(usd(sale), [
          [
            usd(orig * rate),
            `That is the amount taken off. The sale price is what is left.`,
          ],
          [word(orig - rate), `${rate}% of the price is not ${rate} dollars.`],
          [
            usd(orig * 100 + orig * rate),
            "Percent off lowers the price. It does not add.",
          ],
          [
            usd(orig * rate * 10),
            "Use the percent as a fraction of 100: the amount off is much smaller.",
          ],
        ]),
        explanation: [
          `Amount off = ${rate}% of ${orig} = ${orig} × ${rate}/100 = ${usd(orig * rate)}.`,
          `Sale price = ${word(orig)} − ${usd(orig * rate)} = ${usd(sale)}.`,
        ],
        hint: `Find ${rate}% of the ${orig}-dollar price. That amount is taken off the price.`,
        tags: [variant],
        model: { cents: sale },
      };
    }
    case "markdown-rate": {
      const orig = 20 * r(2, 10),
        rate = pick(r, [10, 15, 20, 25, 30, 40, 60]);
      const off = (orig * rate) / 100,
        sale = orig - off;
      return {
        prompt: `A coat was ${word(orig)}. It is now ${word(sale)}. What percent of the original price was taken off?`,
        choices: options(pct(rate, 1), [
          [
            pct(100 - rate, 1),
            `${100 - rate}% is the part of the original price that is left, not the part taken off.`,
          ],
          [
            pct(off, 1),
            `${off} is the dollar amount taken off. Compare it with the original price to get a percent.`,
          ],
          [
            pct(100 * off, sale),
            "The percent is found by comparing the amount off with the original price, not the new price.",
          ],
          [
            pct(rate * 2, 1),
            `Divide the amount off by the original price, ${orig}.`,
          ],
        ]),
        explanation: [
          `Amount taken off = ${orig} − ${sale} = ${off} dollars.`,
          `Percent off = ${off} ÷ ${orig} = ${off / orig} = ${rate}%.`,
        ],
        hint: `First find how many dollars were taken off. Then divide that amount by the original price, ${orig} dollars.`,
        tags: [variant],
        model: { rate },
      };
    }
    case "interest-amount":
    case "interest-balance": {
      const p = 100 * r(2, 20),
        rate = r(2, 6),
        t = r(2, 5);
      const i = (p * rate * t) / 100;
      const balance = variant === "interest-balance";
      const answer = balance ? p + i : i;
      return {
        prompt: `You put ${word(p)} in an account that pays simple interest of ${rate}% per year on the amount you put in. You leave it for ${t} years. ${balance ? "How much is in the account then, with the interest?" : "How much interest do you earn in all?"}`,
        choices: options(word(answer), [
          [
            word(balance ? p + (p * rate) / 100 : (p * rate) / 100),
            `That uses only one year. Simple interest is earned every year for ${t} years.`,
          ],
          [
            word(balance ? i : p + i),
            balance
              ? "That is only the interest. The account also holds the money you put in."
              : "That adds the money you put in. The question asks for the interest alone.",
          ],
          [
            word(balance ? p + p * rate * t : p * rate * t),
            `Use ${rate}/100 of the money each year: dividing by 100 was skipped.`,
          ],
          [
            word(balance ? p + rate * t : rate * t),
            `${rate}% a year is a percent of the money, not ${rate} dollars.`,
          ],
          [
            word(answer + (p * rate) / 100),
            `Count the years again: the interest is earned for ${t} years, not ${t + 1}.`,
          ],
        ]),
        explanation: [
          `Each year earns ${rate}% of ${p} = ${(p * rate) / 100} dollars.`,
          `For ${t} years: ${t} × ${(p * rate) / 100} = ${i} dollars of interest.`,
          ...(balance
            ? [`Account total: ${p} + ${i} = ${p + i} dollars.`]
            : []),
        ],
        hint: `Find the interest for one year: ${rate}% of ${p} dollars. Then think about how many years it is earned.`,
        tags: [variant],
        model: { principal: p, rate, years: t, interest: i, answer },
      };
    }
    case "interest-rate": {
      const p = 100 * r(2, 20),
        rate = r(2, 8),
        t = r(2, 5);
      const i = (p * rate * t) / 100;
      return {
        prompt: `You put ${word(p)} in an account with simple interest. After ${t} years you have earned ${word(i)} in interest. What is the yearly interest rate?`,
        choices: options(pct(rate, 1), [
          [
            pct(rate * t, 1),
            `That is the percent earned over all ${t} years. The question asks for each year.`,
          ],
          [
            pct(rate, t),
            "Divide the total percent earned by the number of years, not the rate by the years.",
          ],
          [pct(i, 1), `${i} is the interest in dollars, not a percent.`],
          [
            pct(rate * 100, 1),
            `Divide ${i} by ${p} to get the part earned, then write it as a percent.`,
          ],
        ]),
        explanation: [
          `Over ${t} years the interest is ${i} dollars out of ${p} dollars: ${i} ÷ ${p} = ${i / p}, which is ${pct(rate * t, 1)}.`,
          `That is for ${t} years, so one year is ${pct(rate * t, 1)} ÷ ${t} = ${pct(rate, 1)}.`,
        ],
        hint: `Compare the interest, ${i} dollars, with the money put in, ${p} dollars, to get a percent. That percent covers all ${t} years.`,
        tags: [variant],
        model: { principal: p, rate, years: t, interest: i },
      };
    }
    default: {
      const e = pick(r, [2, 4, 5, 8, 10, 12, 15, 20, 25]);
      const unit = 100 / gcd(e, 100);
      const actual = unit * r(Math.ceil(20 / unit), Math.floor(160 / unit));
      const d = (actual * e) / 100;
      const high = r(0, 1) === 1;
      const measured = high ? actual + d : actual - d;
      const g = pick(r, ["grams", "centimeters", "liters", "seconds"] as const);
      const wrong: Wrong[] = [
        [
          pct(100 * d, measured),
          "Percent error compares the error with the true value, not with the measured value.",
        ],
        [
          `${d} ${g}`,
          "The error is the difference in " +
            g +
            ". Percent error divides it by the true value to get a percent.",
        ],
        [
          pct(100 * d, actual * 4),
          "Divide the error by the true value, not by a different amount.",
        ],
      ];
      if (!high)
        wrong.push([
          pct(-e, 1),
          "Percent error uses the size of the difference, so it is not negative.",
        ]);
      return {
        prompt: `A scale shows ${measured} ${g} for an object whose true amount is ${actual} ${g}. What is the percent error, the size of the error as a percent of the true amount?`,
        choices: options(pct(e, 1), wrong),
        explanation: [
          `Error = |${measured} − ${actual}| = ${d} ${g}.`,
          `Percent error = ${d} ÷ ${actual} = ${d / actual}, which is ${pct(e, 1)}.`,
        ],
        hint: `Find the size of the difference between the measured and true amounts. Then divide by the amount that is the standard: the true one.`,
        tags: [variant],
        model: { measured, actual, e },
      };
    }
  }
}

// ====================================================== compound-event-simulation
type Experiment = {
  id: string;
  intro: string;
  stages: number[];
  outcomes: string[][];
  events: { text: string; test: (o: string[]) => boolean }[];
};
const range = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}`);
const product = (...sets: string[][]): string[][] =>
  sets.reduce<string[][]>(
    (acc, set) => acc.flatMap((o) => set.map((v) => [...o, v])),
    [[]],
  );
const experiments: Experiment[] = [
  {
    id: "dice",
    intro: "Two fair 4-sided dice, each with faces 1 to 4, are rolled.",
    stages: [4, 4],
    outcomes: product(range(4), range(4)),
    events: [
      { text: "the sum is 5", test: (o) => +o[0]! + +o[1]! === 5 },
      { text: "the sum is at least 6", test: (o) => +o[0]! + +o[1]! >= 6 },
      { text: "the product is even", test: (o) => (+o[0]! * +o[1]!) % 2 === 0 },
      { text: "both dice show the same number", test: (o) => o[0] === o[1] },
    ],
  },
  {
    id: "coin-die",
    intro: "A fair coin is flipped and a fair 6-sided die is rolled.",
    stages: [2, 6],
    outcomes: product(["H", "T"], range(6)),
    events: [
      {
        text: "the coin shows heads and the die shows an even number",
        test: (o) => o[0] === "H" && +o[1]! % 2 === 0,
      },
      {
        text: "the coin shows tails or the die shows 6",
        test: (o) => o[0] === "T" || o[1] === "6",
      },
      {
        text: "the coin shows heads and the die shows at least 5",
        test: (o) => o[0] === "H" && +o[1]! >= 5,
      },
    ],
  },
  {
    id: "coins",
    intro: "A fair coin is flipped 3 times.",
    stages: [2, 2, 2],
    outcomes: product(["H", "T"], ["H", "T"], ["H", "T"]),
    events: [
      {
        text: "exactly 2 flips show heads",
        test: (o) => o.filter((v) => v === "H").length === 2,
      },
      { text: "at least 1 flip shows tails", test: (o) => o.includes("T") },
      {
        text: "all 3 flips show the same side",
        test: (o) => o.every((v) => v === o[0]),
      },
      {
        text: "the first and last flips are different",
        test: (o) => o[0] !== o[2],
      },
    ],
  },
  {
    id: "spinners",
    intro:
      "Spinner 1 has three equal parts: red, blue and green. Spinner 2 has four equal parts numbered 1 to 4. Both are spun once.",
    stages: [3, 4],
    outcomes: product(["red", "blue", "green"], range(4)),
    events: [
      {
        text: "spinner 1 lands on red and spinner 2 lands on an even number",
        test: (o) => o[0] === "red" && +o[1]! % 2 === 0,
      },
      {
        text: "spinner 1 does not land on red and spinner 2 lands on a number greater than 2",
        test: (o) => o[0] !== "red" && +o[1]! > 2,
      },
    ],
  },
];
const outcomeText = (o: string[]) =>
  o.length === 1 ? o[0]! : `(${o.join(", ")})`;
const sampleLines = (e: Experiment) =>
  e.id === "coins"
    ? e.outcomes.map((o) => o.join("")).join(", ")
    : e.outcomes.map(outcomeText).join(", ");

type SimContext = {
  id: string;
  intro: string;
  digits: number;
  unitWord: string;
  mark: (d: number) => boolean;
  markWord: string;
  events: { text: string; test: (marks: number) => boolean }[];
};
const simContexts: SimContext[] = [
  {
    id: "family",
    intro:
      "A family has 3 children, and each child is equally likely to be a girl or a boy. To simulate, use random digits: an even digit (0, 2, 4, 6, 8) means a girl and an odd digit means a boy. Each group of 3 digits is one trial, one family.",
    digits: 3,
    unitWord: "girls",
    mark: (d) => d % 2 === 0,
    markWord: "girl digits",
    events: [
      { text: "the family has exactly 2 girls", test: (m) => m === 2 },
      { text: "the family has at least 2 girls", test: (m) => m >= 2 },
      { text: "the family has at least 1 girl", test: (m) => m >= 1 },
      { text: "all 3 children are the same", test: (m) => m === 0 || m === 3 },
    ],
  },
  {
    id: "free-throws",
    intro:
      "A player makes 60% of free throws. To simulate two shots, use random digits: 0 to 5 mean a made shot and 6 to 9 mean a miss. Each pair of digits is one trial, two shots.",
    digits: 2,
    unitWord: "made shots",
    mark: (d) => d <= 5,
    markWord: "made-shot digits",
    events: [
      { text: "the player makes both shots", test: (m) => m === 2 },
      { text: "the player makes at least 1 shot", test: (m) => m >= 1 },
      { text: "the player makes exactly 1 shot", test: (m) => m === 1 },
    ],
  },
];

function compoundEventSimulation(r: Random): Built {
  const variant = pick(r, [
    "sample-space",
    "simulation",
    "experimental-vs-theoretical",
  ] as const);
  if (variant === "simulation") {
    const ctx = pick(r, simContexts);
    const event = pick(r, ctx.events);
    const N = 20;
    for (;;) {
      const trials = Array.from({ length: N }, () =>
        Array.from({ length: ctx.digits }, () => r(0, 9)),
      );
      const marks = trials.map((t) => t.filter(ctx.mark).length);
      const countOf = (test: (m: number) => boolean) =>
        marks.filter(test).length;
      const hits = countOf(event.test);
      if (hits === 0 || hits === N) continue;
      const others = ctx.events.filter((e) => e !== event);
      const markDigits = marks.reduce((x, y) => x + y, 0);
      const correct = M(fracTex(hits, N));
      const label = (n: number, d: number) => M(fracTex(n, d));
      const candidates: Wrong[] = [
        [
          label(N - hits, N),
          "That is the probability that the event does not happen. Count the trials where it does.",
        ],
        ...others.map((e): Wrong => [
          label(countOf(e.test), N),
          `That counts trials where ${e.text}. The question is about a different event.`,
        ]),
        [
          label(markDigits, ctx.digits * N),
          `That counts single digits. Each trial of ${ctx.digits} digits is one try, so divide by ${N} trials.`,
        ],
        [
          label(hits, N + ctx.digits * N),
          `The estimate divides by the number of trials, ${N}.`,
        ],
      ];
      const seen = new Set([correct]);
      if (candidates.filter(([l]) => !seen.has(l)).length < 3) continue;
      let distinct = 0;
      const unique = new Set<string>();
      for (const [l] of candidates)
        if (l !== correct && !unique.has(l)) {
          unique.add(l);
          distinct++;
        }
      if (distinct < 3) continue;
      const text = trials.map((t) => t.join("")).join(", ");
      const hitTrials = trials
        .filter((_, i) => event.test(marks[i]!))
        .map((t) => t.join(""));
      return {
        prompt: `${ctx.intro} Here are ${N} trials: ${text}. Based on these trials, what is the estimated probability that ${event.text}?`,
        choices: options(correct, candidates),
        explanation: [
          `Go through each of the ${N} trials and count the ${ctx.unitWord}.`,
          `The trials where ${event.text} are ${hitTrials.join(", ")}: ${hits} trials.`,
          `The estimate is ${hits} out of ${N}, which is ${correct}.`,
        ],
        hint: `Treat each group of ${ctx.digits} digits as one trial. For each trial, count the ${ctx.markWord}, and decide if the event happened. Then compare the number of trials where it did with all ${N} trials.`,
        tags: [variant, ctx.id],
        model: {
          trials: trials.map((t) => t.join("")),
          digits: ctx.digits,
          hits,
          N,
        },
      };
    }
  }
  const exp = pick(r, experiments);
  const event = pick(r, exp.events);
  const total = exp.outcomes.length;
  const fav = exp.outcomes.filter(event.test);
  if (fav.length === 0 || fav.length === total)
    return compoundEventSimulation(r);
  const p = fracTex(fav.length, total);
  if (variant === "sample-space") {
    const correct = M(p);
    const stageSum = exp.stages.reduce((x, y) => x + y, 0);
    return {
      prompt: `${exp.intro} What is the probability that ${event.text}? Count the outcomes of the sample space, where every outcome is equally likely.`,
      choices: options(
        correct,
        (
          [
            [
              total - fav.length,
              total,
              "That is the probability that the event does not happen.",
            ],
            [
              fav.length,
              stageSum,
              `The sample space has ${total} outcomes. Do not add the numbers of outcomes of each stage; multiply them.`,
            ],
            [
              fav.length,
              total - fav.length,
              "That compares favorable outcomes with the other outcomes. A probability compares them with all outcomes.",
            ],
            [
              1,
              total,
              "That is the probability of one single outcome. More than one outcome makes the event happen.",
            ],
            [
              fav.length + 1,
              total,
              "Count the favorable outcomes again. Check that none is missed or counted twice.",
            ],
            [
              fav.length,
              total + 1,
              "Count the whole sample space again. The denominator is the number of equally likely outcomes in all.",
            ],
            [
              fav.length,
              total - 1,
              "Count the whole sample space again. The denominator is the number of equally likely outcomes in all.",
            ],
            [
              fav.length - 1,
              total,
              "Count the favorable outcomes again. Check that none is missed or counted twice.",
            ],
          ] as [number, number, string][]
        )
          .filter(([n, d]) => n > 0 && n < d)
          .map(([n, d, why]): Wrong => [M(fracTex(n, d)), why]),
      ),
      explanation: [
        `List the sample space: ${sampleLines(exp)}. That is ${total} equally likely outcomes.`,
        `Outcomes where ${event.text}: ${fav.map((o) => (exp.id === "coins" ? o.join("") : outcomeText(o))).join(", ")}. That is ${fav.length}.`,
        `Probability = ${fav.length}/${total} = ${correct}.`,
      ],
      hint: `Make an organized list or table of every outcome of the experiment (there are ${total} in all). Then mark the ones where ${event.text}.`,
      tags: [variant, exp.id],
      model: { total, favorable: fav.length },
    };
  }
  // experimental vs theoretical
  const num = fav.length;
  const N = pick(r, [40, 60, 80, 100, 120]);
  const expected = (N * num) / total;
  const want = pick(r, ["greater", "less", "equal"] as const);
  const exact = Number.isInteger(expected);
  const kind =
    want === "equal" && !exact ? pick(r, ["greater", "less"] as const) : want;
  const base = Math.round(expected);
  const delta = r(1, Math.max(2, Math.round(N / 10)));
  const observed =
    kind === "equal"
      ? expected
      : kind === "greater"
        ? Math.max(base, Math.floor(expected)) + delta
        : Math.min(base, Math.ceil(expected)) - delta;
  if (observed < 0 || observed > N) return compoundEventSimulation(r);
  const cross = observed * total - num * N;
  const truth = cross > 0 ? "greater" : cross < 0 ? "less" : "equal";
  const exp1 = M(`\\frac{${observed}}{${N}}`);
  const th = M(p);
  const sentence = (rel: string) =>
    `The experimental probability, ${exp1}, is ${rel} the theoretical probability, ${th}.`;
  const statements = {
    greater: sentence("greater than"),
    less: sentence("less than"),
    equal: sentence("equal to"),
  };
  const bad =
    "The experimental and theoretical probabilities must be equal, so the trials were done wrongly.";
  const feedback = (rel: string) =>
    `Compare ${observed}/${N} with ${num}/${total} using a common denominator: ${observed} × ${total} = ${observed * total} and ${num} × ${N} = ${num * N}. The experimental probability is ${truth === "equal" ? "equal to" : truth + " than"} the theoretical one, not ${rel}.`;
  return {
    prompt: `${exp.intro} The theoretical probability that ${event.text} is ${th}. In ${N} trials of a simulation, this happened ${observed} times. How does the experimental probability compare with the theoretical probability?`,
    choices: options(statements[truth], [
      ...(["greater", "less", "equal"] as const)
        .filter((k) => k !== truth)
        .map((k): Wrong => [
          statements[k],
          feedback(k === "equal" ? "equal" : k),
        ]),
      [
        bad,
        "Chance results vary from one set of trials to another. A difference is normal and does not mean the trials were wrong.",
      ],
    ]),
    explanation: [
      `The experimental probability is the number of times it happened divided by the number of trials: ${observed}/${N}.`,
      `Compare with ${num}/${total}: ${observed} × ${total} = ${observed * total} and ${num} × ${N} = ${num * N}.`,
      statements[truth],
    ],
    hint: `Write the experimental probability as ${observed} out of ${N}. To compare it with ${num}/${total}, compare ${observed} × ${total} with ${num} × ${N}, or use decimals.`,
    tags: [variant],
    model: { observed, N, favorable: num, total, relation: truth },
  };
}

// ------------------------------------------------------------------ assembly
const builders: Record<string, (r: Random) => Built> = {
  "proportional-graph": proportionalGraph,
  "story-graph-match": storyGraphMatch,
  "coordinate-context-points": coordinateContextPoints,
  "pattern-pair-relationship": patternPairRelationship,
  "triangle-uniqueness": triangleUniqueness,
  "percent-applications": percentApplications,
  "compound-event-simulation": compoundEventSimulation,
};
const labels: Record<string, string> = {
  "proportional-graph": "Choose one",
  "story-graph-match": "Choose one",
  "coordinate-context-points": "Choose one",
  "pattern-pair-relationship": "Choose one",
  "triangle-uniqueness": "Choose one",
  "percent-applications": "Choose one",
  "compound-event-simulation": "Choose one",
};

export function k8RepresentationCase(id: string, seed: string) {
  const meta = k8RepresentationTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown K–8 representation template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  const { model, ...c } = builders[id]!(r);
  const { problem, tags } = assemble(meta, seed, c, r, labels[id]!);
  return { problem, tags, model };
}
export const generateK8RepresentationProblem = (
  id: string,
  seed: string,
): GeneratedProblem => k8RepresentationCase(id, seed).problem;
