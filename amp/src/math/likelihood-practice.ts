import type { TemplateMetadata } from "./contracts";
import { numberLine } from "./scene/author";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, gcd, pick } from "./chain-kit";
import {
  an,
  draw,
  letters,
  orderedChoiceSurface,
  shuffled,
} from "./elementary-gap-kit";

export const likelihoodWordsTemplate: TemplateMetadata = {
  id: "likelihood-in-words",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Certain, likely, unlikely or impossible",
  skillId: "probability",
  gradeBand: "3–5",
  difficultyOffset: -1,
  description:
    "Name how likely an event is (certain, likely, as likely as not, unlikely or impossible) from the marbles in a bag, the sections of a spinner or the faces of a number cube.",
};
export const probabilityLineTemplate: TemplateMetadata = {
  id: "probability-on-number-line",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "single-choice-v1",
  title: "A chance on a zero to one number line",
  skillId: "probability",
  gradeBand: "3–5",
  difficultyOffset: -0.7,
  description:
    "Choose the lettered point on a number line from 0 to 1 that shows the chance of an event for a bag, spinner or number cube with equally likely outcomes.",
};
export const equalChanceTemplate: TemplateMetadata = {
  id: "equal-chance-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the bag or spinner for a chance",
  skillId: "probability",
  gradeBand: "3–5",
  difficultyOffset: -0.6,
  description:
    "Choose the bag of marbles or spinner that makes two colors equally likely, or one color the most or least likely.",
};

/* -------------------------------------------------------------- events */
export type Word =
  "certain" | "likely" | "as-likely-as-not" | "unlikely" | "impossible";
export const wordLabel: Record<Word, string> = {
  certain: "Certain",
  likely: "Likely",
  "as-likely-as-not": "As likely as not",
  unlikely: "Unlikely",
  impossible: "Impossible",
};
const wordMeaning: Record<Word, string> = {
  certain: "it must happen: every outcome is a success",
  likely: "more than half of the outcomes are successes, but not all",
  "as-likely-as-not": "exactly half of the outcomes are successes",
  unlikely: "fewer than half of the outcomes are successes, but at least one",
  impossible: "it cannot happen: no outcome is a success",
};
export function wordFor(k: number, n: number): Word {
  if (k === 0) return "impossible";
  if (k === n) return "certain";
  if (2 * k === n) return "as-likely-as-not";
  return 2 * k > n ? "likely" : "unlikely";
}
const colors = ["red", "blue", "green", "yellow", "purple", "orange"] as const;

interface Event {
  device: "bag" | "spinner" | "cube";
  /** Total outcomes and favorable outcomes. */
  n: number;
  k: number;
  /** Setup sentence, question about the event, and the counts line. */
  setup: string;
  event: string;
  counts: string;
  /** Short noun for an outcome in hints: "marbles", "sections", "faces". */
  unit: string;
}
const cubeEvents: { text: string; k: number }[] = [
  { text: "an even number", k: 3 },
  { text: "a number greater than 4", k: 2 },
  { text: "a number less than 5", k: 4 },
  { text: "a number less than 7", k: 6 },
  { text: "the number 7", k: 0 },
  { text: "the number 3", k: 1 },
  { text: "a number greater than 1", k: 5 },
  { text: "an odd number", k: 3 },
];
type R = (lo: number, hi: number) => number;
function makeEvent(r: R, device: Event["device"], wanted?: Word): Event {
  if (device === "cube") {
    const pool = wanted
      ? cubeEvents.filter((e) => wordFor(e.k, 6) === wanted)
      : cubeEvents;
    const e = pick(r, pool.length ? pool : cubeEvents);
    return {
      device,
      n: 6,
      k: e.k,
      setup:
        "A number cube has the faces 1, 2, 3, 4, 5 and 6. You roll it once.",
      event: `you roll ${e.text}`,
      counts: "",
      unit: "faces",
    };
  }
  const n = device === "bag" ? r(4, 10) : pick(r, [4, 6, 8, 10]);
  const target = pick(r, colors);
  let k: number;
  if (wanted === "impossible") k = 0;
  else if (wanted === "certain") k = n;
  else if (wanted === "as-likely-as-not") {
    if (n % 2) throw new Error("Need three retries");
    k = n / 2;
  } else if (wanted === "likely") k = r(Math.floor(n / 2) + 1, n - 1);
  else if (wanted === "unlikely") k = r(1, Math.ceil(n / 2) - 1);
  else k = r(0, n);
  if (k < 0 || k > n || (wanted === "likely" && 2 * k <= n))
    throw new Error("Need three retries");
  // Split the rest among up to two other colors.
  const others = draw(
    r,
    colors.filter((c) => c !== target),
    2,
  );
  const rest = n - k;
  let counts: [string, number][] = [];
  if (k > 0) counts.push([target, k]);
  if (rest > 0) {
    if (rest === 1 || others.length < 2 || r(0, 1))
      counts.push([others[0]!, rest]);
    else {
      const first = r(1, rest - 1);
      counts.push([others[0]!, first], [others[1]!, rest - first]);
    }
  }
  counts = shuffled(r, counts);
  const list = counts
    .map(([c, v]) =>
      device === "bag"
        ? `${v} ${c} ${v === 1 ? "marble" : "marbles"}`
        : `${v} ${c}`,
    )
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
  if (device === "bag")
    return {
      device,
      n,
      k,
      setup: `A bag holds ${list}. You pick one marble without looking.`,
      event: `you pick ${an(target)} ${target} marble`,
      counts: list,
      unit: "marbles",
    };
  return {
    device,
    n,
    k,
    setup:
      counts.length === 1
        ? `A spinner has ${n} equal sections, all ${counts[0]![0]}. You spin it once.`
        : `A spinner has ${n} equal sections: ${list}. You spin it once.`,
    event: `you land on ${target}`,
    counts: list,
    unit: "sections",
  };
}

