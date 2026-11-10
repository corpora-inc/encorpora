import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  type ChoiceOption,
} from "./chain-kit";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit";
import { defineAxis, type Random } from "./variation/axes";
import {
  TAU,
  angularGap,
  degreesOf,
  directionOf,
  fnAt,
  norm,
  pick,
  piTex,
  quadrantOf,
  ratioTex,
  realsOf,
  roman,
  shuffled,
  turnsOf,
  unitCircleScene,
  type RealKind,
  type RealT,
} from "./unit-circle-extension-kit";

/**
 * HSF.TF.A.2: the unit circle extends sine and cosine to every real number.
 * A real number t is read as a distance travelled along the unit circle
 * from (1, 0), counterclockwise when positive and clockwise when negative;
 * the point reached gives cos t (its x-coordinate) and sin t (its
 * y-coordinate). The reasoning types never let a computed value answer:
 * the learner justifies a step, picks the correct and complete explanation,
 * finds the flaw in a claim, completes the explanation, or locates the
 * terminal point of a non-special real number (4.3, −2.4, 8.5, 5π/7).
 */

const scenes = { requiredFigureCapability: "scenes-v1" as const };
const base = {
  version: 1,
  skillId: "radians-unit-circle",
  gradeBand: "9–12" as const,
};
export const unitCircleExtensionTemplates: readonly TemplateMetadata[] = [
  {
    ...base,
    id: "unit-circle-extension-reason",
    title: "Why the unit circle defines sine and cosine for every real number",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Justify a step of the argument that reading a real number $t$ as a distance along the unit circle defines $\\sin t$ and $\\cos t$, choose the correct and complete explanation of why $\\cos t$ or $\\sin t$ has a value, or find the flaw in a faulty claim, for positive, negative, multi-turn and $\\pi$-multiple values of $t$ that are never special angles.",
  },
  {
    ...base,
    id: "unit-circle-extension-cloze",
    title: "Complete the explanation from a real number to sine and cosine",
    difficultyOffset: 0.3,
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    description:
      "Complete a four-blank explanation of how the unit circle gives $\\sin t$ and $\\cos t$ for a real number $t$: the direction and distance travelled, the angle in radians, the coordinates of the point reached, and why every real number works. Graded all or nothing.",
  },
  {
    ...base,
    id: "real-number-terminal-point",
    title: "Where a real number lands on the unit circle",
    difficultyOffset: 0.2,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    description:
      "Choose the unit-circle drawing that shows the terminal point of a non-special real number, positive, negative, past one turn or a multiple of $\\pi$, among points for the wrong direction, a mirror image, a compass-style start, $\\pi$ taken as a full turn, and $t$ read as degrees.",
  },
  selectTemplate({
    ...base,
    figure: "scenes-v1",
    id: "real-number-same-terminal-point",
    title: "Real numbers that share a terminal point",
    difficultyOffset: 0.25,
    description:
      "Select every real number whose terminal point on the unit circle is the same as that of a given $t$: whole turns added or taken away, among the mirror images $-t$ and $\\pi - t$, the opposite point $t + \\pi$, and $t + 360$.",
  }),
];
const meta = (id: string) =>
  unitCircleExtensionTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------ helpers */

const KINDS: readonly RealKind[] = [
  "positive",
  "negative",
  "winding",
  "pi-form",
];
/** A real of a uniformly chosen kind that has members passing `keep`. */
function drawReal(r: Random, keep: (t: RealT) => boolean = () => true) {
  const kinds = KINDS.filter((k) => realsOf(k).some(keep));
  const kind = pick(r, kinds);
  return pick(r, realsOf(kind).filter(keep));
}
/** No right triangle has an angle of t radians. */
const nonAcute = (t: RealT) => t.value < 0 || t.value >= 1.9;
/** |t| in prose: a decimal as text, a multiple of π as TeX. */
const units = (t: RealT) => (t.pi ? `$${t.absTex}$` : t.absTex);
/** t in prose: a positive decimal as text, anything signed or with π as TeX. */
const tShown = (t: RealT) => (t.pi || t.value < 0 ? `$${t.tex}$` : t.tex);
const quarterMarks = [
  "",
  "$\\frac{\\pi}{2} \\approx 1.57$",
  "$\\pi \\approx 3.14$",
  "$\\frac{3\\pi}{2} \\approx 4.71$",
  "$2\\pi \\approx 6.28$",
];
const approx = (v: number) => v.toFixed(2);
const quadrantSigns = (q: number) =>
  ({
    1: { cos: ">", sin: ">", words: "both coordinates are positive" },
    2: {
      cos: "<",
      sin: ">",
      words:
        "the $x$-coordinate is negative and the $y$-coordinate is positive",
    },
    3: { cos: "<", sin: "<", words: "both coordinates are negative" },
    4: {
      cos: ">",
      sin: "<",
      words:
        "the $x$-coordinate is positive and the $y$-coordinate is negative",
    },
  })[q]!;
/** Where the trip for t ends, said with quarter-turn landmarks. */
export function tripSentence(t: RealT): string {
  const { turns, rest } = turnsOf(t);
  const m = Math.floor(rest / (Math.PI / 2));
  const between =
    m === 0
      ? `between 0 and ${quarterMarks[1]}`
      : `between ${quarterMarks[m]} and ${quarterMarks[m + 1]}`;
  const q = roman[quadrantOf(t.value)];
  const dir = directionOf(t);
  const dist = t.pi
    ? `${units(t)} units, about ${approx(Math.abs(t.value))},`
    : `${units(t)} units`;
  if (turns === 0)
    return `Travel ${dist} ${dir}. The distance is ${between}, so $P$ is in quadrant ${q}.`;
  const full =
    turns === 1
      ? "One full turn is $2\\pi \\approx 6.28$"
      : "Two full turns are $4\\pi \\approx 12.57$";
  return `Travel ${dist} ${dir}. ${full}, and the ${approx(rest)} left over is ${between}, so $P$ is in quadrant ${q}.`;
}
function signCheck(t: RealT): string {
  const q = quadrantOf(t.value);
  const s = quadrantSigns(q);
  return `Check: in quadrant ${roman[q]} ${s.words}, so $${fnAt("cos", t)} ${s.cos} 0$ and $${fnAt("sin", t)} ${s.sin} 0$.`;
}
const opening =
  "A real number $t$ is a distance along the unit circle, the circle of radius 1 around the origin. Start at $(1, 0)$ and travel counterclockwise if $t$ is positive, clockwise if $t$ is negative. The point where the trip ends is called the terminal point $P$.";
