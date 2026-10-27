import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { table } from "./scene/author";
import { assemble, random, shuffle, type Draft } from "./distribution-practice";

/**
 * State-standard gaps in data displays and consumer statistics: constructing
 * stem-and-leaf plots and frequency tables, reading circle graphs, choosing a
 * display, and checking an investment claim.
 *
 * The scene framework has no sector drawing, and shared renderers are not
 * changed here, so a circle graph is presented as the table of its sectors
 * (percent, central angle or count) rather than as a drawn circle.
 */
const choice = { requiredResponseCapability: "single-choice-v1" } as const;

export const dataDisplayStateTemplates: readonly TemplateMetadata[] = [
  {
    id: "stem-leaf-construct",
    version: 1,
    ...choice,
    requiredFigureCapability: "scenes-v1",
    title: "Build a stem-and-leaf plot",
    skillId: "distribution-plots",
    gradeBand: "3–5",
    difficultyOffset: -0.3,
    description:
      "From a raw list of whole-number or one-decimal data, choose the stem-and-leaf plot with ordered leaves, repeated leaves and empty stems kept, or the key that matches a plot.",
  },
  {
    id: "frequency-table-build",
    version: 1,
    ...choice,
    requiredFigureCapability: "data-displays-v1",
    title: "Build a frequency table",
    skillId: "picture-bar-graphs",
    gradeBand: "3–5",
    difficultyOffset: 0.6,
    description:
      "Count whole-number data from a list or a dot plot into a frequency table, including a value that never occurs and equal-width intervals.",
  },
  {
    id: "circle-graph-read",
    version: 1,
    ...choice,
    requiredFigureCapability: "scenes-v1",
    title: "Read a circle graph",
    skillId: "percentages",
    gradeBand: "6–8",
    difficultyOffset: 0.2,
    description:
      "Connect the percent, central angle and count of a circle-graph sector, and compare sectors, using the table of the graph's sectors.",
  },
  {
    id: "best-display-choice",
    version: 1,
    ...choice,
    title: "Choose the best display",
    skillId: "distribution-plots",
    gradeBand: "6–8",
    difficultyOffset: 0,
    description:
      "Choose the display that fits a situation: circle graph, bar graph, line graph, histogram, scatterplot, or dot plot or stem-and-leaf plot.",
  },
  {
    id: "return-claim-check",
    version: 1,
    ...choice,
    title: "Check an investment claim",
    skillId: "percent-change",
    gradeBand: "6–8",
    difficultyOffset: 0.5,
    description:
      "Compare simple yearly rates of return, and check a stated return against the rate computed from the amounts and the time.",
  },
];

const byId = (id: string) =>
  dataDisplayStateTemplates.find((t) => t.id === id)!;
type Wrong = { label: string; feedback: string };
type Random = ReturnType<typeof random>;

