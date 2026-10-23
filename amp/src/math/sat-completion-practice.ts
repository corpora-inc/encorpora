import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  rational,
  type Draft,
} from "./distribution-practice";
import { scene, table, graph, f } from "./scene/author";
import { dataGraph } from "./algebra-statistics-scenes";

// Each row closes a distinct SAT demand inside an existing exposure objective.
const definitions = [
  [
    "sample-mean-estimate",
    "Estimate a population mean",
    "statistical-inference",
    "Use a random sample mean to estimate a population mean or total, while retaining sampling uncertainty.",
  ],
  [
    "probability-missing-count",
    "Recover a count from probability",
    "probability",
    "Recover an unknown event frequency from a stated probability and known complementary count.",
  ],
  [
    "standard-deviation-compare",
    "Compare standard deviations",
    "statistical-summary-comparison",
    "Compare spread under a translation, scaling, or a change in distances from a shared mean.",
  ],
  [
    "sample-size-margin",
    "Sample size and uncertainty",
    "sampling-margin-error",
    "Compare margins of error for comparable random samples at the same confidence level.",
  ],
  [
    "compound-unit-conversion",
    "Convert compound units",
    "units-and-precision",
    "Convert rates, squared and cubed units, density, and energy from power and time.",
  ],
  [
    "degree-radian-conversion",
    "Degrees and radians",
    "radians-unit-circle",
    "Convert in either direction using the exact relationship between a half turn and $\\pi$ radians.",
  ],
  [
    "unit-circle-coordinate",
    "Coordinates on a unit circle",
    "radians-unit-circle",
    "Use exact sine and cosine values and quadrant signs for angles around the unit circle.",
  ],
  [
    "similar-solid-volume",
    "Volumes of similar solids",
    "dilation-properties",
    "Use a cubed scale factor to connect corresponding lengths and volumes, in either direction.",
  ],
  [
    "nonlinear-formula-isolate",
    "Rearrange a nonlinear formula",
    "formula-rearrangement",
    "Isolate a positive quantity appearing squared, retaining the stated domain.",
  ],
  [
    "quadratic-context-model",
    "Model with a quadratic",
    "nonlinear-equation-modeling",
    "Build an area or height model and interpret its maximum or positive zero.",
  ],
  [
    "exponential-time-scale",
    "Equivalent exponential models",
    "exponential-models",
    "Rewrite a growth or decay model for another time interval and interpret its factor.",
  ],
  [
    "symbolic-rational-exponent",
    "Radicals and fractional exponents",
    "rational-exponents",
    "Recognize equivalent symbolic radical and rational-exponent expressions on a positive domain.",
  ],
  [
    "rational-expression-operation",
    "Combine rational expressions",
    "rational-expressions",
    "Add, subtract, or multiply rational expressions while retaining excluded inputs.",
  ],
  [
    "nonlinear-data-model",
    "Fit a data model",
    "regression-interpretation",
    "Choose a linear, quadratic, or exponential model fitting plotted observations by comparing squared residuals.",
  ],
  [
    "quadratic-parameter-root",
    "A quadratic with one real root",
    "quadratic-formula",
    "Find a coefficient giving exactly one distinct real root using a zero discriminant.",
  ],
  [
    "rational-function-representation",
    "Read a rational function",
    "cross-representation-comparison",
    "Connect a rational rule with a table or solve for an input, respecting the excluded denominator.",
  ],
] as const;
const numeric = new Set([
  "sample-mean-estimate",
  "probability-missing-count",
  "compound-unit-conversion",
  "similar-solid-volume",
  "quadratic-parameter-root",
]);
export const satCompletionTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, description]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "9–12",
    ...(!numeric.has(id)
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
    ...(["nonlinear-data-model", "rational-function-representation"].includes(
      id,
    )
      ? { requiredFigureCapability: "scenes-v1" as const }
      : {}),
  }));