const pointName = (t: RealT) => `$P$ in quadrant ${roman[quadrantOf(t.value)]}`;
function circleFigure(t: RealT, extra: { drop?: boolean } = {}) {
  return {
    kind: "scene" as const,
    scene: unitCircleScene({
      travel: t.value,
      travelLabel: `arc length ${t.absPlain}`,
      points: [{ id: "P", angle: t.value, label: "P" }],
      origin: true,
      ...(extra.drop ? { radii: ["P"], drop: "P" } : {}),
      title: `Unit circle. A path starts at (1, 0) and travels ${t.absPlain} units ${directionOf(t)} around the circle${turnsOf(t).turns ? `, more than one full turn,` : ""} to the point P in quadrant ${roman[quadrantOf(t.value)]}.`,
      ...(extra.drop
        ? {
            note: "A dashed radius joins O to P, and a dashed segment drops from P straight down to the x-axis.",
          }
        : {}),
    }),
  };
}
const NAMES = ["Maya", "Jonah", "Priya", "Luis", "Amara", "Theo"] as const;
/** The wrong options a learner sees, with their feedback, as worked lines. */
const ruledOut = (shown: ChoiceOption[]) =>
  shown.map((o) => `${o.label.replace(/\.$/, "")}: wrong. ${o.feedback}`);
/** Three distractors from a pool, keeping its order of misconceptions. */
const three = (r: Random, pool: ChoiceOption[]) =>
  shuffled(r, pool).slice(0, 3);

/* ------------------------------------- unit-circle-extension-reason */

type Step = "s0" | "s1" | "s2" | "s3" | "s4";
type Claim = "f1" | "f2" | "f3" | "f4";
const familyAxis = defineAxis("family", ["r1", "r2", "r3"]);

function argument(t: RealT): string {
  const dir =
    t.value > 0
      ? "counterclockwise because $t$ is positive"
      : "clockwise because $t$ is negative";
  return [
    `Step 1: Start at $(1, 0)$ and move ${units(t)} units along the unit circle, ${dir}. This reaches exactly one point $P$.`,
    `Step 2: The turn from the positive $x$-axis to ray $OP$ measures $t = ${t.tex}$ radians.`,
    "Step 3: Define $\\cos t$ as the $x$-coordinate of $P$ and $\\sin t$ as its $y$-coordinate. When $0 < t < \\frac{\\pi}{2}$, these agree with the right-triangle ratios.",
    "Step 4: So $\\sin t$ and $\\cos t$ are defined for every real number $t$, with $-1 \\le \\sin t \\le 1$ and $-1 \\le \\cos t \\le 1$.",
  ].join(" ");
}

interface ReasonModel {
  family: "r1" | "r2" | "r3";
  part: Step | Claim | "explain";
  t: RealT;
  fn: "sin" | "cos";
  name: string;
  noFlaw: boolean;
}

