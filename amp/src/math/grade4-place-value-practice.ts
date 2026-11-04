import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { numberWords } from "./staar-gap-practice";
import { numberLine } from "./scene/author";
import {
  assemble,
  random,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";
import {
  grouped,
  multiPartCapability,
  multiPartProblem,
  type Slot,
} from "./multi-part-support";

/** Grade-4 place-value practice that the earlier families do not ask:
 * a digit shifted left or right, a number name matched with its numeral,
 * and a point on a number line scaled by thousands. */
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const scenes = { requiredFigureCapability: "scenes-v1" } as const;

export const grade4PlaceValueTemplates: readonly TemplateMetadata[] = [
  {
    id: "place-shift-value",
    version: 1,
    title: "Value of a digit after it shifts",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Find the new place and value of a digit shifted one place left or right in a whole number up to 1,000,000, or the product when a whole number is multiplied by 10 or 100.",
  },
  {
    id: "number-name-numeral",
    version: 1,
    title: "Match a number name and a numeral",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...choice,
    description:
      "Match a whole number up to 1,000,000 with its number name, in either direction. Distractors drop an internal zero or swap the thousands group.",
  },
  {
    id: "large-number-line-point",
    version: 1,
    title: "Read or locate a number on a large number line",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...choice,
    ...scenes,
    description:
      "Read the whole number at a marked point, or choose the point at a given whole number, on a number line whose ticks are 1,000, 10,000 or 100,000 apart, up to 1,000,000.",
  },
];

const PLACES = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
  "millions",
] as const;

const g = (n: number) => grouped(n);

function wholeNumberName(n: number): string {
  if (n === 1_000_000) return "one million";
  if (n < 1 || n > 999_999) throw new Error(`No name for ${n}`);
  return numberWords(n);
}

function placesMoved(factor: 10 | 100): string {
  return factor === 10 ? "one place" : "two places";
}

/** A digit in `n` that can move `side` and stay a whole number at most 1,000,000. */
function shiftable(r: Random, side: "left" | "right") {
  const length = r(3, 6);
  const digits = Array.from({ length }, (_, i) =>
    i === 0 ? r(1, 9) : r(0, 9),
  );
  const n = Number(digits.join(""));
  const minPlace = side === "right" ? 1 : 0;
  const maxPlace = side === "left" ? length - 1 : length - 1;
  if (maxPlace < minPlace) return null;
  const candidates: number[] = [];
  for (let place = minPlace; place <= maxPlace; place++) {
    const digit = digits[length - 1 - place]!;
    if (digit === 0) continue;
    const next = side === "left" ? place + 1 : place - 1;
    const value = digit * 10 ** next;
    if (next <= 6 && value >= 1 && value <= 1_000_000) candidates.push(place);
  }
  if (!candidates.length) return null;
  const place = candidates[r(0, candidates.length - 1)]!;
  const digit = digits[length - 1 - place]!;
  const next = side === "left" ? place + 1 : place - 1;
  return {
    n,
    digit,
    place,
    next,
    value: digit * 10 ** next,
    oldValue: digit * 10 ** place,
  };
}

function distinctNumbers(correct: number, pool: number[]): string[] {
  const seen = new Set([String(correct)]);
  const out: string[] = [];
  for (const n of pool) {
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) continue;
    const key = String(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length === 3) return out;
  }
  return out;
}

type ShiftBuilt = {
  prompt: string;
  layout: "slots";
  label: string;
  slots: Slot[];
  hint: string;
  explanation: string[];
};

function shiftDraft(r: Random, side: "left" | "right"): ShiftBuilt | null {
  const found = shiftable(r, side);
  if (!found) return null;
  const { n, digit, place, next, value, oldValue } = found;
  const placeWrongs = [
    place,
    next === 0 ? 2 : 0,
    side === "left" ? next + 1 : place + 1,
  ]
    .filter((p) => p !== next && p >= 0 && p < PLACES.length)
    .map((p) => PLACES[p]!);
  const valueWrongs = distinctNumbers(value, [
    oldValue,
    value * 10,
    Math.floor(value / 10),
    oldValue + digit,
    value * 100,
  ]);
  if (new Set(placeWrongs).size < 2 || valueWrongs.length < 3) return null;
  const slots: Slot[] = [
    {
      id: "place",
      label: "The digit's new place",
      correct: PLACES[next]!,
      wrong: [...new Set(placeWrongs)],
    },
    {
      id: "value",
      label: "The digit's new value",
      correct: String(value),
      wrong: valueWrongs,
    },
  ];
  const direction = side === "left" ? "left" : "right";
  const times = side === "left" ? "10 times as much" : "one tenth as much";
  return {
    prompt: `In ${g(n)}, the digit ${digit} is worth ${g(oldValue)}. It shifts one place to the ${direction}, so it is worth ${times}. Choose its new place and its new value.`,
    layout: "slots",
    label: "Choose the new place and the new value",
    slots,
    hint: `One place to the ${direction} changes the value by a factor of 10. The digit is worth ${times} as it is now.`,
    explanation: [
      `The digit ${digit} is worth ${g(oldValue)}, so it is in the ${PLACES[place]} place: ${digit} × ${g(10 ** place)} = ${g(oldValue)}.`,
      side === "left"
        ? `One place to the left is the ${PLACES[next]} place. Each place to the left is worth 10 times as much, so the new value is ${g(oldValue)} × 10 = ${g(value)}.`
        : `One place to the right is the ${PLACES[next]} place. Each place to the right is worth one tenth as much, so the new value is ${g(oldValue)} ÷ 10 = ${g(value)}.`,
      `The digit ${digit} is now in the ${PLACES[next]} place and is worth ${g(value)}.`,
    ],
  };
}

