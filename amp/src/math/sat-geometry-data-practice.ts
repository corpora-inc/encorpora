import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  rational,
  shown,
  type Draft,
  type Random,
} from "./distribution-practice";
import { table } from "./scene/author";
import {
  chordsFigure,
  secantsFigure,
  sceneFigure,
  tangentSecantFigure,
} from "./geometry-teaching-figures";

/** A number in parentheses only when negative. */
const par = (v: number) => (v < 0 ? `(${v})` : `${v}`);

/**
 * SAT geometry and data problem types that the neighbouring skills did not
 * yet practise: right-triangle trigonometry from a described situation,
 * midpoints and endpoints, the diagonal of a box, products of circle
 * segments and the tangent-slope rule, summaries of a frequency table, and
 * tests of independence in a two-way table. Each template is a single-choice
 * family whose variants differ in representation and unknown, not only size.
 */
export const satGeometryDataTemplates: readonly TemplateMetadata[] = (
  [
    {
      id: "trig-context-triangle",
      title: "Trigonometry from a described situation",
      skillId: "right-triangle-trigonometry",
      description:
        "Build the right triangle from angle-of-elevation, angle-of-depression, ladder, ramp and shadow descriptions, then find a side or an angle with a trigonometric ratio, rounded as stated.",
      difficultyOffset: 0.3,
    },
    {
      id: "midpoint-endpoint",
      title: "Midpoints, endpoints and circle centers",
      skillId: "coordinate-distance",
      description:
        "Find a midpoint, a missing endpoint from the midpoint, or the center and equation of a circle from the endpoints of a diameter.",
      difficultyOffset: 0.2,
    },
    {
      id: "space-diagonal",
      title: "The diagonal of a box",
      skillId: "pythagorean-theorem",
      description:
        "Use the three-dimensional Pythagorean relation to find the longest segment in a rectangular box or cube, or a missing edge from the diagonal.",
      difficultyOffset: 0.3,
    },
    {
      id: "circle-segment-lengths",
      title: "Segment products and tangent slope in circles",
      skillId: "circle-theorems",
      description:
        "Use products of segments of intersecting chords, two secants, or a tangent and a secant, and use the perpendicular radius to find the slope of a tangent line.",
      difficultyOffset: 0.4,
      requiredFigureCapability: "scenes-v1" as const,
    },
    {
      id: "frequency-table-center",
      title: "Center from a frequency table",
      skillId: "mean-median",
      description:
        "Find a mean or median from a frequency table, combine means with weights, and decide how adding or removing a value changes the mean and the median.",
      difficultyOffset: 0.3,
      requiredFigureCapability: "scenes-v1" as const,
    },
    {
      id: "independence-test",
      title: "Testing independence in a two-way table",
      skillId: "independent-events",
      description:
        "Decide whether events are independent by comparing conditional and overall proportions, find an expected joint count under independence, and interpret conditional-probability language.",
      difficultyOffset: 0.3,
      requiredFigureCapability: "scenes-v1" as const,
    },
  ] as const
).map((meta) => ({
  ...meta,
  version: 1 as const,
  gradeBand: "9–12" as const,
  requiredResponseCapability: "single-choice-v1" as const,
}));

export type SatGeometryDataCase = { draft: Draft; tag: string };
type Option = [label: string, feedback: string];

/** Exactly four distinct labels, the first correct; undefined when a draw
 * cannot supply three distinct wrong choices (the caller draws again). */
function choose(
  correct: string,
  wrong: Option[],
): Draft["choices"] | undefined {
  const seen = new Set([correct]);
  const out: NonNullable<Draft["choices"]> = [
    { label: correct, correct: true },
  ];
  for (const [label, feedback] of wrong) {
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, feedback });
    if (out.length === 4) return out;
  }
  return undefined;
}
/** Exact decimal when it terminates, else a one-decimal approximation. */
const dec = (n: number, d: number) => {
  const s = shown(n, d);
  return s.includes("/") ? String(Number((n / d).toFixed(1))) : s;
};
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const tex = (s: string) => `$${s}$`;
/** A rational as text or TeX fraction, typeset when it is not a whole number. */
function ratTex(n: number, d: number) {
  const q = rational(n, d);
  const m = /^(-?\d+)\/(\d+)$/.exec(q);
  if (!m) return `$${q}$`;
  const neg = m[1]!.startsWith("-");
  return `$${neg ? "-" : ""}\\frac{${neg ? m[1]!.slice(1) : m[1]}}{${m[2]}}$`;
}
/** 12 -> [2, 3] meaning 2*sqrt(3). */
function simplifyRoot(n: number): [number, number] {
  let outside = 1,
    inside = n;
  for (let f = 2; f * f <= inside; f++)
    while (inside % (f * f) === 0) {
      inside /= f * f;
      outside *= f;
    }
  return [outside, inside];
}
/** An exact length as plain text when whole, else a typeset radical. */
const rt = (n: number) =>
  simplifyRoot(n)[1] === 1 ? String(simplifyRoot(n)[0]) : tex(rootTex(n));
function rootTex(n: number) {
  const [o, i] = simplifyRoot(n);
  if (i === 1) return String(o);
  return `${o === 1 ? "" : o}\\sqrt{${i}}`;
}
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (x: number) => (x * 180) / Math.PI;
/** Away from a rounding boundary, so the stated rounding is unambiguous. */
const safe = (x: number) => Math.abs(((x * 10) % 1) - 0.5) > 0.06;

/* ------------------------------------------------------------ trigonometry */
const trigVariants = [
  "elevation-height",
  "elevation-eye-height",
  "depression-distance",
  "depression-height",
  "ladder-reach",
  "ladder-foot",
  "ladder-length",
  "ramp-angle",
  "shadow-length",
  "shadow-angle",
  "depression-alternate",
  "depression-top",
] as const;

function trigCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, trigVariants);
  for (;;) {
    const t = r(18, 68);
    if (t === 45) continue;
    const sin = Math.sin(rad(t)),
      cos = Math.cos(rad(t)),
      tan = Math.tan(rad(t));
    const len = (v: number, unit: string) => `${v.toFixed(1)} ${unit}`;
    const rule = "Round to the nearest tenth.";
    let prompt = "",
      hint = "",
      correct = "",
      wrong: Option[] = [],
      explanation: string[] = [];
    const sides =
      "In a right triangle, the leg opposite an angle is across from it, the adjacent leg touches it, and the hypotenuse is the longest side, across from the right angle.";
    const ratios =
      "Tangent is opposite ÷ adjacent, sine is opposite ÷ hypotenuse, and cosine is adjacent ÷ hypotenuse.";
    const unitMixup =
      "The angle is measured from the horizontal, so the horizontal leg is adjacent to it and the vertical leg is opposite it.";
    if (tag === "elevation-height" || tag === "elevation-eye-height") {
      const d = 5 * r(6, 18),
        eye = tag === "elevation-eye-height" ? pick(r, [5, 6]) : 0;
      const up = d * tan,
        ans = up + eye;
      if (!safe(ans)) continue;
      prompt = eye
        ? `A surveyor whose eyes are ${eye} feet above level ground stands ${d} feet from the base of a vertical flagpole. The angle of elevation from her eyes to the top of the pole is ${t}°. How tall is the pole, in feet? ${rule}`
        : `From a point on level ground ${d} feet from the base of a vertical flagpole, the angle of elevation to the top of the pole is ${t}°. How tall is the pole, in feet? ${rule}`;
      hint = `Sketch a right triangle: the ${d}-foot ground distance is one leg, the pole is the other, and the ${t}° angle is at the ${eye ? "surveyor's eyes" : "observer's position"}. Decide which leg is opposite the angle and which is adjacent, then choose the ratio that uses exactly those two legs.${eye ? " That ratio gives only the part of the pole above eye level." : ""}`;
      correct = len(ans, "feet");
      wrong = [
        [
          len(d / tan + eye, "feet"),
          "This divides by the tangent. The pole is opposite the angle and the ground distance is adjacent, so multiply the adjacent leg by the tangent.",
        ],
        [
          len(d * sin + eye, "feet"),
          "Sine compares the opposite leg with the hypotenuse, but the line of sight is not given. Use the two legs you are given.",
        ],
        [
          len(d * cos + eye, "feet"),
          "Cosine compares the adjacent leg with the hypotenuse; the hypotenuse is not given here.",
        ],
        ...(eye
          ? [
              [
                len(up, "feet"),
                `The tangent gives only the height above eye level. Add the ${eye} feet from the ground to the eyes.`,
              ] as Option,
            ]
          : []),
      ];
      explanation = [
        `The angle of elevation is how far you look up from level to see the top, here ${t}°.`,
        sides,
        `The ${d}-foot ground distance touches the ${t}° angle, so it is adjacent. The ${eye ? "pole above eye level" : "pole"} is opposite. Tangent uses exactly those two legs: $\\tan ${t}^\\circ=\\frac{\\text{opposite}}{${d}}$.`,
        `Multiply both sides by ${d}: $${d}\\tan ${t}^\\circ\\approx ${up.toFixed(2)}$ feet.`,
        eye
          ? `That is only the part above her eyes. Add the ${eye} feet from the ground to her eyes: ${up.toFixed(2)} + ${eye} = ${ans.toFixed(2)}. The pole is about ${ans.toFixed(1)} feet tall.`
          : `The pole is about ${ans.toFixed(1)} feet tall, to the nearest tenth.`,
      ];
    } else if (tag === "depression-distance" || tag === "depression-height") {
      const base = 5 * r(6, 30);
      const dist = tag === "depression-distance";
      const ans = dist ? base / tan : base * tan;
      if (!safe(ans)) continue;
      prompt = dist
        ? `From the top of a vertical cliff ${base} meters high, the angle of depression to a boat on the level sea is ${t}°. How far is the boat from the base of the cliff, in meters? ${rule}`
        : `A boat on the level sea is ${base} meters from the base of a vertical cliff. From the top of the cliff, the angle of depression to the boat is ${t}°. How high is the cliff, in meters? ${rule}`;
      hint = `The angle of depression is measured downward from the horizontal line through the observer. That horizontal line is parallel to the sea, so the ${t}° angle is equal to the angle at the boat inside the right triangle. Mark which leg is opposite that angle and which is adjacent.`;
      correct = len(ans, "meters");
      wrong = [
        [
          len(dist ? base * tan : base / tan, "meters"),
          "This treats the angle of depression as if it were measured from the vertical. It is measured from the horizontal, and alternate interior angles make it equal to the angle at the boat.",
        ],
        [
          len(dist ? base / sin : base * sin, "meters"),
          dist
            ? "That is the length of the line of sight, the hypotenuse, not the horizontal distance."
            : "Sine would need the line-of-sight length, which is not given.",
        ],
        [
          len(dist ? base * cos : base / cos, "meters"),
          "Cosine relates the adjacent leg and the hypotenuse; only the legs are involved here.",
        ],
      ];
      explanation = [
        `The angle of depression is how far you look down from level, here ${t}°, measured from a level line through the top of the cliff.`,
        `That level line is parallel to the sea. Alternate interior angles, between parallel lines on opposite sides of the line of sight, are equal. So the angle at the boat is also ${t}°.`,
        sides,
        dist
          ? `From the boat, the cliff is opposite and the distance is adjacent. Tangent is opposite ÷ adjacent: $\\tan ${t}^\\circ=\\frac{${base}}{\\text{distance}}$.`
          : `From the boat, the distance is adjacent and the cliff is opposite. Tangent is opposite ÷ adjacent: $\\tan ${t}^\\circ=\\frac{\\text{height}}{${base}}$.`,
        dist
          ? `Solve for the distance: distance $=\\frac{${base}}{\\tan ${t}^\\circ}\\approx ${ans.toFixed(2)}$.`
          : `Multiply both sides by ${base}: height $=${base}\\tan ${t}^\\circ\\approx ${ans.toFixed(2)}$.`,
        dist
          ? `The boat is about ${ans.toFixed(1)} meters from the base of the cliff.`
          : `The cliff is about ${ans.toFixed(1)} meters high.`,
      ];
    } else if (tag.startsWith("ladder-")) {
      const L = r(10, 40);
      const lt = r(55, 78);
      const ls = Math.sin(rad(lt)),
        lc = Math.cos(rad(lt)),
        lg = Math.tan(rad(lt));
      if (tag === "ladder-reach" || tag === "ladder-foot") {
        const reach = tag === "ladder-reach";
        const ans = reach ? L * ls : L * lc;
        if (!safe(ans)) continue;
        prompt = reach
          ? `A ${L}-foot ladder leans against a vertical wall and makes a ${lt}° angle with the level ground. How high up the wall does the ladder reach, in feet? ${rule}`
          : `A ${L}-foot ladder leans against a vertical wall and makes a ${lt}° angle with the level ground. How far is the foot of the ladder from the wall, in feet? ${rule}`;
        hint = `The ladder, the wall and the ground form a right triangle, and the ${lt}° angle is at the foot of the ladder. The ladder is the hypotenuse. Decide whether the ${reach ? "height on the wall" : "distance along the ground"} is opposite or adjacent to that angle.`;
        correct = len(ans, "feet");
        wrong = [
          [
            len(reach ? L * lc : L * ls, "feet"),
            `That uses the ratio for the other leg. ${unitMixup}`,
          ],
          [
            len(reach ? L * lg : L / lg, "feet"),
            "The tangent compares the two legs, but the ladder is the hypotenuse.",
          ],
          [
            len(reach ? L / ls : L / lc, "feet"),
            "Dividing the hypotenuse by the ratio finds a longer length than the ladder, which no leg can be.",
          ],
        ];
        explanation = [
          sides,
          `The ladder is the slanted side, across from the right angle at the wall, so it is the hypotenuse: ${L} feet.`,
          `The ${lt}° angle is at the foot. The height on the wall is opposite it, and the ground distance is adjacent.`,
          reach
            ? `Sine is opposite ÷ hypotenuse: $\\sin ${lt}^\\circ=\\frac{\\text{height}}{${L}}$. Multiply by ${L}: height $=${L}\\sin ${lt}^\\circ\\approx ${ans.toFixed(2)}$.`
            : `Cosine is adjacent ÷ hypotenuse: $\\cos ${lt}^\\circ=\\frac{\\text{distance}}{${L}}$. Multiply by ${L}: distance $=${L}\\cos ${lt}^\\circ\\approx ${ans.toFixed(2)}$.`,
          reach
            ? `The ladder reaches about ${ans.toFixed(1)} feet up the wall.`
            : `The foot of the ladder is about ${ans.toFixed(1)} feet from the wall.`,
        ];
      } else {
        const h = r(8, 30);
        const ans = h / ls;
        if (!safe(ans)) continue;
        prompt = `A ladder must reach a window ${h} feet above level ground and make a ${lt}° angle with the ground. How long must the ladder be, in feet? ${rule}`;
        hint = `The window height ${h} feet is the leg opposite the ${lt}° angle at the foot of the ladder, and the ladder is the hypotenuse. Choose the ratio that links the opposite leg and the hypotenuse, then solve for the hypotenuse.`;
        correct = len(ans, "feet");
        wrong = [
          [
            len(h * ls, "feet"),
            "This multiplies instead of dividing. The unknown is the denominator of the sine ratio.",
          ],
          [
            len(h / lc, "feet"),
            "Cosine relates the adjacent leg and the hypotenuse, but the given height is the opposite leg.",
          ],
          [
            len(h / lg, "feet"),
            "The tangent relates the two legs, but the ladder is the hypotenuse.",
          ],
          [
            len(h * lc, "feet"),
            "Cosine times the height has no meaning for a hypotenuse here.",
          ],
        ];
        explanation = [
          sides,
          `The ${h}-foot height is opposite the ${lt}° angle at the foot. The ladder is the slanted side, the hypotenuse.`,
          `Sine is opposite ÷ hypotenuse: $\\sin ${lt}^\\circ=\\frac{${h}}{\\text{length}}$.`,
          `The unknown is on the bottom, so multiply both sides by the length, then divide by $\\sin ${lt}^\\circ$: length $=\\frac{${h}}{\\sin ${lt}^\\circ}\\approx ${ans.toFixed(2)}$.`,
          `The ladder must be about ${ans.toFixed(1)} feet long.`,
        ];
      }
    } else if (tag === "ramp-angle" || tag === "shadow-angle") {
      const run = r(8, 40),
        rise = r(2, run - 1);
      if (rise === run) continue;
      const a = deg(Math.atan(rise / run));
      if (!safe(a)) continue;
      const cand = [
        deg(Math.atan(rise / run)),
        deg(Math.atan(run / rise)),
        deg(Math.asin(rise / run)),
        deg(Math.acos(rise / run)),
      ];
      const d1 = (x: number) => `${x.toFixed(1)}°`;
      prompt =
        tag === "ramp-angle"
          ? `A straight ramp rises ${rise} feet over a horizontal distance of ${run} feet. What angle does the ramp make with the level ground, in degrees? ${rule}`
          : `A vertical pole ${rise} meters tall casts a shadow ${run} meters long on level ground. What is the angle of elevation of the sun, in degrees? ${rule}`;
      hint = `Draw the right triangle: the ${tag === "ramp-angle" ? "rise" : "pole"} is ${rise} and the ${tag === "ramp-angle" ? "horizontal distance" : "shadow"} is ${run}; these are its two legs. The unknown angle is at the ground end. Choose the ratio of those two legs, then use the inverse function to find the angle.`;
      correct = d1(cand[0]!);
      wrong = [
        [
          d1(cand[1]!),
          "The ratio is inverted. The vertical leg is opposite the angle at the ground, so it belongs in the numerator.",
        ],
        [
          d1(cand[2]!),
          `The sine compares the vertical leg with the hypotenuse, but ${run} is the other leg, not the hypotenuse.`,
        ],
        [
          d1(cand[3]!),
          `The cosine compares the horizontal leg with the hypotenuse, but ${rise} is a leg, not the hypotenuse.`,
        ],
        [
          d1(90 - cand[0]!),
          "This is the angle at the top of the triangle, the other acute angle.",
        ],
      ];
      explanation = [
        sides,
        `Call the angle at the ground $\\theta$ (theta). The ${rise} is the opposite leg, across from it, and ${run} is the adjacent leg, touching it.`,
        `Tangent is opposite ÷ adjacent, so $\\tan\\theta=\\frac{${rise}}{${run}}$.`,
        `The inverse tangent, $\\tan^{-1}$, works backward from a ratio to its angle: $\\theta=\\tan^{-1}\\!\\left(\\frac{${rise}}{${run}}\\right)\\approx ${a.toFixed(2)}^\\circ$.`,
        tag === "ramp-angle"
          ? `The ramp makes an angle of about ${a.toFixed(1)}° with the ground.`
          : `The angle of elevation of the sun is about ${a.toFixed(1)}°.`,
      ];
    } else if (tag === "shadow-length") {
      const h = r(6, 60);
      const ans = h / tan;
      if (!safe(ans)) continue;
      prompt = `A vertical flagpole ${h} feet tall casts a shadow on level ground when the angle of elevation of the sun is ${t}°. How long is the shadow, in feet? ${rule}`;
      hint = `The pole, its shadow and the sun's ray form a right triangle, and the sun's angle of elevation (${t}°) is the angle at the end of the shadow. The pole (${h} feet) is one leg. Decide whether it is opposite or adjacent to that angle.`;
      correct = len(ans, "feet");
      wrong = [
        [
          len(h * tan, "feet"),
          "This multiplies by the tangent, which would turn the shadow into the height. The shadow is the adjacent leg, so divide the height by the tangent.",
        ],
        [
          len(h / sin, "feet"),
          "That is the length of the sun's ray, the hypotenuse, not the shadow.",
        ],
        [
          len(h * cos, "feet"),
          "Cosine relates the shadow and the hypotenuse; the ray's length is not given.",
        ],
      ];
      explanation = [
        `The angle of elevation of the sun is how high the sun is above level: ${t}°. It sits at the tip of the shadow.`,
        sides,
        `The pole, ${h} feet, is opposite that angle. The shadow touches it, so the shadow is adjacent.`,
        `Tangent is opposite ÷ adjacent: $\\tan ${t}^\\circ=\\frac{${h}}{\\text{shadow}}$. Solve: shadow $=\\frac{${h}}{\\tan ${t}^\\circ}\\approx ${ans.toFixed(2)}$.`,
        `The shadow is about ${ans.toFixed(1)} feet long.`,
      ];
    } else {
      // Placement of the depression angle in the triangle.
      const top = tag === "depression-top";
      const target = top ? 90 - t : t;
      const d1 = (x: number) => `${x}°`;
      prompt = top
        ? `From the top $T$ of a vertical lighthouse, the angle of depression to a ship $S$ on the level sea is ${t}°. The base of the lighthouse is $B$, so triangle $TBS$ has a right angle at $B$. What is the measure of angle $BTS$ at the top, in degrees?`
        : `From the top $T$ of a vertical lighthouse, the angle of depression to a ship $S$ on the level sea is ${t}°. The base of the lighthouse is $B$, so triangle $TBS$ has a right angle at $B$. What is the measure of angle $BST$ at the ship, in degrees?`;
      hint = `Draw the horizontal line through $T$. The ${t}° angle of depression is measured from that line down to the line of sight $TS$. Because the horizontal line is parallel to the sea $BS$, line $TS$ is a transversal; find the angle at $S$ that matches by alternate interior angles.${top ? " Then use the angle sum of triangle $TBS$." : ""}`;
      correct = d1(target);
      wrong = top
        ? [
            [
              d1(t),
              "That is the angle of depression itself, measured from the horizontal. Angle $BTS$ is measured from the vertical wall.",
            ],
            [
              d1(180 - t),
              "An acute angle of a right triangle cannot be obtuse.",
            ],
            [
              d1(90 + t),
              "An acute angle of a right triangle cannot exceed 90°.",
            ],
            [
              d1(Math.round(t / 2)),
              "Nothing halves the angle of depression in this figure.",
            ],
          ]
        : [
            [
              d1(90 - t),
              "That is the angle at the top, between the lighthouse and the line of sight. The angle of depression equals the angle at the ship.",
            ],
            [
              d1(180 - t),
              "An acute angle of a right triangle cannot be obtuse; the angle at the ship equals the angle of depression.",
            ],
            [
              d1(90 + t),
              "An acute angle of a right triangle cannot exceed 90°.",
            ],
            [
              d1(Math.round(t / 2)),
              "Nothing halves the angle of depression in this figure.",
            ],
          ];
      explanation = top
        ? [
            `The angle of depression is how far you look down from level: from a level line through $T$ down to the line of sight $TS$.`,
            `That level line is parallel to the sea $BS$. Alternate interior angles, between parallel lines on opposite sides of $TS$, are equal. So angle $BST$ is ${t}°.`,
            `Triangle $TBS$ has a right angle at $B$. Its angles add to 180°, so the two sharp angles share 90°.`,
            `Angle $BTS$ = 90° − ${t}° = ${90 - t}°.`,
            `Angle $BTS$ at the top measures ${90 - t}°.`,
          ]
        : [
            `The angle of depression is how far you look down from level: from a level line through $T$ down to the line of sight $TS$.`,
            `The level line through $T$ is parallel to the sea $BS$, and $TS$ crosses both.`,
            `The angle of depression and angle $BST$ are alternate interior angles: between the parallel lines, on opposite sides of $TS$. Such angles are equal.`,
            `Angle $BST$ at the ship measures ${t}°.`,
          ];
    }
    const choices = choose(correct, wrong);
    if (!choices) continue;
    return { tag, draft: { prompt, answer: "", hint, explanation, choices } };
  }
}