function stepSurface(m: ReasonModel, r: Random) {
  const t = m.t;
  const d = degreesOf(t);
  const tx = tShown(t);
  const step = m.part as Step;
  let ask = "";
  let correct = "";
  let pool: ChoiceOption[] = [];
  let fact = "";
  let hint = "";
  if (step === "s0") {
    const why =
      t.value < 0
        ? `${tShown(t)} is negative`
        : `${tShown(t)} is more than $\\frac{\\pi}{2} \\approx 1.57$`;
    ask = `Before the unit circle, $\\sin t$ meant the opposite leg divided by the hypotenuse, for an acute angle $t$ of a right triangle. Why does that definition give no value for $${fnAt("sin", t)}$?`;
    correct = `No right triangle has an angle of $t$ radians, about $${d}^\\circ$: its acute angles are between 0 and $\\frac{\\pi}{2}$.`;
    pool = [
      {
        label: `Right triangles have only angles that are multiples of $\\pi$, and $t$ is not one.`,
        feedback: `A right triangle's acute angles can be any size between 0 and $\\frac{\\pi}{2}$, such as 1 radian. The trouble is that ${why}.`,
      },
      {
        label: "$t$ radians cannot be converted to degrees.",
        feedback: `Any radian measure converts: ${tx} radians is about $${d}^\\circ$. No right triangle has that angle.`,
      },
      {
        label: "$\\sin t$ would be greater than 1.",
        feedback:
          "No sine is greater than 1. The trouble is that no right triangle has this angle at all.",
      },
      {
        label: `A right triangle cannot have a hypotenuse of length ${units(t)}.`,
        feedback: `A hypotenuse can have any positive length. The angle, not a side, is the trouble: ${why}.`,
      },
    ];
    fact = `A right triangle has one right angle, $\\frac{\\pi}{2}$, and two acute angles that share the remaining $\\frac{\\pi}{2}$. So each acute angle is between 0 and $\\frac{\\pi}{2} \\approx 1.57$. Here ${why}, about $${d}^\\circ$, so no right triangle has this angle, and the unit circle is needed.`;
    hint = `The two acute angles of a right triangle share $\\frac{\\pi}{2}$ radians. Could one of them measure $t = ${t.tex}$ radians?`;
  } else if (step === "s1") {
    ask = `Which statement justifies Step 1: that every real number, however large or negative, reaches exactly one point $P$?`;
    correct =
      "The circle has no end: you can keep going past $2\\pi$, or go clockwise, so every distance ends at one point.";
    pool = [
      {
        label:
          "Every real number is less than $2\\pi$, so the trip never goes past one full turn.",
        feedback:
          "Real numbers such as 7 or 13 are larger than $2\\pi \\approx 6.28$. The trip simply keeps going around.",
      },
      {
        label:
          "The unit circle's circumference is 1, so $t$ is a fraction of one turn.",
        feedback:
          "The unit circle has radius 1, so its circumference is $2\\pi \\approx 6.28$, not 1.",
      },
      {
        label:
          "Only multiples of $\\pi$ land on the circle; other distances fall between points.",
        feedback:
          "Every distance along the circle ends somewhere on it. Multiples of $\\pi$ are only the trips that end on the $x$-axis.",
      },
      {
        label:
          "The step works only for $0 < t < \\frac{\\pi}{2}$, where a right triangle exists.",
        feedback:
          "Step 1 needs no triangle. Travelling along the circle works for any distance, in either direction.",
      },
    ];
    fact =
      "The fact behind Step 1: the circle has no end. A trip longer than $2\\pi$, one full turn, keeps going around, and a negative number travels the other way. Each distance ends at exactly one point, so each real number has exactly one $P$.";
    hint = `Step 1 must work for $t = ${t.tex}$ and for numbers far larger or negative. What happens when a trip along the circle passes $(1, 0)$ again, or runs clockwise?`;
  } else if (step === "s2") {
    ask =
      "Which statement justifies Step 2: that the turn measures $t$ radians, the same size as the distance travelled?";
    correct =
      "An angle in radians is arc length divided by radius. The radius is 1, so the angle's size equals the distance travelled.";
    pool = [
      {
        label:
          "An arc's length equals its angle in radians on every circle, whatever the radius.",
        feedback:
          "On a circle of radius $r$, an angle of $\\theta$ radians cuts an arc of length $r\\theta$. Only radius 1 makes the two equal.",
      },
      {
        label: "One radian is the same as one degree.",
        feedback:
          "One radian is about $57^\\circ$. A full turn is $2\\pi$ radians, or $360^\\circ$.",
      },
      {
        label: "The arc length is $t\\pi$, and $\\pi$ radians is half a turn.",
        feedback: `The path is ${units(t)} units long, with no factor of $\\pi$.`,
      },
      {
        label: "Point $P$ is $t$ units from the origin.",
        feedback:
          "Every point of the unit circle is 1 unit from the origin. The distance $t$ is measured along the circle.",
      },
    ];
    fact = `The fact behind Step 2: an angle in radians is the arc length divided by the radius. The radius here is 1, so a path of ${units(t)} units makes a turn of ${units(t)} radians, ${t.value > 0 ? "counterclockwise" : "clockwise, which is written as a negative angle"}.`;
    hint = `Radian measure compares arc length with radius. What is the radius of this circle, and what does that make a path of ${units(t)} units?`;
  } else if (step === "s3") {
    ask =
      "Which statement justifies the last sentence of Step 3: that for $0 < t < \\frac{\\pi}{2}$ the coordinates of $P$ agree with the right-triangle ratios?";
    correct =
      "From $P$, drop a perpendicular: adjacent leg $x$, opposite leg $y$, hypotenuse 1, so the ratios are $x$ and $y$.";
    pool = [
      {
        label: "The hypotenuse is $x$ and the adjacent leg is 1.",
        feedback:
          "The hypotenuse is the radius $OP$, which is 1. The adjacent leg lies along the $x$-axis and has length $x$.",
      },
      {
        label: "The triangle is always a 45-45-90 triangle, so $x = y$.",
        feedback: `The triangle's shape depends on $t$. Here $t = ${t.tex}$, and only $t = \\frac{\\pi}{4}$ gives equal legs.`,
      },
      {
        label: "The coordinates $x$ and $y$ are positive for every $t$.",
        feedback:
          "Coordinates are negative in other quadrants. The step needs the hypotenuse to be 1, not positive coordinates.",
      },
      {
        label: "$\\sin t = t$ for every $t$.",
        feedback:
          "That is false: $\\sin t$ is never more than 1, but $t$ can be any size.",
      },
    ];
    fact = `The fact behind Step 3: for $0 < t < \\frac{\\pi}{2}$, such as $t = ${t.tex}$, the dashed segment from $P$ to the $x$-axis makes a right triangle. Its hypotenuse is the radius $OP = 1$, its adjacent leg is $x$ and its opposite leg is $y$. Dividing by a hypotenuse of 1 leaves $x$ and $y$, so adjacent over hypotenuse is $x$ and opposite over hypotenuse is $y$.`;
    hint = `For $t = ${t.tex}$, look at the right triangle under $OP$ in the figure. Which side is the radius, and how long is it?`;
  } else {
    ask =
      "Which statement justifies the bounds in Step 4: that $\\sin t$ and $\\cos t$ always lie between $-1$ and $1$?";
    correct =
      "$P$ lies on the circle $x^2 + y^2 = 1$, so neither coordinate can be more than 1 in size.";
    pool = [
      {
        label: "The number $t$ is never more than 1.",
        feedback: `$t$ can be any real number; here $t = ${t.tex}$. The bound comes from the point, not from $t$.`,
      },
      {
        label: "The angle $t$ is never more than $2\\pi$.",
        feedback:
          "Angles can be more than $2\\pi$, such as 8.5. The bound comes from the circle's radius.",
      },
      {
        label: "$\\sin t$ is close to $t$, and $t$ is small.",
        feedback:
          "$\\sin t$ is close to $t$ only when $t$ is near 0. The bound holds for every $t$.",
      },
      {
        label: "Sine is never negative.",
        feedback:
          "Sine is negative below the $x$-axis. A sign also says nothing about size.",
      },
    ];
    fact =
      "The fact behind Step 4: every point $(x, y)$ of the unit circle is 1 unit from the origin, so $x^2 + y^2 = 1$. A square is never negative, so $x^2 \\le 1$ and $y^2 \\le 1$. That means $-1 \\le x \\le 1$ and $-1 \\le y \\le 1$.";
    hint = `Step 4 bounds the coordinates of $P$ for $t = ${t.tex}$. What equation do the coordinates of every point on the unit circle satisfy?`;
  }
  const shown = three(r, pool);
  const prompt =
    step === "s0"
      ? ask
      : `For $t = ${t.tex}$, the figure shows the trip that defines $\\sin t$ and $\\cos t$. ${argument(t)} ${ask}`;
  return choiceSurface(r, {
    prompt,
    options: [{ label: correct, correct: true }, ...shown],
    hint,
    explanation: [
      opening,
      tripSentence(t),
      fact,
      ...ruledOut(shown),
      signCheck(t),
    ],
  });
}