function choices(labels: string[], explanation: string): Draft["choices"] {
  if (new Set(labels).size !== labels.length)
    throw new Error("Duplicate SAT choices");
  return labels.map((label, i) =>
    i === 0 ? { label, correct: true } : { label, feedback: explanation },
  );
}
const math = (s: string) => {
  // A bare positive number between dollar signs is read as currency by the
  // shared typesetter. Leave integer choices as text; typeset fractions fully.
  if (/^-?\d+$/.test(s)) return s;
  const fraction = /^(-?\d+)\/(\d+)$/.exec(s);
  return fraction ? `$\\frac{${fraction[1]}}{${fraction[2]}}$` : `$${s}$`;
};
const piMultiple = (numerator: number, denominator: number) => {
  const q = rational(numerator, denominator);
  if (q === "1") return "\\pi";
  const [n, d] = q.split("/");
  return d ? `\\frac{${n}\\pi}{${d}}` : `${n}\\pi`;
};
function draft(id: string, r: ReturnType<typeof random>): Draft {
  if (id === "sample-mean-estimate") {
    const mean = r(12, 50),
      n = 10 * r(4, 10),
      population = 100 * r(15, 40),
      total = r(0, 1) === 1;
    return {
      prompt: `A simple random sample of ${n} plants from a population of ${population} plants has mean height ${mean} centimeters. What is the sample-based estimate of the ${total ? "sum of all plant heights, in centimeters" : "population mean height, in centimeters"}?`,
      answer: String(total ? mean * population : mean),
      hint: `The sample mean is ${mean} centimeters per plant. ${total ? "Scale that average by the whole population size to estimate the total." : "A random sample's average estimates the average for the population from which it was selected."}`,
      explanation: [
        `Use the sample mean, ${mean} centimeters, to estimate the population mean.`,
        total
          ? `The estimated total is ${mean} × ${population} = ${mean * population} centimeters.`
          : "The population mean estimate is the same sample average, not the sum of the sampled heights.",
        "This is an estimate from a random sample; the true population value may differ.",
      ],
    };
  }
  if (id === "probability-missing-count") {
    const red = r(1, 12),
      blue = r(2, 15);
    return {
      prompt: `A bag contains only red and blue counters. It contains ${blue} blue counters. One counter is selected uniformly at random. The probability that it is red is ${rational(red, red + blue)}. How many red counters are in the bag?`,
      answer: String(red),
      hint: `There are ${blue} blue counters. Let $x$ be the red count, so the total is $x+${blue}$. Express the stated red probability as red count divided by total count.`,
      explanation: [
        `The equation is $x/(x+${blue})=${rational(red, red + blue)}$.`,
        `Multiply by the positive total and solve: $${red + blue}x=${red}(x+${blue})$, so $${blue}x=${red * blue}$.`,
        `Thus $x=${red}$ red counters. Check: ${red} out of ${red + blue} counters gives the stated probability.`,
      ],
    };
  }
  if (id === "standard-deviation-compare") {
    const mode = r(0, 2),
      shift = r(2, 12),
      scale = r(2, 5),
      center = 5 * r(3, 8),
      spread = r(1, 4);
    const values = [
      center - 2 * spread,
      center - spread,
      center,
      center + spread,
      center + 2 * spread,
    ];
    const other =
      mode === 0
        ? values.map((v) => v + shift)
        : mode === 1
          ? values.map((v) => v * scale)
          : [
              center - 3 * spread,
              center - spread,
              center,
              center + spread,
              center + 3 * spread,
            ];
    const result =
      mode === 0
        ? "The standard deviations are equal."
        : "Data set B has the larger standard deviation.";
    return {
      prompt: `Data set A is ${values.join(", ")}. Data set B is ${other.join(", ")}. Which statement compares their standard deviations? Standard deviation measures how far values typically lie from their mean.`,
      answer: "",
      hint: `Start with the middle value ${center} in data set A. Compare each set's distances from its own mean, rather than the size of the values.`,
      choices: choices(
        [
          result,
          mode === 0
            ? "Data set B has the larger standard deviation."
            : "The standard deviations are equal.",
          "Data set A has the larger standard deviation.",
          "Standard deviation cannot be compared unless the means are equal.",
        ],
        "Compare distances from each set's own mean; a shift changes the mean but not the spread.",
      ),
      explanation:
        mode === 0
          ? [
              `Every value increases by ${shift}, so the mean also increases by ${shift}.`,
              "Each distance from the mean is unchanged. The standard deviations are equal.",
            ]
          : mode === 1
            ? [
                `Every value, and therefore the mean, is multiplied by ${scale}.`,
                `Every distance from the mean is multiplied by ${scale}. The standard deviation of B is ${scale} times that of A.`,
              ]
            : [
                `Both means equal ${center}.`,
                `The two outer distances increase from ${2 * spread} to ${3 * spread}; the other distances are unchanged.`,
                "The mean of squared distances increases, so its square root, the standard deviation, increases.",
              ],
    };
  }
  if (id === "sample-size-margin") {
    const n = 100 * r(2, 8),
      factor = r(2, 4);
    return {
      prompt: `Two surveys use independent simple random samples from the same large population, the same question and confidence level, and comparable sample proportions. Survey A samples ${n} people; survey B samples ${n * factor} people. Which statement is justified?`,
      answer: "",
      hint: `Survey A uses ${n} people. Compare that sample size with survey B while keeping the sampling method and confidence level fixed.`,
      choices: choices(
        [
          "Survey B generally has a smaller margin of error.",
          "Survey A generally has a smaller margin of error.",
          "Both margins of error must be identical.",
          "Survey B is guaranteed to have an estimate equal to the population proportion.",
        ],
        "A larger comparable random sample generally reduces sampling uncertainty, but does not guarantee an exact estimate.",
      ),
      explanation: [
        `Survey B uses ${factor} times as many sampled people.`,
        "With comparable conditions, a larger random sample generally gives a smaller margin of error.",
        "This is a statement about sampling uncertainty, not a guarantee of a more accurate realized estimate or a cure for biased sampling.",
      ],
    };
  }
  if (id === "compound-unit-conversion") {
    const mode = r(0, 4),
      v = r(2, 20);
    const cases = [
      {
        prompt: `A vehicle travels at ${v * 18} kilometers per hour. Given 1 kilometer = 1000 meters and 1 hour = 3600 seconds, what is its speed in meters per second?`,
        answer: String(v * 5),
        hint: `Start with ${v * 18} kilometers per hour. Convert the distance to meters and the time to seconds.`,
        explanation: [
          `${v * 18} × 1000 ÷ 3600 = ${v * 5} meters per second.`,
          "Both the numerator and denominator units must be converted.",
        ],
      },
      {
        prompt: `A panel has area ${v} square meters. Given 1 meter = 100 centimeters, what is its area in square centimeters?`,
        answer: String(v * 10000),
        hint: `One square meter has side lengths of 1 meter each. Convert both lengths using 100 centimeters per meter.`,
        explanation: [
          "A square meter is 100 × 100 = 10000 square centimeters.",
          `Multiply: ${v} × 10000 = ${v * 10000} square centimeters.`,
        ],
      },
      {
        prompt: `A container holds ${v} cubic meters. Given 1 meter = 100 centimeters, what is this volume in cubic centimeters?`,
        answer: String(v * 1000000),
        hint: `A cubic meter has 3 length dimensions. Apply the factor 100 to each dimension.`,
        explanation: [
          "One cubic meter equals 100 × 100 × 100 = 1000000 cubic centimeters.",
          `The volume is ${v} × 1000000 = ${v * 1000000} cubic centimeters.`,
        ],
      },
      {
        prompt: `A material has density ${v} grams per cubic centimeter. Given 1 kilogram = 1000 grams and 1 cubic meter = 1000000 cubic centimeters, what is its density in kilograms per cubic meter?`,
        answer: String(v * 1000),
        hint: `At ${v} grams per cubic centimeter, first find the grams in 1000000 cubic centimeters. Then convert grams to kilograms.`,
        explanation: [
          `A cubic meter has mass ${v} × 1000000 grams.`,
          `Divide by 1000 grams per kilogram: ${v * 1000} kilograms per cubic meter.`,
        ],
      },
      {
        prompt: `A device uses constant power of ${v * 250} watts for 30 minutes. Given 1000 watts = 1 kilowatt and 60 minutes = 1 hour, how many kilowatt-hours of energy does it use?`,
        answer: rational(v, 8),
        hint: `Convert ${v * 250} watts to kilowatts and 30 minutes to hours before multiplying power by time.`,
        explanation: [
          `Power is ${v * 250}/1000 = ${rational(v, 4)} ${v === 4 ? "kilowatt" : "kilowatts"}; time is 30/60 = 1/2 hour.`,
          `Energy is power × time = ${rational(v, 4)} × 1/2 = ${rational(v, 8)} kilowatt-hours.`,
        ],
      },
    ];
    return { ...cases[mode]!, fraction: true };
  }
  if (id === "degree-radian-conversion") {
    const degree = [
        30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
      ][r(0, 14)]!,
      reverse = r(0, 1) === 1;
    const q = rational(degree, 180),
      rad = piMultiple(degree, 180),
      labels = reverse
        ? [degree, degree / 2, degree * 2, degree + 1].map(String)
        : [
            rad,
            piMultiple(degree, 360),
            piMultiple(degree, 90),
            String(degree),
          ];
    return {
      prompt: reverse
        ? `An angle measures $${rad}$ radians. What is its measure in degrees?`
        : `An angle measures ${degree} degrees. Which expression gives its measure in radians?`,
      answer: "",
      hint:
        degree === 180
          ? reverse
            ? "The stated radian measure represents half a turn. Express that fraction of a full turn in degrees."
            : "The given 180 degrees is half of a full turn. Express that same fraction of a turn in radians."
          : `A half turn is 180 degrees or $\\pi$ radians. Compare the stated ${reverse ? math(rad) + " radians" : degree + " degrees"} with that half turn.`,
      choices: choices(
        labels.map(math),
        "Use the equivalence between 180 degrees and $\\pi$ radians, keeping the same fraction of a half turn.",
      ),
      explanation: reverse
        ? [
            `Multiply the radian measure by $180/\\pi$.`,
            `$${rad} \\times 180/\\pi = ${degree}$ degrees.`,
          ]
        : [
            "Divide by 180 to count half turns, then multiply by $\\pi$.",
            `$${degree}/180 = ${q}$, so the angle is $${rad}$ radians.`,
          ],
    };
  }
  if (id === "unit-circle-coordinate") {
    const a = [30, 45, 60][r(0, 2)]!,
      quadrant = r(0, 3),
      degree = [a, 180 - a, 180 + a, 360 - a][quadrant]!,
      sin = r(0, 1) === 1;
    const base = sin
      ? a === 30
        ? "1/2"
        : a === 45
          ? "\\sqrt{2}/2"
          : "\\sqrt{3}/2"
      : a === 60
        ? "1/2"
        : a === 45
          ? "\\sqrt{2}/2"
          : "\\sqrt{3}/2";
    const negative = sin ? quadrant >= 2 : quadrant === 1 || quadrant === 2;
    const answer = (negative ? "-" : "") + base;
    const other = base === "1/2" ? "\\sqrt{3}/2" : "1/2";
    return {
      prompt: `On the unit circle centered at the origin, an angle of ${degree} degrees is measured counterclockwise from the positive $x$-axis. What is the ${sin ? "$y$" : "$x$"}-coordinate of its endpoint?`,
      answer: "",
      hint: `The angle ${degree} degrees has reference angle ${a} degrees. Use that acute triangle, then check the sign of the ${sin ? "$y$" : "$x$"}-coordinate in this quadrant.`,
      choices: choices(
        [answer, (negative ? "" : "-") + base, other, "-" + other].map(math),
        "The $x$-coordinate is cosine and the $y$-coordinate is sine; the quadrant determines the sign.",
      ),
      explanation: [
        `The unit circle has radius 1. Its coordinates are $(\\cos\\theta,\\sin\\theta)$.`,
        `The reference angle is ${a} degrees; the corresponding positive ${sin ? "sine" : "cosine"} is $${base}$.`,
        `The endpoint is in quadrant ${quadrant + 1}, where its ${sin ? "$y$" : "$x$"}-coordinate is ${negative ? "negative" : "positive"}. The requested coordinate is $${answer}$.`,
      ],
    };
  }
  if (id === "similar-solid-volume") {
    const k = r(2, 5),
      length = r(2, 7),
      volume = r(10, 80),
      reverse = r(0, 1) === 1;
    return {
      prompt: reverse
        ? `Two solids are similar. The smaller has volume ${volume} cubic centimeters and a corresponding edge of ${length} cm. The larger has volume ${volume * k ** 3} cubic centimeters. How long is the corresponding edge of the larger solid, in centimeters?`
        : `Two solids are similar. Corresponding edges measure ${length} cm and ${length * k} cm. The smaller solid has volume ${volume} cubic centimeters. What is the larger solid's volume, in cubic centimeters?`,
      answer: String(reverse ? length * k : volume * k ** 3),
      hint: `Compare the ${reverse ? volume + " and " + volume * k ** 3 + " cubic-centimeter volumes" : length + " and " + length * k + " centimeter edges"}. A length scale factor acts in all 3 dimensions of volume.`,
      explanation: reverse
        ? [
            `The volume ratio is ${volume * k ** 3}/${volume} = ${k ** 3}.`,
            `The edge ratio is its cube root, ${k}. The edge is ${length} × ${k} = ${length * k} cm.`,
          ]
        : [
            `The length scale factor is ${length * k}/${length} = ${k}.`,
            `Volume scales by ${k}³ = ${k ** 3}, so the larger volume is ${volume} × ${k ** 3} = ${volume * k ** 3} cubic centimeters.`,
          ],
    };
  }
  if (id === "nonlinear-formula-isolate") {
    const variant = r(0, 2);
    const cases = [
      {
        prompt:
          "A circle has area $A=\\pi r^2$, where $A>0$ and $r>0$. Which expression gives its radius?",
        labels: ["\\sqrt{A/\\pi}", "A/\\pi", "\\sqrt{\\pi A}", "A/(2\\pi)"],
        hint: "In $A=\\pi r^2$, first divide both sides by the positive constant $\\pi$ to isolate the square.",
        steps: [
          "Dividing by $\\pi$ gives $r^2=A/\\pi$.",
          "Since $r>0$, take the positive square root: $r=\\sqrt{A/\\pi}$.",
        ],
      },
      {
        prompt:
          "A cylinder has volume $V=\\pi r^2h$, where $V>0$, $h>0$, and $r>0$. Which expression gives its radius?",
        labels: [
          "\\sqrt{V/(\\pi h)}",
          "V/(\\pi h)",
          "\\sqrt{Vh/\\pi}",
          "\\sqrt{V/\\pi}/h",
        ],
        hint: "In $V=\\pi r^2h$, divide by the positive product $\\pi h$ before undoing the square.",
        steps: [
          "Divide by $\\pi h$: $r^2=V/(\\pi h)$.",
          "The radius is positive, so $r=\\sqrt{V/(\\pi h)}$.",
        ],
      },
      {
        prompt:
          "Kinetic energy is $E=mv^2/2$, where $E>0$, mass $m>0$, and speed $v>0$. Which expression gives the speed?",
        labels: ["\\sqrt{2E/m}", "2E/m", "\\sqrt{E/(2m)}", "\\sqrt{2Em}"],
        hint: "In $E=mv^2/2$, first multiply by 2. Then divide by the positive mass $m$ to isolate the squared speed.",
        steps: [
          "Multiply by 2 and divide by $m$: $v^2=2E/m$.",
          "Speed is positive, so $v=\\sqrt{2E/m}$.",
        ],
      },
    ];
    const c = cases[variant]!;
    return {
      prompt: c.prompt,
      answer: "",
      hint: c.hint,
      explanation: c.steps,
      choices: choices(
        c.labels.map(math),
        "Isolate the squared quantity first, then choose the positive square root required by the stated domain.",
      ),
    };
  }
  if (id === "quadratic-context-model") {
    const mode = r(0, 4),
      b = 2 * r(5, 15),
      a = r(1, 4),
      end = 2 * r(3, 8);
    if (mode === 0)
      return {
        prompt: `A rectangle has perimeter ${2 * b} meters. Its width is $x$ meters. Which expression gives its area in square meters?`,
        answer: "",
        hint: `Half the perimeter ${2 * b} meters equals the length plus the width. Express the other side using $x$ before multiplying.`,
        choices: choices(
          [`x(${b}-x)`, `x(${2 * b}-x)`, `2x(${b}-x)`, `x(${b}+x)`].map(math),
          "The sum of one length and one width is half the perimeter; area is their product.",
        ),
        explanation: [
          `One length plus one width equals ${b} meters, so the length is $${b}-x$.`,
          `Area equals width times length: $A=x(${b}-x)$, with $0<x<${b}$.`,
        ],
      };
    if (mode === 1)
      return {
        prompt: `A ball's height in meters after $t$ seconds is $h(t)=${a}t(${end}-t)$ for $0\\le t\\le ${end}$. What is its maximum height, in meters?`,
        answer: "",
        hint: `The height is zero at $t=0$ and $t=${end}$. The maximum lies halfway between these two times because the parabola is symmetric.`,
        choices: choices(
          [a * (end / 2) ** 2, a * end, a * end ** 2, end / 2].filter(
            (v, i, arr) => arr.indexOf(v) === i,
          ).length === 4
            ? [a * (end / 2) ** 2, a * end, a * end ** 2, end / 2].map((v) =>
                math(String(v)),
              )
            : [
                a * (end / 2) ** 2,
                a * (end / 2) ** 2 + 1,
                a * (end / 2) ** 2 - 1,
                a * (end / 2) ** 2 + end,
              ].map((v) => math(String(v))),
          "Find the vertex time, then evaluate the height; the time and height are different quantities.",
        ),
        explanation: [
          `The zeros are 0 and ${end}, so the maximum occurs at $t=${end / 2}$.`,
          `Substitute: $h(${end / 2})=${a}(${end / 2})(${end / 2})=${a * (end / 2) ** 2}$ meters.`,
        ],
      };
    if (mode === 3)
      return {
        prompt: `A ball's height in meters at time $t$ seconds is $h(t)=${a}(${end}-t)(t+${b})$ for $t\\ge0$. After how many seconds does it first reach the ground?`,
        answer: "",
        hint: `Ground level means height 0. For $h(t)=${a}(${end}-t)(t+${b})$, set each variable factor equal to zero and keep a nonnegative time.`,
        choices: choices(
          [end, -b, end / 2, end + 1].map((v) => math(String(v))),
          "Use a zero of the height model, then apply the nonnegative time domain.",
        ),
        explanation: [
          `Ground level requires $h(t)=0$, so $${end}-t=0$ or $t+${b}=0$.`,
          `The candidate times are ${end} and ${-b}. Only ${end} is nonnegative, so the ball reaches the ground after ${end} seconds.`,
        ],
      };
    if (mode === 4)
      return {
        prompt: `A ball's height in meters at time $t$ seconds is $h(t)=${a}(${end}-t)(t+${b})$ for $t\\ge0$. What is its initial height, in meters?`,
        answer: "",
        hint: `Initial height means the height at time 0. Substitute 0 into $${a}(${end}-t)(t+${b})$ before multiplying.`,
        choices: choices(
          [a * end * b, end, 0, a * end * b + 1].map((v) => math(String(v))),
          "Evaluate the output at time zero; an intercept time is a different quantity.",
        ),
        explanation: [
          `At $t=0$, $h(0)=${a}(${end})(${b})=${a * end * b}$.`,
          `The model's initial height is ${a * end * b} meters.`,
        ],
      };
    return {
      prompt: `A rectangle is $x$ meters wide and $x+${a}$ meters long. Its area is ${end * (end + a)} square meters. What is its width, in meters?`,
      answer: "",
      hint: `Multiply the two side lengths $x$ and $x+${a}$ to obtain the stated area ${end * (end + a)}. A side length must be positive.`,
      choices: choices(
        [end, end + a, -end - a, -end].map((v) => math(String(v))),
        "Solve the area equation, then reject a negative length.",
      ),
      explanation: [
        `The equation is $x(x+${a})=${end * (end + a)}$.`,
        `Rearrange and factor: $(x-${end})(x+${end + a})=0$.`,
        `The candidates are ${end} and ${-end - a}. Only ${end} is a positive width.`,
      ],
    };
  }
  if (id === "exponential-time-scale") {
    const a = 10 * r(2, 20),
      period = r(2, 6),
      factor = r(0, 1) ? 2 : r(2, 5),
      decay = r(0, 1) === 1;
    const f = decay ? `1/${factor}` : String(factor);
    if (r(0, 1) === 1)
      return {
        prompt: `A population is modeled by $P(t)=${a}(${f})^{t/${period}}$, where $t$ is in years. Which expression is an equivalent model?`,
        answer: "",
        hint: `The exponent $t/${period}$ means $t$ times $1/${period}$. Use the power-of-a-power rule to write one factor for each year.`,
        choices: choices(
          [
            `P(t)=${a}\\left(\\left(${f}\\right)^{1/${period}}\\right)^t`,
            `P(t)=${a}(${f})^t`,
            `P(t)=${a}(${f})^{${period}t}`,
            `P(t)=${a}+(${f})^{t/${period}}`,
          ].map(math),
          "Use the positive annual factor whose power over the full interval equals the stated factor.",
        ),
        explanation: [
          `For a positive base, $b^{uv}=(b^u)^v$.`,
          `Write $t/${period}=\\frac{1}{${period}}t$, so $P(t)=${a}\\left(\\left(${f}\\right)^{1/${period}}\\right)^t$.`,
          `The initial value stays ${a}; the per-year factor is the positive root of ${f} with index ${period}.`,
        ],
      };
    return {
      prompt: `A population is modeled by $P(t)=${a}(${f})^{t/${period}}$, where $t$ is in years. Which statement describes the model?`,
      answer: "",
      hint: `Compare $P(t+${period})$ with $P(t)$. Increasing $t$ by ${period} adds 1 to the exponent.`,
      choices: choices(
        [
          `Every ${period} years, the population is multiplied by ${f}.`,
          `Every year, the population is multiplied by ${f}.`,
          `Every ${period} years, the population changes by ${factor} individuals.`,
          `The initial population is ${a * factor}.`,
        ],
        "The denominator of the exponent defines the time interval for one multiplication by the base.",
      ),
      explanation: [
        `At $t=0$, the population is $${a}$.`,
        `Since $(t+${period})/${period}=t/${period}+1$, $P(t+${period})=${decay ? `\\frac{1}{${factor}}` : f}P(t)$.`,
        `An equivalent annual form is $P(t)=${a}\\left(\\left(${f}\\right)^{1/${period}}\\right)^t$. The annual factor is the positive root of ${f} with index ${period}.`,
      ],
    };
  }
  if (id === "symbolic-rational-exponent") {
    const n = r(2, 5),
      m = r(1, n - 1),
      mode = r(0, 1),
      expression =
        mode === 0 ? `\\sqrt[${n}]{x^{${m}}}` : `1/\\sqrt[${n}]{x^{${m}}}`,
      exponent = rational(mode === 0 ? m : -m, n);
    return {
      prompt: `For $x>0$, which expression is equivalent to $${expression}$?`,
      answer: "",
      hint: `The root index ${n} divides the exponent ${m}. ${mode === 1 ? "A reciprocal reverses the exponent's sign." : "Keep the power and the root as separate operations."}`,
      choices: choices(
        [
          `x^{${exponent}}`,
          `x^{${rational(n, m)}}`,
          `x^{${m + n}}`,
          mode === 0 ? `x^{${rational(-m, n)}}` : `x^{${rational(m, n)}}`,
        ].map(math),
        "For a positive base, an nth root is a power of 1/n; a reciprocal negates the exponent.",
      ),
      explanation: [
        `For $x>0$, $\\sqrt[${n}]{x^{${m}}}=x^{${rational(m, n)}}$.`,
        mode === 0
          ? `The equivalent expression is $x^{${exponent}}$.`
          : `Taking the reciprocal gives $x^{${exponent}}$.`,
      ],
    };
  }
  if (id === "rational-expression-operation") {
    const a = r(2, 7),
      b = r(2, 7),
      c = r(1, 6),
      mode = r(0, 2);
    const expression =
      mode === 0
        ? `\\frac{${a}}{x}+\\frac{${b}}{x+${c}}`
        : mode === 1
          ? `\\frac{${a}}{x}-\\frac{${b}}{x+${c}}`
          : `\\frac{x+${c}}{x}\\cdot\\frac{${a}}{x+${c}}`;
    const numerator = mode === 0 ? `${a + b}x+${a * c}` : `${a - b}x+${a * c}`;
    const result =
      mode === 2 ? `\\frac{${a}}{x}` : `\\frac{${numerator}}{x(x+${c})}`;
    return {
      prompt: `Which expression equals $${expression}$ for all allowed inputs? Retain the restrictions $x\\ne0$ and $x\\ne-${c}$.`,
      answer: "",
      hint: `The denominators contain $x$ and $x+${c}$. ${mode === 2 ? "Multiply numerators and denominators before cancelling a common factor." : "Use their product as a common denominator before combining numerators."}`,
      choices: choices(
        [
          result,
          mode === 2 ? `\\frac{${a}}{x+${c}}` : `\\frac{${numerator}}{2x+${c}}`,
          mode === 2 ? `\\frac{${a}}{x^2}` : `\\frac{${numerator}}{x}`,
          mode === 2 ? String(a) : `-\\frac{${numerator}}{x(x+${c})}`,
        ].map(math),
        "Add or subtract numerators only after expressing both terms over a common denominator; never cancel terms in a sum.",
      ),
      explanation:
        mode === 2
          ? [
              `The product is $\\frac{${a}(x+${c})}{x(x+${c})}$.`,
              `Cancel the nonzero factor $x+${c}$ to get $${result}$.`,
              `The original restrictions $x\\ne0,-${c}$ still apply.`,
            ]
          : [
              `The common denominator is $x(x+${c})$.`,
              `The numerator is $${a}(x+${c})${mode === 0 ? "+" : "-"}${b}x=${numerator}$.`,
              `The result is $${result}$ with $x\\ne0,-${c}$.`,
            ],
    };
  }
  if (id === "nonlinear-data-model") {
    const mode = r(0, 2),
      exponential = mode === 1,
      linear = mode === 2,
      a = r(2, 5),
      b = r(2, 3);
    const xs = [0, 1, 2, 3],
      y = xs.map((x) =>
        exponential ? a * b ** x : linear ? a * x + b : a * x * x + b,
      ),
      ys = y.map((v, i) => v + [1, -1, 1, -1][i]!);
    const labels = exponential
      ? [`${a}(${b})^x`, `${a}x^2+${b}`, `${a * b}x+${a}`, `${a * b ** 3}`]
      : [`${a}x^2+${b}`, `${a}(${b})^x`, `${a}x+${b}`, `${a * 9 + b}`];
    // Occasionally a competing model fits better; calculate exact least-squares
    // comparison rather than assuming the model used to generate data wins.
    const funcs = exponential
      ? [
          (x: number) => a * b ** x,
          (x: number) => a * x * x + b,
          (x: number) => a * b * x + a,
          (_x: number) => a * b ** 3,
        ]
      : [
          (x: number) => a * x * x + b,
          (x: number) => a * b ** x,
          (x: number) => a * x + b,
          (_x: number) => a * 9 + b,
        ];
    const errors = funcs.map((fn) =>
      xs.reduce((sum, x, i) => sum + (ys[i]! - fn(x)) ** 2, 0),
    );
    const sorted = errors.map((e, i) => ({ e, i })).sort((l, r) => l.e - r.e);
    if (sorted[0]!.e === sorted[1]!.e) throw new Error("Ambiguous model fit");
    const best = sorted[0]!.i;
    const visual = scene(
      dataGraph(
        { start: 0, end: 4, step: 1, label: "Time (days)" },
        {
          start: 0,
          end: Math.ceil((Math.max(...ys) + 5) / 10) * 10,
          step: 10,
          label: "Measured amount",
        },
      )
        .point(0, ys[0]!)
        .point(1, ys[1]!)
        .point(2, ys[2]!)
        .point(3, ys[3]!),
    ).build({
      title: "Observed growth",
      note: `Observed input-output pairs: ${xs.map((x, i) => `(${x}, ${ys[i]})`).join(", ")}.`,
      width: 360,
      maxHeight: 260,
    });
    return {
      prompt: `Four observations are plotted: $${xs.map((x, i) => `(${x},${ys[i]})`).join(", ")}$. Each pair gives time in days and measured amount. Which model has the smallest sum of squared residuals for these observations? A residual is observed output minus predicted output.`,
      figure: { kind: "scene", scene: visual },
      answer: "",
      hint: `At time 3, the observed amount is ${ys[3]}. For each model, subtract its predicted amount from the observed amount, square the difference, and add over all 4 observations.`,
      choices: choices(
        [labels[best]!, ...labels.filter((_, i) => i !== best)].map((s) =>
          math(`y=${s}`),
        ),
        "Compare all four squared residual totals; the closest fit need not pass through every observed point.",
      ),
      explanation: labels
        .map(
          (label, i) =>
            `For $y=${label}$, the sum of squared residuals is ${errors[i]}.`,
        )
        .concat(
          `The smallest total is ${errors[best]}, so choose $y=${labels[best]}$. This is a fit to these observations, not proof of a causal law.`,
        ),
    };
  }
  if (id === "quadratic-parameter-root") {
    const a = r(1, 5),
      root = r(1, 9) * (r(0, 1) ? 1 : -1),
      b = -2 * a * root,
      c = a * root * root;
    return {
      prompt: `For which value of $c$ does $${a}x^2${b < 0 ? "-" : "+"}${Math.abs(b)}x+c=0$ have exactly one distinct real solution?`,
      answer: String(c),
      hint: `The leading coefficient is ${a} and the linear coefficient is ${b}. Exactly one distinct real root requires the discriminant $b^2-4ac$ to be zero.`,
      explanation: [
        `Set the discriminant equal to zero: $${b < 0 ? `(${b})` : b}^2-${4 * a}c=0$.`,
        `Thus $c=\\frac{${b * b}}{${4 * a}}=${c}$.`,
        `Check: the equation becomes $${a}(x${root < 0 ? "+" : "-"}${Math.abs(root)})^2=0$, with the single distinct real root $x=${root}$.`,
      ],
    };
  }
  if (id === "rational-function-representation") {
    const a = r(2, 9),
      h = r(1, 4),
      k = r(1, 5),
      input = h + r(1, 4),
      output = rational(a + k * (input - h), input - h),
      reverse = r(0, 1) === 1;
    const xs = [h - 2, h - 1, h + 1, h + 2],
      outputs = xs.map((x) =>
        rational((a + k * (x - h)) * Math.sign(x - h), Math.abs(x - h)),
      );
    const tableVisual = scene(
      table({
        columns: ["Input", "Output"],
        rows: xs.map((x, i) => ({
          label: `Row ${i + 1}`,
          cells: [x, outputs[i]!],
        })),
      }),
    ).build({
      title: "Rational function values",
      note: "The table shows four input-output pairs. The excluded input is not included.",
      width: 360,
      maxHeight: 240,
    });
    const useGraph = !reverse && r(0, 1) === 1;
    const graphVisual = useGraph
      ? scene(
          graph({
            x: [h - 4, h + 4],
            y: [k - a - 2, k + a + 2],
            grid: 1,
            tick: 2,
            aspect: 1,
          })
            .curve(f.rational([k, a - k * h], [1, -h]), { label: false })
            .point(h - 1, k - a)
            .point(h + 1, k + a),
        ).build({
          title: "A rational function",
          note: `Marked input-output pairs include (${h - 1}, ${k - a}) and (${h + 1}, ${k + a}). The graph has no point at input ${h}.`,
          width: 360,
          maxHeight: 260,
        })
      : tableVisual;
    return {
      prompt: reverse
        ? `The function is $f(x)=\\frac{${a}}{x-${h}}+${k}$, with $x\\ne${h}$. For which input is $f(x)=${output}$?`
        : useGraph
          ? `Which rule matches the graphed function and its marked points?`
          : `The table shows values of one of these functions. Which rule matches every row?`,
      figure: { kind: "scene", scene: graphVisual },
      answer: "",
      hint: reverse
        ? `Subtract ${k} from the output ${output} before solving for the denominator $x-${h}$.`
        : `Use the ${useGraph ? "marked point" : "row"} with input ${useGraph ? h - 1 : xs[0]} to test the denominator and vertical shift in each proposed rule.`,
      choices: choices(
        reverse
          ? [input, h, h + input, -input].map((v) => math(String(v)))
          : [
              `f(x)=\\frac{${a}}{x-${h}}+${k}`,
              `f(x)=\\frac{${a}}{x+${h}}+${k}`,
              `f(x)=\\frac{${a}}{x-${h}}-${k}`,
              `f(x)=${a}(x-${h})+${k}`,
            ].map(math),
        "Substitute into the full expression and retain its excluded input.",
      ),
      explanation: reverse
        ? [
            `Subtract ${k}: $\\frac{${a}}{x-${h}}=${rational(a, input - h)}$.`,
            `Thus $x-${h}=${input - h}$ and $x=${input}$.`,
            `This input is allowed because ${input} differs from ${h}; substitution recovers the stated output.`,
          ]
        : useGraph
          ? [
              `The marked points are $(${h - 1},${k - a})$ and $(${h + 1},${k + a})$. Both match $f(x)=\\frac{${a}}{x-${h}}+${k}$.`,
              `The two curved branches rule out the linear candidate, even though it passes through both marked points. The graph has no point at $x=${h}$, where the denominator is zero.`,
            ]
          : [
              `For $f(x)=\\frac{${a}}{x-${h}}+${k}$, substituting ${xs.join(", ")} gives ${outputs.join(", ")}.`,
              `Every row matches. The denominator excludes $x=${h}$, even though that input is absent from the table.`,
            ],
    };
  }
  throw new Error("Unknown SAT completion family");
}
export function generateSatCompletionProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  const meta = satCompletionTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown SAT completion family");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  return assemble(meta, seed, r, draft(id, r));
}
