import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import { graph } from "./scene/author";
import { axisRecord, chooseAxes, defineAxis, type Random } from "./variation/axes";

/** Complete a slope proof in order. The learner follows the proof; the
 * lesson carries the motion. A free-written proof is not graded. */
export const slopeCriteriaProofTemplate: TemplateMetadata = {
  id: "slope-criteria-proof",
  version: 1,
  title: "Complete a slope proof",
  skillId: "slope-proofs",
  gradeBand: "9–12",
  difficultyOffset: 0.55,
  requiredResponseCapability: "multi-part-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description:
    "Complete a proof that parallel lines have equal slopes, that equal slopes make lines parallel, or that a quarter turn makes slopes negative reciprocals. Each step has one valid reason. This follows a proof; it does not ask the learner to invent one.",
};

export const slopeProofAxes = {
  proof: defineAxis("proof", ["parallel", "converse", "perpendicular"] as const),
};

/** The one valid reason for each fixed step. No distractor is in this table. */
export const VALID_REASONS: Record<string, string> = {
  "parallel-runs": "Given: both runs are equal.",
  "parallel-right": "The rise is vertical and the run is horizontal.",
  "parallel-angles": "Corresponding angles: parallel lines cut by a transversal.",
  "parallel-cong": "ASA: two angles and the included side.",
  "parallel-parts": "Corresponding parts of congruent triangles are equal.",
  "converse-rises": "Equal slopes and equal runs give equal rises.",
  "converse-sas": "SAS: two sides and the included right angle.",
  "converse-parts": "Corresponding parts of congruent triangles are equal.",
  "converse-lines": "Equal corresponding angles mean the lines are parallel.",
  "perp-preserve": "A rotation preserves length and angle.",
  "perp-turn": "A quarter turn sends horizontal to vertical and reverses once.",
  "perp-product": "Multiply the slopes. Their product is -1.",
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1;
    const limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}

type Step = { id: string; key: string; wrong: readonly string[] };