function explainSurface(m: ReasonModel, r: Random) {
  const t = m.t;
  const fn = m.fn;
  const coord = fn === "cos" ? "$x$" : "$y$";
  const val = `$${fnAt(fn, t)}$`;
  const { turns, restText } = turnsOf(t);
  const d = degreesOf(t);
  const dir = directionOf(t);
  const trip =
    turns === 0
      ? `travel ${units(t)} units ${dir}`
      : `go ${turns === 1 ? "one full turn" : "two full turns"} ${dir} and about ${restText} more`;
  const sym = `$\\${fn} t$`;
  const correct = `From $(1, 0)$, ${trip}. ${sym} is the ${coord}-coordinate where you stop.`;
  const v = fn === "cos" ? Math.cos(t.value) : Math.sin(t.value);
  const pool: ChoiceOption[] = [
    {
      label: `$t$ radians is about $${d}^\\circ$, and every angle has a ${fn === "cos" ? "cosine" : "sine"}, so ${sym} is defined.`,
      feedback: `This assumes what it should explain: that every angle, even $${d}^\\circ$, already has a ${fn === "cos" ? "cosine" : "sine"}. The point on the unit circle is what gives it one.`,
    },
    {
      label: `A calculator shows $\\${fn} t \\approx ${v.toFixed(3)}$, so it is defined.`,
      feedback:
        "A calculator uses the definition; it does not explain it. The value comes from the point on the unit circle.",
    },
    {
      label:
        "$t$ is a real number, and the unit circle contains every real number.",
      feedback: `The circle contains points, not numbers. $t = ${t.tex}$ is a distance travelled along it, and the stopping point gives the value.`,
    },
  ];
  if (nonAcute(t))
    pool.push({
      label: `Draw a right triangle with an angle of $t$ radians; ${sym} is ${fn === "cos" ? "adjacent" : "opposite"} over hypotenuse.`,
      feedback: `No right triangle has an angle of ${tShown(t)} radians, about $${d}^\\circ$: its acute angles are less than $\\frac{\\pi}{2}$.`,
    });
  // cos t = cos(2π − t) and sin t = sin(π − t) hold, so the choice is wrong
  // only as circular reasoning; it is offered only when the angle it calls
  // acute is not acute, so it is false outright.
  const other =
    fn === "cos"
      ? {
          value: TAU - t.value,
          sym: "2\\pi - t",
          tex: `2\\pi - ${t.value < 0 ? `(${t.tex})` : t.tex}`,
        }
      : {
          value: Math.PI - t.value,
          sym: "\\pi - t",
          tex: `\\pi - ${t.value < 0 ? `(${t.tex})` : t.tex}`,
        };
  if (!(other.value > 0 && other.value < Math.PI / 2))
    pool.push({
      label: `$\\${fn} t = \\${fn}(${other.sym})$, and that angle is acute.`,
      feedback: `$${other.tex} \\approx ${other.value.toFixed(2)}$ is not between 0 and $\\frac{\\pi}{2}$, so it is not acute. And using a property of ${fn === "cos" ? "cosine" : "sine"} assumes it is already defined.`,
    });
  const shown = three(r, pool);
  return choiceSurface(r, {
    prompt: `The figure shows the trip for $t = ${t.tex}$. Which explanation of why ${val} has a value is correct and complete?`,
    options: [{ label: correct, correct: true }, ...shown],
    hint: `A complete explanation says where the trip for $t = ${t.tex}$ ends and which coordinate of that point is the ${fn === "cos" ? "cosine" : "sine"}. Reject a choice that assumes the value already exists.`,
    explanation: [
      opening,
      tripSentence(t),
      `${val} is defined as the ${coord}-coordinate of that one point $P$. Nothing else is needed: no right triangle, no degrees, no calculator.`,
      ...ruledOut(shown),
      signCheck(t),
    ],
  });
}