const wordAxes = {
  device: defineAxis("device", ["bag", "spinner", "cube"] as const),
};
interface WordModel {
  event: Event;
  word: Word;
  options: Word[];
}
export const likelihoodWords = chainFamily({
  template: likelihoodWordsTemplate,
  axes: wordAxes,
  model: (r, a): WordModel => {
    const words: Word[] = [
      "certain",
      "likely",
      "as-likely-as-not",
      "unlikely",
      "impossible",
    ];
    const word = pick(r, words);
    const event = makeEvent(r, a.device, word);
    const actual = wordFor(event.k, event.n);
    const others = draw(
      r,
      words.filter((w) => w !== actual),
      3,
    );
    return { event, word: actual, options: [actual, ...others] };
  },
  variant: (m) => `${m.event.device}-${m.word}`,
  render: (m, _a, r) => {
    const { event: e } = m;
    const half = e.n / 2;
    const compare = `${e.k} of the ${e.n} ${e.unit} ${e.k === 1 ? "is a success" : "are successes"}`;
    const options = m.options.map((w) =>
      w === m.word
        ? { label: wordLabel[w], correct: true as const }
        : {
            label: wordLabel[w],
            feedback: `${wordLabel[w]} would mean ${wordMeaning[w]}. Here ${compare}, out of ${e.n} in all.`,
          },
    );
    return choiceSurface(r, {
      prompt: `${e.setup} How likely is it that ${e.event}?`,
      options,
      hint: `Count the successes, the ${e.unit} where ${e.event}${e.device === "cube" ? ": check each number from 1 to 6" : `, using the counts ${e.counts}`}. Then compare that count with none, with half of ${e.n} (which is ${half}), and with all ${e.n}.`,
      explanation: [
        `${e.k} of the ${e.n} ${e.unit} ${e.k === 1 ? "is a success" : "are successes"}: ${e.event}.`,
        e.k === 0
          ? "No outcome is a success, so the event cannot happen."
          : e.k === e.n
            ? "Every outcome is a success, so the event must happen."
            : `Half of ${e.n} is ${half}; ${e.k} is ${e.k === half ? "exactly half" : e.k > half ? "more than half but not all" : "less than half but not none"}.`,
        `The event is ${wordLabel[m.word].toLowerCase()}.`,
      ],
    });
  },
});

