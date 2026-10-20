import { act, lessonStep, step } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";

/** Lesson models for whole-number powers, registered in `sceneIllustrations`. */
const ladder = [0, 1, 2, 3, 4];
const race = [1, 2, 3, 4, 5, 6];
const bar = (id: string, k: number, i: number) => [
  act.appear(`${id}.series.${k}.bar.${i}`),
  act.appear(`${id}.series.${k}.value.${i}`),
];

export const powerScenes = {
  /** 3⁰ to 3⁴: each step up multiplies by 3, each step down divides. */
  "power-ladder": {
    v: 1,
    title: "Powers of 3 from exponent 0 to 4",
    elements: [
      {
        type: "bars",
        id: "ladder",
        categories: ladder.map(String),
        series: [{ values: ladder.map((e) => 3 ** e), color: "accent" }],
        axisName: "Exponent",
      },
    ],
    steps: [
      step("$3^1 = 3$: one factor of 3.", ...bar("ladder", 0, 1)),
      step(
        "$3^2 = 3 \\cdot 3 = 9$ and $3^3 = 9 \\cdot 3 = 27$: each step up multiplies by 3.",
        ...bar("ladder", 0, 2),
        ...bar("ladder", 0, 3),
      ),
      step(
        "$3^4 = 3^2 \\cdot 3^2 = 9 \\cdot 9 = 81$: build a big power from a known one.",
        ...bar("ladder", 0, 4),
      ),
      lessonStep(
        "Step down from $3^1 = 3$ by dividing by 3 once more: $3^0 = 1$.",
        ...bar("ladder", 0, 0),
      ),
    ],
  } satisfies Scene,
  /** 2ⁿ against n² for n = 1 to 6: tied at 2 and 4, then doubling pulls away. */
  "power-race-bars": {
    v: 1,
    title:
      "Doubling, 2 to the n, against squaring, n squared, for n from 1 to 6",
    elements: [
      {
        type: "bars",
        id: "race",
        categories: race.map(String),
        series: [
          {
            label: "Doubling",
            values: race.map((n) => 2 ** n),
            color: "accent",
          },
          { label: "Squaring", values: race.map((n) => n * n), color: "warm" },
        ],
        axisName: "n",
      },
    ],
    steps: [
      step(
        "At $n = 1$ doubling leads, 2 to 1. At $n = 2$ both are 4.",
        ...[0, 1].flatMap((i) => [...bar("race", 0, i), ...bar("race", 1, i)]),
      ),
      step(
        "At $n = 3$ squaring is ahead, 9 to 8; at $n = 4$ they tie again: $2^4 = 4^2 = 16$.",
        ...[2, 3].flatMap((i) => [...bar("race", 0, i), ...bar("race", 1, i)]),
      ),
      step(
        "From then on doubling wins: $2^5 = 32 > 5^2 = 25$, and $2^6 = 64 > 6^2 = 36$.",
        ...[4, 5].flatMap((i) => [...bar("race", 0, i), ...bar("race", 1, i)]),
      ),
    ],
  } satisfies Scene,
};