function flawSurface(m: ReasonModel, r: Random) {
  const t = m.t;
  const name = m.name;
  const claim = m.part as Claim;
  const tx = tShown(t);
  const sinT = `$${fnAt("sin", t)}$`;
  const { turns, restText } = turnsOf(t);
  const noFlaw = (fb: string): ChoiceOption => ({
    label: "There is no flaw; the argument is correct.",
    feedback: fb,
  });
  let quote = "";
  let correct = "";
  let others: ChoiceOption[] = [];
  let flawless: ChoiceOption;
  let fact = "";
  let hint = "";
  if (claim === "f1") {
    quote = `“$\\sin t$ is the opposite leg over the hypotenuse. For $t = ${t.tex}$, the opposite leg is ${sinT} and the hypotenuse is 1, so $${fnAt("sin", t)} = \\frac{${fnAt("sin", t)}}{1}$, which is defined.”`;
    correct =
      "It uses $\\sin t$ to define $\\sin t$, and no right triangle has an angle of $t$ radians. Point $P$ defines it.";
    others = [
      {
        label: `The hypotenuse should be ${units(t)}, not 1.`,
        feedback: `The hypotenuse is not the trouble. The argument assumes ${sinT} exists in order to show that it exists.`,
      },
      {
        label: "$t$ should be converted to degrees first.",
        feedback: `Converting gives about $${degreesOf(t)}^\\circ$, and no right triangle has that angle either. The argument is still circular.`,
      },
      {
        label:
          "Opposite over hypotenuse works only for angles measured in degrees.",
        feedback: `The ratio does not depend on the unit. The flaw is that it uses ${sinT} to define ${sinT}.`,
      },
    ];
    flawless = noFlaw(
      `It uses ${sinT} to define ${sinT}, so it proves nothing.`,
    );
    fact = `${name} uses ${sinT} as a side length before ${sinT} has a value: the argument is circular. And no right triangle has an angle of ${tx} radians, about $${degreesOf(t)}^\\circ$, because its acute angles are less than $\\frac{\\pi}{2}$. The terminal point $P$ is what defines ${sinT}.`;
    hint = `Check whether ${name}'s argument uses ${sinT} before it has a value, and whether a right triangle can have an angle of ${tx} radians.`;
  } else if (claim === "f2") {
    quote = `“Negative angles do not exist, so ${sinT} is undefined.”`;
    correct = `Negative means clockwise: move ${units(t)} units from $(1, 0)$ to a point, and $\\sin t$ is its $y$-coordinate.`;
    const flipped = fnAt("sin", { ...t, value: -t.value, tex: t.absTex });
    others = [
      {
        label: `The fix is to drop the sign: $${fnAt("sin", t)} = ${flipped}$.`,
        feedback: `Going clockwise gives the mirror image across the $x$-axis, so $${fnAt("sin", t)} = -${flipped}$, not $${flipped}$.`,
      },
      {
        label:
          "The claim is right: arc lengths are never negative, so $\\sin t$ is undefined.",
        feedback: `The sign of $t$ gives the direction, and the distance is ${units(t)}. Clockwise travel reaches a point like any other.`,
      },
      {
        label:
          "A negative number means starting at $(-1, 0)$ instead of $(1, 0)$.",
        feedback:
          "Every trip starts at $(1, 0)$. A negative number changes only the direction, to clockwise.",
      },
    ];
    flawless = noFlaw(
      "Negative real numbers have sines: travel clockwise from $(1, 0)$.",
    );
    fact = `${name}'s claim is false. The sign of $t = ${t.tex}$ gives the direction: travel ${units(t)} units clockwise from $(1, 0)$. That trip ends at one point $P$, and ${sinT} is its $y$-coordinate.`;
    hint = `What does the minus sign in $t = ${t.tex}$ say about the direction of the trip on the unit circle?`;
  } else if (claim === "f3") {
    quote = `“$2\\pi$ is a full turn, so every angle is between 0 and $2\\pi$. So ${sinT} is undefined.”`;
    const full =
      turns === 1
        ? "one full turn ($2\\pi \\approx 6.28$)"
        : "two full turns ($4\\pi \\approx 12.57$)";
    correct = `Travel ${units(t)} units${t.value < 0 ? " clockwise" : ""}: ${turns === 1 ? "one full turn" : "two full turns"} of $2\\pi$, then about ${restText} more. That ends at a point, so $\\sin t$ exists.`;
    others = [
      {
        label: "Reduce $t$ by $\\pi$, since $\\pi$ is one full turn.",
        feedback:
          "One full turn is $2\\pi$, not $\\pi$. Going $\\pi$ further lands on the opposite point.",
      },
      {
        label:
          "The flaw is the unit: $\\sin t$ means the sine of $t$ degrees, and any number of degrees works.",
        feedback: `Radians are not degrees: $t = ${t.tex}$ radians is about $${degreesOf(t)}^\\circ$. The trip itself is fine, because the circle has no end.`,
      },
      {
        label:
          "The flaw is that every angle is between 0 and $\\pi$, not $2\\pi$.",
        feedback:
          "Angles have no upper limit. Past $2\\pi$ the trip keeps going around.",
      },
    ];
    flawless = noFlaw(
      "Real numbers larger than $2\\pi$ in size still reach a point: keep going around.",
    );
    fact = `${name}'s claim is false: the circle has no end. Travel ${units(t)} units ${directionOf(t)}: ${full} and about ${restText} more. That ends at one point $P$, so ${sinT} is defined, and it equals $\\sin\\left(${t.tex} ${t.value > 0 ? "-" : "+"} ${2 * turns}\\pi\\right)$: removing ${turns === 1 ? "the full turn" : "the full turns"} leaves the same point.`;
    hint = `How far is one full turn of the unit circle? Compare it with the ${units(t)} units of the trip for $t = ${t.tex}$.`;
  } else {
    const arc = t.pi
      ? piTex(3 * t.pi.p, t.pi.q)
      : String(Math.round(30 * t.value) / 10);
    const third = t.pi ? piTex(t.pi.p, 3 * t.pi.q) : `\\frac{${t.tex}}{3}`;
    quote = `“On a circle of radius 3, an angle of ${tx} radians cuts an arc of length ${tx}, so ${sinT} is the $y$-coordinate of the point reached.”`;
    correct =
      "On radius 3 the arc is $3t$ and the $y$-coordinate is $3\\sin t$. Only radius 1 gives $t$ and $\\sin t$.";
    others = [
      {
        label: "The arc should be $\\frac{t}{3}$.",
        feedback: `A bigger circle makes a longer arc for the same angle: the arc is $3 \\times ${t.tex} = ${arc}$, not $${third}$.`,
      },
      {
        label: "$\\sin t$ is the $x$-coordinate, not the $y$-coordinate.",
        feedback:
          "Sine is the $y$-coordinate on the unit circle. The flaw is the radius: on radius 3 both coordinates are 3 times as large.",
      },
      {
        label:
          "The arc is $t$, but the $y$-coordinate is $\\frac{\\sin t}{3}$.",
        feedback: `On radius 3 the arc is $3 \\times ${t.tex}$ and the $y$-coordinate is $3${fnAt("sin", t)}$: both are 3 times the unit-circle values.`,
      },
    ];
    flawless = {
      label: "There is no flaw; arc length equals the angle on any circle.",
      feedback:
        "Arc length is radius times angle. Only on the unit circle are the two equal.",
    };
    fact = `${name}'s claim fails because the radius is 3. Arc length is radius times angle, so the arc is $3 \\times ${t.tex} = ${arc}$, not ${tx}. Every coordinate is 3 times its unit-circle value, so the $y$-coordinate is $3${fnAt("sin", t)}$. Only on the unit circle, radius 1, does the arc equal the angle and the $y$-coordinate equal ${sinT}.`;
    hint = `On a circle of radius 3, how long is the arc for an angle of ${tx} radians, and how high is its endpoint compared with the unit circle's?`;
  }
  const shown = m.noFlaw
    ? [flawless, ...shuffled(r, others).slice(0, 2)]
    : shuffled(r, others);
  return choiceSurface(r, {
    prompt: `The figure shows the trip for $t = ${t.tex}$. ${name} argues: ${quote} What is the flaw?`,
    options: [{ label: correct, correct: true }, ...shown],
    hint,
    explanation: [
      opening,
      tripSentence(t),
      fact,
      ...ruledOut(shown),
      signCheck(t),
    ],
  });
}

const reasonKeep: Record<Step | Claim | "explain", (t: RealT) => boolean> = {
  s0: nonAcute,
  s1: () => true,
  s2: () => true,
  s3: (t) => t.value > 0 && t.value < Math.PI / 2,
  s4: () => true,
  explain: () => true,
  f1: nonAcute,
  f2: (t) => t.value < 0,
  f3: (t) => Math.abs(t.value) > TAU,
  f4: (t) => t.value > 0 && t.value < Math.PI,
};