function productDraft(r: Random, factor: 10 | 100): ShiftBuilt | null {
  const exact = r(0, 9) === 0;
  const cap = Math.floor(1_000_000 / factor);
  const n = exact ? 1_000_000 / factor : r(12, cap);
  if (!Number.isInteger(n) || n < 10 || n * factor > 1_000_000) return null;
  const product = n * factor;
  const moved = placesMoved(factor);
  const wrongMoved =
    factor === 10
      ? ["two places", "three places", "zero places"]
      : ["one place", "three places", "ten places"];
  const wrongProducts = distinctNumbers(product, [
    n * (factor === 10 ? 100 : 10),
    n + factor,
    product * 10,
    Math.floor(product / 10),
    n * factor + n,
  ]).filter((w) => Number(w) <= 10_000_000);
  if (wrongProducts.length < 3) return null;
  const slots: Slot[] = [
    {
      id: "product",
      label: "The product",
      correct: String(product),
      wrong: wrongProducts,
    },
    {
      id: "places",
      label: "How many places the digits move",
      correct: moved,
      wrong: wrongMoved,
      max: 4,
    },
  ];
  return {
    prompt: `${g(n)} × ${factor} shifts every digit to the left. Choose the product and how many places the digits move.`,
    layout: "slots" as const,
    label: "Choose the product and the shift",
    slots,
    hint: `Multiplying by ${factor} makes every digit worth ${factor} times as much. Count the zeros in ${factor}: each zero is one place to the left.`,
    explanation: [
      `${factor} is ${factor === 10 ? "10, one zero" : "10 × 10, two zeros"}. Each zero moves every digit one place to the left.`,
      `So the digits of ${g(n)} move ${moved} to the left.`,
      `${g(n)} × ${factor} = ${g(product)}.`,
    ],
  };
}

function placeShift(r: Random): ShiftBuilt | null {
  const kind = r(0, 3);
  if (kind === 0) return shiftDraft(r, "left");
  if (kind === 1) return shiftDraft(r, "right");
  if (kind === 2) return productDraft(r, 10);
  return productDraft(r, 100);
}

type Choice = { label: string; correct?: true; feedback: string };

/** True when `label` is its own number in `text`, not a piece of a longer number. */
function showsNumber(text: string, label: string): boolean {
  const digits = label.replaceAll(",", "");
  if (!/^\d+$/.test(digits)) return false;
  return new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(text.replaceAll(",", ""));
}

function fourChoices(
  correct: string,
  wrong: { label: string; feedback: string }[],
): Choice[] | null {
  const seen = new Set([correct]);
  const out: Choice[] = [{ label: correct, correct: true, feedback: "" }];
  for (const item of wrong) {
    if (seen.has(item.label) || item.label === correct) continue;
    seen.add(item.label);
    out.push(item);
    if (out.length === 4) return out;
  }
  return null;
}

function dropInternalZero(n: number): number | null {
  const text = String(n);
  const at = text.indexOf("0", 1);
  if (at < 0) return null;
  const next = Number(text.slice(0, at) + text.slice(at + 1));
  return next !== n && next >= 1 ? next : null;
}

function swapThousands(n: number): number | null {
  if (n < 1_000 || n >= 1_000_000) return null;
  const hi = Math.floor(n / 1000);
  const lo = n % 1000;
  if (lo === 0 || hi === 0) return null;
  const swapped = lo * 1000 + hi;
  return swapped !== n ? swapped : null;
}