function optionsFor(r: Random, step: Step): { options: PartOption[]; key: string } {
  const labels = [step.key, ...step.wrong];
  const order = labels.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = r(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const options = order.map((source, i) => ({
    id: "abcdef"[i]!,
    label: labels[source]!,
  }));
  return { options, key: options[order.indexOf(0)]!.id };
}

function slopeTex(num: number, den: number) {
  const sign = num < 0 ? "-" : "";
  const n = Math.abs(num);
  if (den === 1) return `$${sign}${n}$`;
  return `$${sign}\\frac{${n}}{${den}}$`;
}

const parallelFigures = (() => {
  const out: { run: number; rise: number; x2: number; y0: number; gap: number }[] = [];
  for (let run = 1; run <= 4; run++)
    for (let rise = 1; rise <= 4; rise++)
      for (let x2 = run + 1; x2 <= 8; x2++) {
        if ((rise * x2) % run !== 0) continue;
        const gap = (rise * x2) / run;
        if (gap < 2 || gap > 6) continue;
        if (x2 + run > 10 || 1 + rise > 8) continue;
        out.push({ run, rise, x2, y0: 1, gap });
      }
  return out;
})();

function parallelScene(run: number, rise: number, x2: number, y0: number) {
  const a: [number, number] = [0, y0];
  const b: [number, number] = [run, y0];
  const c: [number, number] = [run, y0 + rise];
  const d: [number, number] = [x2, y0];
  const e: [number, number] = [x2 + run, y0];
  const f: [number, number] = [x2 + run, y0 + rise];
  return graph({ id: "g", x: [-1, 11], y: [0, 9], grid: 1, aspect: 1 })
    .line({ through: [a, c] }, { color: "accent" })
    .line({ through: [d, f] }, { color: "warm" })
    .slope(a, c, "none")
    .slope(d, f, "none")
    .point(a[0], a[1], "A")
    .point(b[0], b[1], "B")
    .point(c[0], c[1], "C")
    .point(d[0], d[1], "D")
    .point(e[0], e[1], "E")
    .point(f[0], f[1], "F")
    .scene({
      title: "Two slope triangles on parallel lines",
    });
}

function parallelSteps(): Step[] {
  return [
    {
      id: "parallel-runs",
      key: VALID_REASONS["parallel-runs"]!,
      wrong: [
        "The rises were measured first.",
        "The triangles are already congruent.",
        "The lines were vertical.",
      ],
    },
    {
      id: "parallel-right",
      key: VALID_REASONS["parallel-right"]!,
      wrong: [
        "Vertical angles are equal.",
        "The lines are parallel.",
        "Both slopes are positive.",
      ],
    },
    {
      id: "parallel-angles",
      key: VALID_REASONS["parallel-angles"]!,
      wrong: [
        "Vertical angles.",
        "The triangles look the same.",
        "Alternate interior angles of the two rises.",
      ],
    },
    {
      id: "parallel-cong",
      key: VALID_REASONS["parallel-cong"]!,
      wrong: [
        "AA, which gives similarity only.",
        "SSS, with only one side known.",
        "They already have the same slope.",
      ],
    },
    {
      id: "parallel-parts",
      key: VALID_REASONS["parallel-parts"]!,
      wrong: [
        "Parallel lines share a y-intercept.",
        "The definition of slope alone.",
        "Both rises are positive.",
      ],
    },
  ];
}

function converseSteps(): Step[] {
  return [
    {
      id: "converse-rises",
      key: VALID_REASONS["converse-rises"]!,
      wrong: [
        "The lines were given as parallel.",
        "The y-intercepts are equal.",
        "The triangles were assumed congruent.",
      ],
    },
    {
      id: "converse-sas",
      key: VALID_REASONS["converse-sas"]!,
      wrong: [
        "ASA, before any angle match is known.",
        "SSS, with the hypotenuse unknown.",
        "AA, which does not fix the sides.",
      ],
    },
    {
      id: "converse-parts",
      key: VALID_REASONS["converse-parts"]!,
      wrong: [
        "Corresponding angles of parallel lines.",
        "Vertical angles.",
        "The slopes were measured twice.",
      ],
    },
    {
      id: "converse-lines",
      key: VALID_REASONS["converse-lines"]!,
      wrong: [
        "Equal slopes were the conclusion already.",
        "The triangles look the same.",
        "Alternate interior angles of vertical lines.",
      ],
    },
  ];
}

function perpSteps(a: number, b: number): Step[] {
  const key = slopeTex(-a, b);
  const wrong = [slopeTex(a, b), slopeTex(-b, a), slopeTex(b, a)];
  return [
    {
      id: "perp-preserve",
      key: VALID_REASONS["perp-preserve"]!,
      wrong: [
        "A reflection was used, so lengths match.",
        "A half turn makes a parallel line.",
        "A dilation preserves angles only.",
      ],
    },
    {
      id: "perp-turn",
      key: VALID_REASONS["perp-turn"]!,
      wrong: [
        "The legs swap and keep their signs.",
        "Only the sign of the slope changes.",
        "The turn keeps the run horizontal.",
      ],
    },
    {
      id: "perp-slope",
      key,
      wrong,
    },
    {
      id: "perp-product",
      key: VALID_REASONS["perp-product"]!,
      wrong: [
        "Add the slopes. Their sum is 0.",
        "The slopes are equal.",
        "Subtract the slopes.",
      ],
    },
  ];
}

export function generateSlopeCriteriaProof(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId !== slopeCriteriaProofTemplate.id)
    throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const axes = chooseAxes(templateId, seed, slopeProofAxes);
  const fig = parallelFigures[r(0, parallelFigures.length - 1)]!;
  let prompt = "";
  let steps: Step[] = [];
  let scene = parallelScene(fig.run, fig.rise, fig.x2, fig.y0);
  if (axes.proof === "perpendicular") {
    let a = r(1, 5);
    let b = r(1, 5);
    let guard = 0;
    while ((gcd(a, b) !== 1 || a === b) && guard++ < 20) {
      a = r(1, 5);
      b = r(1, 5);
    }
    if (gcd(a, b) !== 1 || a === b) {
      a = 3;
      b = 2;
    }
    const px = r(-2, 2);
    const py = r(-2, 2);
    const pts: [number, number][] = [
      [px, py],
      [px + a, py],
      [px + a, py + b],
      [px, py + a],
      [px - b, py],
      [px - b, py + a],
    ];
    if (pts.some(([x, y]) => Math.abs(x) > 6 || Math.abs(y) > 6))
      return generateSlopeCriteriaProof(templateId, `${seed}~`);
    steps = perpSteps(a, b);
    prompt = `Line l through P(${px}, ${py}) has run ${a} and rise ${b}, so its slope is ${b}/${a}. Line m is l turned 90 degrees about P. Complete the proof that the slope of m is -${a}/${b}. Choose that slope as a number too.`;
    scene = graph({ id: "g", x: [-6, 6], y: [-6, 6], grid: 1, aspect: 1 })
      .line({ through: [[px, py], [px + a, py + b]] }, { color: "accent" })
      .line({ through: [[px, py], [px - b, py + a]] }, { color: "warm" })
      .slope([px, py], [px + a, py + b], "none")
      .slope([px, py], [px - b, py + a], "none")
      .point(px, py, "P")
      .scene({ title: "A slope triangle and its quarter turn" });
  } else if (axes.proof === "converse") {
    steps = converseSteps();
    prompt = `On the figure, both slope triangles have run ${fig.run} and the lines have slope ${fig.rise}/${fig.run}. The rises are drawn. Complete the proof that the lines are parallel.`;
  } else {
    steps = parallelSteps();
    prompt = `Lines l and m are parallel. Each slope triangle has run ${fig.run} and a right angle between the horizontal run and the vertical rise. Complete the proof that the slopes are equal.`;
  }
  const built = steps.map((step) => ({ step, pick: optionsFor(r, step) }));
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose the reason for each step",
    layout: "slots",
    blanks: built.map((item, i) => ({
      id: `s${i + 1}`,
      label: `Step ${i + 1}`,
      options: item.pick.options,
    })),
  };
  const answer = serializeMultiPart(
    response,
    Object.fromEntries(built.map((item, i) => [`s${i + 1}`, item.pick.key])),
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      skillId: slopeCriteriaProofTemplate.skillId,
      prompt,
      response,
      figure: { kind: "scene", scene },
    },
    answer,
    hint: "Use the given runs first. A reason that mentions the conclusion too early is circular.",
    explanation: [
      ...built.map(
        (item, i) =>
          `Step ${i + 1}: ${item.step.key}`,
      ),
      axes.proof === "perpendicular"
        ? "Parallel lines share a slope. A quarter turn makes slopes whose product is -1."
        : "Parallel lines share a slope. Equal slopes make lines parallel.",
      "This follows the proof in order. It does not ask you to invent the proof.",
    ],
    variant: { id: axes.proof, axes: axisRecord(axes) },
  };
}
