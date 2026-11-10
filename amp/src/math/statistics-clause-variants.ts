import { count } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  ClauseBuilder,
  clauseDraw,
  pick,
  round,
  scatter,
  sceneFigure,
  sum,
  table,
} from "./clause-variant-kit";
import { graph } from "./scene/author";
import { generateInferenceProblem } from "./inference-practice";
import { shuffle, type Random } from "./distribution-practice";

export const statisticsClauses: Record<string, readonly string[]> = {
  "representative-sample-choice": ["generalization-validity"],
  "sample-proportion-estimate": ["supported-inference"],
  "sample-estimates-plot": ["estimate-variation", "estimate-error"],
  "scatter-association-choice": ["cluster-outlier", "construct-scatter"],
  "trend-slope-meaning": ["intercept-meaning"],
  "two-way-association-choice": ["column-association"],
  "two-way-missing": ["construct-table"],
  "study-design-classify": ["three-designs"],
  "margin-of-error-interval": ["margin-from-simulation"],
  "relative-frequency-percent": ["summarize-then-interpret"],
  "nonlinear-data-model": ["plot-then-describe"],
  "residual-function-fit": ["plot-residuals", "line-by-eye"],
  "correlation-choice": ["read-regression-output"],
};

/** Bernoulli draws, not authored piles. A sample is drawn with replacement
 * from a model population with probability p/100 of the named trait. */
export const binomial = (r: Random, n: number, p: number) =>
  sum(Array.from({ length: n }, () => (r(1, 100) <= p ? 1 : 0)));

function sampleCounts(r: Random) {
  const n = pick(r, [20, 25, 40]),
    N = pick(
      r,
      [500, 800, 1000, 1200, 2000].filter((N) => N % n === 0),
    );
  const p = r(35, 75),
    k = N / n;
  for (let attempt = 0; attempt < 10000; attempt++) {
    const counts = Array.from({ length: 10 }, () => binomial(r, n, p));
    const lo = Math.min(...counts),
      hi = Math.max(...counts);
    if (
      hi - lo >= 3 &&
      hi - lo <= 7 &&
      (sum(counts) * k) % 10 === 0 &&
      counts.every((c) => counts.filter((v) => v === c).length <= 6)
    )
      return { n, N, k, counts, lo, hi, mean: (sum(counts) * k) / 10 };
  }
  throw new Error("Sampling rejection limit");
}