export const reasonFamily = chainFamily({
  template: meta("unit-circle-extension-reason"),
  axes: { family: familyAxis },
  model: (r, axes): ReasonModel => {
    const family = axes.family;
    const part =
      family === "r1"
        ? pick(r, ["s0", "s1", "s2", "s3", "s4"] as const)
        : family === "r3"
          ? pick(r, ["f1", "f2", "f3", "f4"] as const)
          : ("explain" as const);
    const t = drawReal(r, reasonKeep[part]);
    return {
      family,
      part,
      t,
      fn: pick(r, ["sin", "cos"] as const),
      name: pick(r, NAMES),
      noFlaw: r(0, 4) < 2,
    };
  },
  variant: (m) => `${m.family}-${m.part}`,
  render: (m, _axes, r) => {
    const surface =
      m.family === "r1"
        ? stepSurface(m, r)
        : m.family === "r2"
          ? explainSurface(m, r)
          : flawSurface(m, r);
    if (!surface) return null;
    return {
      ...surface,
      figure: circleFigure(m.t, { drop: m.part === "s3" }),
    };
  },
});

/* -------------------------------------- unit-circle-extension-cloze */

interface ClozeModel {
  t: RealT;
}
type Opt = { label: string; correct?: true; why: string };
function optionsOf(r: Random, opts: Opt[]) {
  const order = shuffled(r, opts);
  const options: PartOption[] = order.map((o, i) => ({
    id: "abcdef"[i]!,
    label: o.label,
  }));
  const key = options[order.findIndex((o) => o.correct)]!.id;
  return { options, key, order };
}
export const clozeFamily = chainFamily({
  template: meta("unit-circle-extension-cloze"),
  axes: { kind: defineAxis("kind", KINDS) },
  model: (r, axes): ClozeModel => ({ t: pick(r, realsOf(axes.kind)) }),
  variant: (m) => m.t.kind,
  render: (m, _axes, r) => {
    const t = m.t;
    const a = t.absTex;
    const A = units(t);
    const neg = t.value < 0;
    const { turns, restText } = turnsOf(t);
    const dir = directionOf(t);
    const wrongDir = neg ? "counterclockwise" : "clockwise";
    const tp = t.pi;
    const moveOpts: Opt[] =
      turns > 0
        ? [
            {
              label: `${A} units ${dir}: ${turns === 1 ? "one full turn" : "two full turns"}, then about ${restText} more`,
              correct: true,
              why: `$t = ${t.tex}$ is ${neg ? "negative, so the trip runs clockwise" : "positive, so the trip runs counterclockwise"}; it passes $(1, 0)$ ${turns === 1 ? "once" : "twice"} and goes about ${restText} further.`,
            },
            {
              label: `${A} units ${wrongDir}: ${turns === 1 ? "one full turn" : "two full turns"}, then about ${restText} more`,
              why: `This runs ${wrongDir}. The sign of $t$ sets the direction: ${neg ? "negative means clockwise" : "positive means counterclockwise"}.`,
            },
            {
              label: `$${a} - \\pi$ units ${dir}, since $\\pi$ is a full turn`,
              why: "A full turn is $2\\pi \\approx 6.28$; $\\pi$ is only half a turn.",
            },
            {
              label: `$${a}^\\circ$ ${dir}`,
              why: `$t$ is a distance along the circle, ${a} units, not a number of degrees.`,
            },
          ]
        : [
            {
              label: `${A} units ${dir}`,
              correct: true,
              why: `$t = ${t.tex}$ is ${neg ? "negative, so the trip runs clockwise" : "positive, so the trip runs counterclockwise"} for a distance of ${A}.`,
            },
            {
              label: `${A} units ${wrongDir}`,
              why: `This runs ${wrongDir}. The sign of $t$ sets the direction: ${neg ? "negative means clockwise" : "positive means counterclockwise"}.`,
            },
            {
              label: `$${a}^\\circ$ ${dir}`,
              why: `$t$ is a distance along the circle, ${A} units, not a number of degrees.`,
            },
            {
              label: tp
                ? `$${ratioTex(Math.abs(tp.p), tp.q)}$ units ${dir}`
                : `$${a}\\pi$ units ${dir}`,
              why: tp
                ? `The distance is ${A}, with its factor of $\\pi$; dropping $\\pi$ shortens the trip.`
                : `The distance is ${A} itself, with no factor of $\\pi$.`,
            },
          ];
    const angleOpts: Opt[] = [
      {
        label: `${tShown(t)} radians`,
        correct: true,
        why: `On a circle of radius 1, the angle in radians equals the arc length, so the angle is ${tShown(t)} radians${neg ? ", negative because the turn is clockwise" : ""}.`,
      },
      {
        label: tp ? `$\\left(${t.tex}\\right)^\\circ$` : `$${t.tex}^\\circ$`,
        why: "Degrees are a different unit; arc length on the unit circle gives radians.",
      },
      {
        label: tp
          ? `$${ratioTex(tp.p, 2 * tp.q)}$ radians`
          : `$\\frac{${t.tex}}{2\\pi}$ radians`,
        why: "Dividing by $2\\pi$ gives the fraction of a full turn, not the angle.",
      },
      {
        label: tp
          ? `$${ratioTex(tp.p, tp.q)}$ radians`
          : `$${t.tex}\\pi$ radians`,
        why: tp
          ? "This drops the factor of $\\pi$ from the arc length."
          : "The arc length has no factor of $\\pi$, so neither does the angle.",
      },
    ];
    const cosT = fnAt("cos", t),
      sinT = fnAt("sin", t);
    const pointOpts: Opt[] = [
      {
        label: "$(\\cos t, \\sin t)$",
        correct: true,
        why: `Cosine is defined as the $x$-coordinate and sine as the $y$-coordinate, in that order: $P = (${cosT}, ${sinT})$.`,
      },
      {
        label: "$(\\sin t, \\cos t)$",
        why: "This swaps the coordinates. The $x$-coordinate, written first, is the cosine.",
      },
      {
        label: "$(t, \\sin t)$",
        why: "$t$ is a distance along the circle, not the $x$-coordinate of the point.",
      },
      {
        label: "$(\\cos t^\\circ, \\sin t^\\circ)$",
        why: "This reads $t$ as degrees. The point uses the angle in radians.",
      },
    ];
    const reasonOpts: Opt[] = [
      {
        label:
          "the circle has no end: any distance can be travelled, going around either way",
        correct: true,
        why: "The circle has no end, so a trip of any length, in either direction, ends at one point.",
      },
      {
        label: "every real number is between 0 and $2\\pi$",
        why: "Real numbers such as 13 are greater than $2\\pi$, and some are negative.",
      },
      {
        label: "every real number is positive",
        why: "Negative real numbers exist; they travel clockwise.",
      },
      {
        label: "the circumference of the unit circle is 1",
        why: "Radius 1 gives a circumference of $2\\pi \\approx 6.28$.",
      },
    ];
    const move = optionsOf(r, moveOpts);
    const angle = optionsOf(r, angleOpts);
    const point = optionsOf(r, pointOpts);
    const reason = optionsOf(r, reasonOpts);
    const response: MultiPartChoiceResponse = {
      kind: "multi-part-choice",
      label: "Choose an option for each blank",
      layout: "inline",
      blanks: [
        { id: "move", label: "Distance and direction", options: move.options },
        { id: "angle", label: "Angle", options: angle.options },
        {
          id: "point",
          label: "Coordinates of the point",
          options: point.options,
        },
        { id: "reason", label: "Reason", options: reason.options },
      ],
      sentence: [
        { text: "Start at $(1, 0)$ and move " },
        { blank: "move" },
        {
          text: ` along the unit circle. Because the radius is 1, an arc of length ${A}${neg ? ", travelled clockwise," : ""} makes an angle of `,
        },
        { blank: "angle" },
        { text: ". The point reached is $P$, with coordinates " },
        { blank: "point" },
        { text: ". This works for every real number $t$ because " },
        { blank: "reason" },
        { text: "." },
      ],
    };
    const wrongs = (o: Opt[]) =>
      o
        .filter((x) => !x.correct)
        .map((x) => `${x.label}: ${x.why}`)
        .join(" ");
    const keyOf = (o: Opt[]) => o.find((x) => x.correct)!;
    return {
      prompt: `For the real number $t = ${t.tex}$, complete the explanation of how the unit circle gives $${sinT}$ and $${cosT}$. The figure marks the start $(1, 0)$ and the terminal point $P$.`,
      response,
      answer: serializeMultiPart(response, {
        move: move.key,
        angle: angle.key,
        point: point.key,
        reason: reason.key,
      }),
      hint: `The radius is 1, so arc length and angle are the same number. Read $t = ${t.tex}$: its sign gives the direction, and coordinates are written $x$ first, then $y$.`,
      explanation: [
        opening,
        `Distance and direction: ${keyOf(moveOpts).why} Wrong choices: ${wrongs(moveOpts)}`,
        `Angle: ${keyOf(angleOpts).why} Wrong choices: ${wrongs(angleOpts)}`,
        `Coordinates: ${keyOf(pointOpts).why} Wrong choices: ${wrongs(pointOpts)}`,
        `Reason: ${keyOf(reasonOpts).why} Wrong choices: ${wrongs(reasonOpts)}`,
        tripSentence(t),
        `Nothing here needed $t$ to be acute, positive or less than $2\\pi$. That is why $\\sin t$ and $\\cos t$ are defined for every real number.`,
      ],
      figure: {
        kind: "scene" as const,
        scene: unitCircleScene({
          points: [{ id: "P", angle: t.value, label: "P" }],
          origin: true,
          title: `Unit circle with the start (1, 0) and the terminal point P of t = ${t.plain}, in quadrant ${roman[quadrantOf(t.value)]}.`,
        }),
      },
    };
  },
});