/* ------------------------------------------------------ midpoint, endpoint */
const midpointVariants = [
  "midpoint",
  "missing-endpoint",
  "endpoint-sum",
  "circle-center",
  "circle-equation",
] as const;
const lenOf = (n: number, u: readonly [string, string]) =>
  `${n} ${n === 1 ? u[0] : u[1]}`;
const sgn = (n: number) => (n < 0 ? `-${-n}` : String(n));
/** Decimal text of n/2, exact. */
const half = (n: number) => String(n / 2);
const pair = (x: number | string, y: number | string) => tex(`(${x},\\ ${y})`);
const shiftTex = (v: string, c: number) =>
  c === 0 ? v : c > 0 ? `${v}-${c}` : `${v}+${-c}`;

function midpointCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, midpointVariants);
  for (;;) {
    if (tag === "midpoint") {
      const A = [r(-9, 9), r(-9, 9)] as const,
        B = [r(-9, 9), r(-9, 9)] as const;
      if (A[0] === B[0] && A[1] === B[1]) continue;
      const mx = A[0] + B[0],
        my = A[1] + B[1];
      const m = [half(mx), half(my)];
      const choices = choose(pair(m[0]!, m[1]!), [
        [
          pair(sgn(mx), sgn(my)),
          "This adds the coordinates but does not divide by 2. The midpoint is the average of the endpoints.",
        ],
        [
          pair(half(B[0] - A[0]), half(B[1] - A[1])),
          "This halves the change from $A$ to $B$, which is the vector to the midpoint, not the midpoint itself. Add it to $A$.",
        ],
        [
          pair(half(A[0] - B[0]), half(A[1] - B[1])),
          "This halves a difference. The midpoint averages the coordinates, so add them first.",
        ],
        [
          pair(half(-mx), half(-my)),
          "The signs are reversed: the average of the coordinates keeps their signs.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `Segment $AB$ has endpoints $A(${sgn(A[0])},\\ ${sgn(A[1])})$ and $B(${sgn(B[0])},\\ ${sgn(B[1])})$. What are the coordinates of the midpoint of $\\overline{AB}$?`,
          answer: "",
          hint: `The midpoint is halfway between the endpoints in each coordinate. For the $x$-coordinate, use ${A[0]} and ${B[0]}; then do the same for $y$.`,
          explanation: [
            `The midpoint is the point exactly halfway between the endpoints.`,
            `Halfway in each direction means the average: add the two coordinates and divide by 2.`,
            `$x=\\frac{${A[0]}+${par(B[0])}}{2}=${m[0]}$ and $y=\\frac{${A[1]}+${par(B[1])}}{2}=${m[1]}$.`,
            `The midpoint of $\\overline{AB}$ is $(${m[0]},\\ ${m[1]})$.`,
          ],
          choices,
        },
      };
    }
    if (tag === "missing-endpoint" || tag === "endpoint-sum") {
      const A = [r(-9, 9), r(-9, 9)] as const,
        M = [r(-9, 9), r(-9, 9)] as const;
      const B = [2 * M[0] - A[0], 2 * M[1] - A[1]] as const;
      if (A[0] === M[0] && A[1] === M[1]) continue;
      const sum = tag === "endpoint-sum";
      const correct = sum ? String(B[0] + B[1]) : pair(B[0], B[1]);
      const wrongPts: Option[] = [
        [
          pair(M[0] - A[0], M[1] - A[1]),
          "This is the vector from $A$ to the midpoint. Add it to the midpoint again, or double the midpoint and subtract $A$.",
        ],
        [
          pair(M[0] + A[0], M[1] + A[1]),
          "This adds the midpoint and the known endpoint. The midpoint is the average, so the missing endpoint is twice the midpoint minus the known endpoint.",
        ],
        [
          pair(half(A[0] + M[0]), half(A[1] + M[1])),
          "This finds the midpoint of $A$ and $M$, a point only a quarter of the way along the full segment.",
        ],
        [
          pair(2 * M[0] + A[0], 2 * M[1] + A[1]),
          "The known endpoint must be subtracted, not added: $B=2M-A$.",
        ],
      ];
      const wrongSum: Option[] = wrongPts.map(([label, fb], i) => {
        const cand = [
          M[0] - A[0] + (M[1] - A[1]),
          M[0] + A[0] + (M[1] + A[1]),
          (A[0] + M[0] + A[1] + M[1]) / 2,
          2 * M[0] + A[0] + 2 * M[1] + A[1],
        ][i]!;
        return [String(cand), fb] as Option;
      });
      const choices = choose(correct, sum ? wrongSum : wrongPts);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: sum
            ? `The midpoint of $\\overline{AB}$ is $M(${sgn(M[0])},\\ ${sgn(M[1])})$ and $A$ is $(${sgn(A[0])},\\ ${sgn(A[1])})$. What is the sum of the coordinates of $B$?`
            : `The midpoint of $\\overline{AB}$ is $M(${sgn(M[0])},\\ ${sgn(M[1])})$ and $A$ is $(${sgn(A[0])},\\ ${sgn(A[1])})$. What are the coordinates of $B$?`,
          answer: "",
          hint: `Each midpoint coordinate is the average of the endpoint coordinates. For the $x$-coordinate write $\\frac{${A[0]}+x_B}{2}=${M[0]}$, and solve for $x_B$; then do the same for $y$.`,
          explanation: [
            `The midpoint is halfway between the endpoints, so each of its coordinates is the average of the endpoints' coordinates.`,
            `Write that with the unknown $B=(x_B,\\ y_B)$: $\\frac{${A[0]}+x_B}{2}=${M[0]}$ and $\\frac{${A[1]}+y_B}{2}=${M[1]}$.`,
            `Multiply both sides by 2 to undo the division, then subtract $A$'s coordinate: $x_B=2(${M[0]})-${par(A[0])}=${B[0]}$ and $y_B=2(${M[1]})-${par(A[1])}=${B[1]}$.`,
            `Check: $M$ is the same step from $A$ as $B$ is from $M$.`,
            sum
              ? `So $B=(${B[0]},\\ ${B[1]})$, and the sum of its coordinates is ${B[0]} + ${par(B[1])} = ${B[0] + B[1]}.`
              : `The coordinates of $B$ are $(${B[0]},\\ ${B[1]})$.`,
          ],
          choices,
        },
      };
    }
    // The diameter has even changes in both coordinates, so r^2 is an integer.
    const p = r(1, 6) * pick(r, [1, -1]),
      q = r(1, 6) * pick(r, [1, -1]);
    const h = r(-7, 7),
      k = r(-7, 7);
    if (h === 0 || k === 0) continue;
    const A = [h - p, k - q] as const,
      B = [h + p, k + q] as const;
    const r2 = p * p + q * q;
    if (tag === "circle-center") {
      const choices = choose(pair(h, k), [
        [
          pair(B[0] - A[0], B[1] - A[1]),
          "This is the change from one endpoint to the other, which is the diameter vector, not a point.",
        ],
        [
          pair(A[0] + B[0], A[1] + B[1]),
          "This adds the endpoints but does not divide by 2.",
        ],
        [
          pair(-h, -k),
          "The signs are reversed: the center is the midpoint, with the same signs as the averaged coordinates.",
        ],
        [
          pair(h + p, k - q),
          "This mixes one coordinate of each endpoint. The center averages matching coordinates.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `In the $xy$-plane, $\\overline{AB}$ is a diameter of a circle, with $A(${sgn(A[0])},\\ ${sgn(A[1])})$ and $B(${sgn(B[0])},\\ ${sgn(B[1])})$. What are the coordinates of the center of the circle?`,
          answer: "",
          hint: `Every diameter passes through the center and the center is halfway between its endpoints. Average the $x$-coordinates ${A[0]} and ${B[0]}, then the $y$-coordinates.`,
          explanation: [
            "A diameter is a segment through the center, from one side of the circle to the other. The center sits exactly halfway along it.",
            "So the center is the midpoint of $\\overline{AB}$: average the $x$-coordinates, then the $y$-coordinates.",
            `$x=\\frac{${A[0]}+${par(B[0])}}{2}=${h}$ and $y=\\frac{${A[1]}+${par(B[1])}}{2}=${k}$.`,
            `The center of the circle is $(${h},\\ ${k})$.`,
          ],
          choices,
        },
      };
    }
    const eq = (a: number, b: number, rhs: string) =>
      tex(`(${shiftTex("x", a)})^2+(${shiftTex("y", b)})^2=${rhs}`);
    const choices = choose(eq(h, k, String(r2)), [
      [
        eq(-h, -k, String(r2)),
        "In $(x-h)^2$ the center's coordinate is subtracted. A center with $x=h$ gives $x-h$, not $x+h$.",
      ],
      [
        eq(h, k, String(4 * r2)),
        "This uses the diameter squared. The radius is half the diameter, so $r^2$ is one-fourth of the diameter squared.",
      ],
      [
        eq(h, k, String(p * p)),
        "This squares only the change in $x$ from the center to an endpoint. The distance formula adds the squared changes in both coordinates.",
      ],
      [eq(h, k, rootTex(r2)), "The right side is $r^2$, not $r$."],
    ]);
    if (!choices) continue;
    return {
      tag,
      draft: {
        prompt: `In the $xy$-plane, a circle has a diameter with endpoints $(${sgn(A[0])},\\ ${sgn(A[1])})$ and $(${sgn(B[0])},\\ ${sgn(B[1])})$. Which equation represents the circle?`,
        answer: "",
        hint: `Find the center first: it is the midpoint of the diameter with endpoints $(${sgn(A[0])},\\ ${sgn(A[1])})$ and $(${sgn(B[0])},\\ ${sgn(B[1])})$. Then find the distance from the center to one endpoint; that is the radius, and the equation needs its square.`,
        explanation: [
          `A circle's equation is $(x-h)^2+(y-k)^2=r^2$, where $(h,\\ k)$ is the center and $r$ is the radius, the distance from the center to the circle.`,
          `A diameter passes through the center, so the center is its midpoint: $(\\frac{${A[0]}+${par(B[0])}}{2},\\ \\frac{${A[1]}+${par(B[1])}}{2})=(${h},\\ ${k})$.`,
          `The radius reaches from the center to an endpoint. The distance formula squares the change in $x$ and in $y$ and adds: $r^2=(${B[0]}-${par(h)})^2+(${B[1]}-${par(k)})^2=${p * p}+${q * q}=${r2}$.`,
          `Put the center and $r^2$ into the form. Subtracting a negative coordinate shows as a plus sign.`,
          `The equation of the circle is $(${shiftTex("x", h)})^2+(${shiftTex("y", k)})^2=${r2}$.`,
        ],
        choices,
      },
    };
  }
}

