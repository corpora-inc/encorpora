import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { snakeRegions, type PartitionedShape } from "./part-whole-models";

type Response = "choice" | "fraction" | "number";
// id | title | skill | grade band | response | description
const rows = `
find-equal-shares|Find halves or quarters|halves-and-quarters|K–2|choice|Pick the shape cut into two or four equal parts from a shape with unequal parts and a shape with a different number of equal parts.
name-equal-share|Name halves and quarters|halves-and-quarters|K–2|choice|Name the shaded part of a circle, square or rectangle cut into two or four equal parts.
larger-share|Halves and quarters of one size|halves-and-quarters|K–2|choice|Decide whether one half or one quarter of two same-size shapes is larger or smaller.
find-equal-thirds|Find halves, thirds or quarters|thirds-and-partitions|K–2|choice|Pick the shape cut into two, three or four equal parts from a shape with unequal parts and a shape with a different number of equal parts.
name-share|Name halves, thirds and quarters|thirds-and-partitions|K–2|choice|Name the shaded part of a shape cut into two, three or four equal parts, including a whole as all of its parts.
same-share-different-shape|Equal shares, different shapes|thirds-and-partitions|K–2|choice|Compare one equal share of two same-size wholes cut in different ways, with the same or a different number of parts.
equal-area-fraction|An equal-area part as a fraction|partition-area|3–5|fraction|Name one of several equal-area grid regions of different shapes as a unit fraction of the rectangle's area.
equal-area-part-size|Area of one equal part|partition-area|3–5|number|Find the area of one part when a rectangle of known area is split into a counted number of equal-area parts.
compare-like-denominators|Compare same-size pieces|compare-fractions|3–5|fraction|Choose the greater or lesser of two fractions of one whole with the same denominator.
compare-like-numerators|Compare the same number of pieces|compare-fractions|3–5|fraction|Choose the greater or lesser of two fractions of one whole with the same numerator.
compare-unlike-fractions|Compare unlike fractions|fraction-comparison|3–5|fraction|Choose the greater or lesser of two proper fractions with different numerators and denominators.
`;
const definitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, gradeBand, response, description] = row.split(
      "|",
    ) as [string, string, string, "K–2" | "3–5", Response, string];
    return { id, title, skillId, gradeBand, response, description };
  });
