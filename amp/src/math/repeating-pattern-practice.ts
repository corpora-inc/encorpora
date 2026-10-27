import type { TemplateMetadata } from "./contracts";
import { scene } from "./scene/author";
import type { Element } from "./scene/spec";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const repeatingPatternTemplate: TemplateMetadata = {
  id: "repeating-shape-pattern",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "single-choice-v1",
  title: "Complete a repeating pattern",
  skillId: "arithmetic-patterns",
  gradeBand: "3–5",
  difficultyOffset: -0.9,
  description:
    "Find the two shapes that come next in a repeating pattern of circles, squares and triangles, or the two shapes missing from the middle of it.",
};

export const shapeKinds = ["circle", "square", "triangle"] as const;
export type ShapeKind = (typeof shapeKinds)[number];

/** Whether the unit repeats a shorter unit, so its length is not its period. */
export function shortestPeriod(unit: readonly ShapeKind[]): number {
  for (let p = 1; p <= unit.length; p++)
    if (unit.length % p === 0 && unit.every((k, i) => k === unit[i % p]))
      return p;
  return unit.length;
}

const axes = {
  ask: defineAxis("ask", ["next-two", "missing-two"] as const),
};
interface Model {
  ask: "next-two" | "missing-two";
  unit: ShapeKind[];
  /** Tokens drawn left to right; null marks an empty box. */
  slots: (ShapeKind | null)[];
  /** The two tokens that belong in the empty boxes, in order. */
  answer: [ShapeKind, ShapeKind];
  /** Index in the repeating sequence of the first empty box. */
  at: number;
}
const tokenAt = (unit: readonly ShapeKind[], i: number) =>
  unit[i % unit.length]!;

function model(
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"] },
): Model {
  const length = pick(r, [2, 3, 3, 4]);
  const unit = Array.from({ length }, () => pick(r, shapeKinds));
  if (new Set(unit).size < 2 || shortestPeriod(unit) !== length)
    throw new Error("Need three retries");
  if (a.ask === "next-two") {
    const shown = length * r(2, 3) + r(1, length - 1);
    if (shown + 2 > 11) throw new Error("Need three retries");
    const slots: (ShapeKind | null)[] = [
      ...Array.from({ length: shown }, (_, i) => tokenAt(unit, i)),
      null,
      null,
    ];
    return {
      ask: a.ask,
      unit,
      slots,
      answer: [tokenAt(unit, shown), tokenAt(unit, shown + 1)],
      at: shown,
    };
  }
  const total = length * 3 + r(0, length - 1);
  if (total > 11) throw new Error("Need three retries");
  // Keep a full unit before and after the holes so the pattern is clear.
  const at = r(length, total - length - 2);
  const slots = Array.from({ length: total }, (_, i) =>
    i === at || i === at + 1 ? null : tokenAt(unit, i),
  );
  return {
    ask: a.ask,
    unit,
    slots,
    answer: [tokenAt(unit, at), tokenAt(unit, at + 1)],
    at,
  };
}

function figure(slots: (ShapeKind | null)[]) {
  const step = 1.5;
  const els: Element[] = [];
  slots.forEach((k, i) => {
    const x = i * step + 0.5;
    const id = `slot-${i}`;
    if (k === null) {
      els.push(
        {
          type: "rect",
          id,
          at: [x - 0.5, 0],
          size: [1, 1],
          fill: "paper",
          stroke: "muted",
          dash: "dash",
          width: 2,
        },
        {
          type: "text",
          id: `${id}-q`,
          at: [x, 0.5],
          text: "?",
          font: "sans",
          size: "lg",
          color: "muted",
        },
      );
    } else if (k === "circle")
      els.push({
        type: "circle",
        id,
        center: [x, 0.5],
        r: 0.5,
        fill: "accent-fill",
        stroke: "accent",
        width: 2,
      });
    else if (k === "square")
      els.push({
        type: "rect",
        id,
        at: [x - 0.5, 0],
        size: [1, 1],
        fill: "warm-fill",
        stroke: "warm",
        width: 2,
      });
    else
      els.push({
        type: "polygon",
        id,
        points: [
          [x - 0.55, 0],
          [x + 0.55, 0],
          [x, 1],
        ],
        fill: "gold-fill",
        stroke: "gold",
        width: 2,
      });
  });
  return {
    kind: "scene" as const,
    scene: scene(...els).build({
      title: "A row of shapes with two empty boxes",
    }),
  };
}

const pairText = (p: [ShapeKind, ShapeKind]) => `${p[0]}, ${p[1]}`;

export const repeatingShapePattern = chainFamily({
  template: repeatingPatternTemplate,
  axes,
  model,
  variant: (m) => `${m.ask}-${m.unit.length}`,
  render: (m, _a, r) => {
    const correct = pairText(m.answer);
    const unitText = m.unit.join(", ");
    // Distractors: swapped order, the pair one place along, and a pair that
    // restarts the pattern.
    const place = (offset: number): [ShapeKind, ShapeKind] => [
      tokenAt(m.unit, m.at + offset),
      tokenAt(m.unit, m.at + offset + 1),
    ];
    const candidates: { pair: [ShapeKind, ShapeKind]; why: string }[] = [
      {
        pair: [m.answer[1], m.answer[0]],
        why: "These are the right shapes in the wrong order. Follow the pattern left to right.",
      },
      {
        pair: place(1),
        why: "This pair starts one shape too late. Count how far into the repeating part the first empty box is.",
      },
      {
        pair: place(-1),
        why: "This pair starts one shape too early. Look at the shape just before the empty boxes.",
      },
      {
        pair: [m.unit[0]!, m.unit[1 % m.unit.length]!],
        why: "This pair starts the pattern over, but the empty boxes come in the middle of a repeat.",
      },
      ...shapeKinds.flatMap((x) =>
        shapeKinds.map((y) => ({
          pair: [x, y] as [ShapeKind, ShapeKind],
          why: "These shapes do not continue the repeating part. Find the part that repeats and follow it.",
        })),
      ),
    ];
    const seen = new Set([correct]);
    const wrong = candidates.filter((c) => {
      const t = pairText(c.pair);
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    const options = [
      { label: correct, correct: true as const },
      ...draw(r, wrong.slice(0, 4), 3).map((c) => ({
        label: pairText(c.pair),
        feedback: c.why,
      })),
    ];
    const surface = choiceSurface(r, {
      prompt:
        m.ask === "next-two"
          ? "A pattern of shapes repeats. Which two shapes go in the empty boxes at the end?"
          : "A pattern of shapes repeats. Which two shapes go in the empty boxes, from left to right?",
      options,
      hint: `The same short part repeats again and again. Count the shapes before the first empty box: ${m.at}. Then see how many full repeats fit in ${m.at} and how far into the next repeat the box falls.`,
      explanation: [
        `The repeating part is ${unitText}, which is ${m.unit.length} shapes long.`,
        `${m.at} shapes come before the first empty box, and ${m.at} is ${Math.floor(m.at / m.unit.length)} full ${Math.floor(m.at / m.unit.length) === 1 ? "repeat" : "repeats"} plus ${m.at % m.unit.length} more, so the first empty box is shape number ${(m.at % m.unit.length) + 1} of the repeat.`,
        `The two empty boxes hold ${correct}.`,
      ],
    });
    return surface && { ...surface, figure: figure(m.slots) };
  },
});

export const repeatingPatternTemplates = [repeatingPatternTemplate] as const;
export const repeatingPatternGenerate = dispatch(repeatingPatternTemplates, {
  "repeating-shape-pattern": (seed) =>
    repeatingShapePattern.generate(seed).problem,
});