/* ----------------------------------------------------------- space diagonal */
// Integer edges (a, b, c) with a^2 + b^2 + c^2 a perfect square.
const quadruples: readonly (readonly [number, number, number, number])[] = [
  [1, 2, 2, 3],
  [2, 3, 6, 7],
  [1, 4, 8, 9],
  [4, 4, 7, 9],
  [2, 6, 9, 11],
  [6, 6, 7, 11],
  [3, 4, 12, 13],
  [2, 10, 11, 15],
  [8, 9, 12, 17],
  [4, 5, 20, 21],
];
const spaceVariants = [
  "box-diagonal",
  "longest-rod",
  "box-edge",
  "cube-diagonal",
  "radical-diagonal",
] as const;
function spaceCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, spaceVariants);
  for (;;) {
    if (tag === "box-diagonal" || tag === "longest-rod" || tag === "box-edge") {
      const [a0, b0, c0, d0] = pick(r, quadruples);
      const s = pick(r, [1, 1, 2, 3]);
      const e = [a0 * s, b0 * s, c0 * s];
      // Shuffle which edge is which.
      const order = [0, 1, 2];
      for (let i = 2; i > 0; i--) {
        const j = r(0, i);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      const [l, w, h] = order.map((i) => e[i]!) as [number, number, number];
      const d = d0 * s;
      const unit = pick(r, [
        ["inch", "inches"],
        ["centimeter", "centimeters"],
        ["foot", "feet"],
      ] as const);
      if (tag === "box-edge") {
        const choices = choose(String(h), [
          [
            String(d - l - w),
            "Subtracting the lengths directly treats the diagonal as the sum of the three edges. Square the lengths first.",
          ],
          [
            String(d * d - l * l - w * w),
            "This is $h^2$. Take the square root to get $h$.",
          ],
          [
            rt(d * d - l * l),
            "This uses only one of the two known edges. All three edges, squared, add to the diagonal squared.",
          ],
          [
            rt(d * d - w * w),
            "This uses only one of the two known edges. All three edges, squared, add to the diagonal squared.",
          ],
        ]);
        if (!choices) continue;
        return {
          tag,
          draft: {
            prompt: `A rectangular box has a base ${lenOf(l, unit)} long and ${lenOf(w, unit)} wide. The longest straight segment between two corners of the box is ${lenOf(d, unit)}. What is the height of the box, in ${unit[1]}?`,
            answer: "",
            hint: `The segment between opposite corners of a box has length $\\sqrt{\\ell^2+w^2+h^2}$. Square the known lengths ${l}, ${w} and ${d}, and use them to get $h^2$.`,
            explanation: [
              `The longest segment in a box runs from one corner to the opposite corner, through the inside. Call its length $d$.`,
              `Using the Pythagorean theorem twice (once across the base, once up the height) gives $d^2=\\ell^2+w^2+h^2$: length, width and height, each squared.`,
              `Substitute: $${d}^2=${l}^2+${w}^2+h^2$, so $${d * d}=${l * l + w * w}+h^2$.`,
              `Subtract to get $h^2$ alone: $h^2=${d * d}-${l * l + w * w}=${h * h}$. Take the square root: $h=${h}$.`,
              `The height of the box is ${lenOf(h, unit)}.`,
            ],
            choices,
          },
        };
      }
      const choices = choose(String(d), [
        [
          String(l + w + h),
          "Adding the edges is a path along the edges. The straight segment is shorter: square, add, then take the root.",
        ],
        [
          String(l * l + w * w + h * h),
          "This is the squared length. Take the square root.",
        ],
        [
          rt(l * l + w * w),
          "This is the diagonal of the base only, which is not corner to corner through the box. Include the height under the root.",
        ],
        [
          rt(l * l + w * w + h * h - 2 * Math.min(l, w, h) ** 2),
          "This leaves out one edge. All three edges contribute under the root.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt:
            tag === "box-diagonal"
              ? `A rectangular box is ${lenOf(l, unit)} long, ${lenOf(w, unit)} wide and ${lenOf(h, unit)} tall. What is the distance, in ${unit[1]}, from one corner of the box to the opposite corner?`
              : `A shipping tube is a straight, thin rod. What is the length, in ${unit[1]}, of the longest rod that fits inside a closed rectangular box ${lenOf(l, unit)} by ${lenOf(w, unit)} by ${lenOf(h, unit)}? The rod can lie along the diagonal from one corner to the opposite corner.`,
          answer: "",
          hint: `First find the diagonal of the base using ${l} and ${w}. That diagonal and the ${lenOf(h, unit)} height are the legs of a second right triangle whose hypotenuse is the corner-to-corner segment.`,
          explanation: [
            `The Pythagorean theorem says that in a right triangle, leg² + leg² = hypotenuse², where the hypotenuse is the longest side, across from the right angle.`,
            `First cross the bottom of the box. The base diagonal $f$ is the hypotenuse of a right triangle with legs ${l} and ${w}: $f^2=${l}^2+${w}^2=${l * l + w * w}$.`,
            `Now go up. The corner-to-corner segment $d$ is the hypotenuse of a right triangle with legs $f$ and the height ${h}: $d^2=f^2+${h}^2=${l * l + w * w}+${h * h}=${d * d}$.`,
            `Take the square root: $d=\\sqrt{${d * d}}=${d}$.`,
            tag === "box-diagonal"
              ? `The distance from one corner to the opposite corner is ${lenOf(d, unit)}.`
              : `The longest rod that fits is ${lenOf(d, unit)} long.`,
          ],
          choices,
        },
      };
    }
    const edge = r(2, 12);
    if (tag === "cube-diagonal") {
      const choices = choose(tex(`${edge}\\sqrt{3}`), [
        [
          tex(`${edge}\\sqrt{2}`),
          "This is the diagonal of one square face. The corner-to-corner segment of the cube also climbs the third edge.",
        ],
        [
          String(3 * edge),
          "Adding the three edges is a path along the edges. Use the Pythagorean relation: $\\sqrt{3a^2}$.",
        ],
        [
          tex(`${3 * edge}\\sqrt{3}`),
          "The edge is not multiplied by 3 before the root: $\\sqrt{a^2+a^2+a^2}=a\\sqrt{3}$.",
        ],
        [
          tex(`${edge}\\sqrt{6}`),
          "That adds the squares twice. Three equal squared edges give $3a^2$ under the root.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `A cube has edges of length ${edge} centimeters. What is the distance, in centimeters, from one vertex of the cube to the opposite vertex?`,
          answer: "",
          hint: `Each edge is ${edge} centimeters. Find a face diagonal first; then use it and one more edge as the legs of a right triangle.`,
          explanation: [
            `The Pythagorean theorem says that in a right triangle, leg² + leg² = hypotenuse², where the hypotenuse is the longest side, across from the right angle.`,
            `A face diagonal crosses one square face. Its legs are two edges: $\\sqrt{${edge}^2+${edge}^2}=\\sqrt{${2 * edge * edge}}$.`,
            `The vertex-to-vertex segment $d$ has legs: that face diagonal and one more edge going up. So $d^2=${2 * edge * edge}+${edge * edge}=${3 * edge * edge}$.`,
            `Simplify: $d=\\sqrt{${3 * edge * edge}}=\\sqrt{${edge * edge}\\cdot 3}=${edge}\\sqrt{3}$.`,
            `The distance between opposite vertices is $${edge}\\sqrt{3}$ centimeters.`,
          ],
          choices,
        },
      };
    }
    // Non-perfect sums give a simplified radical.
    const l = r(1, 9),
      w = r(1, 9),
      h = r(1, 9);
    const S = l * l + w * w + h * h;
    if (simplifyRoot(S)[1] === 1) continue;
    if (new Set([l, w, h]).size < 2) continue;
    const choices = choose(rt(S), [
      [
        String(l + w + h),
        "Adding the edges is not the straight-line distance. Add the squares and take the root.",
      ],
      [
        rt(l * l + w * w),
        "This is only the diagonal of the base. Include the height under the root.",
      ],
      [String(S), "This is the squared length. Take the square root."],
      [
        rt(l * w + w * h + l * h),
        "Products of edges are not involved; the relation uses the squares of the edges.",
      ],
    ]);
    if (!choices) continue;
    return {
      tag,
      draft: {
        prompt: `A rectangular box has dimensions ${lenOf(l, ["inch", "inches"])} by ${lenOf(w, ["inch", "inches"])} by ${lenOf(h, ["inch", "inches"])}. What is the exact distance, in inches, between two opposite corners? Simplify any radical.`,
        answer: "",
        hint: `The corner-to-corner segment is the hypotenuse of a right triangle whose legs are the base diagonal (found from ${l} and ${w}) and the ${h}-inch height. Keep the squares exact and simplify at the end.`,
        explanation: [
          `The Pythagorean theorem says that in a right triangle, leg² + leg² = hypotenuse², where the hypotenuse is the longest side, across from the right angle.`,
          `Use it twice: across the base (legs ${l} and ${w}), then up the height ${h}. Together that gives $d^2=${l}^2+${w}^2+${h}^2=${l * l}+${w * w}+${h * h}=${S}$.`,
          `So $d=\\sqrt{${S}}$.${simplifyRoot(S)[0] > 1 ? ` To simplify, pull out the largest perfect square: $${S}=${simplifyRoot(S)[0] ** 2}\\cdot ${simplifyRoot(S)[1]}$, so $d=${rootTex(S)}$.` : ""}`,
          `The exact distance between opposite corners is $${rootTex(S)}$ inches.`,
        ],
        choices,
      },
    };
  }
}

/* --------------------------------------------------------- circle segments */
const secantVariants = [
  "chords-segment",
  "chords-whole",
  "secants-whole",
  "secants-internal",
  "tangent-secant-whole",
  "tangent-secant-tangent",
  "tangent-secant-chord",
  "tangent-slope",
  "tangent-slope-axis",
] as const;
const divisors = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const triples: readonly (readonly [number, number])[] = [
  [3, 4],
  [4, 3],
  [5, 12],
  [12, 5],
  [6, 8],
  [8, 6],
  [8, 15],
  [15, 8],
];
function circleSegmentCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, secantVariants);
  for (;;) {
    if (tag === "chords-segment" || tag === "chords-whole") {
      const p = r(1, 4),
        q = r(1, 5),
        s = r(1, 4),
        t = r(1, 5);
      // AE*EB = CE*ED, with all four segments different from the unknown.
      const a = p * q,
        b = s * t,
        c = p * s,
        d = q * t;
      if (new Set([a, b, c, d]).size < 3 || Math.max(a, b, c, d) > 24) continue;
      const whole = tag === "chords-whole";
      const correct = String(whole ? c + d : d);
      const prod = a * b;
      const choices = choose(correct, [
        [
          String(whole ? c + a : a + b - c),
          whole
            ? "This adds a segment from the other chord. The whole chord $CD$ is $CE+ED$."
            : "This subtracts from the sum. Chord segments multiply: $AE\\cdot EB=CE\\cdot ED$.",
        ],
        [
          String(whole ? d : prod - c),
          whole
            ? "That is only $ED$; the question asks for the whole chord $CD$."
            : "This subtracts instead of dividing the product by $CE$.",
        ],
        [
          rational(a * c, b),
          "This pairs the products incorrectly. Multiply the two parts of one chord and set it equal to the product of the two parts of the other.",
        ],
        [
          rational(b * c, a),
          "This pairs the products incorrectly. Multiply the two parts of one chord and set it equal to the product of the two parts of the other.",
        ],
        [
          String(whole ? c + d + 1 : a + b + c),
          "Segments of chords are related by a product, not a sum.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          figure: sceneFigure(
            chordsFigure({
              AE: String(a),
              EB: String(b),
              CE: String(c),
              ...(whole ? {} : { ED: null }),
            }),
          ),
          prompt: `Chords $\\overline{AB}$ and $\\overline{CD}$ of a circle intersect at point $E$ inside the circle. $AE=${a}$, $EB=${b}$ and $CE=${c}$. ${whole ? "What is the length of $\\overline{CD}$?" : "What is the length of $\\overline{ED}$?"}`,
          answer: "",
          hint: `For two chords meeting inside a circle, the two parts of one chord multiply to the same number as the two parts of the other. Start with $AE\\cdot EB$ using ${a} and ${b}.`,
          explanation: [
            `A chord is a segment joining two points on a circle. When two chords cross inside a circle, each is cut into two pieces.`,
            `The two pieces of one chord multiply to the same number as the two pieces of the other: $AE\\cdot EB=CE\\cdot ED$. This holds because the crossing makes two similar triangles.`,
            `Substitute: $${a}\\cdot ${b}=${c}\\cdot ED$, so $${prod}=${c}\\cdot ED$.`,
            `Divide both sides by ${c}: $ED=${prod}\\div ${c}=${d}$.`,
            whole
              ? `The whole chord is both pieces: $CD=CE+ED=${c}+${d}=${c + d}$. So $\\overline{CD}$ has length ${c + d}.`
              : `$\\overline{ED}$ has length ${d}.`,
          ],
          choices,
        },
      };
    }
    if (tag === "secants-whole" || tag === "secants-internal") {
      const e1 = r(2, 8),
        w1 = e1 + r(2, 10);
      const P = e1 * w1;
      const e2 = pick(
        r,
        divisors(P).filter((x) => x !== e1 && x * x < P),
      );
      if (e2 === undefined) continue;
      const w2 = P / e2;
      if (w2 > 40) continue;
      const internal = tag === "secants-internal";
      const correct = String(internal ? w2 - e2 : w2);
      const choices = choose(correct, [
        [
          String(internal ? w2 : w2 - e2),
          internal
            ? "That is the whole secant $PD$. The chord $CD$ is the whole secant minus the outside part, $PD-PC$."
            : "That is the chord inside the circle. The whole secant includes the outside part $PC$.",
        ],
        [
          rational(e1 * (w1 - e1), e2),
          "This multiplies the outside part by the inside part. The rule multiplies the outside part by the whole secant.",
        ],
        [
          String(e1 + w1 - e2),
          "The segments are related by a product, not a sum.",
        ],
        [
          String(P),
          "This is the product $PA\\cdot PB$. Divide by $PC$ to find $PD$.",
        ],
        [
          String(w1 - e1 + e2),
          "The segments are related by a product, not a sum.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          figure: sceneFigure(
            secantsFigure({
              upper: { outside: String(e1), whole: String(w1) },
              lower: internal
                ? { outside: String(e2) }
                : { outside: String(e2), whole: null },
              ...(internal ? { chord: null } : {}),
            }),
          ),
          prompt: `Two secants from an external point $P$ meet a circle. The first secant meets it at $A$ and then $B$, with $PA=${e1}$ and $PB=${w1}$. The second meets it at $C$ and then $D$, with $PC=${e2}$. ${internal ? "What is the length of chord $\\overline{CD}$?" : "What is the length of $\\overline{PD}$?"}`,
          answer: "",
          hint: `For two secants from one outside point, the outside part times the whole secant is the same for both. Use $PA\\cdot PB$ with ${e1} and ${w1} to get that common product.`,
          explanation: [
            `A secant is a line that cuts through a circle at two points. From one outside point $P$, each secant has an outside part and a whole length.`,
            `For two secants from the same point, outside part × whole secant is the same for both: $PA\\cdot PB=PC\\cdot PD$.`,
            `Substitute: $${e1}\\cdot ${w1}=${P}$, so $${e2}\\cdot PD=${P}$.`,
            `Divide both sides by ${e2}: $PD=${P}\\div ${e2}=${w2}$.`,
            internal
              ? `The chord is the part inside the circle: whole minus outside part. $CD=PD-PC=${w2}-${e2}=${w2 - e2}$, so chord $\\overline{CD}$ is ${w2 - e2} long.`
              : `The whole secant $\\overline{PD}$ is ${w2} long.`,
          ],
          choices,
        },
      };
    }
    if (tag.startsWith("tangent-secant")) {
      const t = r(3, 14);
      const options = divisors(t * t).filter((x) => x < t);
      const e = pick(r, options);
      const w = (t * t) / e;
      if (w - e < 1 || w > 60) continue;
      const kind = tag.slice("tangent-secant-".length);
      const correct =
        kind === "whole"
          ? String(w)
          : kind === "tangent"
            ? String(t)
            : String(w - e);
      const wrong: Option[] =
        kind === "whole"
          ? [
              [
                String(t * e),
                "This multiplies the tangent and the outside part. The tangent is squared: $PT^2=PA\\cdot PB$.",
              ],
              [
                String(t * t),
                "That is $PT^2$. Divide by the outside part $PA$ to find the whole secant $PB$.",
              ],
              [
                String(t * t - e),
                "This subtracts instead of dividing by the outside part.",
              ],
              [
                String(w - e),
                "That is the chord inside the circle. The product uses the whole secant $PB$.",
              ],
            ]
          : kind === "tangent"
            ? [
                [String(e * w), "This is $PT^2$. Take its square root."],
                [
                  rational(e + w, 2),
                  "The tangent is the geometric mean of the outside part and whole secant, not their average.",
                ],
                [
                  String(w - e),
                  "That is the chord. The tangent squared equals outside part times whole secant.",
                ],
                [String(w), "That is the whole secant, not the tangent."],
              ]
            : [
                [
                  String(w),
                  "That is the whole secant $PB$. The chord is $PB-PA$.",
                ],
                [
                  rational(t * t, w - e),
                  "The product uses the whole secant, not the inside chord.",
                ],
                [String(t * t - e), "This subtracts instead of dividing."],
                [
                  String(t * e),
                  "This multiplies the tangent and the outside part.",
                ],
              ];
      const choices = choose(correct, wrong);
      if (!choices) continue;
      const given =
        kind === "tangent"
          ? `$PA=${e}$ and $PB=${w}$`
          : `$PT=${t}$ and $PA=${e}$`;
      return {
        tag,
        draft: {
          figure: sceneFigure(
            tangentSecantFigure(
              kind === "whole"
                ? { tangent: String(t), outside: String(e), whole: null }
                : kind === "tangent"
                  ? { tangent: null, outside: String(e), whole: String(w) }
                  : { tangent: String(t), outside: String(e), chord: null },
            ),
          ),
          prompt: `From an external point $P$, $\\overline{PT}$ is tangent to a circle at $T$, and a secant from $P$ meets the circle at $A$ and then $B$. ${given}. ${kind === "whole" ? "What is the length of $\\overline{PB}$?" : kind === "tangent" ? "What is the length of $\\overline{PT}$?" : "What is the length of chord $\\overline{AB}$?"}`,
          answer: "",
          hint:
            kind === "tangent"
              ? `A tangent segment squared equals the outside part of a secant times the whole secant. Multiply ${e} and ${w}.`
              : `A tangent segment squared equals the outside part of a secant times the whole secant. Start with $PT^2$ using ${t}.`,
          explanation: [
            `A tangent touches a circle at exactly one point, here $T$. A secant cuts through the circle at two points, here $A$ and $B$.`,
            `From one outside point, the tangent squared equals the secant's outside part times its whole length: $PT^2=PA\\cdot PB$.`,
            kind === "tangent"
              ? `Substitute: $PT^2=${e}\\cdot ${w}=${e * w}$. Take the square root: $PT=${t}$.`
              : `Substitute: $${t}^2=${e}\\cdot PB$, so $${t * t}=${e}\\cdot PB$. Divide by ${e}: $PB=${t * t}\\div ${e}=${w}$.`,
            kind === "chord"
              ? `The chord is the part inside the circle: $AB=PB-PA=${w}-${e}=${w - e}$. So $\\overline{AB}$ is ${w - e} long.`
              : kind === "whole"
                ? `The whole secant $\\overline{PB}$ is ${w} long.`
                : `The tangent segment $\\overline{PT}$ is ${t} long.`,
          ],
          choices,
        },
      };
    }
    // Tangent slope: perpendicular to the radius at the point of tangency.
    const [dx0, dy0] = pick(r, triples);
    const h = r(-6, 6),
      k = r(-6, 6);
    let X = dx0 * pick(r, [1, -1]),
      Y = dy0 * pick(r, [1, -1]);
    const axis = tag === "tangent-slope-axis";
    const radius = Math.round(Math.hypot(X, Y));
    if (axis) {
      if (r(0, 1)) {
        X = radius * pick(r, [1, -1]);
        Y = 0;
      } else {
        X = 0;
        Y = radius * pick(r, [1, -1]);
      }
    }
    const P = [h + X, k + Y] as const;
    const slopeText = (n: number, d: number) =>
      d === 0 ? "undefined" : ratTex(d < 0 ? -n : n, Math.abs(d));
    const ans = slopeText(-X, Y);
    const wrong: Option[] = axis
      ? [
          [
            slopeText(Y, X),
            "This is the slope of the radius. The tangent is perpendicular to the radius.",
          ],
          [
            tex("1"),
            "A slope of 1 would not be perpendicular to a horizontal or vertical radius.",
          ],
          [
            tex("-1"),
            "A slope of −1 would not be perpendicular to a horizontal or vertical radius.",
          ],
        ]
      : [
          [
            slopeText(Y, X),
            "This is the slope of the radius. The tangent is perpendicular to the radius, so take the negative reciprocal.",
          ],
          [
            slopeText(X, Y),
            "This is the reciprocal of the radius slope but with the wrong sign. Perpendicular slopes have opposite signs.",
          ],
          [
            slopeText(-Y, X),
            "This negates the radius slope but does not take the reciprocal.",
          ],
        ];
    const choices = choose(
      ans,
      axis
        ? [
            ...wrong,
            [
              tex("2"),
              "Neither a vertical nor a horizontal line has a slope of 2.",
            ],
          ]
        : wrong,
    );
    if (!choices) continue;
    return {
      tag: axis ? "tangent-slope-axis" : "tangent-slope",
      draft: {
        prompt: `In the $xy$-plane, a circle has center $(${sgn(h)},\\ ${sgn(k)})$ and passes through $P(${sgn(P[0])},\\ ${sgn(P[1])})$. What is the slope of the line tangent to the circle at $P$?`,
        answer: "",
        hint: `The tangent at $P(${sgn(P[0])},\\ ${sgn(P[1])})$ is perpendicular to the radius that ends at $P$. First find the slope of that radius using the center $(${sgn(h)},\\ ${sgn(k)})$ and $P$.`,
        explanation: [
          `A tangent line touches the circle at one point, $P$, and makes a right angle with the radius to that point. The radius runs from the center to the circle.`,
          `The radius from the center to $P$ has rise ${Y} (change in $y$) and run ${X} (change in $x$).`,
          axis
            ? `That radius is ${Y === 0 ? "horizontal" : "vertical"}, and the tangent is perpendicular to it, so it is ${Y === 0 ? "vertical" : "horizontal"}.`
            : `The radius's slope, rise over run, is $\\frac{${Y}}{${X}}$. Perpendicular lines have opposite reciprocal slopes: flip the fraction and change the sign.`,
          ans === "undefined"
            ? "The slope of the tangent at $P$ is undefined, because the tangent is a vertical line."
            : `The slope of the tangent at $P$ is ${ans}.`,
        ],
        choices,
      },
    };
  }
}

