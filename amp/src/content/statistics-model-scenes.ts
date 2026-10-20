import {
  act,
  graph,
  lessonStep,
  scene,
  step,
  table,
} from "../math/scene/author";
import type { Point } from "../math/scene/spec";
import {
  conditionalBars,
  correlation,
  dataGraph,
  leastSquares,
  outlierWalkthrough,
  residualSticks,
  t,
  tightenScene,
} from "../math/algebra-statistics-scenes";

/** Lesson models for Algebra 1 statistics, registered in
 * `sceneIllustrations`. The numbers match the lessons' paragraphs. */
const practice = {
  x: { label: "practice (hours)", start: 0, end: 10, step: 1 },
  y: { label: "test score", start: 30, end: 100, step: 10 },
};
/** Eleven students whose least-squares line is exactly ŷ = 4x + 42. */
export const practicePoints: Point[] = [
  [0, 39],
  [1, 45],
  [2, 52],
  [3, 57],
  [4, 58],
  [5, 65],
  [6, 63],
  [7, 69],
  [8, 78],
  [9, 72],
  [10, 84],
];
const fit = { c: practice, m: 4, b: 42, points: practicePoints };
const loose: Point[] = [
  [1, 59],
  [2, 65],
  [3, 57],
  [4, 73],
  [5, 56],
  [6, 80],
  [7, 74],
  [8, 75],
  [9, 70],
  [10, 73],
];
const day: Point[] = [
  [6, 51],
  [8, 65],
  [9, 74],
  [10, 77],
  [11, 82],
  [12, 83],
  [13, 85],
  [14, 82],
  [15, 80],
  [16, 79],
  [17, 72],
  [18, 67],
  [20, 49],
];
const r2 = (v: number) => t(Math.round(v * 100) / 100);
/** Stopping distances that grow faster than a line: v²/20 + v. */
const braking: Point[] = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70].map(
  (v) => [v, (v * v) / 20 + v],
);
const brakingFit = leastSquares(braking);

/** Ice cream and sunburns on 16 days; the hot days, marked, are high on both. */
function lurking() {
  const cool: Point[] = [
    [100, 4],
    [130, 8],
    [150, 5],
    [180, 9],
    [200, 7],
    [220, 12],
    [240, 10],
    [260, 14],
  ];
  const hot: Point[] = [
    [300, 18],
    [330, 24],
    [350, 21],
    [380, 27],
    [400, 25],
    [420, 31],
    [450, 29],
    [470, 34],
  ];
  let g = dataGraph(
    { label: "cones sold", start: 0, end: 500, step: 50 },
    { label: "sunburns", start: 0, end: 40, step: 5 },
  ).scatter(cool);
  for (const [x, y] of hot) g = g.point(x, y, undefined, { color: "warm" });
  return g.scene({
    steps: [
      step(
        "Days with more cones sold had more sunburns.",
        act.highlight("g.scatter"),
        act.highlight("g.point"),
      ),
      step(
        "The hot days, marked, are high on both: heat brings people to the beach to buy ice cream and to get sunburned.",
        act.highlight("g.point"),
      ),
    ],
  });
}