/* --------------------------------------- real-number-terminal-point */

type DecoyKind = "reverse" | "mirror" | "compass" | "half-turn" | "degrees";
interface Decoy {
  kind: DecoyKind;
  angle: number;
}
/** The decoy points for t: each a named misreading of the trip. */
export function decoysOf(t: number): Decoy[] {
  return [
    { kind: "reverse", angle: -t },
    { kind: "mirror", angle: Math.PI - t },
    { kind: "compass", angle: Math.PI / 2 - t },
    { kind: "half-turn", angle: t - Math.PI },
    { kind: "degrees", angle: (t * Math.PI) / 180 },
  ];
}
/** Three decoys, pairwise and from the key at least 0.3 apart: the first
 * valid triple in the shuffled order. {−t, π − t, t − π} always qualifies
 * for every t at least 0.3 from the axes. */
export function chooseDecoys(t: number, order: readonly Decoy[]): Decoy[] {
  const ok = (a: number, b: number) => angularGap(a, b) >= 0.3;
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++)
      for (let k = j + 1; k < order.length; k++) {
        const set = [order[i]!, order[j]!, order[k]!];
        const angles = [t, ...set.map((d) => d.angle)];
        if (angles.every((a, x) => angles.every((b, y) => x >= y || ok(a, b))))
          return set;
      }
  throw new Error(`No decoys for t = ${t}`);
}
const signed1 = (v: number) => {
  const s = (Math.round(v * 10) / 10 + 0).toFixed(1);
  return s === "-0.0" ? "0.0" : s.startsWith("-") ? `−${s.slice(1)}` : s;
};
/** Spoken description of a point; distinct for points 0.3 apart. */
export function pointWords(angle: number): string {
  const x = Math.cos(angle),
    y = Math.sin(angle);
  return `A point on the unit circle in quadrant ${roman[quadrantOf(angle)]}, at about (${signed1(x)}, ${signed1(y)}).`;
}
const CARD = { width: 264, maxHeight: 280 } as const;
export const terminalFamily = chainFamily({
  template: meta("real-number-terminal-point"),
  axes: { kind: defineAxis("kind", KINDS) },
  model: (r, axes) => ({ t: pick(r, realsOf(axes.kind)) }),
  variant: (m) => m.t.kind,
  render: (m, _axes, r) => {
    const t = m.t;
    const decoys = chooseDecoys(t.value, shuffled(r, decoysOf(t.value)));
    type Card = { angle: number; decoy?: DecoyKind };
    const cards: Card[] = shuffled(r, [
      { angle: t.value },
      ...decoys.map((d) => ({ angle: d.angle, decoy: d.kind })),
    ]);
    const response: FigureChoiceResponse = {
      kind: "figure-choice",
      label: "Choose the graph",
      noun: "Graph",
      options: cards.map((c, i) => ({
        id: figureOptionIds[i]!,
        label: pointWords(c.angle),
        scene: unitCircleScene({
          points: [{ id: "Q", angle: c.angle }],
          ...CARD,
        }),
      })),
    };
    const name = (i: number) => `Graph ${figureOptionLetters[i]}`;
    const keyAt = cards.findIndex((c) => c.decoy === undefined);
    const dir = directionOf(t);
    const why: Record<DecoyKind, (n: string) => string> = {
      reverse: (n) =>
        `${n} goes the wrong way. ${t.value > 0 ? "A positive" : "A negative"} number travels ${dir}; this point is where ${t.value > 0 ? "clockwise" : "counterclockwise"} travel ends.`,
      mirror: (n) =>
        `${n} is the mirror image across the $y$-axis: it measures the trip from $(-1, 0)$. Every trip starts at $(1, 0)$.`,
      compass: (n) =>
        `${n} starts at the top, $(0, 1)$, and turns the other way, like a compass. Every trip starts at $(1, 0)$ and runs counterclockwise for a positive number.`,
      "half-turn": (n) =>
        `${n} treats $\\pi$ as a full turn. A full turn is $2\\pi \\approx 6.28$; $\\pi$ is only half a turn.`,
      degrees: (n) =>
        `${n} reads $t$ as degrees, so the point barely moves from $(1, 0)$. $t$ is a distance along the circle, in radians.`,
    };
    const choiceFeedback: Record<string, string> = {};
    cards.forEach((c, i) => {
      if (c.decoy) choiceFeedback[figureOptionIds[i]!] = why[c.decoy](name(i));
    });
    return {
      prompt: `A real number $t$ names a trip along the unit circle that starts at $(1, 0)$. Which graph shows the terminal point, where the trip for $t = ${t.tex}$ ends?`,
      response,
      answer: figureOptionIds[keyAt]!,
      choiceFeedback,
      hint: `Use landmarks: a quarter turn is $\\frac{\\pi}{2} \\approx 1.57$, half a turn is $\\pi \\approx 3.14$, a full turn is $2\\pi \\approx 6.28$. Where does a trip of ${units(t)} units fall, and which way does $t = ${t.tex}$ travel?`,
      explanation: [
        opening,
        tripSentence(t),
        ...cards.flatMap((c, i) => (c.decoy ? [why[c.decoy](name(i))] : [])),
        signCheck(t),
        `${name(keyAt)} shows the terminal point of $t = ${t.tex}$, in quadrant ${roman[quadrantOf(t.value)]}.`,
      ],
    };
  },
});