/* ------------------------------------------------------- frequency tables */
const freqVariants = [
  "freq-mean",
  "freq-median",
  "weighted-mean",
  "combine-groups",
  "add-value-mean",
  "remove-value-mean",
  "add-value-effect",
] as const;
type Dist = { values: number[]; freq: number[] };
const countOf = (d: Dist) => d.freq.reduce((a, b) => a + b, 0);
const totalOf = (d: Dist) =>
  d.values.reduce((a, v, i) => a + v * d.freq[i]!, 0);
function sorted(d: Dist) {
  return d.values.flatMap((v, i) => Array<number>(d.freq[i]!).fill(v));
}
/** Twice the median, an integer, so comparisons stay exact. */
function twiceMedian(xs: number[]) {
  const n = xs.length;
  return n % 2 ? 2 * xs[(n - 1) / 2]! : xs[n / 2 - 1]! + xs[n / 2]!;
}
const fmtHalf = (twice: number) => shown(twice, 2);
function freqFigure(d: Dist, corner: string) {
  return {
    kind: "scene" as const,
    scene: table({
      id: "t",
      corner,
      columns: ["Frequency"],
      rows: d.values.map((v, i) => ({ label: String(v), cells: [d.freq[i]!] })),
    }).scene({ title: "Frequency table" }),
  };
}
const contexts = [
  { corner: "Score", noun: "quiz scores" },
  { corner: "Pets", noun: "numbers of pets" },
  { corner: "Books", noun: "numbers of books read" },
  { corner: "Goals", noun: "numbers of goals scored" },
] as const;
function distribution(r: Random, minK: number, maxK: number): Dist {
  const k = r(minK, maxK);
  const start = r(0, 6);
  const step = pick(r, [1, 1, 2]);
  return {
    values: Array.from({ length: k }, (_, i) => start + i * step),
    freq: Array.from({ length: k }, () => r(1, 9)),
  };
}
function freqCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, freqVariants);
  for (;;) {
    const ctx = pick(r, contexts);
    if (tag === "freq-mean") {
      const d = distribution(r, 4, 6);
      const n = countOf(d),
        T = totalOf(d);
      if ((2 * T) % n !== 0) continue;
      const mean = dec(T, n);
      const choices = choose(mean, [
        [
          dec(
            d.values.reduce((a, b) => a + b, 0),
            d.values.length,
          ),
          "This averages the listed values and ignores how often each occurs. Weight each value by its frequency.",
        ],
        [
          dec(T, 1),
          "This is the sum of all the data values. Divide by the number of data values, the total frequency.",
        ],
        [
          dec(n, d.values.length),
          "This averages the frequencies, which counts how many data values are in each row, not their size.",
        ],
        [
          dec(T, d.values.length),
          "This divides by the number of rows. Divide by the number of data values, the total frequency.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `The frequency table shows ${ctx.noun} for a group. What is the mean of the data?`,
          figure: freqFigure(d, ctx.corner),
          answer: "",
          hint: `Each value occurs as many times as its frequency. Multiply each value by its frequency, add those products, and also add the frequencies to learn how many data values there are.`,
          explanation: [
            `The mean is the average: add all the data values, then divide by how many there are.`,
            `In a frequency table, the frequency says how many times each value occurs. So a value with frequency 3 is counted 3 times.`,
            `Total of all the data: multiply each value by its frequency and add. ${d.values.map((v, i) => `${v}·${d.freq[i]}`).join(" + ")} = ${T}.`,
            `Number of data values: add the frequencies. ${d.freq.join(" + ")} = ${n}.`,
            `Divide: ${T} ÷ ${n} = ${mean}. The mean of the data is ${mean}.`,
          ],
          choices,
        },
      };
    }
    if (tag === "freq-median") {
      const d = distribution(r, 4, 6);
      const xs = sorted(d),
        n = xs.length;
      const med = fmtHalf(twiceMedian(xs));
      const mean = dec(totalOf(d), n);
      const modeIdx = d.freq.indexOf(Math.max(...d.freq));
      const mid = d.values.length;
      const listedMedian = fmtHalf(
        mid % 2
          ? 2 * d.values[(mid - 1) / 2]!
          : d.values[mid / 2 - 1]! + d.values[mid / 2]!,
      );
      const choices = choose(med, [
        [
          listedMedian,
          "This is the middle of the list of values and ignores the frequencies. The median is the middle of all the data values.",
        ],
        [
          d.values[modeIdx] === undefined ? "0" : String(d.values[modeIdx]),
          "That is the most frequent value, the mode, not the median.",
        ],
        [
          mean,
          "That is the mean. The median is the middle data value when all values are ordered.",
        ],
        [
          dec(d.values[0]! + d.values.at(-1)!, 2),
          "This is halfway between the least and greatest values, not the middle of the ordered data.",
        ],
      ]);
      if (!choices) continue;
      const pos =
        n % 2 ? `the ${(n + 1) / 2}th` : `the ${n / 2}th and ${n / 2 + 1}th`;
      return {
        tag,
        draft: {
          prompt: `The frequency table shows ${ctx.noun} for a group. What is the median of the data?`,
          figure: freqFigure(d, ctx.corner),
          answer: "",
          hint: `There are ${n} data values in all. Decide which position${n % 2 ? "" : "s"} in the ordered list hold${n % 2 ? "s" : ""} the middle, then add frequencies from the smallest value until you reach ${n % 2 ? "it" : "them"}.`,
          explanation: [
            `The median is the middle value when all the data are listed in order. The frequency says how many times each value appears.`,
            `Adding the frequencies gives ${n} data values, so the median is ${pos} value in order${n % 2 ? "" : ", averaged"}.`,
            `Running totals of the frequencies: ${d.values
              .map(
                (v, i) =>
                  `${v}: ${d.freq.slice(0, i + 1).reduce((a, b) => a + b, 0)}`,
              )
              .join(", ")}.`,
            `A running total counts how many values are at or below each value, so it shows where each position lands. ${pos.replace("the ", "The ")}${n % 2 ? " value is" : " values are"} ${n % 2 ? med : `${xs[n / 2 - 1]} and ${xs[n / 2]}`}.`,
            `The median of the data is ${med}.`,
          ],
          choices,
        },
      };
    }
    if (tag === "weighted-mean") {
      const wts = pick(r, [
        [50, 30, 20],
        [40, 40, 20],
        [60, 25, 15],
        [30, 30, 40],
        [50, 25, 25],
      ] as const);
      const sc = [r(6, 19) * 5, r(6, 19) * 5, r(6, 19) * 5];
      const T = sc[0]! * wts[0] + sc[1]! * wts[1] + sc[2]! * wts[2];
      const choices = choose(dec(T, 100), [
        [
          dec(sc[0]! + sc[1]! + sc[2]!, 3),
          "This gives each part the same weight. The parts are worth different percentages of the grade.",
        ],
        [
          String(T),
          "This adds the weighted products without dividing by 100, which scales the percentages.",
        ],
        [
          dec(sc[0]! * wts[2] + sc[1]! * wts[1] + sc[2]! * wts[0], 100),
          "The weights are attached to the wrong scores. Pair each score with its own weight.",
        ],
        [
          dec(sc[0]! * wts[0] + sc[1]! * wts[1], 100),
          "This leaves out the third part of the grade.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `A course grade counts tests for ${wts[0]}%, projects for ${wts[1]}% and homework for ${wts[2]}%. A student's averages are ${sc[0]} on tests, ${sc[1]} on projects and ${sc[2]} on homework. What is the student's course grade?`,
          answer: "",
          hint: `Each average counts in proportion to its percentage: ${wts[0]}%, ${wts[1]}% and ${wts[2]}%. Multiply each average by its percentage written as a decimal, and add the three products.`,
          explanation: [
            `A weighted mean lets some parts count more than others. Each average counts by its percentage, its weight.`,
            `Write each percentage as a decimal (divide by 100) and multiply it by its average: ${sc[0]}(${wts[0] / 100}) + ${sc[1]}(${wts[1] / 100}) + ${sc[2]}(${wts[2] / 100}).`,
            `Multiply and add: ${dec(sc[0]! * wts[0], 100)} + ${dec(sc[1]! * wts[1], 100)} + ${dec(sc[2]! * wts[2], 100)}. The weights add to 100%, so no further dividing is needed.`,
            `The course grade is ${dec(T, 100)}.`,
          ],
          choices,
        },
      };
    }
    if (tag === "combine-groups") {
      const n1 = r(2, 9) * 5,
        n2 = r(2, 9) * 5;
      if (n1 === n2) continue;
      const m1 = r(60, 90),
        m2 = r(60, 90);
      if (m1 === m2) continue;
      const T = n1 * m1 + n2 * m2;
      if ((2 * T) % (n1 + n2) !== 0) continue;
      const choices = choose(dec(T, n1 + n2), [
        [
          dec(m1 + m2, 2),
          "This averages the two means as if the groups were the same size. The larger group should count more.",
        ],
        [
          dec(n1 * m2 + n2 * m1, n1 + n2),
          "The group sizes are attached to the wrong means. Each size weights its own mean.",
        ],
        [
          String(T),
          "This is the combined total. Divide by the total number of students.",
        ],
        [
          dec(T, 2),
          "This divides the combined total by the number of groups. Divide by the number of students.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `One class of ${n1} students has a mean test score of ${m1}. Another class of ${n2} students has a mean test score of ${m2}. What is the mean test score of all ${n1 + n2} students together?`,
          answer: "",
          hint: `A group's total is its size times its mean, such as ${n1} students with mean ${m1}. Find the total score of each class, add them, and then divide by the number of students in both classes.`,
          explanation: [
            `The mean is total ÷ count, so total = mean × count. A bigger class counts more in the combined mean.`,
            `Class totals: ${n1}·${m1} = ${n1 * m1} and ${n2}·${m2} = ${n2 * m2}.`,
            `Combined total: ${n1 * m1} + ${n2 * m2} = ${T}, for ${n1} + ${n2} = ${n1 + n2} students.`,
            `Divide: ${T} ÷ ${n1 + n2} = ${dec(T, n1 + n2)}. The mean test score of all ${n1 + n2} students is ${dec(T, n1 + n2)}.`,
          ],
          choices,
        },
      };
    }
    if (tag === "add-value-mean" || tag === "remove-value-mean") {
      const add = tag === "add-value-mean";
      const n = r(4, 12),
        m = r(20, 60),
        m2 = m + r(-6, 6);
      if (m2 === m) continue;
      // add: new value v makes the new mean m2; remove: v leaves mean m2.
      const v = add ? (n + 1) * m2 - n * m : n * m - (n - 1) * m2;
      if (v < 0 || v > 120 || v === m) continue;
      const choices = choose(String(m2), [
        [
          dec(m + v, 2),
          "This averages the old mean and the new value as if each counted once. The old mean stands for all " +
            n +
            " values.",
        ],
        [
          add ? dec(n * m + v, n) : dec(n * m - v, n),
          "This keeps the old number of values in the divisor. The count changes by one.",
        ],
        [
          String(m),
          "The mean changes unless the " +
            (add ? "added" : "removed") +
            " value equals the mean.",
        ],
        [
          add ? String(n * m + v) : String(n * m - v),
          "This is the new total. Divide by the new number of values.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: add
            ? `A set of ${n} numbers has a mean of ${m}. A new number, ${v}, is added to the set. What is the mean of the new set of ${n + 1} numbers?`
            : `A set of ${n} numbers has a mean of ${m}. One of the numbers, ${v}, is removed. What is the mean of the remaining ${n - 1} numbers?`,
          answer: "",
          hint: `The mean times the number of values gives the total. Find the original total from ${n} and ${m}, ${add ? "add" : "subtract"} ${v}, and divide by the new number of values.`,
          explanation: [
            `The mean is total ÷ count, so total = mean × count. Original total: ${n}·${m} = ${n * m}.`,
            add
              ? `New total: ${n * m} + ${v} = ${n * m + v}, for ${n + 1} numbers.`
              : `Remaining total: ${n * m} − ${v} = ${n * m - v}, for ${n - 1} numbers.`,
            `Divide by the new count: ${add ? n * m + v : n * m - v} ÷ ${add ? n + 1 : n - 1} = ${m2}. The mean of the ${add ? "new set" : "remaining numbers"} is ${m2}.`,
          ],
          choices,
        },
      };
    }
    // add-value-effect: compare mean and median before and after.
    const d = distribution(r, 4, 6);
    const n = countOf(d),
      T = totalOf(d);
    const lo = d.values[0]!,
      hi = d.values.at(-1)!;
    const v = pick(r, [
      hi + pick(r, [1, 5, 12]),
      Math.max(0, lo - pick(r, [1, 3])),
      Math.round(T / n),
      d.values[(d.values.length - 1) >> 1]!,
    ]);
    const xs = sorted(d),
      ys = [...xs, v].sort((a, b) => a - b);
    const cmp = (a: number, b: number) =>
      a > b ? "up" : a < b ? "down" : "same";
    // mean: compare T/n with (T+v)/(n+1) by cross-multiplication.
    const meanDir = cmp((T + v) * n, T * (n + 1));
    const medDir = cmp(twiceMedian(ys), twiceMedian(xs));
    const word = (kind: string, dir: string) =>
      dir === "up"
        ? `The ${kind} increases`
        : dir === "down"
          ? `The ${kind} decreases`
          : `The ${kind} does not change`;
    const label = (a: string, b: string) =>
      `${word("mean", a)}; ${word("median", b).replace("The", "the")}.`;
    const all = (["up", "down", "same"] as const).flatMap((a) =>
      (["up", "down", "same"] as const).map((b) => [a, b] as const),
    );
    const correct = label(meanDir, medDir);
    // Prefer near misses: change one of the two directions.
    const near = all.filter(([a, b]) => (a === meanDir) !== (b === medDir));
    const far = all.filter(([a, b]) => a !== meanDir && b !== medDir);
    const fb = () =>
      `Compute each statistic before and after. The mean goes from ${dec(T, n)} to ${dec(T + v, n + 1)} and the median goes from ${fmtHalf(twiceMedian(xs))} to ${fmtHalf(twiceMedian(ys))}.`;
    const wrong: Option[] = [...near, ...far]
      .filter(([a, b]) => !(a === meanDir && b === medDir))
      .map(([a, b]) => [label(a, b), fb()] as Option);
    const choices = choose(correct, wrong);
    if (!choices) continue;
    return {
      tag,
      draft: {
        prompt: `The frequency table shows ${ctx.noun} for a group. A new data value of ${v} is added to the data. Which statement describes what happens to the mean and the median?`,
        figure: freqFigure(d, ctx.corner),
        answer: "",
        hint: `Compare the new value ${v} with the current mean of ${dec(T, n)}: a value above the mean pulls the mean up and a value below pulls it down. For the median, count how the middle position moves in the ordered data.`,
        explanation: [
          `The mean is the total divided by the count. The median is the middle value when the data are in order.`,
          `Before: ${n} values, total ${T}, mean ${dec(T, n)}; the median is ${fmtHalf(twiceMedian(xs))}.`,
          `After adding ${v}: ${n + 1} values, total ${T + v}, mean ${dec(T + v, n + 1)}; the median is ${fmtHalf(twiceMedian(ys))}.`,
          `${word("mean", meanDir)}, and ${word("median", medDir).replace("The", "the")}.`,
        ],
        choices,
      },
    };
  }
}

/* ---------------------------------------------------------- independence */
const independenceVariants = [
  "independent-group",
  "relation-2x2",
  "expected-both",
  "conditional-meaning",
] as const;
const surveyContexts = [
  {
    title: "Language class",
    ask: "take a language class",
    groups: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
    cols: ["Yes", "No"],
    pop: "students",
  },
  {
    title: "Weekend plans",
    ask: "plan to volunteer",
    groups: ["Ages 18-29", "Ages 30-44", "Ages 45-59", "Ages 60+"],
    cols: ["Yes", "No"],
    pop: "adults",
  },
  {
    title: "Commute",
    ask: "bike to work",
    groups: ["North", "South", "East", "West"],
    cols: ["Yes", "No"],
    pop: "employees",
  },
] as const;
function twoByTwoFigure(
  rows: [string, string],
  cols: [string, string],
  a: number[][],
  title: string,
) {
  const rt = a.map((x) => x[0]! + x[1]!),
    ct = [a[0]![0]! + a[1]![0]!, a[0]![1]! + a[1]![1]!];
  return {
    kind: "scene" as const,
    scene: table({
      id: "t",
      title,
      columns: [cols[0], cols[1], "Total"],
      rows: [
        { label: rows[0], cells: [a[0]![0]!, a[0]![1]!, rt[0]!] },
        { label: rows[1], cells: [a[1]![0]!, a[1]![1]!, rt[1]!] },
        { label: "Total", cells: [ct[0]!, ct[1]!, rt[0]! + rt[1]!] },
      ],
      sums: true,
    }).scene({ title }),
  };
}
const interpretations = [
  {
    all: "surveyed students",
    group: "students",
    A: {
      pred: "play a sport",
      one: "plays a sport",
      neg: "do not play a sport",
      letter: "S",
    },
    B: {
      pred: "are in the band",
      one: "is in the band",
      neg: "are not in the band",
      letter: "B",
    },
  },
  {
    all: "surveyed households",
    group: "households",
    A: {
      pred: "own a car",
      one: "owns a car",
      neg: "do not own a car",
      letter: "C",
    },
    B: {
      pred: "are in the city",
      one: "is in the city",
      neg: "are not in the city",
      letter: "L",
    },
  },
  {
    all: "surveyed customers",
    group: "customers",
    A: {
      pred: "buy a drink",
      one: "buys a drink",
      neg: "do not buy a drink",
      letter: "D",
    },
    B: {
      pred: "order lunch",
      one: "orders lunch",
      neg: "do not order lunch",
      letter: "O",
    },
  },
] as const;
function independenceCase(r: Random): SatGeometryDataCase {
  const tag = pick(r, independenceVariants);
  for (;;) {
    if (tag === "independent-group") {
      const ctx = pick(r, surveyContexts);
      const [num, den] = pick(r, [
        [1, 4],
        [2, 5],
        [1, 3],
        [3, 5],
        [1, 2],
        [3, 4],
      ] as const);
      const m = [r(2, 6), r(2, 6), r(2, 6), r(2, 6)];
      const g = r(0, 3);
      const others = [0, 1, 2, 3].filter((i) => i !== g);
      const d1 = r(1, 3) * pick(r, [1, -1]),
        d2 = r(1, 3) * pick(r, [1, -1]);
      if (d1 + d2 === 0) continue;
      const dev = [d1, d2, -(d1 + d2)];
      const yes = m.map((mi, i) => num * mi);
      others.forEach((i, j) => (yes[i] = yes[i]! + dev[j]!));
      const tot = m.map((mi) => den * mi);
      if (yes.some((y, i) => y < 1 || y > tot[i]! - 1)) continue;
      const share = (i: number) => rational(yes[i]!, tot[i]!);
      const pct = (i: number) => `${((100 * yes[i]!) / tot[i]!).toFixed(1)}%`;
      const overall = yes.reduce((a, b) => a + b, 0);
      const N = tot.reduce((a, b) => a + b, 0);
      if (overall * den !== num * N) continue;
      const choices = choose(
        ctx.groups[g]!,
        others.map((i) => [
          ctx.groups[i]!,
          `In ${ctx.groups[i]}, ${pct(i)} answered Yes, while ${((100 * overall) / N).toFixed(1)}% of everyone did. Independence needs those proportions to be equal.`,
        ]) as Option[],
      );
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `${ctx.pop[0]!.toUpperCase()}${ctx.pop.slice(1)} in four groups were asked whether they ${ctx.ask}. The table shows the counts. For which group is belonging to that group independent of answering Yes?`,
          figure: {
            kind: "scene",
            scene: table({
              id: "t",
              title: ctx.title,
              columns: ["Yes", "No", "Total"],
              rows: [
                ...ctx.groups.map((name, i) => ({
                  label: name,
                  cells: [yes[i]!, tot[i]! - yes[i]!, tot[i]!],
                })),
                { label: "Total", cells: [overall, N - overall, N] },
              ],
              sums: true,
            }).scene({ title: ctx.title }),
          },
          answer: "",
          hint: `Two events are independent when the proportion answering Yes within the group equals the proportion answering Yes overall. Find the overall proportion from the Total row, then compare it with each group's proportion.`,
          explanation: [
            `Two events are independent when knowing one does not change the chance of the other.`,
            `So being in a group is independent of answering Yes when that group says Yes at the same rate as everyone.`,
            `Overall, ${overall} of ${N} answered Yes, a proportion (fraction of the whole) of ${rational(overall, N)}.`,
            `Within each group, the Yes proportions are ${ctx.groups.map((name, i) => `${name}: ${share(i)}`).join(", ")}.`,
            `Only ${ctx.groups[g]} matches the overall ${rational(overall, N)}. So being in ${ctx.groups[g]} is independent of answering Yes.`,
          ],
          choices,
        },
      };
    }
    if (tag === "relation-2x2") {
      const rows: [string, string] = ["A", "Not A"];
      const cols: [string, string] = ["B", "Not B"];
      const M = r(1, 3);
      const s = r(1, 3),
        t = r(1, 3),
        x = r(1, 3),
        y = r(1, 3);
      const base = [
        [M * s * x, M * s * y],
        [M * t * x, M * t * y],
      ];
      const kind = pick(r, ["same", "same", "up", "down"] as const);
      const delta =
        kind === "same"
          ? 0
          : (kind === "up" ? 1 : -1) * r(1, Math.min(M * s * y, M * t * x));
      const tab = [
        [base[0]![0]! + delta, base[0]![1]! - delta],
        [base[1]![0]! - delta, base[1]![1]! + delta],
      ];
      if (tab.some((row) => row.some((c) => c < 1))) continue;
      const N = tab[0]![0]! + tab[0]![1]! + tab[1]![0]! + tab[1]![1]!;
      const rowA = tab[0]![0]! + tab[0]![1]!,
        colB = tab[0]![0]! + tab[1]![0]!;
      const joint = tab[0]![0]!;
      // P(A|B) = joint/colB versus P(A) = rowA/N, by cross-multiplication.
      const dir =
        joint * N > rowA * colB
          ? "up"
          : joint * N < rowA * colB
            ? "down"
            : "same";
      const text = {
        up: "$P(A\\mid B)>P(A)$, so the events are not independent.",
        down: "$P(A\\mid B)<P(A)$, so the events are not independent.",
        same: "$P(A\\mid B)=P(A)$, so the events are independent.",
      };
      const choices = choose(text[dir], [
        ...(["up", "down", "same"] as const)
          .filter((k) => k !== dir)
          .map(
            (k) =>
              [
                text[k],
                `Here $P(A\\mid B)=\\frac{${joint}}{${colB}}$ and $P(A)=\\frac{${rowA}}{${N}}$, so $P(A\\mid B)$ is ${dir === "same" ? "equal to" : dir === "up" ? "greater than" : "less than"} $P(A)$.`,
              ] as Option,
          ),
        [
          "No person is in both $A$ and $B$, so the events are independent.",
          `The table shows ${joint} people in both $A$ and $B$. Events with no overlap are mutually exclusive, which is a different idea from independence.`,
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `The table shows how ${N} people are classified by two events, $A$ and $B$. Which statement is true?`,
          figure: twoByTwoFigure(rows, cols, tab, "Counts of people"),
          answer: "",
          hint: `Find $P(A\\mid B)$ by restricting to the ${colB} people in column $B$ and counting those also in $A$. Find $P(A)$ from the whole table of ${N} people, and compare the two.`,
          explanation: [
            `$P(A)$ is the probability of $A$ among everyone. $P(A\\mid B)$, read "the probability of $A$ given $B$", is the probability of $A$ among only those with $B$.`,
            `$P(A\\mid B)=\\frac{${joint}}{${colB}}=${rational(joint, colB)}$ and $P(A)=\\frac{${rowA}}{${N}}=${rational(rowA, N)}$.`,
            dir === "same"
              ? "The two proportions are equal, so knowing $B$ does not change the probability of $A$."
              : `They differ (${dir === "up" ? "the conditional proportion is larger" : "the conditional proportion is smaller"}), so knowing $B$ changes the probability of $A$.`,
            text[dir].replace("so the events", "so the events"),
          ],
          choices,
        },
      };
    }
    if (tag === "expected-both") {
      const useCount = r(0, 1) === 1;
      if (useCount) {
        const N = pick(r, [100, 120, 150, 200, 250, 300, 400]);
        const nA = r(2, 9) * (N / 20),
          nB = r(2, 9) * (N / 20);
        if (
          !Number.isInteger(nA) ||
          !Number.isInteger(nB) ||
          nA >= N ||
          nB >= N ||
          (nA * nB) % N !== 0
        )
          continue;
        const both = (nA * nB) / N;
        const choices = choose(String(both), [
          [
            String(Math.min(nA, nB)),
            "The count in both would be this large only if one group sat entirely inside the other. Independence multiplies proportions.",
          ],
          [
            String(nA + nB - N),
            "This is the least possible overlap. Independence says the overlap is the product of the proportions times the total.",
          ],
          [
            String(nA * nB),
            "This multiplies counts but does not scale back to the number surveyed. Divide by " +
              N +
              ".",
          ],
          [
            dec(nA + nB, 2),
            "Averaging the two counts does not use independence. Multiply the proportions.",
          ],
        ]);
        if (!choices) continue;
        return {
          tag,
          draft: {
            prompt: `A survey asked ${N} people two questions. ${nA} people answered Yes to question 1 and ${nB} answered Yes to question 2. If the answers to the two questions are independent, how many people are expected to answer Yes to both?`,
            answer: "",
            hint: `Write the share answering Yes to each question as a fraction of ${N}. For independent events the share answering both is the product of those two shares; then convert back to a count.`,
            explanation: [
              `Independent means one answer does not change the chance of the other.`,
              `The probability of Yes to each question: $P(\\text{Yes to 1})=\\frac{${nA}}{${N}}$ and $P(\\text{Yes to 2})=\\frac{${nB}}{${N}}$.`,
              `For independent events, the chance of both is the product of the chances: $P(\\text{both})=\\frac{${nA}}{${N}}\\cdot\\frac{${nB}}{${N}}$.`,
              `Multiply by the ${N} people to turn a probability into a count: ${N}·that product = ${nA}·${nB} ÷ ${N} = ${both}.`,
              `So ${both} people would be expected to answer Yes to both.`,
            ],
            choices,
          },
        };
      }
      const pa = pick(r, [10, 20, 25, 40, 50, 60]),
        pb = pick(r, [10, 20, 25, 40, 50]);
      const joint = (pa * pb) / 100;
      const fmt = (x: number) => `${Number(x.toFixed(2))}%`;
      const choices = choose(fmt(joint), [
        [
          fmt(pa + pb),
          "Adding gives the chance of A or B when they cannot overlap. Independent events multiply.",
        ],
        [
          fmt(Math.min(pa, pb)),
          "This would be the overlap if the smaller group sat inside the larger. Independence multiplies the probabilities.",
        ],
        [
          fmt((pa * pb) / 10),
          "Convert the percents to decimals before multiplying: the product of two percents is a percent of a percent.",
        ],
        [
          fmt(Math.abs(pa - pb)),
          "Subtracting does not use independence. Multiply the probabilities.",
        ],
      ]);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `Events $A$ and $B$ are independent. $P(A)=${pa}\\%$ and $P(B)=${pb}\\%$. What is $P(A\\text{ and }B)$?`,
          answer: "",
          hint: `Independence means knowing one event gives no information about the other. Write $P(A)=${pa}\\%$ and $P(B)=${pb}\\%$ as decimals and use the product rule for independent events.`,
          explanation: [
            `Independent events do not affect each other's chances.`,
            `For independent events, the probability of both is the product: $P(A\\text{ and }B)=P(A)\\cdot P(B)$.`,
            `Write the percents as decimals and multiply: $${pa / 100}\\times ${pb / 100}=${Number(((pa * pb) / 10000).toFixed(4))}$.`,
            `The probability that both happen is ${fmt(joint)}.`,
          ],
          choices,
        },
      };
    }
    // conditional-meaning
    const c = pick(r, interpretations);
    const swap = r(0, 1) === 1;
    const X = swap ? c.B : c.A,
      Y = swap ? c.A : c.B;
    const p = pick(r, [20, 30, 35, 40, 60, 65, 75]);
    const choices = choose(`Among ${c.all} who ${Y.pred}, ${p}% ${X.pred}.`, [
      [
        `Among ${c.all} who ${X.pred}, ${p}% ${Y.pred}.`,
        `This reverses the condition. In $P(${X.letter}\\mid ${Y.letter})$ the event after the bar is the group being considered.`,
      ],
      [
        `${p}% of all ${c.all} ${Y.pred} and ${X.pred}.`,
        "This describes a joint probability, a share of everyone. A conditional probability is a share of the group named after the bar.",
      ],
      [
        `Among ${c.all} who ${Y.neg}, ${p}% ${X.pred}.`,
        `This describes the complement of the condition. The condition is that they ${Y.pred}.`,
      ],
    ]);
    if (!choices) continue;
    return {
      tag,
      draft: {
        prompt: `In a survey of ${c.group}, let $${c.A.letter}$ be the event that a randomly selected respondent ${c.A.one}, and let $${c.B.letter}$ be the event that the respondent ${c.B.one}. It is known that $P(${X.letter}\\mid ${Y.letter})=${p / 100}$. Which statement correctly interprets this probability?`,
        answer: "",
        hint: `In $P(${X.letter}\\mid ${Y.letter})$, the event after the bar is the condition: first restrict attention to the respondents for whom $${Y.letter}$ is true. Then ask what share of that restricted group has $${X.letter}$; the given probability is ${p / 100}.`,
        explanation: [
          `A conditional probability is a chance within a smaller group. The vertical bar reads "given that".`,
          `The event after the bar, $${Y.letter}$, names the group: ${c.all} who ${Y.pred}.`,
          `The probability ${p / 100}, or ${p}%, is the share of that group for whom $${X.letter}$ happens.`,
          `So the correct reading is: among ${c.all} who ${Y.pred}, ${p}% ${X.pred}.`,
        ],
        choices,
      },
    };
  }
}

const builders: Record<string, (r: Random) => SatGeometryDataCase> = {
  "trig-context-triangle": trigCase,
  "midpoint-endpoint": midpointCase,
  "space-diagonal": spaceCase,
  "circle-segment-lengths": circleSegmentCase,
  "frequency-table-center": freqCase,
  "independence-test": independenceCase,
};

export function satGeometryDataCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tag: string } {
  const meta = satGeometryDataTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown SAT geometry and data family");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const built = builders[id]!(r);
  return { problem: assemble(meta, seed, r, built.draft), tag: built.tag };
}
export function generateSatGeometryDataProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return satGeometryDataCase(id, seed).problem;
}