function checkSeed(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
}
/** The correct choice plus three distinct wrong ones. */
function options(
  correct: string,
  wrong: Wrong[],
): NonNullable<Draft["choices"]> {
  const seen = new Set([correct]);
  const kept = wrong.filter(({ label }) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (kept.length < 3) throw new Error("Insufficient distinct choices");
  return [{ label: correct, correct: true }, ...kept.slice(0, 3)];
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
type SceneOf = Extract<SemanticFigure, { kind: "scene" }>["scene"];
const sceneFigure = (scene: SceneOf): SemanticFigure => ({
  kind: "scene",
  scene,
});

/* ------------------------------------------------------------------ */
/* Stem-and-leaf construction                                          */
/* ------------------------------------------------------------------ */

type Row = { stem: number; leaves: number[] };
const stemOf = (v: number) => Math.floor(v / 10);
const leafOf = (v: number) => v % 10;
/** Every stem from the least to the greatest, an empty row where no value falls. */
const keyLeaf = (row: Row) =>
  row.stem > 0 ? row.leaves.find((l) => l !== 0 && l !== row.stem) : undefined;

function rowsOf(values: number[]): Row[] {
  const sorted = [...values].sort((a, b) => a - b);
  const rows: Row[] = [];
  for (let s = stemOf(sorted[0]!); s <= stemOf(sorted.at(-1)!); s++)
    rows.push({
      stem: s,
      leaves: sorted.filter((v) => stemOf(v) === s).map(leafOf),
    });
  return rows;
}
// Non-breaking spaces keep each row whole, so a choice wraps only between rows.
const plotText = (rows: Row[]) =>
  rows
    .map((row) =>
      row.leaves.length
        ? `${row.stem}\u00a0|\u00a0${row.leaves.join("\u00a0")}`
        : `${row.stem}\u00a0|`,
    )
    .join("; ");
const tenths = (v: number) => `${stemOf(v)}.${leafOf(v)}`;

const leafContexts: [string, string][] = [
  ["minutes each student spent reading last night", "minutes"],
  ["points a team scored in its games", "points"],
  ["seconds runners took to finish a lap", "seconds"],
  ["floors in the buildings on a city block", "floors"],
];
const hundredContexts: [string, string][] = [
  ["grams of cereal in each box", "grams"],
  ["minutes each movie in a festival lasted", "minutes"],
  ["calories in each snack", "calories"],
];
const tenthContexts: [string, string][] = [
  ["lengths of pencils, in centimeters", "cm"],
  ["masses of apples, in hundreds of grams", "hundred grams"],
  ["times to swim a length, in tens of seconds", "ten-second units"],
];

export function stemLeafConstructCase(seed: string) {
  checkSeed(seed);
  const meta = byId("stem-leaf-construct");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const decimal = variant === 2 || (variant === 5 && r(0, 2) === 1);
  const hundreds = variant === 5 && !decimal && r(0, 1) === 1;
  const show = (v: number) => (decimal ? tenths(v) : String(v));
  // Values are stored as stem*10+leaf; a decimal plot shows them over ten.
  let values: number[] = [];
  for (let guard = 0; ; guard++) {
    if (guard > 2000) throw new Error("No stem-and-leaf data found");
    const first = hundreds ? r(10, 13) : variant === 4 ? 0 : r(1, 6);
    const span = variant === 1 ? 4 : variant === 4 ? 3 : r(3, 4);
    const n = r(9, 12);
    const gap = variant === 1 ? first + r(1, span - 2) : -1;
    values = [];
    while (values.length < n) {
      const s = first + r(0, span - 1);
      if (s === gap) continue;
      const v = s * 10 + r(0, 9);
      if (variant === 4 && s === 0 && v === 0) continue;
      values.push(v);
    }
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const repeats = [...counts.values()].some((c) => c >= 2);
    const stems = new Set(values.map(stemOf));
    if (
      stems.size >= 3 &&
      stems.has(first) &&
      new Set(values).size >= 6 &&
      (variant !== 3 || repeats) &&
      (variant !== 5 || rowsOf(values).some((x) => keyLeaf(x) !== undefined)) &&
      (variant !== 5 ||
        [...stems].every(
          (st) => values.filter((v) => stemOf(v) === st).length <= 7,
        )) &&
      (variant !== 1 ||
        (!stems.has(gap) && stems.has(gap - 1) && stems.has(gap + 1)))
    )
      break;
  }
  const rows = rowsOf(values);
  const sorted = [...values].sort((a, b) => a - b);
  const unsorted = shuffle(r, [...values]);
  const [context, unit] = decimal
    ? pick(r, tenthContexts)
    : hundreds
      ? pick(r, hundredContexts)
      : pick(r, leafContexts);
  const listed = unsorted.map(show).join(", ");
  const least = sorted[0]!;
  const greatest = sorted.at(-1)!;
  const rule = decimal
    ? "Use the whole-number part as the stem and the tenths digit as the leaf."
    : hundreds
      ? "Use every digit except the last as the stem and the last digit as the leaf."
      : "Use the tens digit as the stem and the ones digit as the leaf.";

  if (variant === 5) {
    // Choose the key for a finished plot.
    // The key's stem and leaf must differ from each other and the leaf must not be 0,
    // or the sum and swap distractors would equal the correct meaning.
    const row = rows.find((x) => keyLeaf(x) !== undefined)!;
    const leaf = keyLeaf(row)!;
    const sample = row.stem * 10 + leaf;
    const keyLabel = (meaning: string) =>
      `$${row.stem}\\mid ${leaf}$ means $${meaning}$ ${unit}`;
    const correct = keyLabel(show(sample));
    const swapped = leafOf(sample) * 10 + stemOf(sample);
    const wrong: Wrong[] = decimal
      ? [
          {
            label: keyLabel(String(sample)),
            feedback:
              "A key with a decimal point puts the leaf in the tenths place. These data have tenths, so the point goes between the stem and the leaf.",
          },
          {
            label: keyLabel(`0.${sample}`),
            feedback:
              "The stem keeps its place. The leaf is the tenths digit after the point, so the stem is the whole-number part.",
          },
          {
            label: keyLabel(String(row.stem + leaf)),
            feedback:
              "A stem and a leaf are digits of one number. Write them together; do not add them.",
          },
          {
            label: keyLabel(`${leafOf(sample)}.${stemOf(sample)}`),
            feedback:
              "The stem comes first and the leaf second. Swapping them changes the number.",
          },
        ]
      : [
          {
            label: keyLabel(tenths(sample)),
            feedback:
              "These data are whole numbers, so there is no decimal point. The stem is the leading digits and the leaf is the last digit.",
          },
          {
            label: keyLabel(String(row.stem + leaf)),
            feedback:
              "A stem and a leaf are digits of one number. Write them together; do not add them.",
          },
          {
            label: keyLabel(String(swapped)),
            feedback:
              "The stem comes first and the leaf second. Swapping them changes the number.",
          },
          {
            label: keyLabel(String(sample * 10)),
            feedback:
              "The leaf is the last digit, so the stem is tens and the leaf is ones. Nothing is multiplied by 10 again.",
          },
        ];
    return {
      values,
      variant,
      problem: assemble(meta, seed, r, {
        prompt: `This stem-and-leaf plot shows these ${values.length} values, the ${context}: ${listed}. Which key matches the plot?`,
        figure: sceneFigure(
          table({
            id: "plot",
            corner: "Stem",
            columns: ["Leaf"],
            rows: rows.map((x) => ({
              label: String(x.stem),
              cells: [x.leaves.length ? x.leaves.join(" ") : " "],
            })),
          }).scene(),
        ),
        answer: "",
        hint: `Pick one row, such as stem ${row.stem}. Find the value in the list that starts with those digits and has ${leaf} as its last digit. Then decide where the decimal point is, if any.`,
        explanation: [
          `The row with stem ${row.stem} has the leaf ${leaf}.`,
          `The list contains ${show(sample)}, which is stem ${row.stem} followed by leaf ${leaf}${decimal ? ", with the decimal point between them" : ""}.`,
          `So the key is: ${row.stem} | ${leaf} means ${show(sample)} ${unit}.`,
        ],
        choices: options(correct, wrong),
      }),
    };
  }

  // Build the plot from the raw list.
  const correct = plotText(rows);
  const rowLabel = (rs: Row[]) => plotText(rs);
  const clone = (rs: Row[]) =>
    rs.map((x) => ({ stem: x.stem, leaves: [...x.leaves] }));
  const unordered = (() => {
    const rs = clone(rows);
    const target = [...rs].sort(
      (a, b) => new Set(b.leaves).size - new Set(a.leaves).size,
    )[0]!;
    target.leaves.reverse();
    return rowLabel(rs);
  })();
  const droppedRepeat = (() => {
    const rs = clone(rows);
    for (const x of rs) {
      const seen = new Set<number>();
      x.leaves = x.leaves.filter((l) =>
        seen.has(l) ? false : (seen.add(l), true),
      );
    }
    return rowLabel(rs);
  })();
  const droppedEmpty = rowLabel(clone(rows).filter((x) => x.leaves.length > 0));
  const swappedRoles =
    greatest < 100
      ? plotText(rowsOf(values.map((v) => leafOf(v) * 10 + stemOf(v))))
      : correct;
  const movedLeaf = (() => {
    const rs = clone(rows);
    const from = rs.findIndex((x) => x.leaves.length > 1);
    const to = from + 1 < rs.length ? from + 1 : from - 1;
    const leaf = rs[from]!.leaves.pop()!;
    rs[to]!.leaves.push(leaf);
    rs[to]!.leaves.sort((a, b) => a - b);
    return rowLabel(rs);
  })();
  const missingGreatest = rowLabel(rowsOf(sorted.slice(0, -1)));
  const missingLeast = rowLabel(rowsOf(sorted.slice(1)));
  const feedback = {
    unordered:
      "Leaves must be in order from least to greatest in each row. The values are right but this row is not ordered.",
    repeat:
      "Write a leaf once for every time its value occurs. A repeated value needs a repeated leaf.",
    empty:
      "Keep every stem from the least to the greatest, even a stem with no leaves. Skipping it hides the gap in the data.",
    swapped:
      "The stem is the leading digit or digits and the leaf is the last digit. This plot uses the last digit as the stem.",
    moved:
      "A leaf belongs in the row of its own stem. One value is in the wrong row.",
    missing:
      "Every value in the list must appear as a leaf. Count the leaves and compare with the number of values.",
  };
  const pool: Record<string, Wrong[]> = {
    1: [
      { label: droppedEmpty, feedback: feedback.empty },
      { label: unordered, feedback: feedback.unordered },
      { label: movedLeaf, feedback: feedback.moved },
      { label: swappedRoles, feedback: feedback.swapped },
    ],
    3: [
      { label: droppedRepeat, feedback: feedback.repeat },
      { label: unordered, feedback: feedback.unordered },
      { label: movedLeaf, feedback: feedback.moved },
      { label: swappedRoles, feedback: feedback.swapped },
    ],
  };
  const wrong: Wrong[] = [
    ...(pool[variant] ?? [
      { label: unordered, feedback: feedback.unordered },
      { label: swappedRoles, feedback: feedback.swapped },
      { label: movedLeaf, feedback: feedback.moved },
      { label: droppedRepeat, feedback: feedback.repeat },
    ]),
    { label: missingGreatest, feedback: feedback.missing },
    { label: missingLeast, feedback: feedback.missing },
    { label: droppedEmpty, feedback: feedback.empty },
  ];
  const keySample = (() => {
    for (let s = rows[0]!.stem; s <= rows.at(-1)!.stem; s++)
      for (let l = 0; l < 10; l++)
        if (!values.includes(s * 10 + l)) return s * 10 + l;
    return rows[0]!.stem * 10;
  })();
  const emptyRows = rows.filter((x) => !x.leaves.length).map((x) => x.stem);
  return {
    values,
    variant,
    problem: assemble(meta, seed, r, {
      prompt: `These ${values.length} values are the ${context}: ${listed}. Which stem-and-leaf plot shows these data? ${rule} For example, $${stemOf(keySample)}\\mid ${leafOf(keySample)}$ means $${show(keySample)}$ ${unit}.`,
      answer: "",
      hint: `The least value is ${show(least)} and the greatest is ${show(greatest)}, so the stems run from ${stemOf(least)} to ${stemOf(greatest)}. Write each stem once. Then go through the list, put each value's last digit on its stem's row, and order each row.`,
      explanation: [
        `The least value is ${show(least)} (stem ${stemOf(least)}) and the greatest is ${show(greatest)} (stem ${stemOf(greatest)}), so the stems are ${rows.map((x) => x.stem).join(", ")}.`,
        ...rows.map((x) =>
          x.leaves.length
            ? `Stem ${x.stem}: the values ${x.leaves.map((l) => show(x.stem * 10 + l)).join(", ")} give leaves ${x.leaves.join(" ")}, in order.`
            : `Stem ${x.stem}: no value falls here, so the row stays with no leaves.`,
        ),
        `All ${values.length} values appear as leaves${emptyRows.length ? ", and the empty stem is kept" : ""}. The plot is ${correct}.`,
      ],
      choices: options(correct, wrong),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Frequency tables                                                    */
/* ------------------------------------------------------------------ */

const freqContexts: {
  intro: string;
  unit: string;
  lo: number;
  hi: number;
  noun: string;
}[] = [
  {
    intro: "pets each student has",
    unit: "pets",
    lo: 0,
    hi: 5,
    noun: "students",
  },
  {
    intro: "goals a team scored in each game",
    unit: "goals",
    lo: 0,
    hi: 6,
    noun: "games",
  },
  {
    intro: "books each student read this month",
    unit: "books",
    lo: 0,
    hi: 6,
    noun: "students",
  },
  {
    intro: "siblings each child has",
    unit: "siblings",
    lo: 0,
    hi: 5,
    noun: "children",
  },
];
const intervalContexts: { intro: string; unit: string; noun: string }[] = [
  {
    intro: "points scored by each player in a game",
    unit: "points",
    noun: "players",
  },
  {
    intro: "minutes each student spent on homework",
    unit: "minutes",
    noun: "students",
  },
  {
    intro: "number of laps each runner finished",
    unit: "laps",
    noun: "runners",
  },
];

const tableText = (labels: string[], counts: number[]) =>
  labels.map((label, i) => `${label}: ${counts[i]}`).join(", ");

export function frequencyTableCase(seed: string) {
  checkSeed(seed);
  const meta = byId("frequency-table-build");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const grouped = variant === 3 || variant === 4;
  const total = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let values: number[] = [];
  let labels: string[] = [];
  let counts: number[] = [];
  let intro = "";
  let unit = "";
  let noun = "";
  let lo = 0;
  let hi = 0;
  let width = 0;
  for (let guard = 0; ; guard++) {
    if (guard > 2000) throw new Error("No frequency data found");
    if (grouped) {
      const c = pick(r, intervalContexts);
      width = pick(r, [5, 10]);
      lo = 0;
      hi = width * 3 - 1;
      ({ intro, unit, noun } = c);
    } else {
      const c = pick(r, freqContexts);
      ({ intro, unit, noun, lo, hi } = c);
      if (variant === 2) hi = Math.min(hi, 6);
    }
    const n = r(10, 15);
    values = Array.from({ length: n }, () => r(lo, hi));
    if (grouped) {
      labels = [0, 1, 2].map((k) => `${k * width}–${k * width + width - 1}`);
      counts = [0, 1, 2].map(
        (k) => values.filter((v) => Math.floor(v / width) === k).length,
      );
      // Keep values on both ends of an interval so boundaries matter.
      const edges =
        values.some((v) => v % width === 0) &&
        values.some((v) => v % width === width - 1);
      if (!edges || counts.some((x) => x === 0) || new Set(counts).size < 3)
        continue;
    } else {
      labels = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
      counts = labels.map((_, i) => values.filter((v) => v === lo + i).length);
      const zeros = counts.filter((x) => x === 0).length;
      if (new Set(counts).size < 3 || Math.max(...counts) > 7) continue;
      if (variant === 5 ? zeros < 1 || zeros > 2 : variant === 1 && zeros > 1)
        continue;
      if (
        variant === 0 &&
        counts.filter((x) => x === Math.max(...counts)).length > 1
      )
        continue;
    }
    break;
  }
  const n = values.length;
  const listed = shuffle(r, [...values]).join(", ");
  const definition =
    "The frequency of a value is how many times it appears. Each choice is written as value: frequency.";

  // A single count asked for directly.
  if (variant === 0 || variant === 4) {
    const idx =
      variant === 0
        ? counts.findIndex((c) => c === Math.max(...counts))
        : r(0, labels.length - 1);
    const c = counts[idx]!;
    const label = labels[idx]!;
    const value = lo + idx;
    const wrongNumbers: Wrong[] = grouped
      ? [
          {
            label: String(
              values.filter((v) => v > idx * width && v <= idx * width + width)
                .length,
            ),
            feedback: `An interval ${label} includes both end values. A value equal to ${idx * width} belongs to this interval, and a value equal to ${idx * width + width} belongs to the next one.`,
          },
          {
            label: String(counts[(idx + 1) % 3]!),
            feedback: `This counts a different interval. Use the interval ${label}.`,
          },
          {
            label: String(c + counts[(idx + 1) % 3]!),
            feedback: `This adds a second interval. Count only the values from ${idx * width} to ${idx * width + width - 1}.`,
          },
          {
            label: String(n),
            feedback: `${n} is the number of all values, not the number in this interval.`,
          },
        ]
      : [
          {
            label: String(value * c),
            feedback: `${value} × ${c} is the total of those values, not how many there are. Frequency is the count.`,
          },
          {
            label: String(counts[(idx + 1) % counts.length]!),
            feedback: `This counts a different value. Count only the ${value}s.`,
          },
          {
            label: String(values.filter((v) => v >= value).length),
            feedback: `This counts every value from ${value} upward. Count only the values equal to ${value}.`,
          },
          {
            label: String(n),
            feedback: `${n} is the number of all values, not how many are ${value}.`,
          },
        ];
    const wrongExtra: Wrong[] = [c + 1, c - 1, c + 2]
      .filter((x) => x >= 0)
      .map((x) => ({
        label: String(x),
        feedback:
          "Count again, marking each value as you go. Count every matching value once.",
      }));
    return {
      values,
      variant,
      problem: assemble(meta, seed, r, {
        prompt: grouped
          ? `These are data about the ${intro}, for ${n} ${noun}: ${listed}. Each interval includes both of its end values. How many are in the interval ${label}?`
          : `These are data about the ${intro}, for ${n} ${noun}: ${listed}. How many ${noun} have exactly ${value} ${unit}?`,
        answer: "",
        hint: grouped
          ? `Go through the list once. Count a value when it is at least ${idx * width} and at most ${idx * width + width - 1}. Ignore the others.`
          : `Go through the list once and mark every ${value}. Do not count any other number.`,
        explanation: grouped
          ? [
              `The interval ${label} holds the values from ${idx * width} to ${idx * width + width - 1}, both included.`,
              `The values in the list in that range are ${values
                .filter((v) => Math.floor(v / width) === idx)
                .sort((a, b) => a - b)
                .join(", ")}.`,
              `That is ${c} values.`,
            ]
          : [
              `Find every ${value} in the list: there are ${c}.`,
              `The frequency of ${value} is ${c}.`,
            ],
        choices: options(String(c), [...wrongNumbers, ...wrongExtra]),
      }),
    };
  }

  // A whole table to choose.
  const make = (c: number[]) => tableText(labels, c);
  const correct = make(counts);
  const cloneCounts = () => [...counts];
  const up = (() => {
    const c = cloneCounts();
    const i = c.findIndex((x) => x > 0);
    c[i]! += 1;
    return c;
  })();
  const down = (() => {
    const c = cloneCounts();
    const i = c.length - 1 - [...c].reverse().findIndex((x) => x > 0);
    c[i]! -= 1;
    return c;
  })();
  const swapped = (() => {
    const c = cloneCounts();
    const i = 0;
    const j = c.findIndex((x, k) => k > 0 && x !== c[0]);
    [c[i], c[j]] = [c[j]!, c[i]!];
    return c;
  })();
  const times = grouped ? undefined : counts.map((c, i) => c * (lo + i));
  const shifted = grouped
    ? [0, 1, 2].map(
        (k) =>
          values.filter((v) => v > k * width && v <= k * width + width).length,
      )
    : undefined;
  const wrongTables: Wrong[] = [
    {
      label: make(up),
      feedback: `These frequencies add to ${total(up)}, but there are ${n} values. Check that the frequencies add to ${n}.`,
    },
    {
      label: make(down),
      feedback: `These frequencies add to ${total(down)}, but there are ${n} values. A count is one short. Check that the frequencies add to ${n}.`,
    },
    {
      label: make(swapped),
      feedback: "Two frequencies are traded. Count each value on its own.",
    },
  ];
  if (times)
    wrongTables.push({
      label: make(times),
      feedback:
        "This multiplies each value by its count. A frequency is only the count.",
    });
  else if (shifted)
    wrongTables.unshift({
      label: make(shifted),
      feedback: `Each interval includes both of its end values. Here a value equal to the start of an interval was counted in the interval before it.`,
    });
  if (variant === 5)
    wrongTables.unshift({
      label: tableText(
        labels.filter((_, i) => counts[i]! > 0),
        counts.filter((x) => x > 0),
      ),
      feedback: "A value that never occurs still gets a row, with frequency 0.",
    });
  const figure: SemanticFigure | undefined =
    variant === 2
      ? {
          kind: "line-plot",
          denominator: 1,
          start: lo,
          end: hi,
          values,
          mark: "dot",
          unit,
        }
      : undefined;
  const prompt = grouped
    ? `These are data about the ${intro}, for ${n} ${noun}: ${listed}. Which frequency table groups them into intervals? Each interval includes both of its end values. ${definition}`
    : variant === 2
      ? `The dot plot shows the ${intro}, for ${n} ${noun}. Which frequency table matches it? ${definition}`
      : `These are data about the ${intro}, for ${n} ${noun}: ${listed}. Which frequency table matches the data? The table has one row for each whole number from ${lo} to ${hi}. ${definition}`;
  return {
    values,
    variant,
    problem: assemble(meta, seed, r, {
      prompt,
      ...(figure ? { figure } : {}),
      answer: "",
      hint: grouped
        ? `Make a row for each interval: ${labels.join(", ")}. Go through the ${n} values once and put each in the interval that holds it. Check that the frequencies add to ${n}.`
        : `Make a row for each value from ${lo} to ${hi}, even one that never appears. Count how many times each value appears. Check that the frequencies add to ${n}.`,
      explanation: [
        ...labels.map((label, i) =>
          grouped
            ? `Interval ${label}: ${counts[i]} values.`
            : `${label}: appears ${counts[i]} ${counts[i] === 1 ? "time" : "times"}.`,
        ),
        `The frequencies add to ${total(counts)}, which is the number of values. The table is ${correct}.`,
      ],
      choices: options(correct, wrongTables),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Circle graphs (shown as their table of sectors)                      */
/* ------------------------------------------------------------------ */

const circleContexts: {
  who: string;
  about: (n?: number) => string;
  cats: string[];
}[] = [
  {
    who: "students",
    about: (n) => `how ${n ? `${n} ` : ""}students travel to school`,
    cats: ["Walk", "Bus", "Car", "Bike", "Other"],
  },
  {
    who: "students",
    about: (n) => `the favorite lunch of ${n ? `${n} ` : ""}students`,
    cats: ["Pizza", "Salad", "Pasta", "Tacos", "Soup"],
  },
  {
    who: "families",
    about: (n) => `the favorite pet of ${n ? `${n} ` : ""}families`,
    cats: ["Dog", "Cat", "Fish", "Bird", "Other"],
  },
  {
    who: "people",
    about: (n) => `the favorite sport of ${n ? `${n} ` : ""}people`,
    cats: ["Soccer", "Tennis", "Swimming", "Running", "Other"],
  },
];

export function circleGraphCase(seed: string) {
  checkSeed(seed);
  const meta = byId("circle-graph-read");
  const r = random(meta.id, seed);
  const variant = r(0, 6);
  const ctx = pick(r, circleContexts);
  const k = r(0, 1) ? 4 : 5;
  const names = ctx.cats.slice(0, k);
  // Percents are multiples of 5, so every angle is a whole degree.
  let percents: number[] = [];
  for (;;) {
    let left = 20;
    percents = [];
    for (let i = 0; i < k - 1; i++) {
      const maxHere = left - (k - 1 - i);
      const p = r(1, Math.min(maxHere, 8));
      percents.push(p);
      left -= p;
    }
    percents.push(left);
    percents = percents.map((p) => p * 5);
    if (
      percents.every((p) => p >= 5 && p <= 50) &&
      new Set(percents).size === k
    )
      break;
  }
  const N = pick(r, [40, 60, 80, 100, 120, 200]);
  const countOf = (p: number) => (p * N) / 100;
  const angleOf = (p: number) => p * 3.6;
  const target = r(0, k - 1);
  const other = (target + 1 + r(0, k - 2)) % k;
  const p = percents[target]!;
  const name = names[target]!;
  const intro = (n?: number) =>
    `A circle graph shows ${ctx.about(n)}. The table lists the graph's sectors, one row for each.`;
  const makeTable = (
    cols: string[],
    cell: (i: number) => string | number | null,
  ) =>
    sceneFigure(
      table({
        id: "sectors",
        corner: "Sector",
        columns: cols,
        rows: names.map((label, i) => ({ label, cells: [cell(i)] })),
      }).scene(),
    );
  const pc = (x: number) => `${x}%`;
  const deg = (x: number) => `${x}°`;
  let prompt: string;
  let figure: SemanticFigure;
  let correct: string;
  let wrong: Wrong[];
  let hint: string;
  let explanation: string[];
  const fillers = (
    correctValue: number,
    label: (x: number) => string,
  ): Wrong[] =>
    [correctValue + 1, correctValue - 1, correctValue + 5, correctValue * 2]
      .filter((x) => x > 0)
      .map((x) => ({
        label: label(x),
        feedback:
          "Check the arithmetic step by step with the numbers in the table.",
      }));
  if (variant === 0) {
    const c = countOf(p);
    prompt = `${intro(N)} How many ${ctx.who} are in the sector for ${name}?`;
    figure = makeTable(["Percent"], (i) => pc(percents[i]!));
    correct = String(c);
    wrong = [
      {
        label: String(p),
        feedback: `${p}% of ${N} is not ${p}. A percent is a part out of 100, so find ${p}% of the total.`,
      },
      {
        label: String(p * N),
        feedback: `Divide by 100 as well: a percent is out of 100.`,
      },
      {
        label: String(N - c),
        feedback: `This is everyone not in the sector for ${name}.`,
      },
      ...fillers(c, String),
    ];
    hint = `${N} ${ctx.who} is the whole, or 100%. Read the percent for ${name} from the graph, write it as a fraction out of 100, then take that fraction of ${N}.`;
    explanation = [
      `${p}% means ${p} out of 100, so the count is $${p}\\div100\\times${N}$.`,
      `${N} × ${p} ÷ 100 = ${c}.`,
    ];
  } else if (variant === 1) {
    const c = countOf(p);
    prompt = `${intro(N)} What percent of the circle is the sector for ${name}?`;
    figure = makeTable(["Number"], (i) => countOf(percents[i]!));
    correct = pc(p);
    wrong = [
      {
        label: pc(c),
        feedback: `${c} is a count. Divide it by the total ${N} and write the result as a percent.`,
      },
      {
        label: pc(Math.round((N / c) * 10) / 10),
        feedback: `Divide the part by the whole: ${c} ÷ ${N}, not ${N} ÷ ${c}.`,
      },
      {
        label: pc(100 - p),
        feedback: `This is the share of everyone except ${name}.`,
      },
      ...fillers(p, pc),
    ];
    hint = `The whole circle is all ${N} ${ctx.who}. Write ${name}'s number as a fraction of ${N}, then change it to a percent out of 100.`;
    explanation = [
      `The share is $${c}\\div${N}$.`,
      `${c} ÷ ${N} = ${p / 100}, which is ${p}%.`,
    ];
  } else if (variant === 2) {
    const a = angleOf(p);
    prompt = `${intro()} The full circle is 360°. What is the central angle of the sector for ${name}?`;
    figure = makeTable(["Percent"], (i) => pc(percents[i]!));
    correct = deg(a);
    wrong = [
      {
        label: deg(p),
        feedback: `A percent is not a number of degrees. The whole circle is 360°, so ${p}% of 360° is the angle.`,
      },
      {
        label: deg(p * 3),
        feedback: `One percent of the circle is 3.6°, not 3°.`,
      },
      {
        label: deg(360 - a),
        feedback: `This is the rest of the circle. The sector itself is ${p}% of 360°.`,
      },
      ...fillers(a, deg),
    ];
    hint = `The whole circle is 100% and 360°. Find how many degrees are in 1%, then multiply by ${p}.`;
    explanation = [`The angle is ${p}% of 360°.`, `${p} ÷ 100 × 360 = ${a}°.`];
  } else if (variant === 3) {
    const a = angleOf(p);
    prompt = `${intro()} The full circle is 360°. What percent of the circle is the sector for ${name}?`;
    figure = makeTable(["Angle"], (i) => deg(angleOf(percents[i]!)));
    correct = pc(p);
    wrong = [
      {
        label: pc(a),
        feedback: `${a}° is an angle. Divide it by 360° to find the part of the whole circle.`,
      },
      {
        label: pc(Math.round((a / 3) * 10) / 10),
        feedback: `1% of the circle is 3.6°, not 3°.`,
      },
      {
        label: pc(100 - p),
        feedback: `This is the share of everything except ${name}.`,
      },
      ...fillers(p, pc),
    ];
    hint = `The sector for ${name} is ${a}° of a 360° circle. Write that as a fraction of 360, then as a percent.`;
    explanation = [
      `The share is $${a}\\div360$.`,
      `${a} ÷ 360 = ${p / 100}, which is ${p}%.`,
    ];
  } else if (variant === 4) {
    const a = angleOf(p);
    const c = countOf(p);
    prompt = `${intro(N)} How many ${ctx.who} are in the sector for ${name}?`;
    figure = makeTable(["Angle"], (i) => deg(angleOf(percents[i]!)));
    correct = String(c);
    wrong = [
      {
        label: String(a),
        feedback: `${a}° is the angle. Find that share of ${N}: divide ${a} by 360, then multiply by ${N}.`,
      },
      {
        label: String(Math.round((a * N) / 100)),
        feedback: `The whole circle is 360°, not 100°. Divide the angle by 360.`,
      },
      {
        label: String(N - c),
        feedback: `This is everyone not in the sector for ${name}.`,
      },
      ...fillers(c, String),
    ];
    hint = `The ${a}° sector is part of the whole 360° circle, and the whole circle is all ${N} ${ctx.who}. Write the share as ${a} out of 360.`;
    explanation = [
      `The share is $${a}\\div360=${p / 100}$.`,
      `${p / 100} × ${N} = ${c}.`,
    ];
  } else if (variant === 5) {
    const a = percents[target]!;
    const b = percents[other]!;
    const diff = countOf(Math.abs(a - b));
    const [big, small] = a > b ? [target, other] : [other, target];
    prompt = `${intro(N)} How many more ${ctx.who} are in the sector for ${names[big]} than in the sector for ${names[small]}?`;
    figure = makeTable(["Percent"], (i) => pc(percents[i]!));
    correct = String(diff);
    wrong = [
      {
        label: String(Math.abs(a - b)),
        feedback: `The difference of the percents is ${Math.abs(a - b)} percentage points. Find that share of ${N} to get people.`,
      },
      {
        label: String(countOf(a + b)),
        feedback: `This adds the two sectors. The question asks for the difference.`,
      },
      {
        label: String(countOf(Math.max(a, b))),
        feedback: `This is only the larger sector. Subtract the smaller sector's count.`,
      },
      ...fillers(diff, String),
    ];
    hint = `Find how many are in the sector for ${names[big]} and in the sector for ${names[small]}, using ${N} as the whole. Then subtract.`;
    explanation = [
      `${names[big]}: ${percents[big]}% of ${N} = ${countOf(percents[big]!)}.`,
      `${names[small]}: ${percents[small]}% of ${N} = ${countOf(percents[small]!)}.`,
      `${countOf(percents[big]!)} − ${countOf(percents[small]!)} = ${diff}.`,
    ];
  } else {
    // The last sector is the rest of the circle.
    const last = k - 1;
    const rest = percents[last]!;
    const a = angleOf(rest);
    prompt = `${intro()} The table leaves out the last sector, ${names[last]}. The sectors fill the whole circle, which is 360°. What is the central angle of the sector for ${names[last]}?`;
    figure = makeTable(["Percent"], (i) =>
      i === last ? null : pc(percents[i]!),
    );
    correct = deg(a);
    wrong = [
      {
        label: deg(rest),
        feedback: `${rest}% is the missing percent, not an angle. Change it to degrees with 360°.`,
      },
      {
        label: deg(rest * 3),
        feedback: `One percent of the circle is 3.6°, not 3°.`,
      },
      {
        label: deg(360 - a),
        feedback: `This is the angle for all the other sectors together. The last sector is the rest.`,
      },
      ...fillers(a, deg),
    ];
    hint = `The percents of all sectors add to 100%. Add the ${k - 1} given percents and subtract from 100% to find the missing percent, then use 360° for the whole circle.`;
    explanation = [
      `The given percents add to ${percents.slice(0, last).reduce((x, y) => x + y, 0)}%, so ${names[last]} is ${rest}%.`,
      `${rest}% of 360° is ${rest} ÷ 100 × 360 = ${a}°.`,
    ];
  }
  return {
    percents,
    N,
    variant,
    problem: assemble(meta, seed, r, {
      prompt,
      figure,
      answer: "",
      hint,
      explanation,
      choices: options(correct, wrong),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Choose the best display                                             */
/* ------------------------------------------------------------------ */

type Display = "circle" | "bar" | "line" | "histogram" | "scatter" | "dotstem";
const displayName: Record<Display, string> = {
  circle: "Circle graph",
  bar: "Bar graph",
  line: "Line graph",
  histogram: "Histogram",
  scatter: "Scatterplot",
  dotstem: "Dot plot or stem-and-leaf plot",
};
const displayJob: Record<Display, string> = {
  circle:
    "shows how the parts of one whole compare, as shares that add to 100%",
  bar: "compares the counts or amounts of separate categories",
  line: "shows how one quantity changes over time",
  histogram:
    "shows how many values of a large numerical data set fall in each interval",
  scatter:
    "shows whether two numerical measures of the same people or things are related",
  dotstem: "shows every value of a small numerical data set",
};
/** Displays that could also answer a scenario and so are never offered with it. */
const excluded: Record<Display, Display[]> = {
  circle: ["bar"],
  bar: ["circle", "histogram"],
  line: ["bar", "scatter"],
  histogram: ["bar", "dotstem"],
  scatter: ["line", "bar"],
  dotstem: ["histogram", "bar"],
};
const scenarios: Record<Display, { text: string; cue: string }[]> = {
  circle: [
    {
      text: "A school spends $2,400 on a field trip: $1,200 on buses, $600 on tickets, $400 on lunch and $200 on supplies. You want to show what share of the whole budget each part takes.",
      cue: "The four amounts add up to one $2,400 budget, and the question is about each part's share of it.",
    },
    {
      text: "In a survey of 500 voters, every voter named exactly one favorite season. You want to show what part of all voters chose each season.",
      cue: "Each voter is in exactly one group, so the groups together make all 500 voters, and the question is about each group's share.",
    },
    {
      text: "A family tracks how 24 hours of a day is split among sleep, school, play and meals. You want to show how the day divides into parts.",
      cue: "The parts are pieces of one 24-hour day and together fill it.",
    },
    {
      text: "A farm sold 1,000 eggs: 400 white, 350 brown and 250 speckled. You want to show each color as a part of all the eggs sold.",
      cue: "The three colors together are all 1,000 eggs, and the question is about each color's part of that whole.",
    },
  ],
  bar: [
    {
      text: "A class counts its pets: 9 dogs, 6 cats, 4 fish and 3 birds. You want to compare how many pets there are of each kind.",
      cue: "Each of the 4 kinds of pet is a separate category with its own count, and the goal is to compare the counts.",
    },
    {
      text: "Four bakeries each report how many loaves they sold on Saturday. You want to compare the four totals.",
      cue: "The four bakeries are separate groups with one total each, and the goal is to compare them.",
    },
    {
      text: "A school lists the number of books its library has in five subjects. You want to see which subject has the most books.",
      cue: "The five subjects are separate categories with a count each, and the goal is to see which count is greatest.",
    },
    {
      text: "A coach records how many goals each of six players scored this season. You want to compare the players.",
      cue: "Each player is a separate category with one count.",
    },
  ],
  line: [
    {
      text: "A town records its population every ten years from 1950 to 2020. You want to show how the population has changed over those years.",
      cue: "The measurements are taken at equally spaced times from 1950 to 2020, and the goal is to show how one quantity changes as time passes.",
    },
    {
      text: "A plant's height is measured every week for 12 weeks. You want to show how its height changes from week to week.",
      cue: "Each of the 12 heights goes with a week, and the goal is to show the change from week to week.",
    },
    {
      text: "A store records its monthly sales for one year. You want to show whether sales rose or fell through the year.",
      cue: "The sales are recorded month after month, and the goal is to see the change over time.",
    },
    {
      text: "A thermometer reading is taken every hour for a day. You want to show how the temperature changed during the day.",
      cue: "One quantity is measured at many times, and the goal is the change over the day.",
    },
  ],
  histogram: [
    {
      text: "A park records the ages, in whole years, of 300 visitors. You want to group the ages into intervals such as 0–9, 10–19 and 20–29 and see where most visitors fall.",
      cue: "There are 300 numerical values, too many to show one by one, and the goal is to see how many fall in each interval.",
    },
    {
      text: "A teacher has the scores, from 0 to 100, of 250 students on a state test. You want to group them into intervals of 10 points and see the shape of the scores.",
      cue: "There are 250 numerical scores to group into equal-width intervals, and the goal is the shape of the whole set.",
    },
    {
      text: "A factory measures the lengths of 400 bolts and wants to see how many fall in each 0.5-millimeter interval.",
      cue: "There are 400 numerical measurements to group into equal-width intervals.",
    },
    {
      text: "A city records the waiting time, in minutes, of 600 callers. You want to show how many waited 0–4 minutes, 5–9 minutes, and so on.",
      cue: "There are 600 numerical values to place in equal-width intervals, and the goal is how many fall in each.",
    },
  ],
  scatter: [
    {
      text: "For 30 students, you have the hours each studied and the score each earned on a test. You want to see whether more study time goes with higher scores.",
      cue: "Each of the 30 students has two numerical measures, and the goal is to see whether they are related.",
    },
    {
      text: "For 25 cities, you have each city's average winter temperature and its yearly heating cost. You want to see whether colder cities pay more.",
      cue: "Each of the 25 cities has two numerical measures, and the goal is to see whether one goes with the other.",
    },
    {
      text: "For 40 used cars, you have each car's age and its price. You want to see how price relates to age.",
      cue: "Each of the 40 cars has two numerical measures, and the goal is the relationship between them.",
    },
    {
      text: "For 20 plants, you have the hours of sunlight each got and its final height. You want to see whether more sunlight goes with taller plants.",
      cue: "Each of the 20 plants has two numerical measures, and the goal is to see whether they are related.",
    },
  ],
  dotstem: [
    {
      text: "A coach times 12 swimmers in one race and wants to show every swimmer's exact time and see whether the times cluster.",
      cue: "There are only 12 values, and the goal is to keep every individual value visible.",
    },
    {
      text: "A student records the number of text messages she got each day for 14 days and wants to see every day's count and the most common count.",
      cue: "There are only 14 values, and every value should stay visible.",
    },
    {
      text: "A teacher has quiz scores for a group of 15 students and wants to show each score and find the middle one.",
      cue: "There are only 15 values, and the goal is to keep every score and read the middle.",
    },
    {
      text: "A gardener counts the tomatoes on each of 13 plants and wants to see each count and spot any unusual one.",
      cue: "There are only 13 values, and the goal is to keep each count visible to spot an unusual one.",
    },
  ],
};
const displayOrder: Display[] = [
  "circle",
  "bar",
  "line",
  "histogram",
  "scatter",
  "dotstem",
];

export function bestDisplayCase(seed: string) {
  checkSeed(seed);
  const meta = byId("best-display-choice");
  const r = random(meta.id, seed);
  const answer = displayOrder[r(0, 5)]!;
  const index = r(0, 3);
  const scenario = scenarios[answer][index]!;
  const others = displayOrder.filter(
    (d) => d !== answer && !excluded[answer].includes(d),
  );
  const wrong = shuffle(r, [...others]).slice(0, 3);
  return {
    answer,
    index,
    shown: [answer, ...wrong],
    problem: assemble(meta, seed, r, {
      prompt: `${scenario.text} Which display fits best?`,
      answer: "",
      hint:
        scenario.cue +
        " Ask which display is built for that kind of data and goal.",
      explanation: [
        scenario.cue,
        `A ${displayName[answer].toLowerCase()} ${displayJob[answer]}.`,
        `The best display is the ${displayName[answer].toLowerCase()}.`,
      ],
      choices: options(
        displayName[answer],
        wrong.map((d) => ({
          label: displayName[d],
          feedback: `A ${displayName[d].toLowerCase()} ${displayJob[d]}. That is not what this situation asks for.`,
        })),
      ),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Rates of return                                                     */
/* ------------------------------------------------------------------ */

const money = (x: number) => `${x} dollars`;
const verdict = (claim: number, actual: number) =>
  claim === actual ? "accurate" : claim > actual ? "too high" : "too low";

export function returnClaimCase(seed: string) {
  checkSeed(seed);
  const meta = byId("return-claim-check");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const names = ["$A$", "$B$"];
  let prompt: string;
  let correct: string;
  let wrong: Wrong[];
  let hint: string;
  let explanation: string[];

  if (variant === 0 || variant === 1) {
    // Two investments; the bigger dollar gain (variant 0) or bigger total (variant 1) is not the better rate.
    let p: number[] = [];
    let t: number[] = [];
    let yearly: number[] = [];
    let gain: number[] = [];
    for (let guard = 0; ; guard++) {
      if (guard > 5000) throw new Error("No investment pair found");
      p = [pick(r, [400, 500, 800, 1000]), pick(r, [100, 200, 250, 300])];
      t = variant === 0 ? [1, 1] : [r(3, 5), r(1, 2)];
      yearly = [r(3, 9), r(4, 12)];
      gain = [0, 1].map((i) => (p[i]! * yearly[i]! * t[i]!) / 100);
      const total = [0, 1].map((i) => yearly[i]! * t[i]!);
      if (!gain.every(Number.isInteger) || yearly[0] === yearly[1]) continue;
      const rateWinner = yearly[0]! > yearly[1]! ? 0 : 1;
      const dollarWinner = gain[0]! > gain[1]! ? 0 : 1;
      const totalWinner = total[0]! > total[1]! ? 0 : 1;
      if (variant === 0 && (dollarWinner === rateWinner || rateWinner !== 1))
        continue;
      if (
        variant === 1 &&
        (totalWinner === rateWinner || gain[0]! === gain[1]!)
      )
        continue;
      break;
    }
    if (r(0, 1)) {
      for (const a of [p, t, yearly, gain]) a.reverse();
    }
    const total = [0, 1].map((i) => yearly[i]! * t[i]!);
    const win = yearly[0]! > yearly[1]! ? 0 : 1;
    const lose = 1 - win;
    const dollar = gain[0]! > gain[1]! ? 0 : 1;
    const final = [0, 1].map((i) => p[i]! + gain[i]!);
    const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;
    const text = (i: number) =>
      `Investment ${names[i]} grew from ${money(p[i]!)} to ${money(final[i]!)} in ${years(t[i]!)}.`;
    prompt = `${text(0)} ${text(1)} Use simple rates: total gain ÷ starting amount ÷ years. Which investment earned the higher yearly rate of return?`;
    correct = `${names[win]}: ${yearly[win]}% per year, higher than ${yearly[lose]}% per year`;
    const totalWinner = total[0]! > total[1]! ? 0 : 1;
    const larger = p[0]! > p[1]! ? 0 : 1;
    wrong = [
      {
        label: `${names[dollar]}: gained ${money(gain[dollar]!)}, more than ${money(gain[1 - dollar]!)}`,
        feedback:
          "More dollars does not mean a higher rate. A rate compares the gain with the amount invested, over the time.",
      },
      variant === 0
        ? {
            label: `${names[larger]}: started with ${money(p[larger]!)}, more than ${money(p[1 - larger]!)}`,
            feedback:
              "A larger starting amount does not make a higher rate. Divide each gain by its own starting amount.",
          }
        : {
            label: `${names[totalWinner]}: total return ${total[totalWinner]}%, more than ${total[1 - totalWinner]}%`,
            feedback:
              "Total return covers different lengths of time. Divide each total by its years to compare yearly rates.",
          },
      {
        label: `Equal: both earned ${yearly[lose]}% per year`,
        feedback:
          "The rates are not equal. Compute each: gain ÷ starting amount ÷ years.",
      },
    ];
    hint = `For ${names[0]}, the gain is ${money(final[0]! - p[0]!)} on ${money(p[0]!)}${t[0]! > 1 ? ` over ${years(t[0]!)}` : ""}. Find gain ÷ starting amount${t[0]! > 1 ? ", then divide by the years" : ""}, and do the same for ${names[1]}.`;
    explanation = [0, 1].map(
      (i) =>
        `${names[i]}: gain ${money(final[i]! - p[i]!)}; ${money(gain[i]!)} ÷ ${money(p[i]!)} = ${total[i]}%${t[i]! > 1 ? `; ${total[i]}% ÷ ${t[i]} years = ${yearly[i]}% per year` : ` per year`}.`,
    );
    explanation.push(
      `${names[win]} has the higher yearly rate: ${yearly[win]}% against ${yearly[lose]}%.`,
    );
  } else if (variant === 5) {
    const m = pick(r, [1, 2, 3]);
    const upper = 12 * m - 1;
    const y = r(Math.max(m + 4, 12 * m - 6), upper);
    const annual = 12 * m;
    prompt = `One account pays ${m}% a month. Another pays ${y}% a year. Compare the two by adding the same simple rate for each of 12 months. Which statement is right?`;
    const state = (monthly: number, wrongVerdict: boolean) => {
      const higher = monthly > y;
      return `${m}% per month is ${monthly}% per year, ${(wrongVerdict ? !higher : higher) ? "higher" : "lower"} than ${y}% per year`;
    };
    correct = state(annual, false);
    wrong = [
      {
        label: `${y}% per year is higher, since ${y} is greater than ${m}`,
        feedback:
          "The rates use different time units. Change the monthly rate to a yearly rate before comparing.",
      },
      {
        label: state(annual, true),
        feedback: `You found the yearly rate correctly. Now compare ${annual}% with ${y}%: ${annual} is greater, so the monthly account pays more.`,
      },
      {
        label: state(m + 12, false),
        feedback:
          "Each of the 12 months adds the monthly rate. Multiply the monthly rate by 12; do not add 12.",
      },
    ];
    hint = `There are 12 months in a year. Add ${m}% for each month to get a yearly rate, then compare it with ${y}%.`;
    explanation = [
      `A year has 12 months, so ${m}% a month is $${m}\\times12=${annual}$% a year.`,
      `${annual}% is greater than ${y}%, so the monthly account pays the higher yearly rate.`,
    ];
  } else {
    // Check a claim against the rate computed from amounts and time.
    const useMonths = variant === 3;
    let p = 0;
    let n = 0; // years or months
    let actual = 0;
    let gain = 0;
    for (let guard = 0; ; guard++) {
      if (guard > 5000) throw new Error("No claim data found");
      p = pick(
        r,
        useMonths ? [1200, 2400, 3000, 6000] : [500, 800, 1000, 2000],
      );
      n = useMonths ? pick(r, [3, 6]) : r(2, 5);
      actual = pick(r, useMonths ? [4, 6, 8, 10, 12, 16] : [3, 4, 5, 6, 8, 10]);
      gain = useMonths ? (p * actual * n) / 1200 : (p * actual * n) / 100;
      if (Number.isInteger(gain)) break;
    }
    const total = Number(
      (useMonths ? (actual * n) / 12 : actual * n).toFixed(4),
    );
    const kind = variant === 4 ? "total" : pick(r, ["high", "low", "accurate"]);
    const claim =
      kind === "total"
        ? total
        : kind === "high"
          ? actual + pick(r, [4, 5, 6, 10])
          : kind === "low"
            ? Math.max(1, actual - pick(r, [1, 2, 3]))
            : actual;
    const span = useMonths ? `${n} months` : `${n} years`;
    const final = p + gain;
    prompt = `An ad says: "Our fund returns ${claim}% per year." A fund started with ${money(p)} and had ${money(final)} after ${span}. Use simple rates and no compounding. Which statement is right?`;
    const label = (x: number, forced?: string) =>
      `${x}% per year: the claim is ${forced ?? verdict(claim, x)}`;
    const trueVerdict = verdict(claim, actual);
    const flipped =
      trueVerdict === "accurate"
        ? "too high"
        : trueVerdict === "too high"
          ? "too low"
          : "too high";
    correct = label(actual);
    wrong = [
      {
        label: label(actual, flipped),
        feedback: `The yearly rate is right, but compare it with the ad's ${claim}%. The claim is ${trueVerdict}.`,
      },
      {
        label: label(total),
        feedback: useMonths
          ? `${total}% is the return for the whole ${span}. Change it to a year: a year is 12 months.`
          : `${total}% is the total return for all ${n} years. Divide by ${n} to get a yearly rate.`,
      },
      {
        label: label(total * n),
        feedback: useMonths
          ? `To change months to a year, scale by 12 ÷ ${n}, not by ${n}.`
          : `Divide the total return by the years; do not multiply by them.`,
      },
      {
        label: label(claim, "accurate"),
        feedback:
          "Do not accept the stated rate. Compute the rate from the amounts and the time, then compare.",
      },
    ];
    hint = `The fund gained ${money(final - p)} on ${money(p)} in ${span}. Find the gain as a percent of ${money(p)}, then scale it to one year, and compare it with the ad's ${claim}%.`;
    explanation = [
      `Gain: ${money(final)} − ${money(p)} = ${money(gain)}.`,
      `Total return: ${money(gain)} ÷ ${money(p)} = ${total}%.`,
      useMonths
        ? `${span} is ${n}/12 of a year, so the yearly rate is ${total}% × 12 ÷ ${n} = ${actual}%.`
        : `Yearly rate: ${total}% ÷ ${n} years = ${actual}% per year.`,
      `The ad says ${claim}%, so the claim is ${trueVerdict}.`,
    ];
  }
  return {
    variant,
    problem: assemble(meta, seed, r, {
      prompt,
      answer: "",
      hint,
      explanation,
      choices: options(correct, wrong),
    }),
  };
}

export function generateDataDisplayStateProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId === "stem-leaf-construct")
    return stemLeafConstructCase(seed).problem;
  if (templateId === "frequency-table-build")
    return frequencyTableCase(seed).problem;
  if (templateId === "circle-graph-read") return circleGraphCase(seed).problem;
  if (templateId === "best-display-choice")
    return bestDisplayCase(seed).problem;
  if (templateId === "return-claim-check") return returnClaimCase(seed).problem;
  throw new Error(`Unknown data display template: ${templateId}`);
}