export function statisticsClause(
  meta: TemplateMetadata,
  seed: string,
  force?: string,
): GeneratedProblem | null {
  const variants = statisticsClauses[meta.id];
  if (!variants) return null;
  const variant = force ?? clauseDraw(meta.id, seed, variants);
  if (variant === "legacy") return null;
  const b = new ClauseBuilder(meta, seed, variant),
    r = b.r;
  if (variant === "generalization-validity") {
    const [num, den] = pick(r, [
      [1, 4],
      [1, 3],
      [2, 5],
      [1, 2],
      [3, 5],
      [2, 3],
      [3, 4],
    ] as const);
    const n = den * r(Math.ceil(40 / den), Math.floor(200 / den)),
      N = n * r(Math.ceil(400 / n), Math.floor(2000 / n));
    const valid = r(0, 1) === 1;
    const [method, bias] = pick(r, [
      ["students leaving the library", "students at one place"],
      ["members of the book club", "one club"],
      ["students who volunteer online", "volunteers"],
      ["the first students to answer an email", "the first people to answer"],
      ["her friends", "her friends"],
    ]);
    const count = (n * num) / den;
    const correct = valid
      ? "Yes. Random selection from the whole school makes this an estimate the sample can support."
      : `No. The sample reaches ${bias}, who may differ from the whole school.`;
    return b.choice(
      {
        prompt: `A librarian surveys ${n} of the school's ${N} students, ${valid ? "chosen at random from the complete school roster" : `chosen from ${method}`}. Of those asked, ${count} read at least three books a month. She concludes that about ${num}/${den} of the school's students do. Is this conclusion supported by the sampling method?`,
        hint: `The fraction ${count}/${n} describes the sample. Check who could be selected from all ${N} students.`,
        explanation: [
          `The arithmetic is correct: ${count}/${n} = ${num}/${den}.`,
          valid
            ? "Random selection gives every student a chance to be selected. The sample supports an approximate population share, not an exact count."
            : `The sample favors ${bias}. A larger sample of that same group would not remove this bias.`,
        ],
      },
      correct,
      valid
        ? [
            "No. A sample can never tell us anything about a population.",
            `Yes. Exactly ${(N * num) / den} students read at least three books a month.`,
            `No. ${n} students is too small a sample to support any estimate.`,
          ]
        : [
            `Yes. ${n} is a large enough sample to guarantee a representative result.`,
            `Yes. The sample fraction must equal the population fraction.`,
            `No. She must survey every member of that same selected group.`,
          ],
    );
  }
  if (variant === "supported-inference") {
    // Reuse the parent's givens so this is the inference twin of the exact
    // same estimate, including its context and seed.
    const parent = generateInferenceProblem(meta.id, seed);
    const stem = parent.public.prompt.split(" About how many")[0]!;
    return b.choice(
      {
        prompt: `${stem} Which conclusion does this sample support?`,
        hint: parent.hint,
        explanation: [
          ...parent.explanation,
          "Use ‘about’: the sample provides evidence, not certainty.",
        ],
      },
      `The estimated population count is about ${parent.answer}.`,
      [
        `The population count is exactly ${parent.answer}.`,
        "The count observed in the sample is the entire population count.",
        "No population estimate is possible from a random sample.",
      ],
    );
  }
  if (variant === "estimate-variation" || variant === "estimate-error") {
    const { n, N, k, counts, lo, hi, mean } = sampleCounts(r);
    const figure = {
      kind: "line-plot",
      denominator: 1,
      start: lo - 1,
      end: hi + 1,
      values: counts,
      mark: "dot",
      unit: "count in a sample",
    } as const;
    const intro = `A simulation draws ten independent random samples of ${n} students from a model school of ${N}. The dot plot shows how many in each sample walk or bike to school.`;
    const explanation = [
      `Each sampled student represents ${N}/${n} = ${k} students.`,
      `The smallest estimate is ${lo} × ${k} = ${lo * k}; the largest is ${hi} × ${k} = ${hi * k}.`,
    ];
    if (variant === "estimate-error" && r(0, 1))
      return b.choice(
        {
          figure,
          prompt: `${intro} The mean-based class estimate is ${mean}. Which statement correctly describes the simulated estimates?`,
          hint: `Multiply the smallest and largest counts by ${k}.`,
          explanation: [
            ...explanation,
            "The spread describes variation due to sampling. It does not guarantee bounds on the true population count.",
          ],
        },
        `The simulated estimates range from ${lo * k} to ${hi * k}; the true count is not guaranteed to be in this range.`,
        [
          `Exactly ${mean} students in the population walk or bike.`,
          `Every simulated estimate equals ${mean}.`,
          `The sample with ${hi} is necessarily wrong.`,
        ],
      );
    const error = Math.max(mean - lo * k, hi * k - mean);
    return b.work(
      {
        figure,
        prompt: `${intro} ${variant === "estimate-variation" ? "How many students apart are the largest and smallest estimates for the whole school?" : `The mean-based class estimate is ${mean}. What is the largest distance between one sample's population estimate and ${mean}?`}`,
        hint: `One count in a sample of ${n} stands for ${k} students. Scale both extremes before comparing.`,
        explanation: [
          ...explanation,
          variant === "estimate-variation"
            ? `The range is ${hi * k} − ${lo * k} = ${(hi - lo) * k} students.`
            : `Compare ${mean} − ${lo * k} = ${mean - lo * k} with ${hi * k} − ${mean} = ${hi * k - mean}. The larger distance is ${error}.`,
          "Random samples of the same size can give different estimates.",
        ],
      },
      [
        {
          label:
            variant === "estimate-variation"
              ? "Range of estimates"
              : "Largest distance from class estimate",
          value: variant === "estimate-variation" ? (hi - lo) * k : error,
          unit: "students",
        },
      ],
    );
  }
  if (variant === "cluster-outlier") {
    const branch = r(0, 2),
      clustered = branch !== 0,
      outlier = branch !== 1;
    const m =
        clustered && !outlier && r(0, 2) === 0
          ? 0
          : pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]),
      intercept = m < 0 ? 54 : m === 0 ? 30 : 6;
    const xs = clustered
      ? [1, 1, 2, 2, 3, 4, 9, 9, 10, 10, 11, 12]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const points: [number, number][] = xs.map((x) => [
      x,
      m * x + intercept + r(-2, 2),
    ]);
    points[11] = [12, m * 12 + intercept];
    const odd: [number, number] = [3, m * 3 + intercept + (m > 0 ? 18 : -18)];
    if (outlier) points.push(odd);
    const g = graph({
      x: [0, 13],
      y: [0, 65],
      grid: [1, 5],
      axisNames: ["Distance (km)", "Time (minutes)"],
    })
      .scatter(points)
      .point(...points[11]!, "E");
    if (outlier) g.point(...odd, "P");
    const correct = [
      m === 0
        ? "No clear association"
        : m > 0
          ? "Positive association"
          : "Negative association",
      ...(clustered
        ? ["Two clusters separated by an empty horizontal gap"]
        : []),
      ...(outlier ? [`An outlier at P (${odd.join(", ")})`] : []),
    ];
    return b.select(
      {
        figure: sceneFigure(g.scene()),
        prompt: `The scatter plot records ${points.length} students' distance from school and commute time. Select all the patterns shown.`,
        hint: "Look first for the overall upward or downward trend, then for an empty gap or a point off that trend.",
        explanation: [
          m === 0
            ? "The two clusters have similar heights; there is no clear upward or downward association."
            : `The main cloud tends ${m > 0 ? "up" : "down"}, so the association is ${m > 0 ? "positive" : "negative"}.`,
          ...(clustered
            ? [
                "No points have distances between 4 and 9 km: the groups form two clusters.",
              ]
            : []),
          ...(outlier
            ? ["P is far from the main cloud's trend, so it is an outlier."]
            : []),
          "E is far along the horizontal axis but follows the trend. An extreme horizontal coordinate alone does not make an outlier.",
        ],
      },
      correct,
      [
        m > 0 ? "Negative association" : "Positive association",
        "Nonlinear association",
        "An outlier at E",
      ],
    );
  }
  if (variant === "construct-scatter" || variant === "plot-then-describe") {
    const advanced = variant === "plot-then-describe";
    const kind = r(0, advanced ? 2 : 3),
      plot = r(0, 1) === 0;
    // Four points fit the existing plotting protocol. Interpretation twins
    // retain the six/seven-row data sets. Curves include their turning point.
    const count = plot ? 4 : advanced ? 6 : 7;
    const slope = r(2, 3),
      offset = r(2, 6),
      scale = r(1, 2),
      vertex = r(2, 3),
      floor = r(2, 5);
    const points: [number, number][] = Array.from({ length: count }, (_, i) => {
      const x = i + 1;
      const base = advanced
        ? kind === 0
          ? slope * x + offset
          : kind === 1
            ? scale * 2 ** i
            : scale * (x - vertex) ** 2 + floor
        : kind === 0
          ? slope * x + offset
          : kind === 1
            ? 3 * count + 4 - slope * x
            : kind === 2
              ? scale * (x - vertex) ** 2 + floor
              : [8, 3, 11, 5, 9, 2, 7][i]! + offset - 2;
      const noise = r(-1, 1);
      // Keep the quadratic's turn visible even when its vertex is near an edge.
      // Preserve increasing exponentials so they cannot also match a turn.
      const y =
        base +
        ((kind === 2 && (x === 1 || x === vertex)) ||
        (advanced && kind === 1 && i < 2)
          ? 0
          : noise);
      return [x, y];
    });
    const relation = advanced
      ? [
          "Linear: roughly equal increases for equal steps",
          "Exponential: roughly doubling each step",
          "Quadratic: falling, then rising",
        ][kind]!
      : [
          "Positive linear association",
          "Negative linear association",
          "Nonlinear association",
          "No clear association",
        ][kind]!;
    const rows = [
      [advanced ? "x" : "Practice (hours)", advanced ? "y" : "Shots made"],
      ...points.map((p) => p.map(String)),
    ];
    const copy = {
      prompt: `${advanced ? "The table gives paired measurements." : "Each table row gives one student's practice hours and successful shots."} ${plot ? "Plot one point for each row. Read the horizontal coordinate first." : "Which description best matches the relationship?"}`,
      figure: table(rows),
      hint: `The first row pairs ${points[0]![0]} with ${points[0]![1]}. A pair gives one point, not two points on the axes.`,
      explanation: [
        `The pairs are ${points.map((p) => `(${p.join(", ")})`).join(", ")}.`,
        relation + ".",
        "Read each pair across first, then up. To describe the plot, follow the overall pattern rather than one dot.",
      ],
    };
    if (plot)
      return b.plot(copy, points, {
        xMin: 0,
        xMax: 10,
        yMin: 0,
        yMax: 20,
        xLabel: rows[0]![0]!,
        yLabel: rows[0]![1]!,
      });
    return b.choice(
      copy,
      relation,
      advanced
        ? [
            "Linear: roughly equal increases for equal steps",
            "Exponential: roughly doubling each step",
            "Quadratic: falling, then rising",
            "No relationship",
          ].filter((x) => x !== relation)
        : [
            "Positive linear association",
            "Negative linear association",
            "Nonlinear association",
            "No clear association",
          ].filter((x) => x !== relation),
    );
  }
  if (variant === "intercept-meaning") {
    const absurd = r(0, 1) === 1,
      m = pick(r, absurd ? [1, 1.5, 2] : [0.5, 1, 1.5, 2]),
      c = absurd ? -pick(r, [45, 60, 85]) : r(5, 18);
    const xs = absurd ? [150, 158, 166, 174, 182, 190] : [0, 2, 4, 6, 8, 10];
    const points: [number, number][] = xs.map((x) => [x, m * x + c + r(-2, 2)]);
    const equation = `$\\hat y = ${m}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}$`;
    return b.choice(
      {
        figure: scatter(
          points,
          absurd
            ? ["Height (cm)", "Mass (kg)"]
            : ["Practice (hours)", "Score (points)"],
          { m, b: c },
        ),
        prompt: `${equation} predicts ${absurd ? "adult mass in kg from height in cm; the studied heights are 150–190 cm" : "a skill score in points from practice hours; the studied hours are 0–10"}. What is the practical meaning of the intercept ${c}?`,
        hint: `The intercept is the predicted value when $x=0$. Ask whether 0 ${absurd ? "cm" : "hours"} makes sense here.`,
        explanation: [
          `At $x=0$, the line predicts $\\hat y=${c}$.`,
          absurd
            ? "An adult cannot be 0 cm tall. Zero is far outside the data, so the intercept has no practical interpretation here."
            : `Zero hours of practice is possible and in the data range. The line predicts about ${c} points at zero hours.`,
        ],
      },
      absurd
        ? "The intercept has no practical meaning: zero adult height is impossible and far outside the data."
        : `At zero practice hours, the predicted score is about ${c} points.`,
      absurd
        ? [
            `A zero-height adult has a mass of ${c} kg.`,
            "An intercept never has practical meaning.",
            `Each extra centimeter changes predicted mass by ${c} kg.`,
          ]
        : [
            `Each extra practice hour adds ${c} points.`,
            `At ${c} hours, the predicted score is zero.`,
            `${c} students were measured.`,
          ],
    );
  }
  if (variant === "column-association") {
    const associated = r(0, 1) === 1;
    const [n1, n2] = pick(r, [
      [40, 100],
      [100, 40],
      [20, 80],
      [80, 20],
    ] as const);
    const p1 = pick(r, [25, 50, 75]),
      p2 = associated ? (p1 === 75 ? 25 : 75) : p1;
    const a = (n1 * p1) / 100,
      c = (n2 * p2) / 100;
    const rowPercent = round((a / (a + c)) * 100, 1);
    const correct = `${associated ? "Yes" : "No"}: ${p1}% with chores have a curfew, compared with ${p2}% without chores.`;
    return b.choice(
      {
        figure: table([
          ["", "Chores: yes", "Chores: no"],
          ["Curfew: yes", `${a}`, `${c}`],
          ["Curfew: no", `${n1 - a}`, `${n2 - c}`],
          ["Total", `${n1}`, `${n2}`],
        ]),
        prompt:
          "Among students with chores, what percent have a curfew? Among students without chores? Do these shares suggest an association?",
        hint: `‘With chores’ names a group of ${n1}; divide its curfew count ${a} by that column total.`,
        explanation: [
          `With chores: ${a}/${n1} = ${p1}%. Without chores: ${c}/${n2} = ${p2}%.`,
          associated
            ? "These shares differ by at least 25 percentage points, suggesting an association."
            : "The shares are equal even though group sizes and counts differ. These data show no association.",
          "Compare conditional percentages, not counts from differently sized groups.",
        ],
      },
      correct,
      [
        `Yes, because ${a} and ${c} are different counts.`,
        `No, because ${a} is less than half the grand total ${n1 + n2}.`,
        `No, because ${rowPercent}% of students with a curfew have chores (rounded to a tenth).`,
      ],
    );
  }
  if (variant === "construct-table") {
    const n = r(12, 20),
      cells = [1, 1, 1, 1];
    for (let i = 4; i < n; i++) cells[r(0, 3)]!++;
    const pairs = shuffle(
      r,
      cells.flatMap((v, i) =>
        Array.from({ length: v }, () => [
          i < 2 ? "yes" : "no",
          i % 2 === 0 ? "yes" : "no",
        ]),
      ),
    );
    const names = [
      "Maya",
      "Liam",
      "Ava",
      "Noah",
      "Emma",
      "Omar",
      "Zoe",
      "Leo",
      "Nia",
      "Ben",
      "Ivy",
      "Sam",
      "Ada",
      "Max",
      "Lila",
      "Eli",
      "Mia",
      "Kai",
      "Rosa",
      "Finn",
    ];
    return b.work(
      {
        prompt: `Tally these ${n} students by curfew and chores. Each student belongs in exactly one cell. ${pairs.map((p, i) => `${names[i]}: curfew ${p[0]}, chores ${p[1]}`).join("; ")}. Complete the four cells; the curfew-yes, chores-no cell answers how many have a curfew but no chores.`,
        figure: table([
          ["", "Chores: yes", "Chores: no"],
          ["Curfew: yes", "?", "?"],
          ["Curfew: no", "?", "?"],
        ]),
        hint: `${names[0]} has curfew ${pairs[0]![0]} and chores ${pairs[0]![1]}. Put one tally where that row and column meet.`,
        explanation: [
          "Count each student once in the cell matching both answers.",
          `Reading rows from left to right gives ${cells.join(", ")}.`,
          `Check: ${cells.join(" + ")} = ${n}, the roster size.`,
        ],
      },
      cells.map((value, i) => ({
        label: `Curfew ${i < 2 ? "yes" : "no"}, chores ${i % 2 === 0 ? "yes" : "no"}`,
        value,
      })),
    );
  }
  if (variant === "summarize-then-interpret") {
    const junior = pick(r, [40, 50, 60, 80, 100]),
      senior = pick(r, [20, 40, 60, 80, 100]),
      a = r(1, junior - 1),
      percent = pick(r, [25, 50, 75]),
      c = (senior * percent) / 100;
    return b.work(
      {
        prompt: `A school surveyed ${junior + senior} students. There are ${junior} juniors. Of the juniors, ${count(a, "student")} ${a === 1 ? "has" : "have"} a part-time job; ${count(c, "senior")} ${c === 1 ? "has" : "have"} a job. Complete the table, then find the percent of seniors who have a job.`,
        figure: table([
          ["", "Job: yes", "Job: no", "Total"],
          ["Juniors", "?", "?", `${junior}`],
          ["Seniors", "?", "?", "?"],
          ["Total", "?", "?", `${junior + senior}`],
        ]),
        hint: `Subtract ${junior} juniors from the total ${junior + senior} to find the senior total.`,
        explanation: [
          `Seniors: ${junior + senior} − ${junior} = ${senior}.`,
          `Juniors without a job: ${junior} − ${a} = ${junior - a}. Seniors without a job: ${senior} − ${c} = ${senior - c}.`,
          `The four cells sum to ${junior + senior}. Of the seniors, ${c}/${senior} × 100 = ${percent}% have a job.`,
        ],
      },
      [
        { label: "Juniors with a job", value: a },
        { label: "Juniors without a job", value: junior - a },
        { label: "Seniors with a job", value: c },
        { label: "Seniors without a job", value: senior - c },
        { label: "Percent of seniors with a job", value: percent, unit: "%" },
      ],
    );
  }
  if (variant === "three-designs") {
    const kind = r(0, 2),
      purpose = r(0, 1) === 1;
    const scenarios = [
      "A city selects 500 residents at random from a complete list of its 60000 residents and sends them a questionnaire about support for a bike lane. Assume all respond.",
      "A coach randomly assigns 80 volunteers to a 10-minute warm-up or no warm-up, then measures their mile times.",
      "Researchers randomly select 200 adults' records and compare people who already smoke with those who do not. The researchers assign no treatment.",
    ];
    const designs = [
      "Sample survey",
      "Randomized experiment",
      "Observational study",
    ];
    const roles = [
      "Random selection supports generalizing to the city's residents.",
      "Random assignment supports a causal comparison for these volunteers.",
      "Random selection supports generalizing; no assignment means no causal claim.",
    ];
    const goals = [
      "Estimate the share of city residents supporting a bike lane.",
      "Test whether a 10-minute warm-up causes faster mile times.",
      "Look for an association with an existing smoking habit without assigning it.",
    ];
    return b.parts(
      {
        prompt: `${purpose ? `Goal: ${goals[kind]} Evaluate this proposed design. ` : ""}${scenarios[kind]} Classify the most specific study design and identify what its randomization supports. A sample survey asks a population sample questions; an observational comparison measures existing groups; an experiment assigns a treatment.`,
        hint: `In this study, ${kind === 1 ? "80 volunteers are assigned to treatments" : "people or records are selected at random"}. Identify which act is randomized.`,
        explanation: [
          `${designs[kind]}: ${goals[kind]}`,
          roles[kind]!,
          "Random selection concerns who enters a sample. Random assignment concerns who receives a treatment. A survey is observational in the broad sense; ‘sample survey’ is the most specific label here.",
        ],
      },
      [
        {
          label: "Most specific design",
          correct: designs[kind]!,
          wrong: designs.filter((_, i) => i !== kind),
        },
        {
          label: "Role of randomization",
          correct: roles[kind]!,
          wrong: [
            ...roles.filter((_, i) => i !== kind),
            "A large sample alone guarantees an unbiased result.",
          ],
        },
      ],
    );
  }
  if (variant === "margin-from-simulation") {
    if (r(0, 3) === 0) {
      const n = pick(r, [25, 50, 100]),
        center = r(4, 7);
      const values = Array.from({ length: 100 }, () =>
        Math.round(
          (sum(Array.from({ length: n }, () => r(center - 3, center + 3))) *
            10) /
            n,
        ),
      );
      const margin = values
        .map((x) => Math.abs(x - 10 * center))
        .sort((a, b) => a - b)[94]!;
      const bins = [...new Set(values)].sort((a, b) => a - b);
      return b.work(
        {
          prompt: `A random sample of ${n} words has mean length ${center} letters. A computer simulates 100 independent samples of ${n} from a word-length model with mean ${center}. The table bins sample means to the nearest 0.1 letter. Find the smallest band centered at ${center} containing at least 95 simulated means. Give the margin of error and both endpoints, in letters.`,
          figure: table([
            ["Mean (letters)", "Count"],
            ...bins.map((x) => [
              `${x / 10}`,
              `${values.filter((v) => v === x).length}`,
            ]),
          ]),
          hint: `Count results in bands centered at ${center}, increasing the half-width by 0.1 letter each time.`,
          explanation: [
            `The half-width ${margin / 10} contains ${values.filter((x) => Math.abs(x - 10 * center) <= margin).length} results; half-width ${(margin - 1) / 10} contains only ${values.filter((x) => Math.abs(x - 10 * center) <= margin - 1).length}.`,
            `The interval is ${center} ± ${margin / 10}, from ${center - margin / 10} to ${center + margin / 10} letters.`,
            "The spread estimates random sampling error. With four times as many independently sampled words, the standard error is half as large; a particular simulation can vary.",
          ],
        },
        [
          { label: "Margin (letters)", value: margin / 10 },
          { label: "Lower endpoint (letters)", value: center - margin / 10 },
          { label: "Upper endpoint (letters)", value: center + margin / 10 },
        ],
      );
    }
    const n = pick(r, [100, 200, 400, 800]),
      percent = pick(r, [40, 48, 56, 60, 64]);
    const bin = n >= 400 ? 1 : 2;
    // Count in percentage points so bins and interval endpoints stay exact.
    let bins: number[] = [],
      margin = 0;
    for (let attempt = 0; attempt < 1000; attempt++) {
      bins = Array.from(
        { length: 100 },
        () => Math.round((100 * binomial(r, n, percent)) / n / bin) * bin,
      );
      const distances = bins
        .map((x) => Math.abs(x - percent))
        .sort((a, b) => a - b);
      margin = distances[94]!;
      const theory = 1.96 * Math.sqrt((percent * (100 - percent)) / n);
      if (Math.abs(margin - theory) <= bin && margin > 0) break;
      if (attempt === 999) throw new Error("Margin simulation rejection limit");
    }
    const values = [...new Set(bins)].sort((a, b) => a - b),
      counts = values.map((x) => bins.filter((y) => y === x).length);
    return b.work(
      {
        prompt: `A random sample of ${n} voters found ${percent}% favor a levy. A computer simulated 100 independent samples of ${n} from a model population with ${percent}% support. The table bins the simulated percentages in steps of ${bin} percentage point${bin === 1 ? "" : "s"}. Find the smallest band centered at ${percent}% containing at least 95 results. Give its half-width (margin of error) and both interval endpoints, in percent.`,
        figure: table([
          ["Percent", "Count"],
          ...values.map((v, i) => [`${v}`, `${counts[i]}`]),
        ]),
        hint: `Start at ${percent}% and include bins equally far to its left and right until the counts reach 95.`,
        explanation: [
          `The counts sum to ${sum(counts)}. A band of ${margin} percentage points contains ${bins.filter((x) => Math.abs(x - percent) <= margin).length} results.`,
          `The next smaller band, ${margin - bin} points, contains only ${bins.filter((x) => Math.abs(x - percent) <= margin - bin).length}.`,
          `The interval is ${percent} ± ${margin}%, from ${percent - margin}% to ${percent + margin}%.`,
          "This simulation estimates ordinary sampling error. It does not remove bias or guarantee that the interval contains the true proportion.",
          "Four times the sample size halves the model's standard error. Larger independent samples usually produce a narrower pile.",
        ],
      },
      [
        { label: "Margin (percentage points)", value: margin },
        { label: "Lower endpoint (%)", value: percent - margin },
        { label: "Upper endpoint (%)", value: percent + margin },
      ],
    );
  }
  if (variant === "plot-residuals") {
    const curved = r(0, 1) === 1,
      plot = r(0, 1) === 1,
      m = r(1, 4),
      c = r(3, 9);
    const residuals = curved
      ? [-5, -2, 2, 4, 3, -1, -4]
      : pick(r, [
          [1, -2, 2, -1, -3, 2, 1],
          [-2, 1, 3, -1, 2, -3, 1],
        ]);
    const points: [number, number][] = residuals.map((v, i) => [
      i + 1,
      m * (i + 1) + c + v,
    ]);
    const correct = curved
      ? "The residuals bend, so a linear model is not appropriate."
      : "The residuals have no clear pattern, so a linear model is reasonable.";
    const copy = {
      prompt: `The fitted line is $\\hat y=${m}x+${c}$. The table gives observed values. ${plot ? "Compute and plot the residuals for the first four rows. A residual is observed minus predicted." : "Compute the residuals. Does the pattern support a linear model?"}`,
      figure: table([["x", "Observed y"], ...points.map((p) => p.map(String))]),
      hint: `At $x=1$, predict ${m} × 1 + ${c}, then subtract that prediction from the observed ${points[0]![1]}.`,
      explanation: [
        `Observed minus predicted gives residuals ${residuals.join(", ")}.`,
        "Positive residuals are above the fitted line; negative residuals are below it.",
        correct,
        "Predicted minus observed reverses every sign and mirrors the correct plot across zero.",
      ],
    };
    if (plot)
      return b.plot(
        copy,
        residuals.slice(0, 4).map((y, i) => [i + 1, y]),
        {
          xMin: 0,
          xMax: 8,
          yMin: -6,
          yMax: 6,
          xLabel: "x",
          yLabel: "Residual",
        },
      );
    return b.choice(copy, correct, [
      curved
        ? "The residuals have no pattern, so a linear model is appropriate."
        : "The residuals form a curve, so a linear model is inappropriate.",
      "Any nonzero residual proves the data contain errors.",
      "Residuals summing near zero alone prove the fit is good.",
    ]);
  }
  if (variant === "line-by-eye") {
    const m = pick(r, [-3, -2, -1, 1, 2, 3]),
      c = r(5, 15),
      noise = [1, -1, -1, 1, 0, 0, 1, -1, -1, 1];
    // Sum(noise) = Sum(x*noise) = 0, so least squares is exactly mx+c.
    const points: [number, number][] = noise.map((v, i) => [
      i + 1,
      m * (i + 1) + c + v,
    ]);
    const lines = [
      { m, b: c },
      { m: m * 1.5, b: c - 2.75 * m },
      { m, b: c + 4 },
      { m: 0, b: c + 5.5 * m },
    ];
    const sse = lines.map((l) =>
      sum(points.map(([x, y]) => (y - l.m * x - l.b) ** 2)),
    );
    const prediction = r(0, 1) === 1;
    const copy = {
      prompt: prediction
        ? `The table records a machine's output $y$ after $x$ minutes. The least-squares fit is $\\hat y=${m}x+${c}$. Predict output at $x=7$.`
        : "Each graph shows the same machine measurements and a candidate line. Which line best fits the data?",
      hint: prediction
        ? `Substitute 7 for $x$ in $\\hat y=${m}x+${c}$.`
        : "Look for a line through the middle, with small vertical misses on both sides.",
      explanation: [
        `The candidate sums of squared vertical misses are ${sse.map((x) => round(x, 3)).join(", ")}.`,
        `The smallest belongs to $\\hat y=${m}x+${c}$. At $x=7$, it predicts ${7 * m + c}.`,
      ],
    };
    if (prediction)
      return b.work(
        {
          ...copy,
          figure: table([
            ["x (minutes)", "y (output)"],
            ...points.map((p) => p.map(String)),
          ]),
        },
        [{ label: "Predicted output at 7 minutes", value: 7 * m + c }],
      );
    return b.figures(
      copy,
      lines.map((l) => ({
        label: `Candidate line y = ${l.m}x + ${l.b}`,
        scene: graph({
          x: [0, 11],
          y: [
            Math.min(-5, ...points.map((p) => p[1])) - 5,
            Math.max(...points.map((p) => p[1])) + 8,
          ],
          grid: [1, 5],
          axisNames: ["Minutes", "Output"],
        })
          .scatter(points, l)
          .scene({ width: 280, maxHeight: 280 }),
      })),
    );
  }
  if (variant === "read-regression-output") {
    const magnitude = r(40, 98) / 100,
      sign = r(0, 1) ? 1 : -1,
      correlation = sign * magnitude,
      slope = sign * pick(r, [1.2, 2.3, 3.2]),
      c = sign < 0 ? 40 : 6;
    // Construct centered orthogonal noise to realize the displayed r.
    const xs = [-3, -2, -1, 1, 2, 3],
      z = [1, -1, 0, 0, -1, 1];
    const factor =
      Math.abs(slope) *
      Math.sqrt(
        (sum(xs.map((x) => x * x)) * (1 / magnitude ** 2 - 1)) /
          sum(z.map((x) => x * x)),
      );
    const points: [number, number][] = xs.map((x, i) => [
      x + 4,
      slope * (x + 4) + c + factor * z[i]!,
    ]);
    return b.choice(
      {
        prompt: `Technology output for $\\hat y=ax+b$: $a=${slope}$, $b=${c}$, $r^2=${(magnitude ** 2).toFixed(4)}$. What is the correlation coefficient $r$?`,
        figure: scatter(points),
        hint: `Take the square root of ${(magnitude ** 2).toFixed(4)}, then use the sign of the slope ${slope}.`,
        explanation: [
          `The square root of ${(magnitude ** 2).toFixed(4)} is ${magnitude}.`,
          `The slope is ${sign < 0 ? "negative" : "positive"}, so $r=${correlation}$.`,
          "The size of r measures the strength of the linear relationship; its sign gives the direction.",
        ],
      },
      `${correlation}`,
      [`${-correlation}`, `${(magnitude ** 2).toFixed(4)}`, `${slope}`],
    );
  }
  throw new Error(`Unhandled statistics clause ${variant}`);
}