function nameDraft(r: Random): Draft | null {
  const toWords = r(0, 1) === 0;
  let n: number;
  if (r(0, 24) === 0) n = 1_000_000;
  else {
    const length = r(4, 6);
    const digits = Array.from({ length }, (_, i) =>
      i === 0 ? r(1, 9) : r(0, 9),
    );
    const hole = r(1, length - 1);
    digits[hole] = 0;
    n = Number(digits.join(""));
  }
  const name = wholeNumberName(n);
  const numeral = g(n);
  const dropped = dropInternalZero(n);
  const swapped = swapThousands(n);
  const off = n >= 100_000 && n < 1_000_000 ? Math.floor(n / 10) : n * 10;
  const pool = [
    dropped,
    swapped,
    off,
    n === 1_000_000 ? 100_000 : null,
    n === 1_000_000 ? 10_000 : null,
    n === 1_000_000 ? 999_000 : null,
    n + 1_000 <= 1_000_000 ? n + 1_000 : null,
    n - 1_000 >= 1 ? n - 1_000 : null,
  ].filter(
    (v): v is number => v !== null && v !== n && v >= 1 && v <= 1_000_000,
  );
  const unique = [...new Set(pool)];
  if (unique.length < 3) return null;
  const picked = unique.slice(0, 3);
  const feedbackFor = (value: number) => {
    if (value === dropped)
      return "A zero inside the number was left out. That zero holds a place, so the other digits keep their places only when it stays.";
    if (value === swapped)
      return "The thousands group and the ones group traded places. Read the part before the comma as thousands.";
    if (value === 100_000 && n === 1_000_000)
      return "One million is 1,000 thousands, not 100 thousands.";
    return "A digit moved to a neighboring place. Match each part of the name to its own place.";
  };
  if (toWords) {
    const choices = fourChoices(
      name,
      picked.map((value) => ({
        label: wholeNumberName(value),
        feedback: feedbackFor(value),
      })),
    );
    if (!choices) return null;
    return {
      prompt: `Which number name matches ${numeral}?`,
      answer: "",
      hint: `Say ${numeral} in two parts. The digits before the comma are thousands. The last three digits are the rest.`,
      explanation: [
        `${numeral} has ${String(n).length} digits.`,
        n === 1_000_000
          ? "1,000,000 is one million: a 1 followed by six zeros."
          : `The thousands part is ${g(Math.floor(n / 1000))}, said as ${wholeNumberName(Math.floor(n / 1000))} thousand. The rest is ${n % 1000 === 0 ? "nothing more" : wholeNumberName(n % 1000)}.`,
        `In words: ${name}.`,
      ],
      choices,
    };
  }
  const choices = fourChoices(
    numeral,
    picked.map((value) => ({
      label: g(value),
      feedback: feedbackFor(value),
    })),
  );
  if (!choices) return null;
  return {
    prompt: `Which numeral matches this number name: ${name}?`,
    answer: "",
    hint: `The word thousand splits the name into two groups of digits. Write the thousands group, then the rest, and keep a zero for any place the name skips.`,
    explanation: [
      `“${name}” names ${numeral}.`,
      dropped !== null
        ? `Leaving out an inside zero would write ${g(dropped)}, a different number.`
        : `The zeros in ${numeral} hold places. They stay in the numeral.`,
      `The numeral is ${numeral}.`,
    ],
    choices,
  };
}

type LineSpec = { min: number; max: number; step: number; labels: number[] };
const LINES: LineSpec[] = [
  { min: 0, max: 10_000, step: 1_000, labels: [0, 5_000, 10_000] },
  { min: 20_000, max: 30_000, step: 1_000, labels: [20_000, 25_000, 30_000] },
  { min: 0, max: 100_000, step: 10_000, labels: [0, 50_000, 100_000] },
  {
    min: 200_000,
    max: 300_000,
    step: 10_000,
    labels: [200_000, 250_000, 300_000],
  },
  { min: 0, max: 1_000_000, step: 100_000, labels: [0, 500_000, 1_000_000] },
  {
    min: 300_000,
    max: 800_000,
    step: 100_000,
    labels: [300_000, 500_000, 800_000],
  },
];

function lineScene(line: LineSpec, marks: { at: number; label: string }[]) {
  return numberLine({
    id: "nl",
    min: line.min,
    max: line.max,
    step: line.step,
    labels: line.labels,
    marks,
  }).scene({
    title: "Number line",
    note: `Tick marks are ${g(line.step)} apart. The labeled ticks are ${line.labels.map(g).join(", ")}.`,
    width: 360,
  });
}