export const partWholeTemplates: readonly TemplateMetadata[] = definitions.map(
  ({ id, title, skillId, gradeBand, response, description }) => ({
    id,
    version: 1,
    title,
    skillId,
    gradeBand,
    description,
    ...(response === "choice"
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

type Random = (low: number, high: number) => number;
function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
function shuffle<T>(r: Random, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = r(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const WORDS = ["zero", "one", "two", "three", "four"] as const;
const UNIT: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
};
/** "one half", "two thirds", "four quarters". */
export const shareName = (k: number, n: number) =>
  `${WORDS[k]} ${UNIT[n]![k === 1 ? 0 : 1]}`;
const units = (n: number) => UNIT[n]![1];
const unit = (n: number) => UNIT[n]![0];
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const pieces = (n: number) => `${n} ${n === 1 ? "piece" : "pieces"}`;
const parts = (n: number) => `${WORDS[n] ?? n} equal parts`;

type ShapeKind = PartitionedShape["shape"];
type Cut = PartitionedShape["cut"];
/** Cuts that make n equal parts of a shape. */
function equalCuts(shape: ShapeKind, n: number): Cut[] {
  if (shape === "circle") return ["sectors"];
  const cuts: Cut[] = ["columns", "rows"];
  if (n === 2) cuts.push("diagonal");
  if (n === 4) cuts.push("grid");
  if (n === 4 && shape === "square") cuts.push("diagonals");
  return cuts;
}
/** Visibly unequal weights: the largest part is at least 1.5 times the smallest. */
const UNEQUAL: Record<number, number[][]> = {
  2: [
    [1, 2],
    [2, 1],
    [1, 3],
    [3, 1],
  ],
  3: [
    [1, 1, 2],
    [1, 2, 1],
    [2, 1, 1],
    [1, 2, 3],
    [3, 2, 1],
  ],
  4: [
    [1, 1, 2, 2],
    [2, 1, 1, 2],
    [1, 2, 1, 2],
    [1, 1, 1, 3],
    [2, 2, 1, 3],
  ],
};
const SHAPES: readonly ShapeKind[] = ["rectangle", "square", "circle"];
function equalShape(r: Random, n: number, shape = pick(r, SHAPES)) {
  return {
    shape,
    cut: pick(r, equalCuts(shape, n)),
    sizes: Array<number>(n).fill(1),
    shaded: [] as number[],
  };
}
function shadeSome(r: Random, n: number, k: number): number[] {
  return shuffle(
    r,
    Array.from({ length: n }, (_, i) => i),
  )
    .slice(0, k)
    .sort((a, b) => a - b);
}

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  choices?: Choice[];
  /** Choices are already in display order (labels name figure positions). */
  ordered?: boolean;
};

function findEqualShares(r: Random, targets: number[], counts: number[]) {
  const n = pick(r, targets),
    m = pick(
      r,
      counts.filter((c) => c !== n),
    );
  const correct = equalShape(r, n);
  const unequalKind = pick(r, SHAPES);
  const unequal = {
    shape: unequalKind,
    cut: (unequalKind === "circle"
      ? "sectors"
      : pick(r, ["columns", "rows"])) as Cut,
    sizes: [...pick(r, UNEQUAL[n]!)],
    shaded: [] as number[],
  };
  const wrongCount = equalShape(r, m);
  const roles = shuffle(r, [
    { role: "correct", shape: correct },
    { role: "unequal", shape: unequal },
    { role: "count", shape: wrongCount },
  ]);
  const labels = ["A", "B", "C"] as const;
  const shapes = roles.map(({ shape }, i) => ({ ...shape, label: labels[i] }));
  const name = (role: string) =>
    `Shape ${labels[roles.findIndex((x) => x.role === role)]}`;
  const draft: Draft = {
    prompt: `Which shape is cut into ${units(n)}?`,
    hint: `${capital(units(n))} are ${parts(n)} of one whole. Check that the parts are the same size, then count them.`,
    figure: { kind: "partitioned-shapes", shapes },
    explanation: [
      `${capital(units(n))} means the whole is cut into ${parts(n)}.`,
      `${name("unequal")} has ${WORDS[n]} parts, but they are not the same size, so they are not ${units(n)}.`,
      `${name("count")} has equal parts, but ${WORDS[m]} of them: those are ${units(m)}.`,
      `${name("correct")} has ${parts(n)}: it is cut into ${units(n)}.`,
    ],
    ordered: true,
    choices: roles.map(({ role }, i) => {
      const label = `Shape ${labels[i]}`;
      if (role === "correct") return { label, correct: true };
      return {
        label,
        feedback:
          role === "unequal"
            ? `${label} has ${WORDS[n]} parts, but they are different sizes. ${capital(units(n))} must be equal parts.`
            : `${label} has equal parts, but there are ${WORDS[m]} of them. ${capital(units(n))} means ${WORDS[n]} equal parts.`,
      };
    }),
  };
  return draft;
}

function nameShare(r: Random, k: number, n: number, pool: [number, number][]) {
  const shape = equalShape(r, n);
  shape.shaded = shadeSome(r, n, k);
  const noun = shape.shape;
  const answer = shareName(k, n);
  const value = (a: number, b: number) => `${a / gcd(a, b)}/${b / gcd(a, b)}`;
  const used = new Set([value(k, n)]);
  const choices: Choice[] = [{ label: answer, correct: true }];
  for (const [a, b] of pool) {
    if (choices.length === 4) break;
    if (used.has(value(a, b))) continue;
    used.add(value(a, b));
    choices.push({
      label: shareName(a, b),
      feedback:
        b !== n
          ? `“${capital(shareName(a, b))}” names parts of a whole cut into ${WORDS[b]} equal parts. This ${noun} has ${parts(n)}, so each part is one ${unit(n)}.`
          : a === n - k
            ? `${capital(WORDS[a])} ${a === 1 ? "part is" : "parts are"} not shaded. Count the shaded parts: ${WORDS[k]}.`
            : `Count the shaded parts again: ${WORDS[k]} ${k === 1 ? "part is" : "parts are"} shaded.`,
    });
  }
  const draft: Draft = {
    prompt: `The ${noun} is cut into equal parts. How much of the ${noun} is shaded?`,
    hint: "Count all the equal parts to name their size. Then count the shaded parts.",
    figure: { kind: "partitioned-shapes", shapes: [shape] },
    explanation: [
      `The ${noun} is cut into ${parts(n)}, so each part is one ${unit(n)}.`,
      k === n
        ? `All ${WORDS[n]} parts are shaded: ${answer} make the whole ${noun}.`
        : `${capital(WORDS[k])} of the ${WORDS[n]} parts ${k === 1 ? "is" : "are"} shaded: ${answer}.`,
    ],
    choices,
  };
  return draft;
}

function sameShare(r: Random, equal: boolean): Draft {
  const shape = pick(r, ["square", "rectangle"] as const);
  let n1: number, n2: number, c1: Cut, c2: Cut;
  if (equal) {
    // Three strips of a square are congruent; a rectangle's are not.
    n1 = n2 = pick(r, shape === "square" ? [2, 4] : [2, 3, 4]);
    const cuts = shuffle(r, equalCuts(shape, n1));
    [c1, c2] = [cuts[0]!, cuts[1]!];
  } else {
    [n1, n2] = shuffle(r, [2, 3, 4]).slice(0, 2) as [number, number];
    c1 = pick(r, equalCuts(shape, n1));
    c2 = pick(
      r,
      equalCuts(shape, n2).filter((c) => c !== c1),
    );
  }
  const a: PartitionedShape = {
    shape,
    cut: c1,
    sizes: Array<number>(n1).fill(1),
    shaded: [r(0, n1 - 1)],
    label: "A",
  };
  const b: PartitionedShape = {
    shape,
    cut: c2,
    sizes: Array<number>(n2).fill(1),
    shaded: [r(0, n2 - 1)],
    label: "B",
  };
  const larger = n1 < n2 ? "A" : "B";
  const same = "They are the same amount.";
  const describe = (label: string, n: number) =>
    `${label} is cut into ${parts(n)}, so its shaded part is one ${unit(n)}.`;
  return {
    prompt: `${capital(shape)}s A and B are the same size. Which is true about their shaded parts?`,
    hint: "Name each shaded part by counting the equal parts in its whole. The shape of a part does not decide its size.",
    figure: { kind: "partitioned-shapes", shapes: [a, b] },
    explanation: [
      describe("A", n1),
      describe("B", n2),
      equal
        ? `Both are one ${unit(n1)} of the same-size ${shape}, so they are the same amount, even though their shapes are different.`
        : `One ${unit(Math.min(n1, n2))} is larger than one ${unit(Math.max(n1, n2))}: cutting the same whole into more equal parts makes each part smaller.`,
    ],
    choices: [
      {
        label: "A's shaded part is larger.",
        ...(!equal && larger === "A"
          ? { correct: true as const }
          : {
              feedback: equal
                ? `Both shaded parts are one ${unit(n1)} of the same whole. A different shape is not a different amount.`
                : `A's shaded part is one ${unit(n1)}; B's is one ${unit(n2)}. More equal parts make smaller parts.`,
            }),
      },
      {
        label: "B's shaded part is larger.",
        ...(!equal && larger === "B"
          ? { correct: true as const }
          : {
              feedback: equal
                ? `Both shaded parts are one ${unit(n1)} of the same whole. A different shape is not a different amount.`
                : `B's shaded part is one ${unit(n2)}; A's is one ${unit(n1)}. More equal parts make smaller parts.`,
            }),
      },
      {
        label: same,
        ...(equal
          ? { correct: true as const }
          : {
              feedback: `The shaded parts have different names: one ${unit(n1)} and one ${unit(n2)}. They are not the same amount.`,
            }),
      },
    ],
    ordered: true,
  };
}

const GRIDS: [number, number, number[]][] = [
  [4, 3, [2, 3, 4, 6]],
  [4, 4, [2, 4, 8]],
  [6, 2, [2, 3, 4, 6]],
  [6, 3, [2, 3, 6]],
  [6, 4, [2, 3, 4, 6, 8]],
  [8, 2, [2, 4, 8]],
  [8, 3, [2, 3, 4, 6, 8]],
  [5, 4, [2, 4]],
];
/** A region is bent when it does not fill its bounding rectangle. */
function bent(columns: number, regions: number[]) {
  const count = Math.max(...regions) + 1;
  return Array.from({ length: count }, (_, region) => {
    const cells = regions.flatMap((r, i) => (r === region ? [i] : []));
    const rows = new Set(cells.map((i) => Math.floor(i / columns))).size,
      cols = new Set(cells.map((i) => i % columns)).size;
    return rows * cols !== cells.length;
  }).some(Boolean);
}
/** Grid splittings whose equal-area parts include a bent part, so equal area
 * is visibly not the same as equal shape. */
const PARTITIONS = GRIDS.flatMap(([columns, rows, counts]) =>
  counts.flatMap((n) =>
    [false, true].flatMap((byColumn) => {
      const regions = snakeRegions(columns, rows, n, byColumn);
      return bent(columns, regions) ? [{ columns, rows, n, regions }] : [];
    }),
  ),
);
function areaPartition(r: Random, units: boolean) {
  const { columns, rows, n, regions } = pick(r, PARTITIONS);
  return {
    figure: {
      kind: "area-partition" as const,
      columns,
      rows,
      regions,
      shaded: [r(0, n - 1)],
      units,
    },
    n,
    cells: columns * rows,
  };
}

function compareDraft(
  r: Random,
  [a, b]: [number, number],
  [c, d]: [number, number],
  explain: (greater: string, lesser: string) => string[],
): Draft {
  const ask = r(0, 1) ? "greater" : "less";
  const first = `${a}/${b}`,
    second = `${c}/${d}`;
  const [greater, lesser] = a * d > c * b ? [first, second] : [second, first];
  return {
    prompt: `Which is ${ask}: ${first} or ${second} of the same whole? Enter that fraction.`,
    hint: "Picture both fractions on one whole. Ask how big each piece is and how many pieces there are.",
    figure: {
      kind: "fraction-bars",
      bars: [
        { parts: b, shaded: 0, label: first },
        { parts: d, shaded: 0, label: second },
      ],
    },
    explanation: [
      ...explain(greater, lesser),
      `${greater} > ${lesser}, so the ${ask === "greater" ? "greater" : "lesser"} fraction is ${ask === "greater" ? greater : lesser}.`,
    ],
    answer: ask === "greater" ? greater : lesser,
  };
}

function draft(templateId: string, r: Random): Draft {
  switch (templateId) {
    case "find-equal-shares":
      return findEqualShares(r, [2, 4], [2, 4]);
    case "find-equal-thirds":
      return findEqualShares(r, [2, 3, 3, 4], [2, 3, 4]);
    case "name-equal-share": {
      const [k, n] = pick(r, [
        [1, 2],
        [1, 2],
        [1, 4],
        [2, 4],
        [3, 4],
      ] as const);
      return nameShare(
        r,
        k,
        n,
        shuffle(r, [
          [1, 2],
          [1, 4],
          [2, 4],
          [3, 4],
        ] as [number, number][]),
      );
    }
    case "name-share": {
      const n = pick(r, [2, 3, 3, 4]);
      const k = r(0, 4) === 0 ? n : r(1, n - 1);
      const pool: [number, number][] = [];
      if (n - k >= 1) pool.push([n - k, n]);
      for (const other of shuffle(
        r,
        [2, 3, 4].filter((x) => x !== n),
      ))
        if (k <= other) pool.push([k, other]);
      for (const [a, b] of shuffle(r, [
        [1, 2],
        [1, 3],
        [2, 3],
        [1, 4],
        [3, 4],
        [2, 2],
        [3, 3],
      ] as [number, number][]))
        pool.push([a, b]);
      return nameShare(r, k, n, pool);
    }
    case "larger-share": {
      const shape = pick(r, SHAPES);
      const halvesFirst = r(0, 1) === 1;
      const half = equalShape(r, 2, shape),
        quarter = equalShape(r, 4, shape);
      half.shaded = [r(0, 1)];
      quarter.shaded = [r(0, 3)];
      const [first, second] = halvesFirst ? [half, quarter] : [quarter, half];
      const ask = r(0, 1) ? "larger" : "smaller";
      const [h, q] = halvesFirst ? ["A", "B"] : ["B", "A"];
      return {
        prompt: `Shapes A and B are the same size. Which shaded piece is ${ask}: one half or one quarter?`,
        hint: "Both wholes are the same size. Which whole is cut into more equal pieces?",
        figure: {
          kind: "partitioned-shapes",
          shapes: [
            { ...first, label: "A" },
            { ...second, label: "B" },
          ],
        },
        explanation: [
          `Shape ${h} is cut into 2 equal pieces, so its shaded piece is one half.`,
          `Shape ${q} is cut into 4 equal pieces, so its shaded piece is one quarter.`,
          "The same whole cut into more equal pieces has smaller pieces. Two quarters fill one half.",
          `One half is larger than one quarter, so the ${ask} piece is one ${ask === "larger" ? "half" : "quarter"}.`,
        ],
        choices: [
          {
            label: "one half",
            ...(ask === "larger"
              ? { correct: true as const }
              : {
                  feedback:
                    "One half is the larger piece: the whole is cut into only 2 pieces. The smaller piece comes from cutting the same whole into 4.",
                }),
          },
          {
            label: "one quarter",
            ...(ask === "smaller"
              ? { correct: true as const }
              : {
                  feedback:
                    "Four is more pieces than 2, but the pieces are smaller. Two quarters fit inside one half.",
                }),
          },
          {
            label: "They are the same size.",
            feedback:
              "The wholes are the same size, but one is cut into more pieces. More equal pieces means smaller pieces.",
          },
        ],
        ordered: true,
      };
    }
    case "same-share-different-shape":
      return sameShare(r, r(0, 1) === 1);
    case "equal-area-fraction": {
      const { figure, n, cells } = areaPartition(r, true);
      const size = cells / n;
      return {
        prompt:
          "The rectangle is split into parts with equal area. What fraction of the rectangle's area is the shaded part?",
        hint: "Count the parts. Parts with equal area are equal shares of the whole, even when their shapes differ.",
        figure,
        explanation: [
          `The rectangle covers ${cells} unit squares, and each part covers ${size} of them.`,
          `${n} parts of ${size} squares fill the rectangle: ${n} × ${size} = ${cells}.`,
          `The shaded part is one of ${n} equal shares, so it is 1/${n} of the area.`,
        ],
        answer: `1/${n}`,
      };
    }
    case "equal-area-part-size": {
      const { figure, n, cells } = areaPartition(r, false);
      return {
        prompt: `The rectangle's area is ${cells} square units. It is split into parts with equal area. What is the area of the shaded part, in square units?`,
        hint: "Count the equal parts. The shaded part is one of them, so it gets that fraction of the whole area.",
        figure,
        explanation: [
          `The rectangle is split into ${n} parts with equal area, so the shaded part is 1/${n} of the area.`,
          `${cells} ÷ ${n} = ${cells / n}, so each part has an area of ${cells / n} square units.`,
          `Check: ${n} × ${cells / n} = ${cells}.`,
        ],
        answer: `${cells / n}`,
      };
    }
    case "compare-like-denominators": {
      const d = pick(r, [2, 3, 4, 6, 8]);
      const a = r(1, d);
      let b = r(1, d - 1);
      if (b >= a) b++;
      return compareDraft(r, [a, d], [b, d], (greater, lesser) => [
        `Both fractions use the same piece: 1/${d} of the whole.`,
        `${greater} is ${pieces(Number(greater.split("/")[0]))}; ${lesser} is ${pieces(Number(lesser.split("/")[0]))}. More pieces of the same size make more of the whole.`,
      ]);
    }
    case "compare-like-numerators": {
      const [b, d] = shuffle(r, [2, 3, 4, 6, 8]).slice(0, 2) as [
        number,
        number,
      ];
      const a = r(1, Math.min(b, d) - 1);
      const [few, many] = b < d ? [b, d] : [d, b];
      return compareDraft(r, [a, b], [a, d], () => [
        `Both fractions have ${pieces(a)}, so compare the size of one piece.`,
        `A whole cut into ${few} equal pieces has larger pieces than the same whole cut into ${many}: 1/${few} > 1/${many}.`,
        `${pieces(a)} of size 1/${few} ${a === 1 ? "is" : "make"} more than ${pieces(a)} of size 1/${many}.`,
      ]);
    }
    case "compare-unlike-fractions": {
      let b: number, d: number, a: number, c: number;
      do {
        [b, d] = shuffle(r, [2, 3, 4, 5, 6, 8, 10, 12]).slice(0, 2) as [
          number,
          number,
        ];
        a = r(1, b - 1);
        c = r(1, d - 1);
      } while (a === c || a * d === c * b);
      const l = (b * d) / gcd(b, d);
      return compareDraft(r, [a, b], [c, d], () => {
        const steps: string[] = [];
        // One-half benchmark: one fraction is below a half, the other above.
        if ((2 * a - b) * (2 * c - d) < 0) {
          const [low, high] =
            2 * a < b ? [`${a}/${b}`, `${c}/${d}`] : [`${c}/${d}`, `${a}/${b}`];
          steps.push(
            `Use 1/2 as a benchmark: ${low} is less than one half and ${high} is more than one half.`,
          );
        }
        if (a === b - 1 && c === d - 1) {
          const [coarse, fine] = b < d ? [b, d] : [d, b];
          steps.push(
            `Each fraction is one piece short of a whole. The missing piece 1/${fine} is smaller than 1/${coarse}, so ${b > d ? `${a}/${b}` : `${c}/${d}`} is closer to 1.`,
          );
        }
        steps.push(
          `Rename both with the common denominator ${l}: ${[
            [a, b],
            [c, d],
          ]
            .map(([n, m]) =>
              m === l
                ? `${n}/${m} already has it`
                : `${n}/${m} = ${(n! * l) / m!}/${l}`,
            )
            .join(" and ")}.`,
          `Now the pieces are the same size, so compare the counts: ${Math.max((a * l) / b, (c * l) / d)}/${l} > ${Math.min((a * l) / b, (c * l) / d)}/${l}.`,
        );
        return steps;
      });
    }
  }
  throw new Error(`Unknown part–whole template: ${templateId}`);
}

export function generatePartWholeProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = partWholeTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown part–whole template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const d = draft(templateId, r);
  const id = createHash("sha256")
    .update(JSON.stringify([templateId, 1, seed]))
    .digest("hex");
  const base = {
    id,
    templateId,
    templateVersion: 1 as const,
    seed,
    prompt: d.prompt,
    skillId: meta.skillId,
    ...(d.figure ? { figure: d.figure } : {}),
  };
  if (!d.choices) {
    const kind = definitions.find((x) => x.id === templateId)!.response as
      "fraction" | "number";
    return {
      public: {
        ...base,
        response: {
          kind,
          label: kind === "fraction" ? "Fraction" : "Area in square units",
        },
      },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  }
  const choices = d.ordered ? d.choices : shuffle(r, [...d.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((choice, index) => {
    const optionId = `option-${"abcd"[index]}`;
    if (choice.correct) answer = optionId;
    else choiceFeedback[optionId] = choice.feedback!;
    return { id: optionId, label: choice.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: d.explanation,
    hint: d.hint,
    choiceFeedback,
  };
}