export const statisticsModelScenes = {
  "scene-outlier-mean-median": outlierWalkthrough(
    [4, 2, 5, 20, 3, 5, 4, 5],
    "books",
    { kind: "remove", index: 3 },
  ),
  "scene-skewed-box-plots": scene({
    type: "boxPlot",
    id: "box",
    min: 0,
    max: 60,
    step: 2,
    groups: [
      { label: "Office A", summary: [10, 18, 24, 30, 38] },
      { label: "Office B", summary: [12, 14, 18, 28, 56] },
    ],
    unit: "minutes",
  }).build({
    steps: [
      step(
        "Office A: equal whiskers, the median in the middle of the box. Roughly symmetric.",
        act.highlight("box.group.0"),
      ),
      step(
        "Office B: a long right whisker and a wide right half of the box. A tail toward higher values: skewed right.",
        act.highlight("box.group.1.whisker.high"),
        act.highlight("box.group.1.box"),
      ),
      step(
        "Compare the medians, 24 and 18, and the IQRs, 12 and 14: measures the long tail does not pull.",
        act.highlight("box.group.0.median"),
        act.highlight("box.group.1.median"),
      ),
    ],
  }),
  "scene-relative-frequencies": table({
    id: "t",
    title: "Way to school",
    columns: ["Bus", "Other", "Total"],
    rows: [
      { label: "Grade 9", cells: [30, 20, 50] },
      { label: "Grade 12", cells: [10, 40, 50] },
      { label: "Total", cells: [40, 60, 100] },
    ],
    sums: true,
  }).scene({
    steps: [
      step(
        "Joint: ninth graders who ride the bus, 30 of all 100, or 30%.",
        act.highlight("t.cell.0.0"),
        act.highlight("t.cell.2.2"),
      ),
      step(
        "Marginal: everyone who rides the bus, 40 of all 100, or 40%.",
        act.highlight("t.cell.2.0"),
        act.highlight("t.cell.2.2"),
      ),
      step(
        "Conditional on Grade 9: 30 of the 50 ninth graders, or 60%.",
        act.highlight("t.row.0"),
        act.highlight("t.cell.0.0"),
        act.highlight("t.cell.0.2"),
      ),
      step(
        "Conditional on the bus: 30 of the 40 bus riders, or 75%.",
        act.highlight("t.column.0"),
        act.highlight("t.cell.0.0"),
        act.highlight("t.cell.2.0"),
      ),
    ],
  }),
  "scene-conditional-renormalize": conditionalBars(
    ["Grade 9", "Grade 12"],
    ["Bus", "Other"],
    [
      [18, 12],
      [21, 49],
    ],
    [
      "Counts on one scale: more twelfth graders ride the bus, 21 against 18. But there are 70 twelfth graders and only 30 ninth graders.",
      "Each row as 100%: 60% of ninth graders ride the bus, but only 30% of twelfth graders.",
    ],
  ),
  "scene-least-squares-line": dataGraph(practice.x, practice.y)
    .scatter(practicePoints, { m: 4, b: 42 })
    .slope([2, 50], [7, 70], "shown")
    .scene({
      steps: [
        step(
          "The least-squares line, $\\hat{y} = 4x + 42$.",
          act.highlight("g.fit"),
        ),
        step(
          "From 2 to 7 hours, 5 more, the prediction rises 20 points: 4 points per hour.",
          act.appear("g.slope.0"),
        ),
      ],
    }),
  "scene-predict-on-line": dataGraph(practice.x, practice.y)
    .scatter(practicePoints, { m: 4, b: 42 })
    .predict(7)
    .scene({
      steps: [
        step(
          "Up from $x = 7$ to the line.",
          act.trace("g.predict.guide.up"),
          act.appear("g.predict"),
        ),
        lessonStep(
          "Across to the axis: $\\hat{y} = 4(7) + 42 = 70$.",
          act.trace("g.predict.guide.across"),
          act.appear("g.predict.label"),
        ),
      ],
    }),
  "scene-residual-sticks": residualSticks(
    fit,
    [
      "Each residual is observed − predicted: the stick from a point to the line.",
      "At 8 hours: $78 - 74 = 4$, a point 4 above the line.",
    ],
    8,
  ),
  "scene-residual-plot-curve": graph({
    id: "g",
    x: [20, 70],
    y: [-30, 30],
    grid: [10, 10],
    tick: [10, 10],
    axisNames: ["speed (mph)", "residual"],
    aspect: (0.6 * 50) / 60,
    frame: true,
  })
    .scatter(
      braking.map(([v, d]): Point => [
        v,
        Math.round((d - (brakingFit.m * v + brakingFit.b)) * 10) / 10,
      ]),
      { m: 0, b: 0 },
    )
    .scene({
      steps: [
        step("Residual 0 is the fitted line.", act.highlight("g.fit")),
        step(
          "Positive, then negative, then positive: a curve the line missed.",
          act.highlight("g.scatter"),
        ),
      ],
    }),
  "scene-correlation-tighten": tightenScene(practice.x, practice.y, loose, [
    `Points loosely around a line: $r = ${r2(correlation(loose))}$.`,
    "Halve every gap to the line: the points tighten and $r$ rises toward 1.",
  ]),
  "scene-curve-near-zero-r": dataGraph(
    { label: "hour of the day", start: 6, end: 20, step: 2 },
    { label: "temperature (°F)", start: 40, end: 90, step: 10 },
  )
    .scatter(day)
    .scene({
      steps: [
        step(
          `A clear curve, yet $r = ${r2(correlation(day))}$: no single line fits a rise and a fall.`,
          act.highlight("g.scatter"),
        ),
      ],
    }),
  "scene-lurking-weather": lurking(),
  "scene-experiment-bars": conditionalBars(
    ["App", "No app"],
    ["Passed", "Did not pass"],
    [
      [18, 2],
      [24, 96],
    ],
    [
      "Counts on one scale: more students without the app passed, 24 against 18. But that group had 120 students, not 20.",
      "Each group as 100%: 90% passed with the app, 20% without.",
    ],
  ),
};