function lineDraft(r: Random): Draft | null {
  const line = LINES[r(0, LINES.length - 1)]!;
  const open: number[] = [];
  for (let v = line.min + line.step; v < line.max; v += line.step)
    if (!line.labels.includes(v)) open.push(v);
  if (open.length < 4) return null;
  const read = r(0, 1) === 0;
  const step = line.step;
  if (read) {
    const value = open[r(0, open.length - 1)]!;
    const near = line.labels.reduce((a, b) =>
      Math.abs(b - value) < Math.abs(a - value) ? b : a,
    );
    const wrongs = [
      value + step,
      value - step,
      value + 2 * step,
      value - 2 * step,
      line.min + line.max - value,
    ].filter(
      (x) =>
        x > line.min && x < line.max && x !== value && !line.labels.includes(x),
    );
    const unique = [...new Set(wrongs)];
    if (unique.length < 3) return null;
    const choices = fourChoices(
      g(value),
      unique.slice(0, 3).map((x) => ({
        label: g(x),
        feedback:
          Math.abs(x - value) === step
            ? `${g(x)} is one tick ${x > value ? "past" : "before"} point P. Each tick is ${g(step)}.`
            : `${g(x)} is not the tick at P. Start at ${g(near)} and count the ticks by ${g(step)}.`,
      })),
    );
    if (!choices) return null;
    const ticks = Math.abs(value - near) / step;
    return {
      prompt: "Which number is at point P on the number line?",
      figure: {
        kind: "scene",
        scene: lineScene(line, [{ at: value, label: "P" }]),
      } satisfies SemanticFigure,
      answer: "",
      hint: `The labeled tick nearest P is ${g(near)}. Count the tick marks from there. Each tick is ${g(step)}.`,
      explanation: [
        `The ticks are ${g(step)} apart.`,
        `Point P is ${ticks} ${ticks === 1 ? "tick" : "ticks"} to the ${value > near ? "right" : "left"} of ${g(near)}.`,
        value > near
          ? `${g(near)} + ${ticks} × ${g(step)} = ${g(value)}.`
          : `${g(near)} − ${ticks} × ${g(step)} = ${g(value)}.`,
        `Point P is at ${g(value)}.`,
      ],
      choices,
    };
  }
  const chosen = shuffle(r, [...open]).slice(0, 4);
  const value = chosen[0]!;
  const order = shuffle(r, [...chosen]);
  const letters = ["A", "B", "C", "D"];
  const correct = letters[order.indexOf(value)]!;
  const near = line.labels.reduce((a, b) =>
    Math.abs(b - value) < Math.abs(a - value) ? b : a,
  );
  const choices = fourChoices(
    correct,
    letters
      .filter((letter) => letter !== correct)
      .map((letter) => {
        const at = order[letters.indexOf(letter)]!;
        return {
          label: letter,
          feedback: `${letter} is at ${g(at)}. Count from ${g(near)} by ${g(step)} to find ${g(value)}.`,
        };
      }),
  );
  if (!choices) return null;
  return {
    prompt: `Which point is at ${g(value)} on the number line?`,
    figure: {
      kind: "scene",
      scene: lineScene(
        line,
        order.map((at, i) => ({ at, label: letters[i]! })),
      ),
    } satisfies SemanticFigure,
    answer: "",
    hint: `Start at the labeled tick nearest ${g(value)}, which is ${g(near)}. Count ticks of ${g(step)} until you reach ${g(value)}.`,
    explanation: [
      `The ticks are ${g(step)} apart. ${g(value)} is ${Math.abs(value - near) / step} ${Math.abs(value - near) / step === 1 ? "tick" : "ticks"} to the ${value > near ? "right" : "left"} of ${g(near)}.`,
      `That tick is labeled ${correct}.`,
      `Point ${correct} is at ${g(value)}.`,
    ],
    choices,
  };
}

function buildChoice(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  draft: () => Draft | null,
): ReturnType<typeof assemble> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const built = draft();
    if (!built) continue;
    const correct = built.choices!.find((c) => c.correct)!.label;
    const visible = `${built.prompt}\n${built.hint}`;
    if (showsNumber(visible, correct) || visible.includes(correct)) continue;
    return assemble(meta, seed, r, built);
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}

export function generateGrade4PlaceValueProblem(
  templateId: string,
  seed: string,
) {
  const meta = grade4PlaceValueTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  if (templateId === "place-shift-value") {
    for (let attempt = 0; attempt < 40; attempt++) {
      const draw = attempt ? random(templateId, `${seed}#${attempt}`) : r;
      const built = placeShift(draw);
      if (!built) continue;
      const problem = multiPartProblem(meta, seed, draw, built);
      const response = problem.public.response;
      if (response.kind !== "multi-part-choice") continue;
      const key = JSON.parse(problem.answer) as Record<string, string>;
      const valueBlank = response.blanks.find(
        (blank) => blank.id === "value" || blank.id === "product",
      );
      const shown = valueBlank?.options.find(
        (option) => option.id === key[valueBlank.id],
      )?.label;
      const visible = `${problem.public.prompt}\n${problem.hint}`;
      if (shown && showsNumber(visible, shown)) continue;
      return problem;
    }
    throw new Error(`${templateId}: no instance for ${seed}`);
  }
  if (templateId === "number-name-numeral")
    return buildChoice(meta, seed, r, () => nameDraft(r));
  if (templateId === "large-number-line-point")
    return buildChoice(meta, seed, r, () => lineDraft(r));
  throw new Error(`Unknown template ${templateId}`);
}