/* ----------------------------------------------------- number line */
const lineAxes = {
  device: defineAxis("device", ["bag", "spinner", "cube"] as const),
};
interface LineModel {
  event: Event;
  /** Numerators of the four lettered points over event.n. */
  points: number[];
  correct: number;
}
export const probabilityLine = chainFamily({
  template: probabilityLineTemplate,
  axes: lineAxes,
  model: (r, a): LineModel => {
    const event = makeEvent(r, a.device);
    const { n, k } = event;
    if (k === 0 || k === n || gcd(k, n) === 0)
      throw new Error("Need three retries");
    const pool = new Set<number>([n - k]);
    for (const c of [k - 1, k + 1, 1, n - 1, Math.floor(n / 2), k + 2])
      if (c > 0 && c < n && c !== k) pool.add(c);
    pool.delete(k);
    if (pool.size < 3) throw new Error("Need three retries");
    const wrong = [
      n - k,
      ...draw(
        r,
        [...pool].filter((v) => v !== n - k),
        2,
      ),
    ];
    if (new Set(wrong).size !== 3 || wrong.includes(k))
      throw new Error("Need three retries");
    const points = [k, ...wrong].sort((x, y) => x - y);
    return { event, points, correct: points.indexOf(k) };
  },
  variant: (m) => m.event.device,
  render: (m) => {
    const { event: e } = m;
    const line = numberLine({
      min: 0,
      max: 1,
      denominator: e.n,
      labels: "ends",
    });
    m.points.forEach((v, i) => line.mark(v / e.n, { label: letters[i]! }));
    const options = m.points.map((v, i) =>
      i === m.correct
        ? { label: `Point $${letters[i]}$`, correct: true as const }
        : {
            label: `Point $${letters[i]}$`,
            feedback:
              v === e.n - m.points[m.correct]!
                ? `Point $${letters[i]}$ is at ${v} out of ${e.n}: that is the chance of the event not happening. The chance that ${e.event} is ${e.k} out of ${e.n}.`
                : `Point $${letters[i]}$ is at ${v} out of ${e.n}. The event is successful for ${e.k} of the ${e.n} ${e.unit}, so its point is ${e.k} ${e.k === 1 ? "space" : "spaces"} from 0.`,
          },
    );
    const surface = orderedChoiceSurface({
      prompt: `${e.setup} The number line from 0 to 1 is cut into ${e.n} equal spaces. Which point shows the chance that ${e.event}?`,
      options,
      hint: `The chance is the number of successes out of all ${e.n} ${e.unit}. Find how many ${e.unit} are successes (${e.event}), then count that many equal spaces up from 0.`,
      explanation: [
        `${e.k} of the ${e.n} ${e.unit} are successes (${e.event}), so the chance is ${e.k} out of ${e.n}, which is $\\frac{${e.k}}{${e.n}}$.`,
        `The line from 0 to 1 has ${e.n} equal spaces, so $\\frac{${e.k}}{${e.n}}$ is ${e.k} ${e.k === 1 ? "space" : "spaces"} up from 0.`,
        `That is point $${letters[m.correct]}$.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: line.scene() },
      }
    );
  },
});

/* ---------------------------------------------------- equal chance */
const chanceAxes = {
  goal: defineAxis("goal", [
    "equally-likely",
    "most-likely",
    "least-likely",
  ] as const),
  device: defineAxis("device", ["bag", "spinner"] as const),
};
interface Candidate {
  /** Counts of the first, second and third color. */
  counts: [number, number, number];
}
interface ChanceModel {
  goal: "equally-likely" | "most-likely" | "least-likely";
  device: "bag" | "spinner";
  colorsUsed: [string, string, string];
  options: Candidate[];
  correct: number;
  total: number;
}
const describe = (m: ChanceModel, c: Candidate) =>
  m.device === "bag"
    ? c.counts
        .map((v, i) => `${v} ${m.colorsUsed[i]}`)
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1") + " marbles"
    : c.counts
        .map((v, i) => `${v} ${m.colorsUsed[i]}`)
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1") + " sections";
export const equalChance = chainFamily({
  template: equalChanceTemplate,
  axes: chanceAxes,
  model: (r, a): ChanceModel => {
    const used = draw(r, colors, 3) as [string, string, string];
    const total = a.device === "spinner" ? pick(r, [6, 8, 10]) : r(6, 10);
    const sets = new Set<string>();
    const out: Candidate[] = [];
    const add = (c: [number, number, number]) => {
      if (c.some((v) => v < 0) || c[0] + c[1] + c[2] !== total) return;
      const key = c.join(",");
      if (sets.has(key)) return;
      sets.add(key);
      out.push({ counts: c });
    };
    // The one choice that meets the goal, drawn directly from its rule.
    let correct: [number, number, number];
    if (a.goal === "equally-likely") {
      const x = r(1, Math.floor((total - 1) / 2));
      correct = [x, x, total - 2 * x];
    } else if (a.goal === "most-likely") {
      const big = r(Math.ceil(total / 2), total - 2);
      const mid = r(1, total - big - 1);
      correct = [big, mid, total - big - mid];
    } else {
      const low = r(1, Math.floor((total - 2) / 3));
      const mid = r(low + 1, total - 2 * low - 1);
      correct = [low, mid, total - low - mid];
    }
    add(correct);
    // Near misses: swap counts, shift one, or make a different color rule.
    for (let i = 0; i < 80 && out.length < 12; i++) {
      const x = r(0, total);
      const y = r(0, total - x);
      add([x, y, total - x - y]);
    }
    const matches = (c: [number, number, number]) =>
      a.goal === "equally-likely"
        ? c[0] === c[1]
        : a.goal === "most-likely"
          ? c[0] > c[1] && c[0] > c[2]
          : c[0] < c[1] && c[0] < c[2];
    const wrong = out
      .filter((c) => !matches(c.counts as [number, number, number]))
      .filter((c) => c.counts.join() !== correct.join())
      // Counts of zero read oddly in a list; keep them only as a last resort.
      .sort(
        (x, y) => Number(x.counts.includes(0)) - Number(y.counts.includes(0)),
      );
    if (wrong.length < 3) throw new Error("Need three retries");
    const options = shuffled(r, [{ counts: correct }, ...wrong.slice(0, 3)]);
    return {
      goal: a.goal,
      device: a.device,
      colorsUsed: used,
      options,
      correct: options.findIndex((o) => o.counts.join() === correct.join()),
      total,
    };
  },
  variant: (m) => `${m.goal}-${m.device}`,
  render: (m) => {
    const [c1, c2, c3] = m.colorsUsed;
    const thing = m.device === "bag" ? "bag of marbles" : "spinner";
    const pickWord =
      m.device === "bag" ? "pick one marble without looking" : "spin once";
    const intro = `Each ${thing} below has ${m.total} ${m.device === "bag" ? "marbles" : "equal sections"} in ${c1}, ${c2} and ${c3}.`;
    const goalText =
      m.goal === "equally-likely"
        ? `You ${pickWord}. You want ${c1} and ${c2} to be equally likely. Which ${thing} should you use?`
        : m.goal === "most-likely"
          ? `You ${pickWord}. You want ${c1} to be more likely than each of the other colors. Which ${thing} should you use?`
          : `You ${pickWord}. You want ${c1} to be less likely than each of the other colors. Which ${thing} should you use?`;
    const rule =
      m.goal === "equally-likely"
        ? `${c1} and ${c2} equally likely means the same number of ${c1} and ${c2}`
        : m.goal === "most-likely"
          ? `${c1} most likely means more ${c1} than any other color`
          : `${c1} least likely means fewer ${c1} than any other color`;
    const options = m.options.map((o, i) => {
      const label = `${thing[0]!.toUpperCase()}${thing.slice(1)} with ${describe(m, o)}`;
      if (i === m.correct) return { label, correct: true as const };
      const [x, y, z] = o.counts;
      return {
        label,
        feedback:
          m.goal === "equally-likely"
            ? `This has ${x} ${c1} but ${y} ${c2}. Equal chances need equal counts, and ${x} is not ${y}.`
            : m.goal === "most-likely"
              ? `${c1} has ${x} here, and the others have ${y} and ${z}. For ${c1} to be the most likely it needs more than both of the others.`
              : `${c1} has ${x} here, and the others have ${y} and ${z}. For ${c1} to be the least likely it needs fewer than both of the others.`,
      };
    });
    const surface = orderedChoiceSurface({
      prompt: `${intro} ${goalText}`,
      options,
      hint: `The chance of a color depends on its count out of ${m.total}. Compare the number of ${c1} with the number of ${m.goal === "equally-likely" ? c2 : `${c2} and ${c3}`} in each choice.`,
      explanation: [
        `Chance depends on how many of the ${m.total} ${m.device === "bag" ? "marbles" : "sections"} are each color, so ${rule}.`,
        `${m.device === "bag" ? "The bag" : "The spinner"} with ${describe(m, m.options[m.correct]!)} is the only choice that fits.`,
      ],
    });
    return surface;
  },
});
export const likelihoodTemplates = [
  likelihoodWordsTemplate,
  probabilityLineTemplate,
  equalChanceTemplate,
] as const;
export const likelihoodGenerate = dispatch(likelihoodTemplates, {
  "likelihood-in-words": (seed) => likelihoodWords.generate(seed).problem,
  "probability-on-number-line": (seed) =>
    probabilityLine.generate(seed).problem,
  "equal-chance-choice": (seed) => equalChance.generate(seed).problem,
});