/* ---------------------------------- real-number-same-terminal-point */

export const sameFamily = selectFamily(
  meta("real-number-same-terminal-point"),
  (r) => {
    const t = pick(r, realsOf("positive"));
    const k = r(2, 3);
    const tx = t.tex;
    const turnWord = (n: number) =>
      `${Math.abs(n) === 1 ? "one full turn" : "two full turns"} ${n > 0 ? "added" : "taken away"}`;
    const same = ([1, -1, 2, -2] as const).map((n) =>
      st(
        `$${tx} ${n > 0 ? "+" : "-"} ${2 * Math.abs(n)}\\pi$`,
        true,
        `This is $t$ with ${turnWord(n)}. A full turn, $2\\pi$, ends where it started, so the trip still ends at $P$.`,
      ),
    );
    const mirror = norm(-t.value),
      across = norm(Math.PI - t.value);
    const differ = [
      st(
        `$-${tx}$`,
        false,
        `This travels ${tx} units clockwise instead: the mirror image of $P$ across the $x$-axis, in quadrant ${roman[quadrantOf(mirror)]}.`,
      ),
      st(
        `$\\pi - ${tx}$`,
        false,
        `This is the mirror image of $P$ across the $y$-axis, in quadrant ${roman[quadrantOf(across)]}.`,
      ),
      st(
        `$${tx} + \\pi$`,
        false,
        "Adding $\\pi$ is half a turn: it ends at the point opposite $P$, through the origin.",
      ),
      st(
        `$${tx} + 360$`,
        false,
        "360 is a full turn in degrees, not radians. Adding 360 units goes around 57 times and then about 1.86 more, so it misses $P$.",
      ),
    ];
    return selectModel({
      variant: `correct-${k}`,
      pool: [...same, ...differ],
      total: 6,
      k,
      one: "number",
      context: `The figure shows the trip for $t = ${tx}$: it starts at $(1, 0)$ and travels ${tx} units counterclockwise to its terminal point $P$.`,
      ask: (n) => `Which ${n} other real numbers also have terminal point $P$?`,
      hint: `Which changes to $t = ${tx}$ add or remove a whole number of full turns, $2\\pi$ each? Which ones reflect $P$ or send it halfway around instead?`,
      figure: {
        kind: "scene",
        scene: unitCircleScene({
          travel: t.value,
          travelLabel: `arc length ${t.absPlain}`,
          points: [{ id: "P", angle: t.value, label: "P" }],
          origin: true,
          title: `Unit circle. A path starts at (1, 0) and travels ${t.absPlain} units counterclockwise to the point P in quadrant ${roman[quadrantOf(t.value)]}.`,
        }),
      },
      lead: [
        opening,
        "Adding or taking away a full turn, $2\\pi$, brings the trip back to the same point. So $t + 2\\pi$, $t - 2\\pi$ and $t \\pm 4\\pi$ all end at $P$.",
      ],
      tail: [
        "One point, infinitely many real numbers: that is why sine and cosine are defined for every real number and repeat every $2\\pi$.",
      ],
    });
  },
);

/* ------------------------------------------------------------ dispatch */

export const unitCircleExtensionGenerate = dispatch(
  unitCircleExtensionTemplates,
  {
    "unit-circle-extension-reason": (seed) =>
      reasonFamily.generate(seed).problem,
    "unit-circle-extension-cloze": (seed) => clozeFamily.generate(seed).problem,
    "real-number-terminal-point": (seed) =>
      terminalFamily.generate(seed).problem,
    "real-number-same-terminal-point": (seed) =>
      sameFamily.generate(seed).problem,
  },
);
