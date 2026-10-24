import type { TemplateMetadata } from "./contracts";
import { assemble, seeded, pick, shuffle, gcd } from "./algebra-one-kit";
import type { Random } from "./algebra-one-kit";

/** Choice-task families for geometric proof, definition and construction
 * skills. AMP cannot grade written proofs or drawn constructions, so each
 * family asks for the reasoning such work needs: a justification, the next
 * step, a property, or a numeric consequence. */

type Wrong = [label: string, feedback: string];
export type ProofVariant = {
  tag: string;
  label: string;
  prompt: string;
  correct: string;
  wrong: Wrong[];
  hint: string;
  explanation: string[];
  /** Private numeric facts used by independent checks. */
  model?: Record<string, unknown>;
};
type Family = {
  meta: Omit<
    TemplateMetadata,
    "version" | "gradeBand" | "requiredResponseCapability"
  >;
  variants: ((r: Random) => ProofVariant)[];
};

const m = (v: number | string) => `$${v}$`;
const deg = (v: number) => `$${v}^\\circ$`;
const dg = (v: number) => `${v}^\\circ`;
/** ax+b with ASCII signs for use inside math. */
const lin = (a: number, b: number) => {
  const t = `${a === 1 ? "" : a}x`;
  return b === 0 ? t : `${t}${b < 0 ? "-" : "+"}${Math.abs(b)}`;
};
const frac = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  const [a, b] = [n / g, d / g];
  return b === 1 ? `${a}` : `\\frac{${a}}{${b}}`;
};
const pt = (p: readonly [number, number]) => `(${p[0]},${p[1]})`;
const R = (r: Random, items: readonly number[]) => pick(r, items);

/* ───────────── 1. line-angle-proofs ───────────── */
const lineReasons = {
  alt: "Alternate interior angles formed by a transversal of parallel lines are congruent.",
  bis: "Every point on the perpendicular bisector of a segment is equidistant from the segment's endpoints.",
  conv: "A point equidistant from a segment's endpoints lies on the segment's perpendicular bisector.",
  vert: "Vertical angles are congruent.",
  corr: "Corresponding angles formed by a transversal of parallel lines are congruent.",
  lin: "Angles that form a linear pair are supplementary.",
};
const lineAngleFamily: Family = {
  meta: {
    id: "line-angle-proof-reasons",
    title: "Justify a line and angle proof step",
    skillId: "line-angle-proofs",
    difficultyOffset: -0.2,
    description:
      "Choose the reason or the equation that a line-and-angle proof step requires: vertical angles, alternate interior angles, or perpendicular bisector points.",
  },
  variants: [
    (r) => {
      const [a, b] = pick(r, [
        [3, 6],
        [4, 5],
      ]);
      return {
        tag: "alternate-interior",
        label: "Reason for the proof step",
        prompt: `Lines $\\ell$ and $m$ are parallel. Transversal $t$ crosses both. Angles ${a} and ${b} lie between $\\ell$ and $m$, on opposite sides of $t$. A proof states $m\\angle ${a} = m\\angle ${b}$. Which reason justifies this step?`,
        correct: lineReasons.alt,
        wrong: [
          [
            lineReasons.corr,
            "Corresponding angles occupy matching positions at the two crossings. These angles are between the lines on opposite sides of the transversal.",
          ],
          [
            lineReasons.vert,
            "Vertical angles are opposite each other at one crossing. These angles are at different crossings.",
          ],
          [
            lineReasons.lin,
            "A linear pair shares a ray and totals $180^\\circ$. These angles are at different crossings and the step claims equality.",
          ],
          [
            lineReasons.bis,
            "That theorem concerns a point on a perpendicular bisector, which this figure does not mention.",
          ],
        ],
        hint: `Find where angles ${a} and ${b} sit relative to the two lines and the transversal: between the lines or outside, same side of $t$ or opposite sides. Then choose the theorem about that position pair.`,
        explanation: [
          `Angles ${a} and ${b} are between the parallel lines $\\ell$ and $m$ and on opposite sides of transversal $t$, so they are alternate interior angles.`,
          `Because $\\ell \\parallel m$, alternate interior angles have equal measures. Reason: ${lineReasons.alt}`,
        ],
      };
    },
    (r) => {
      const [x, y] = pick(r, [
        ["A", "B"],
        ["M", "N"],
        ["R", "S"],
      ]);
      return {
        tag: "bisector-equidistant",
        label: "Reason for the proof step",
        prompt: `Line $\\ell$ is the perpendicular bisector of $\\overline{${x}${y}}$, and point $P$ is on $\\ell$. A proof states $P${x} = P${y}$. Which reason justifies this step?`,
        correct: lineReasons.bis,
        wrong: [
          [
            lineReasons.conv,
            "That is the converse. It would start from equal distances and conclude that $P$ is on the bisector; here the bisector is given and equal distances are the conclusion.",
          ],
          [
            lineReasons.vert,
            "No two lines cross to form opposite angles in this step; the claim compares two lengths.",
          ],
          [
            lineReasons.alt,
            "No parallel lines or transversal are given, and the claim compares two lengths, not two angles.",
          ],
        ],
        hint: `Write what is given about line $\\ell$ and about where $P$ is, then compare it with the claim $P${x}=P${y}$: does the claim start from distances or end with them?`,
        explanation: [
          `$\\ell$ is the perpendicular bisector of $\\overline{${x}${y}}$ and $P$ lies on it, so the given is a position on the bisector.`,
          `The claim is a conclusion about distances to the endpoints. Reason: ${lineReasons.bis}`,
        ],
      };
    },
    (r) => {
      const [x, y] = pick(r, [
        ["A", "B"],
        ["C", "D"],
        ["X", "Y"],
      ]);
      return {
        tag: "equidistant-converse",
        label: "Reason for the proof step",
        prompt: `In a proof, $P${x} = P${y}$ is given. The next step states that $P$ lies on the perpendicular bisector of $\\overline{${x}${y}}$. Which reason justifies this step?`,
        correct: lineReasons.conv,
        wrong: [
          [
            lineReasons.bis,
            "That theorem goes the other way: it starts from a point on the bisector and concludes equal distances. This step starts from equal distances.",
          ],
          [
            lineReasons.vert,
            "The step concerns lengths and a bisector, not opposite angles at a crossing.",
          ],
          [
            lineReasons.corr,
            "No parallel lines or transversal are given, so a corresponding-angle theorem cannot apply.",
          ],
        ],
        hint: `Compare what is given, $P${x}=P${y}$, with what the step concludes. Which theorem begins with that kind of statement?`,
        explanation: [
          `The given is that $P$ is the same distance from ${x} and ${y}.`,
          `The conclusion places $P$ on the perpendicular bisector. Reason: ${lineReasons.conv}`,
        ],
      };
    },
    (r) => {
      const a = R(r, [2, 3, 4]);
      const c = a + R(r, [1, 2, 3]);
      const x0 = r(8, 20);
      const dd = r(1, 20);
      const v = c * x0 - dd;
      const b = v - a * x0;
      const left = lin(a, b);
      const right = lin(c, -dd);
      return {
        tag: "vertical-equation",
        label: "Equation for the proof step",
        prompt: `Lines $AC$ and $BD$ cross at $O$, with $O$ between $A$ and $C$ and between $B$ and $D$. Angle $AOB$ measures $(${left})^\\circ$ and angle $COD$ measures $(${right})^\\circ$. Which equation does the vertical angles theorem justify?`,
        correct: m(`${left}=${right}`),
        wrong: [
          [
            m(`${left}+${right}=180`),
            "That treats the angles as a linear pair. Angles $AOB$ and $COD$ are opposite each other, not adjacent.",
          ],
          [
            m(`${left}+${right}=90`),
            "That treats the angles as complementary, which the figure does not state.",
          ],
          [
            m(`${left}+${right}=360`),
            "The four angles around $O$ total $360^\\circ$, but only two of them are named here.",
          ],
        ],
        hint: `Rays $OA$ and $OC$ are opposite, and so are $OB$ and $OD$. Decide whether angles $AOB$ and $COD$ are opposite angles at $O$ or share a side.`,
        explanation: [
          `Angles $AOB$ and $COD$ are formed by opposite rays, so they are vertical angles and have equal measures: $${left}=${right}$.`,
          `Subtracting $${a}x$ from both sides and solving gives $x=${x0}$, so each angle measures $${v}^\\circ$.`,
        ],
        model: { a, b, c, d: -dd, x0, v },
      };
    },
  ],
};

/* ───────────── 2. triangle-proofs ───────────── */
const triangleProofFamily: Family = {
  meta: {
    id: "triangle-theorem-consequences",
    title: "Use a triangle theorem in a proof",
    skillId: "triangle-proofs",
    difficultyOffset: 0,
    description:
      "Choose the numeric consequence or the justification of a step in triangle proofs: isosceles base angles, the midsegment, medians and the angle sum.",
  },
  variants: [
    (r) => {
      let a = 2 * r(10, 44);
      while (a === 60 || a === 72) a = 2 * r(10, 44);
      const b = (180 - a) / 2;
      return {
        tag: "base-angles",
        label: "Angle measure",
        prompt: `In triangle $ABC$, $AB = AC$ and $m\\angle A = ${dg(a)}$. What is $m\\angle B$?`,
        correct: deg(b),
        wrong: [
          [
            deg(180 - a),
            "That is the total of the two base angles. Base angles of an isosceles triangle are congruent, so each is half of it.",
          ],
          [
            deg(a),
            "$\\angle A$ is the apex angle. $\\angle B$ is a base angle.",
          ],
          [
            deg(180 - 2 * a),
            "That treats $\\angle A$ as one of two congruent base angles. The congruent base angles are $\\angle B$ and $\\angle C$, opposite the equal sides.",
          ],
          [deg(a / 2), "Halve the sum of the base angles, not the apex angle."],
        ],
        hint: `Sides $AB$ and $AC$ are equal, so find which two angles are opposite them. The angle sum of the triangle is $180^\\circ$, and $\\angle A$ is already given as ${dg(a)}$.`,
        explanation: [
          `Since $AB=AC$, the angles opposite them, $\\angle C$ and $\\angle B$, are congruent (base angles of an isosceles triangle).`,
          `The angles sum to $180^\\circ$, so $m\\angle B+m\\angle C=180-${a}=${180 - a}$.`,
          `The two base angles are equal, so $m\\angle B=${180 - a}\\div 2=${b}$.`,
        ],
        model: { apex: a, base: b },
      };
    },
    (r) => {
      const x0 = r(2, 9);
      const p = r(2, 4);
      const q = r(1, 6);
      const s = r(1, 3);
      const c = 2 * p + s;
      const t = p * x0 + q;
      const d = 2 * t - c * x0;
      return {
        tag: "midsegment",
        label: "Length",
        prompt: `In triangle $ABC$, $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$. The length of $\\overline{DE}$ is $${lin(p, q)}$ and the length of $\\overline{BC}$ is $${lin(c, d)}$ (same units). What is $BC$?`,
        correct: m(2 * t),
        wrong: [
          [
            m(t),
            "That is the length of $DE$. The midsegment is half as long as the third side, so $BC$ is twice $DE$.",
          ],
          [
            m(3 * t),
            "The midsegment is half of the third side, not one third.",
          ],
          [m(4 * t), "Double $DE$ once, not twice."],
          [m(x0), "That is the value of $x$, not the length of $BC$."],
        ],
        hint: `$\\overline{DE}$ joins the midpoints of two sides, so it is a midsegment. Write the relationship between $DE$ and $BC$, then use it to find $x$ before computing the length of $BC$.`,
        explanation: [
          `A midsegment is parallel to the third side and half as long, so $BC=2\\cdot DE$.`,
          `Set $${lin(c, d)}=2(${lin(p, q)})$ and solve: $x=${x0}$.`,
          `Then $DE=${t}$ and $BC=2\\cdot ${t}=${2 * t}$.`,
        ],
        model: { p, q, c, d, x0, de: t, bc: 2 * t },
      };
    },
    (r) => {
      const k = r(2, 12);
      const full = 3 * k;
      const ask = r(0, 1);
      const [givenName, givenValue, wantName, correct, wrongs] = ask
        ? ["AM", full, "AG", 2 * k, [k, full / 2, (3 * full) / 4, full]]
        : [
            "GM",
            k,
            "AM",
            3 * k,
            [2 * k, k / 2 === Math.floor(k / 2) ? k / 2 : k + 1, 4 * k, k + 2],
          ];
      return {
        tag: "median-ratio",
        label: "Length",
        prompt: `The medians of triangle $ABC$ meet at $G$. $M$ is the midpoint of $\\overline{BC}$, so $\\overline{AM}$ is a median and $G$ lies on it between $A$ and $M$. $${givenName}=${givenValue}$. What is $${wantName}$?`,
        correct: m(correct as number),
        wrong: (wrongs as number[]).map(
          (v) =>
            [
              m(v),
              "The medians meet at a point that splits each median into two parts in the ratio $2:1$, with the longer part next to the vertex.",
            ] as Wrong,
        ),
        hint: `$G$ is where the medians meet. Split the median $AM$ into $AG$ and $GM$, and use the ratio in which $G$ divides it, starting from $${givenName}=${givenValue}$.`,
        explanation: [
          `The medians meet at $G$, which divides each median in the ratio $2:1$ from the vertex: $AG=2\\cdot GM$, so $AM=3\\cdot GM$.`,
          ask
            ? `$GM=${full}\\div 3=${k}$, so $AG=2\\cdot ${k}=${2 * k}$.`
            : `$AM=3\\cdot ${k}=${3 * k}$.`,
        ],
        model: { ask, k, full },
      };
    },
    () => {
      const reasons = {
        alt: "Alternate interior angles formed by a transversal of parallel lines are congruent.",
        corr: "Corresponding angles formed by a transversal of parallel lines are congruent.",
        vert: "Vertical angles are congruent.",
        iso: "Base angles of an isosceles triangle are congruent.",
      };
      return {
        tag: "angle-sum-step",
        label: "Reason for the proof step",
        prompt: `A proof that the angles of triangle $ABC$ sum to $180^\\circ$ draws line $\\ell$ through $C$ parallel to $\\overline{AB}$. Let $A'$ be a point on $\\ell$ on the same side of $C$ as $A$. The proof then states $m\\angle A'CA = m\\angle CAB$. Which reason justifies this step?`,
        correct: reasons.alt,
        wrong: [
          [
            reasons.corr,
            "Corresponding angles occupy matching positions. Here line $AC$ crosses the parallel lines and the angles lie between them on opposite sides, so they are alternate interior angles.",
          ],
          [
            reasons.vert,
            "These angles are at different points, $C$ and $A$, so they are not opposite angles at one crossing.",
          ],
          [
            reasons.iso,
            "The proof has not stated that any two sides of the triangle are equal.",
          ],
        ],
        hint: `Line $AC$ crosses the two parallel lines $\\ell$ and $AB$. Look at where the two angles lie: between the lines or outside, and on the same or opposite sides of line $AC$.`,
        explanation: [
          `Line $AC$ is a transversal of the parallel lines $\\ell$ and $AB$. Angles $A'CA$ and $CAB$ lie between those lines on opposite sides of $AC$.`,
          `They are alternate interior angles, so ${reasons.alt.toLowerCase()}`,
        ],
      };
    },
  ],
};

/* ───────────── 3. parallelogram-proofs ───────────── */
const pReasons = {
  bisect: "The diagonals of a parallelogram bisect each other.",
  opAngles: "Opposite angles of a parallelogram are congruent.",
  opSides: "Opposite sides of a parallelogram are congruent.",
  rectDiag: "The diagonals of a rectangle are congruent.",
};
const parallelogramFamily: Family = {
  meta: {
    id: "parallelogram-property-consequences",
    title: "Use parallelogram and rectangle theorems",
    skillId: "parallelogram-proofs",
    difficultyOffset: 0.1,
    description:
      "Choose the reason for a parallelogram or rectangle proof step, or the numeric consequence of its diagonal and angle properties.",
  },
  variants: [
    (r) => {
      const kind = pick(r, [
        "bisect",
        "opAngles",
        "opSides",
        "rectDiag",
      ] as const);
      const info = {
        bisect: [
          "$ABCD$ is a parallelogram whose diagonals meet at $E$. A proof states $AE = EC$.",
          "Check which segments are named: $A$, $E$ and $C$ lie on one diagonal, and $E$ is where the diagonals cross.",
          "$\\overline{AC}$ is a diagonal and $E$ is the point where the diagonals meet. $AE=EC$ says that $E$ is the midpoint, so the diagonals bisect each other.",
        ],
        opAngles: [
          "$ABCD$ is a parallelogram. A proof states $m\\angle A = m\\angle C$.",
          "Name the vertices in order around the figure and decide whether $\\angle A$ and $\\angle C$ are adjacent or opposite.",
          "Vertices $A$ and $C$ are opposite corners of $ABCD$, so $\\angle A$ and $\\angle C$ are opposite angles.",
        ],
        opSides: [
          "$ABCD$ is a parallelogram. A proof states $AB = DC$.",
          "Name the sides in order around the figure and decide whether $\\overline{AB}$ and $\\overline{DC}$ share an endpoint.",
          "$\\overline{AB}$ and $\\overline{DC}$ share no endpoint, so they are opposite sides.",
        ],
        rectDiag: [
          "$ABCD$ is a rectangle. A proof states $AC = BD$.",
          "$\\overline{AC}$ and $\\overline{BD}$ join opposite corners. Check which given figure type makes this claim true.",
          "$\\overline{AC}$ and $\\overline{BD}$ are the two diagonals, and the figure is given as a rectangle, a special parallelogram.",
        ],
      }[kind];
      return {
        tag: `reason-${kind}`,
        label: "Reason for the proof step",
        prompt: `${info[0]} Which reason justifies this step?`,
        correct: pReasons[kind],
        wrong: (Object.keys(pReasons) as (keyof typeof pReasons)[])
          .filter((k) => k !== kind)
          .map(
            (k) =>
              [
                pReasons[k],
                kind === "rectDiag" && k !== "rectDiag"
                  ? "That is true of every parallelogram, but it does not give equal diagonals. Equal diagonals need the rectangle property."
                  : "That theorem is true, but its conclusion is about a different part of the figure than this step.",
              ] as Wrong,
          ),
        hint: info[1],
        explanation: [info[2], `Reason: ${pReasons[kind]}`],
      };
    },
    (r) => {
      const x0 = r(2, 9);
      const p = r(2, 5);
      let c = r(2, 5);
      while (c === p) c = r(2, 5);
      const t = r(3, 18);
      const q = t - p * x0;
      const d = t - c * x0;
      return {
        tag: "diagonal-halves",
        label: "Length",
        prompt: `Diagonals $\\overline{AC}$ and $\\overline{BD}$ of parallelogram $ABCD$ meet at $E$. $AE=${lin(p, q)}$ and $EC=${lin(c, d)}$ (same units). What is $AC$?`,
        correct: m(2 * t),
        wrong: [
          [m(t), "That is only $AE$. $AC=AE+EC$, and $E$ is the midpoint."],
          [
            m(3 * t),
            "$AC$ is $AE$ plus $EC$, which are equal, so it is twice $AE$.",
          ],
          [m(x0), "That is the value of $x$, not the length of $AC$."],
          [m(4 * t), "Add $AE$ and $EC$ once; do not double the sum."],
        ],
        hint: `The diagonals of a parallelogram meet at $E$. Write the relationship between $AE$ and $EC$ as an equation, solve for $x$, and only then find $AC$.`,
        explanation: [
          `The diagonals of a parallelogram bisect each other, so $AE=EC$: $${lin(p, q)}=${lin(c, d)}$.`,
          `Solving gives $x=${x0}$, so $AE=EC=${t}$.`,
          `$AC=AE+EC=${t}+${t}=${2 * t}$.`,
        ],
        model: { p, q, c, d, x0, half: t },
      };
    },
    (r) => {
      const x0 = r(2, 9);
      const p = r(3, 6);
      let c = r(2, 5);
      while (c === p) c = r(2, 5);
      const t = 2 * r(5, 20);
      const q = t - p * x0;
      const d = t - c * x0;
      return {
        tag: "rectangle-diagonals",
        label: "Length",
        prompt: `$ABCD$ is a rectangle with diagonals $AC=${lin(p, q)}$ and $BD=${lin(c, d)}$ (same units). What is $AC$?`,
        correct: m(t),
        wrong: [
          [m(x0), "That is the value of $x$, not the length of $AC$."],
          [
            m(t / 2),
            "That is half a diagonal, which is the distance from a corner to the center.",
          ],
          [m(2 * t), "That adds the two diagonals. Find one diagonal."],
          [
            m(t + 2),
            "Substitute the solved value of $x$ into the expression for $AC$.",
          ],
        ],
        hint: `The figure is a rectangle, so its diagonals $AC$ and $BD$ have a special relationship. Write it as an equation in $x$, solve, then substitute into $AC$.`,
        explanation: [
          `The diagonals of a rectangle are congruent, so $${lin(p, q)}=${lin(c, d)}$.`,
          `Solving gives $x=${x0}$.`,
          `$AC=${p}(${x0})${q < 0 ? "-" : "+"}${Math.abs(q)}=${t}$.`,
        ],
        model: { p, q, c, d, x0, t },
      };
    },
    (r) => {
      const a = R(r, [50, 60, 70, 80, 100, 110, 120, 130]);
      return {
        tag: "consecutive-angles",
        label: "Angle measure",
        prompt: `In parallelogram $ABCD$, $m\\angle A=${dg(a)}$. What is $m\\angle B$?`,
        correct: deg(180 - a),
        wrong: [
          [
            deg(a),
            "$\\angle B$ is adjacent to $\\angle A$. The angle equal to $\\angle A$ is $\\angle C$, its opposite.",
          ],
          [
            deg(360 - a),
            "The four angles total $360^\\circ$, but two angles are determined here, not one.",
          ],
          [
            deg(90),
            "A parallelogram is not necessarily a rectangle; adjacent angles need not be right angles.",
          ],
          [
            deg(Math.abs(a - 90)),
            "Adjacent angles of a parallelogram total $180^\\circ$; they are not complementary.",
          ],
        ],
        hint: `$\\angle A$ and $\\angle B$ share side $\\overline{AB}$. Sides $\\overline{AD}$ and $\\overline{BC}$ are parallel, with $\\overline{AB}$ as a transversal, so look for a relationship between the angles on the same side of $AB$.`,
        explanation: [
          `$\\overline{AD}\\parallel\\overline{BC}$ and $\\overline{AB}$ is a transversal, so consecutive angles $\\angle A$ and $\\angle B$ are supplementary.`,
          `$m\\angle B=180-${a}=${180 - a}$.`,
        ],
        model: { a },
      };
    },
  ],
};

/* ───────────── 4. geometric-definitions ───────────── */
const precise = {
  circle:
    "A circle is the set of all points in a plane that are a given distance from a given point.",
  perpendicular:
    "Two lines are perpendicular when they intersect to form a right angle.",
  parallel: "Two lines in a plane are parallel when they do not intersect.",
  angle: "An angle is formed by two rays that share an endpoint.",
  segment:
    "A line segment is the part of a line consisting of two points, its endpoints, and every point between them.",
  ray: "A ray is the part of a line that starts at one point and extends without end in one direction.",
};
const flawed: [string, string][] = [
  [
    "A circle is the set of all points that are a given distance from a given point.",
    'It omits "in a plane". In space, those points form a sphere.',
  ],
  [
    "Two lines are parallel when they do not intersect.",
    'It omits "in a plane". Skew lines in space never meet and are not parallel.',
  ],
  [
    "An angle is the space between two lines.",
    'An angle is formed by two rays with a common endpoint; two lines have no single vertex and the "space" is not defined.',
  ],
  [
    "A ray is the part of a line between two points.",
    "That describes a segment. A ray has one endpoint and extends without end.",
  ],
  [
    "A circle is the set of all points in a plane that are at most a given distance from a given point.",
    '"At most" includes the interior, so this defines a disk. A circle uses points exactly the given distance away.',
  ],
];
const definitionsFamily: Family = {
  meta: {
    id: "precise-geometric-definitions",
    title: "Choose the precise geometric definition",
    skillId: "geometric-definitions",
    difficultyOffset: -0.5,
    description:
      "Choose the precise definition of an angle, circle, perpendicular or parallel lines, ray or segment, or spot the definition with a missing condition.",
  },
  variants: [
    () => ({
      tag: "define-circle",
      label: "Definition",
      prompt: "Which is the precise definition of a circle?",
      correct: precise.circle,
      wrong: [
        [flawed[0]![0], flawed[0]![1]],
        [flawed[4]![0], flawed[4]![1]],
        [
          "A circle is a closed curve with no corners.",
          "An ellipse is also a closed curve with no corners. A circle needs every point at the same distance from one center.",
        ],
      ],
      hint: "A definition must include every condition and exclude every other shape. Ask whether each choice says where the points lie, how far they are from the center, and whether the inside counts.",
      explanation: [
        "A circle has a center and every point on it is the same distance from that center. To exclude spheres, the points must lie in one plane. To exclude the inside, the distance is exactly the radius.",
        precise.circle,
      ],
    }),
    () => ({
      tag: "define-parallel",
      label: "Definition",
      prompt: "Which is the precise definition of parallel lines?",
      correct: precise.parallel,
      wrong: [
        [flawed[1]![0], flawed[1]![1]],
        [
          "Two lines are parallel when they intersect to form a right angle.",
          "That describes perpendicular lines.",
        ],
        [
          "Two lines are parallel when they intersect at exactly one point.",
          "Lines that meet at exactly one point are intersecting lines. Parallel lines never meet.",
        ],
      ],
      hint: "A definition must include every condition and exclude every other pair of lines. Check whether the choice says where the lines lie.",
      explanation: [
        "In a plane, two distinct lines either meet at one point or never meet. In space, two lines can also miss each other without being parallel, so the definition needs the plane.",
        precise.parallel,
      ],
    }),
    () => ({
      tag: "define-angle-ray",
      label: "Definition",
      prompt: "Which is the precise definition of an angle?",
      correct: precise.angle,
      wrong: [
        [flawed[2]![0], flawed[2]![1]],
        [
          precise.ray,
          "That defines a ray, one side of an angle, not the angle formed by two rays.",
        ],
        [
          "An angle is the distance between two lines.",
          "Distance is a length. An angle compares directions and is measured in degrees.",
        ],
      ],
      hint: "An angle needs a vertex and two sides. Check which choice names exactly those parts.",
      explanation: [
        "An angle has a vertex, the shared endpoint, and two sides, which are rays.",
        precise.angle,
      ],
    }),
    (r) => {
      const [bad, why] = pick(r, flawed);
      const pool = Object.values(precise).filter((d) => d !== bad);
      const good = shuffle(r, pool).slice(0, 3);
      return {
        tag: "spot-flawed",
        label: "Flawed definition",
        prompt:
          "Exactly one of these statements is not a precise definition. Which one?",
        correct: bad,
        wrong: good.map(
          (g) =>
            [
              g,
              "This definition names every needed condition. Look for the statement that omits one or describes a different object.",
            ] as Wrong,
        ),
        hint: "For each statement, ask what shape or object it describes and what else it would also describe. The flawed one fits more than one object or leaves out a condition.",
        explanation: [`Flawed: ${bad}`, why],
      };
    },
  ],
};

/* ───────────── plane-transformation engine (families 5 and 7, 12) ───────────── */
type Pt = [number, number];
type Op =
  | { k: "reflx" | "refly" | "rot90" | "rot270" | "rot180" }
  | { k: "tr"; x: number; y: number }
  | { k: "dil"; fn: number; fd: number; cx: number; cy: number };
const applyOp = (op: Op, [x, y]: Pt): Pt => {
  switch (op.k) {
    case "reflx":
      return [x, -y];
    case "refly":
      return [-x, y];
    case "rot90":
      return [-y, x];
    case "rot270":
      return [y, -x];
    case "rot180":
      return [-x, -y];
    case "tr":
      return [x + op.x, y + op.y];
    case "dil":
      return [
        op.cx + (op.fn * (x - op.cx)) / op.fd,
        op.cy + (op.fn * (y - op.cy)) / op.fd,
      ];
  }
};
const trace = (ops: Op[], p: Pt): Pt[] => {
  const out: Pt[] = [p];
  for (const op of ops) out.push(applyOp(op, out[out.length - 1]!));
  return out;
};
const samePt = (a: Pt, b: Pt) =>
  Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const sv = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
const opText = (op: Op): string => {
  switch (op.k) {
    case "reflx":
      return "reflect across the $x$-axis";
    case "refly":
      return "reflect across the $y$-axis";
    case "rot90":
      return "rotate $90^\\circ$ counterclockwise about the origin";
    case "rot270":
      return "rotate $90^\\circ$ clockwise about the origin";
    case "rot180":
      return "rotate $180^\\circ$ about the origin";
    case "tr":
      return `translate by $\\langle ${sv(op.x)},${sv(op.y)}\\rangle$`;
    case "dil": {
      const f = op.fd === 1 ? `${op.fn}` : `\\frac{${op.fn}}{${op.fd}}`;
      return `dilate by scale factor $${f}$ about ${op.cx === 0 && op.cy === 0 ? "the origin" : `$(${op.cx},${op.cy})$`}`;
    }
  }
};
const seqText = (ops: Op[]) => {
  const t = ops.map(opText).join(", then ");
  return t[0]!.toUpperCase() + t.slice(1);
};
const tr = (x: number, y: number): Op => ({ k: "tr", x, y });
const dil = (fn: number, fd = 1, cx = 0, cy = 0): Op => ({
  k: "dil",
  fn,
  fd,
  cx,
  cy,
});
const rigidKinds = ["reflx", "refly", "rot90", "rot270", "rot180"] as const;
const rigid = (k: (typeof rigidKinds)[number]): Op => ({ k });

/* ───────────── 5. transformation-invariants ───────────── */
const sq = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const transformationInvariantFamily: Family = {
  meta: {
    id: "transformation-invariant-claims",
    title: "Compare what transformations preserve",
    skillId: "transformation-invariants",
    difficultyOffset: 0,
    description:
      "Decide which transformations preserve distance and angle measure, whether a coordinate image is rigid, and what the definitions of dilation and rotation require.",
  },
  variants: [
    (r) => {
      const k = r(2, 4);
      const good = pick(r, [
        "A reflection across a line",
        "A rotation about a point",
        "A translation",
      ]);
      return {
        tag: "which-preserves",
        label: "Transformation",
        prompt:
          "Which transformation preserves both the distance between every pair of points and every angle measure?",
        correct: good,
        wrong: [
          [
            `A dilation with scale factor ${k} about a point`,
            `A dilation keeps angle measures but multiplies every distance by ${k}.`,
          ],
          [
            `The stretch $(x,y)\\to(${k}x,\\,y)$`,
            "A stretch in one direction changes distances between points that are not on a horizontal line, and it changes most angles.",
          ],
          [
            "The shear $(x,y)\\to(x+y,\\,y)$",
            "A shear slides each horizontal line by a different amount. Distances along slanted lines and most angles change.",
          ],
        ],
        hint: "A transformation preserves distance if the image of every segment is as long as the segment. Test each choice on a segment and on a right angle from the corner of a square.",
        explanation: [
          "Translations, rotations and reflections are rigid motions: they move every figure without changing any length or angle.",
          `A dilation changes lengths. A stretch or shear changes lengths and angles. So the answer is: ${good.toLowerCase()}.`,
        ],
      };
    },
    (r) => {
      const [a, b] = pick(r, [
        [3, 4],
        [4, 3],
        [6, 8],
        [5, 12],
      ]) as Pt;
      const P: Pt = [r(-3, 2), r(-3, 2)];
      const Q: Pt = [P[0] + a, P[1]];
      const Rr: Pt = [P[0], P[1] + b];
      const kind = pick(r, ["rigid", "dilation", "stretch"] as const);
      const k = r(2, 3);
      const op: Op[] =
        kind === "rigid"
          ? [
              pick(r, [
                rigid("reflx"),
                rigid("refly"),
                rigid("rot90"),
                rigid("rot270"),
                tr(r(1, 4), r(-4, -1)),
              ]),
            ]
          : kind === "dilation"
            ? [dil(k)]
            : [{ k: "tr", x: 0, y: 0 }];
      const image = (p: Pt): Pt =>
        kind === "stretch" ? [k * p[0], p[1]] : trace(op, p).at(-1)!;
      const [P2, Q2, R2] = [P, Q, Rr].map(image) as [Pt, Pt, Pt];
      const before = [sq(P, Q), sq(Q, Rr), sq(Rr, P)];
      const after = [sq(P2, Q2), sq(Q2, R2), sq(R2, P2)];
      const same = before.every((v, i) => v === after[i]);
      const uniform = after.every(
        (v, i) => v * before[0]! === after[0]! * before[i]!,
      );
      const truth = same ? "rigid" : uniform ? "dilation" : "mixed";
      if (truth !== (kind === "stretch" ? "mixed" : kind))
        throw new Error("transformation classification mismatch");
      const kk = truth === "dilation" ? Math.sqrt(after[0]! / before[0]!) : k;
      const labels = {
        rigid:
          "Yes. All three side lengths are unchanged, so it is a rigid motion.",
        dilation: `No. Every side length is multiplied by ${kk}, so it is a dilation, not a rigid motion.`,
        mixed:
          "No. The side lengths change by different factors, so it is neither a rigid motion nor a dilation.",
        angles:
          "No. The side lengths are unchanged but the angles change, so it is not a rigid motion.",
      };
      const data = `Squared side lengths $PQ^2$, $QR^2$, $RP^2$ are ${before.join(", ")} before and ${after.join(", ")} after.`;
      return {
        tag: `coordinate-${truth}`,
        label: "Conclusion",
        prompt: `Triangle $PQR$ has $P${pt(P)}$, $Q${pt(Q)}$ and $R${pt(Rr)}$. A transformation sends it to $P'Q'R'$ with $P'${pt(P2)}$, $Q'${pt(Q2)}$ and $R'${pt(R2)}$. Is the transformation a rigid motion?`,
        correct: labels[truth],
        wrong: (["rigid", "dilation", "mixed", "angles"] as const)
          .filter((t) => t !== truth)
          .map((t) => [labels[t], data] as Wrong),
        hint: `Compare the side lengths before and after. Use the distance formula on $P${pt(P)}$ and $Q${pt(Q)}$, then on $P'${pt(P2)}$ and $Q'${pt(Q2)}$, and see whether the length changed.`,
        explanation: [
          data,
          truth === "rigid"
            ? "Every side length is unchanged, so the image is congruent to the original and the motion preserves distance."
            : truth === "dilation"
              ? `Every squared length is multiplied by ${kk * kk}, so every length is multiplied by ${kk}. Distances are not preserved.`
              : "The sides change by different factors, so the map does not preserve distance and does not scale the figure uniformly.",
        ],
        model: { P, Q, R: Rr, P2, Q2, R2, truth },
      };
    },
    (r) => {
      const [kText, kN, kD] = pick(r, [
        ["2", 2, 1],
        ["3", 3, 1],
        ["4", 4, 1],
        ["\\frac{1}{2}", 1, 2],
        ["\\frac{1}{3}", 1, 3],
      ]) as [string, number, number];
      const good = `Every distance is multiplied by $${kText}$ and every angle measure stays the same.`;
      return {
        tag: "dilation-facts",
        label: "Statement",
        prompt: `A dilation has scale factor $${kText}$. Which statement is true of the image of a figure?`,
        correct: good,
        wrong: [
          [
            `Every distance and every angle measure stays the same.`,
            "A dilation changes size unless the scale factor is 1.",
          ],
          [
            `Every distance stays the same and every angle measure is multiplied by $${kText}$.`,
            "A dilation does the opposite: lengths scale and angles are preserved.",
          ],
          [
            `Every distance and every angle measure is multiplied by $${kText}$.`,
            "Angle measures are preserved by a dilation, which is why the image is similar to the original.",
          ],
        ],
        hint: `Picture a triangle and its dilation from a center point with scale factor $${kText}$. Compare how far apart two vertices are before and after, and whether the corners open wider or narrower.`,
        explanation: [
          `A dilation about a center with scale factor $${kText}$ multiplies the distance from the center to every point by $${kText}$, so every distance between two image points is $${kText}$ times the original distance.`,
          "Angle measures do not change, so the image has the same shape as the original and is similar to it.",
        ],
      };
    },
    (r) => {
      const t = R(r, [60, 90, 120, 150]);
      return {
        tag: "rotation-definition",
        label: "Definition",
        prompt: `A rotation about point $C$ by $${dg(t)}$ sends point $X$ to point $X'$. Which statement must be true?`,
        correct: `$CX' = CX$ and $m\\angle XCX' = ${dg(t)}$`,
        wrong: [
          [
            `$m\\angle XCX' = ${dg(t)}$, but $CX'$ may be any length`,
            "A rotation keeps each point on a circle around the center, so $CX'$ equals $CX$.",
          ],
          [
            "$C$ is the midpoint of $\\overline{XX'}$",
            "That holds only when the rotation is $180^\\circ$.",
          ],
          [
            "$X'$ is the mirror image of $X$ across a line through $C$",
            "That describes a reflection. A reflection reverses orientation, a rotation does not.",
          ],
        ],
        hint: `Think of $X$ moving along a circle centered at $C$. What stays the same about the distance from $C$, and what measures the turn?`,
        explanation: [
          "A rotation about a center turns every point around the center by the same angle without changing its distance from the center.",
          `So $CX'=CX$ and the angle from ray $CX$ to ray $CX'$ measures $${dg(t)}$.`,
        ],
      };
    },
  ],
};

/* ───────────── 6. polygon-symmetries ───────────── */
const polygonSymmetryFamily: Family = {
  meta: {
    id: "polygon-symmetry-counts",
    title: "Count and describe polygon symmetries",
    skillId: "polygon-symmetries",
    difficultyOffset: 0,
    description:
      "Find the smallest rotation angle, the number of rotations and reflection lines, and the rotations that carry regular polygons, rectangles, parallelograms and trapezoids onto themselves.",
  },
  variants: [
    (r) => {
      const n = R(r, [5, 6, 8, 9, 10, 12]);
      const f = (v: number) => deg(v);
      return {
        tag: "smallest-rotation",
        label: "Angle",
        prompt: `What is the smallest positive angle of rotation about its center that carries a regular polygon with ${n} sides onto itself?`,
        correct: f(360 / n),
        wrong: [
          [
            f(180 / n),
            "That is half the smallest turn; a turn of that size would not line up the vertices.",
          ],
          [
            f(720 / n),
            "That rotation works, but it is two steps; a smaller positive rotation also works.",
          ],
          [
            f(((n - 2) * 180) / n),
            "That is an interior angle of the polygon, not the angle between consecutive vertices as seen from the center.",
          ],
          [
            f(360 - 360 / n),
            "That rotation works but is the largest one, not the smallest.",
          ],
        ],
        hint: `The ${n} vertices are equally spaced around the center. A full turn is $360^\\circ$; how is it shared among ${n} equal gaps?`,
        explanation: [
          `The ${n} vertices are equally spaced around the center, so consecutive vertices are separated by $360^\\circ\\div ${n}$.`,
          `Rotating by ${f(360 / n)} moves each vertex to the next one, so the polygon lands on itself.`,
        ],
      };
    },
    (r) => {
      const figures: {
        name: string;
        lines: number;
        wrong: [number, string][];
      }[] = [
        {
          name: "a rectangle that is not a square",
          lines: 2,
          wrong: [
            [
              4,
              "A rectangle has four sides, but only two lines of reflection: the perpendicular bisectors of its sides.",
            ],
            [
              1,
              "A rectangle has a vertical and a horizontal line of symmetry.",
            ],
            [
              0,
              "A rectangle maps onto itself under reflection across the line through the midpoints of opposite sides.",
            ],
            [
              3,
              "A rectangle that is not a square has exactly two lines of symmetry, not three.",
            ],
          ],
        },
        {
          name: "an isosceles trapezoid",
          lines: 1,
          wrong: [
            [
              0,
              "The line through the midpoints of the two parallel sides is a line of symmetry.",
            ],
            [
              2,
              "Only one line works: reflecting across the line through the other direction would swap the unequal parallel sides.",
            ],
            [
              4,
              "An isosceles trapezoid has four sides, but not four lines of symmetry.",
            ],
            [3, "A quadrilateral with three lines of symmetry does not exist."],
          ],
        },
        {
          name: "a parallelogram that is not a rectangle or a rhombus",
          lines: 0,
          wrong: [
            [
              2,
              "The diagonals are not lines of symmetry unless the parallelogram is a rhombus, and the midlines are not unless it is a rectangle.",
            ],
            [
              1,
              "No reflection line carries a slanted parallelogram onto itself.",
            ],
            [
              4,
              "A parallelogram has four sides, but no line of symmetry when it is slanted and has unequal sides.",
            ],
            [3, "No such figure has three lines of symmetry."],
          ],
        },
        {
          name: "a rhombus that is not a square",
          lines: 2,
          wrong: [
            [4, "Only a square among rhombuses has four lines of symmetry."],
            [1, "Both diagonals are lines of symmetry."],
            [0, "Reflecting across a diagonal carries a rhombus onto itself."],
            [3, "A rhombus that is not a square has two lines of symmetry."],
          ],
        },
      ];
      const n = R(r, [5, 6, 7, 8]);
      const all = [
        ...figures,
        {
          name: `a regular polygon with ${n} sides`,
          lines: n,
          wrong: [
            [
              1,
              "A regular polygon has a line of symmetry through each vertex or side midpoint.",
            ],
            [2 * n, "That counts each line twice, once from each end."],
            [
              n - 1,
              "Count one line for each vertex or side midpoint pair; that gives exactly the number of sides.",
            ],
            [0, "A regular polygon has lines of symmetry."],
          ] as [number, string][],
        },
      ];
      const f = pick(r, all);
      return {
        tag: "reflection-lines",
        label: "Number of lines",
        prompt: `How many lines of reflection carry ${f.name} onto itself?`,
        correct: m(f.lines),
        wrong: f.wrong.map(([v, fb]) => [m(v), fb] as Wrong),
        hint: `Imagine folding ${f.name} along a line so the two halves match exactly. Try lines through opposite vertices, and lines through midpoints of opposite sides.`,
        explanation: [
          `A line of reflection is a line along which the figure can be folded so the halves coincide.`,
          `${f.name[0]!.toUpperCase()}${f.name.slice(1)} has exactly ${f.lines} such ${f.lines === 1 ? "line" : "lines"}.`,
        ],
      };
    },
    (r) => {
      const sets = {
        half: "Only $180^\\circ$",
        square: "$90^\\circ$, $180^\\circ$ and $270^\\circ$",
        none: "None of them",
        hex: "$60^\\circ$, $120^\\circ$, $180^\\circ$, $240^\\circ$ and $300^\\circ$",
      };
      const owner = {
        half: "a rectangle or a parallelogram",
        square: "a square",
        none: "an isosceles trapezoid",
        hex: "a regular hexagon",
      };
      const fig = pick(r, [
        ["a rectangle that is not a square", "half"],
        ["a parallelogram that is not a rectangle", "half"],
        ["a square", "square"],
        ["an isosceles trapezoid that is not a parallelogram", "none"],
        ["a regular hexagon", "hex"],
      ] as const);
      const key = fig[1];
      return {
        tag: `rotations-${key}`,
        label: "Rotations",
        prompt: `Which rotations about its center, with angle greater than $0^\\circ$ and less than $360^\\circ$, carry ${fig[0]} onto itself?`,
        correct: sets[key],
        wrong: (Object.keys(sets) as (keyof typeof sets)[])
          .filter((k) => k !== key)
          .map(
            (k) =>
              [
                sets[k],
                `That list belongs to ${owner[k]}, not to ${fig[0]}.`,
              ] as Wrong,
          ),
        hint: `Rotate ${fig[0]} in steps and ask after each step whether every vertex lands on a vertex and the sides match. Check that each side lands on a side of the same length.`,
        explanation: [
          `A rotation carries the figure onto itself when each vertex lands on a vertex and each side on a side.`,
          `For ${fig[0]} the rotations are: ${sets[key]}.`,
        ],
      };
    },
    (r) => {
      const n = R(r, [5, 6, 8, 9, 10, 12]);
      return {
        tag: "rotation-count",
        label: "Number of rotations",
        prompt: `How many different rotations about its center, with angle at least $0^\\circ$ and less than $360^\\circ$, carry a regular polygon with ${n} sides onto itself? Count the $0^\\circ$ rotation.`,
        correct: m(n),
        wrong: [
          [
            m(n - 1),
            "The $0^\\circ$ rotation also carries the polygon onto itself, and the problem asks to count it.",
          ],
          [
            m(2 * n),
            "That counts reflections as well as rotations. Rotations alone give one per vertex.",
          ],
          [
            m(n + 1),
            "The $360^\\circ$ turn is the same rotation as the $0^\\circ$ turn; count it once.",
          ],
          [
            m(360 / n),
            "That is the angle of the smallest rotation, not the count of rotations.",
          ],
        ],
        hint: `Each rotation moves a fixed vertex to one of the ${n} vertex positions. How many different positions can it reach?`,
        explanation: [
          `A rotation is decided by where it sends one chosen vertex, and that vertex can land on any of the ${n} vertices.`,
          `So there are ${n} rotations: the multiples of $${360 / n}^\\circ$ from $0^\\circ$ through $${360 - 360 / n}^\\circ$.`,
        ],
      };
    },
  ],
};

/* ───────────── 7. transformation-constructions ───────────── */
function sequenceVariant(
  r: Random,
  tag: string,
  correct: Op[],
  pool: Op[][],
): ProofVariant {
  const P: Pt = [r(-3, 2), r(-3, 2)];
  const Q: Pt = [P[0] + 3, P[1]];
  const Rr: Pt = [P[0], P[1] + 2];
  const [P2, Q2, R2] = [P, Q, Rr].map((p) => trace(correct, p).at(-1)!) as [
    Pt,
    Pt,
    Pt,
  ];
  const maps = (ops: Op[]) =>
    [P, Q, Rr].every((p, i) => samePt(trace(ops, p).at(-1)!, [P2, Q2, R2][i]!));
  const label = (ops: Op[]) => seqText(ops) + ".";
  const seen = new Set([label(correct)]);
  const wrong = pool
    .filter((ops) => !maps(ops))
    .filter((ops) => {
      const l = label(ops);
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .map(
      (ops) =>
        [
          label(ops),
          `Apply this to $P${pt(P)}$: it ends at $${pt(trace(ops, P).at(-1)!)}$, but $P'$ is $${pt(P2)}$.`,
        ] as Wrong,
    );
  const path = (p: Pt) =>
    trace(correct, p)
      .map((q) => `$${pt(q)}$`)
      .join(" to ");
  return {
    tag,
    label: "Sequence of transformations",
    prompt: `Triangle $PQR$ has $P${pt(P)}$, $Q${pt(Q)}$ and $R${pt(Rr)}$. Its image $P'Q'R'$ has $P'${pt(P2)}$, $Q'${pt(Q2)}$ and $R'${pt(R2)}$, with each vertex sent to its primed vertex. Which sequence of transformations maps $PQR$ onto $P'Q'R'$?`,
    correct: label(correct),
    wrong,
    hint: `Compare side $\\overline{PQ}$ with $\\overline{P'Q'}$: it goes from $\\langle 3,0\\rangle$ to $\\langle ${sv(Q2[0] - P2[0])},${sv(Q2[1] - P2[1])}\\rangle$. Decide whether its length changed and whether its direction turned or flipped, then account for the shift of $P$.`,
    explanation: [
      `Follow $P$: ${path(P)}. Follow $Q$: ${path(Q)}. These match $P'$ and $Q'$.`,
      `Follow $R$: ${path(Rr)}, which matches $R'$. The sequence is: ${seqText(correct)}.`,
    ],
    model: { P, Q, R: Rr, correct, P2, Q2, R2 },
  };
}
const transformationConstructionFamily: Family = {
  meta: {
    id: "transformation-sequence-mapping",
    title: "Choose the transformations that map one figure to another",
    skillId: "transformation-constructions",
    difficultyOffset: 0.2,
    description:
      "From the coordinates of a triangle and its image, choose the single transformation or ordered sequence of reflections, rotations, translations and dilations that maps one onto the other.",
  },
  variants: [
    (r) => {
      const a = r(1, 5) * (r(0, 1) ? 1 : -1);
      const b = r(1, 5) * (r(0, 1) ? 1 : -1);
      const all: Op[] = [...rigidKinds.map(rigid), tr(a, b)];
      const correct = pick(r, all);
      return sequenceVariant(
        r,
        "single",
        [correct],
        [...all.map((o) => [o]), [tr(b, a)], [tr(-a, -b)], [tr(a, -b)]],
      );
    },
    (r) => {
      const a = r(1, 5) * (r(0, 1) ? 1 : -1);
      const b = r(1, 5) * (r(0, 1) ? 1 : -1);
      const t1 = pick(r, rigidKinds.slice());
      const pool: Op[][] = [
        [tr(a, b), rigid(t1)],
        [rigid(t1), tr(-a, -b)],
        [rigid(t1), tr(b, a)],
        ...rigidKinds.filter((k) => k !== t1).map((k) => [rigid(k), tr(a, b)]),
      ];
      return sequenceVariant(r, "composition", [rigid(t1), tr(a, b)], pool);
    },
    (r) => {
      const a = r(1, 5) * (r(0, 1) ? 1 : -1);
      const b = r(1, 5) * (r(0, 1) ? 1 : -1);
      const k = r(2, 3);
      return sequenceVariant(
        r,
        "dilation-composition",
        [dil(k), tr(a, b)],
        [
          [tr(a, b), dil(k)],
          [dil(k), tr(-a, -b)],
          [dil(5 - k), tr(a, b)],
          [dil(1, k), tr(a, b)],
          [dil(k)],
          [tr(a, b)],
        ],
      );
    },
  ],
};

/* ───────────── 8. geometric-constructions ───────────── */
const stepsForPerpendicular = [
  "Mark point $P$ on line $\\ell$.",
  "With the compass centered at $P$, draw arcs that cross $\\ell$ on both sides of $P$, at points $X$ and $Y$.",
  "Open the compass wider than $PX$ and draw arcs centered at $X$ and at $Y$ that cross at a point $Z$.",
  "Draw line $PZ$ with the straightedge.",
];
const constructionFamily: Family = {
  meta: {
    id: "compass-straightedge-reasoning",
    title: "Reason about a compass-and-straightedge construction",
    skillId: "geometric-constructions",
    difficultyOffset: 0.1,
    description:
      "Choose the next step, the correct order or the geometric fact that justifies a bisector, perpendicular or parallel-line construction.",
  },
  variants: [
    (r) => {
      const [A, B] = pick(r, [
        ["A", "B"],
        ["P", "Q"],
        ["X", "Y"],
      ]);
      return {
        tag: "bisector-next-step",
        label: "Next step",
        prompt: `To construct the perpendicular bisector of $\\overline{${A}${B}}$, you open the compass wider than half of ${A}${B} and draw an arc centered at ${A}, above and below the segment. What is the next step?`,
        correct: `Keep the same opening and draw an arc centered at ${B} that crosses the first arc above and below the segment.`,
        wrong: [
          [
            `Close the compass to less than half of ${A}${B} and draw an arc centered at ${B}.`,
            `An arc that small cannot reach the first arc, so the two arcs would not cross.`,
          ],
          [
            `Use a ruler to measure ${A}${B}, halve the length and mark the midpoint.`,
            "A construction uses only a compass and an unmarked straightedge, so no measuring is allowed.",
          ],
          [
            `Draw a line through ${A} at a right angle to $\\overline{${A}${B}}$.`,
            `A perpendicular through ${A} does not pass through the midpoint of $\\overline{${A}${B}}$.`,
          ],
        ],
        hint: `Points on the perpendicular bisector are the same distance from ${A} and ${B}. Decide what second arc would produce points that are as far from ${B} as from ${A}.`,
        explanation: [
          `Any point on the first arc is the chosen distance from ${A}. To find points equally far from ${B}, use the same opening centered at ${B}.`,
          `The two arcs cross above and below the segment; the line through those crossings is the perpendicular bisector.`,
        ],
      };
    },
    () => ({
      tag: "angle-bisector-next-step",
      label: "Next step",
      prompt:
        "To bisect $\\angle ABC$, you draw an arc centered at $B$ that crosses ray $BA$ at $P$ and ray $BC$ at $Q$. What is the next step?",
      correct:
        "With one opening, draw arcs centered at $P$ and at $Q$ that cross inside the angle.",
      wrong: [
        [
          "Use different openings for the arcs centered at $P$ and $Q$.",
          "The crossing point must be the same distance from $P$ as from $Q$, which needs equal radii.",
        ],
        [
          "Draw line $PQ$; it bisects the angle.",
          "Segment $PQ$ is a chord. It is perpendicular to the bisector, not along it.",
        ],
        [
          "Measure $\\angle ABC$ with a protractor and mark half of it.",
          "A construction uses only a compass and an unmarked straightedge.",
        ],
      ],
      hint: "The bisector is the set of points that are the same distance from both sides of the angle. Decide how to locate one such point inside the angle using equal arcs from $P$ and $Q$.",
      explanation: [
        "Arcs of equal radius centered at $P$ and $Q$ cross at a point $X$ that is equally far from $P$ and $Q$.",
        "Because $BP=BQ$ and $XP=XQ$, triangles $BPX$ and $BQX$ are congruent, so ray $BX$ bisects $\\angle ABC$.",
      ],
    }),
    () => ({
      tag: "bisector-justification",
      label: "Justification",
      prompt:
        "In the perpendicular bisector construction for $\\overline{AB}$, arcs centered at $A$ and $B$ have the same radius and cross at $X$ and $Y$. Which fact explains why line $XY$ is the perpendicular bisector of $\\overline{AB}$?",
      correct:
        "$X$ and $Y$ are each equidistant from $A$ and $B$, so both lie on the bisector, and two points fix a line.",
      wrong: [
        [
          "Each arc has radius $AB$, so triangle $ABX$ is equilateral and $XY$ is one of its sides.",
          "The radius only has to be longer than half of $AB$. The construction does not need triangle $ABX$ to be equilateral.",
        ],
        [
          "The arcs are congruent, so $XY$ is parallel to $\\overline{AB}$.",
          "Line $XY$ crosses $\\overline{AB}$ at its midpoint; it is not parallel to it.",
        ],
        [
          "The compass measures a right angle where the two arcs cross.",
          "A compass measures distance, not angle. The right angle follows from the equal distances.",
        ],
      ],
      hint: "Name the distances that the equal-radius arcs make equal for the crossing point $X$. Then recall which set of points is equally far from $A$ and $B$.",
      explanation: [
        "$XA=XB$ and $YA=YB$ because each pair is a radius of arcs with the same opening.",
        "A point equally far from $A$ and $B$ lies on the perpendicular bisector of $\\overline{AB}$, so $X$ and $Y$ both lie on it. Two points determine exactly one line, so $XY$ is the bisector.",
      ],
    }),
    () => ({
      tag: "parallel-justification",
      label: "Justification",
      prompt:
        "To construct the line through $P$ parallel to line $\\ell$, you draw a transversal through $P$, then copy the angle it makes with $\\ell$ onto the transversal at $P$, in the matching position. Which theorem shows that the new line is parallel to $\\ell$?",
      correct:
        "If corresponding angles formed by a transversal are congruent, the two lines are parallel.",
      wrong: [
        [
          "If two lines are parallel, then corresponding angles formed by a transversal are congruent.",
          "That statement starts from parallel lines. The construction must prove the lines parallel, so it needs the converse.",
        ],
        [
          "Vertical angles are congruent.",
          "The two copied angles are at different points, so they are not vertical angles.",
        ],
        [
          "Angles that form a linear pair are supplementary.",
          "The copied angles are in matching positions, not adjacent on a straight line.",
        ],
      ],
      hint: "The copied angle and the original angle sit in matching positions at the two crossings. Ask which theorem uses equal angles in matching positions to conclude something about the lines.",
      explanation: [
        "The copy makes the new angle at $P$ congruent to the original angle, and they are corresponding angles for the transversal.",
        "Congruent corresponding angles imply the lines are parallel, so the new line through $P$ is parallel to $\\ell$.",
      ],
    }),
    (r) => {
      const letters = shuffle(r, ["A", "B", "C", "D"]);
      const letterOf = (step: number) => letters[step]!;
      const sorted = [0, 1, 2, 3].sort((a, b) =>
        letterOf(a).localeCompare(letterOf(b)),
      );
      const order = (steps: number[]) => steps.map(letterOf).join(", ");
      const canonical = [0, 1, 2, 3];
      const swap = (i: number) => {
        const c = [...canonical];
        [c[i], c[i + 1]] = [c[i + 1]!, c[i]!];
        return c;
      };
      return {
        tag: "step-order",
        label: "Order of steps",
        prompt: `These steps construct the perpendicular to line $\\ell$ at point $P$ on $\\ell$, but they are listed out of order. ${sorted.map((s) => `${letterOf(s)}. ${stepsForPerpendicular[s]}`).join(" ")} Which order is correct?`,
        correct: order(canonical),
        wrong: [
          [
            order(swap(0)),
            "The arcs are centered at $P$, so $P$ must be marked first.",
          ],
          [
            order(swap(1)),
            "The arcs centered at $X$ and $Y$ need the points $X$ and $Y$, which the step with arcs from $P$ makes.",
          ],
          [
            order(swap(2)),
            "Line $PZ$ needs the point $Z$, which the crossing arcs make.",
          ],
          [
            order([3, 2, 1, 0]),
            "This is the reverse order; each step needs points made by an earlier one.",
          ],
        ],
        hint: "Each step uses points made earlier. Find the step that needs nothing else, then the step that uses only that point, and continue.",
        explanation: [
          `Mark $P$ first. Then arcs from $P$ make $X$ and $Y$ on $\\ell$, which are the same distance from $P$.`,
          `Arcs from $X$ and $Y$ with equal radii cross at $Z$, which is as far from $X$ as from $Y$, so $Z$ is on the perpendicular bisector of $\\overline{XY}$, which passes through $P$. The line $PZ$ is the perpendicular.`,
        ],
      };
    },
  ],
};

/* ───────────── 9. inscribed-polygons ───────────── */
const inscribedFamily: Family = {
  meta: {
    id: "inscribed-polygon-reasoning",
    title: "Reason about polygons inscribed in a circle",
    skillId: "inscribed-polygons",
    difficultyOffset: 0.2,
    description:
      "Choose the reason a hexagon side equals the radius, the hexagon perimeter, the central angle of a regular inscribed polygon, or the construction method for a triangle, square or hexagon.",
  },
  variants: [
    () => ({
      tag: "hexagon-side-reason",
      label: "Reason",
      prompt:
        "A regular hexagon is inscribed in a circle with center $O$ and radius $r$, by stepping a compass opened to $r$ around the circle. Why does each side of the hexagon equal $r$?",
      correct:
        "Each central angle is $60^\\circ$ and the two radii are equal, so the triangle with the side is equilateral.",
      wrong: [
        [
          "Each central angle is $120^\\circ$, so each chord equals the radius.",
          "Six equal central angles share $360^\\circ$, so each is $60^\\circ$, not $120^\\circ$.",
        ],
        [
          "The six sides together equal the circumference $2\\pi r$, so each side is $\\frac{2\\pi r}{6}$.",
          "That is the length of the arc between vertices. The side is the chord, which is shorter than the arc.",
        ],
        [
          "Every chord of a circle is as long as the radius.",
          "Chords have many lengths; a diameter is twice the radius. The central angle decides the chord length.",
        ],
      ],
      hint: "Look at the triangle formed by the center $O$ and two adjacent vertices. Find its central angle by sharing $360^\\circ$ among the six sides, then decide what the equal radii say about its other two angles.",
      explanation: [
        "The six sides are equal, so the six central angles are equal: $360^\\circ\\div 6=60^\\circ$.",
        "In the triangle $O$, $V_1$, $V_2$ the sides $OV_1$ and $OV_2$ are radii, so the base angles are equal and total $180^\\circ-60^\\circ=120^\\circ$, giving $60^\\circ$ each.",
        "All three angles are $60^\\circ$, so the triangle is equilateral and each side equals $r$.",
      ],
    }),
    (r) => {
      const rad = r(3, 12);
      return {
        tag: "hexagon-perimeter",
        label: "Perimeter",
        prompt: `A regular hexagon is inscribed in a circle of radius ${rad} cm by stepping a compass opened to ${rad} cm around the circle. What is the perimeter of the hexagon?`,
        correct: m(`${6 * rad}\\text{ cm}`),
        wrong: [
          [
            m(`${2 * rad}\\pi\\text{ cm}`),
            "That is the circumference of the circle. The hexagon's sides are chords, so its perimeter is less than the circumference.",
          ],
          [
            m(`${12 * rad}\\text{ cm}`),
            `That uses the diameter, ${2 * rad} cm, for each side. Each side equals the radius.`,
          ],
          [m(`${3 * rad}\\text{ cm}`), "There are six sides, not three."],
        ],
        hint: `The compass opening of ${rad} cm marks each hexagon side. Decide how many sides the hexagon has and how long each one is.`,
        explanation: [
          `Stepping the radius, ${rad} cm, around the circle marks six points. The chord between neighboring points equals the radius because each central angle is $60^\\circ$.`,
          `The perimeter is $6\\times ${rad}=${6 * rad}$ cm.`,
        ],
        model: { r: rad },
      };
    },
    (r) => {
      const n = R(r, [3, 4, 6]);
      const c = 360 / n;
      return {
        tag: "central-angle",
        label: "Angle",
        prompt: `A regular polygon with ${n} sides is inscribed in a circle with center $O$. What is the measure of the central angle between two neighboring vertices, the angle at $O$ formed by the radii to them?`,
        correct: deg(c),
        wrong: [
          [deg(180 / n), "That is half the central angle."],
          [
            deg(((n - 2) * 180) / n),
            "That is an interior angle of the polygon, at a vertex, not the angle at the center.",
          ],
          [
            deg(360 - c),
            "That is the reflex angle on the other side of the two radii.",
          ],
          [deg(90), "That is the central angle only for a square."],
          [deg(2 * c), "That is the angle at the center spanning two sides."],
        ],
        hint: `The ${n} sides of a regular polygon cut the full turn at the center into equal angles. A full turn is $360^\\circ$.`,
        explanation: [
          `The ${n} equal sides give ${n} equal central angles that fill the full turn at $O$.`,
          `Each measures $360^\\circ\\div ${n}=${c}^\\circ$.`,
        ],
      };
    },
    (r) => {
      const methods = {
        hexagon: [
          "regular hexagon",
          "Step the compass, set to the radius, around the circle six times and join consecutive marks.",
        ],
        triangle: [
          "equilateral triangle",
          "Step the compass, set to the radius, around the circle, then join every second mark.",
        ],
        square: [
          "square",
          "Draw a diameter, construct the perpendicular diameter, and join its four endpoints in order.",
        ],
      } as const;
      const shape = pick(r, ["hexagon", "triangle", "square"] as const);
      const others = (["hexagon", "triangle", "square"] as const).filter(
        (s) => s !== shape,
      );
      const why = {
        hexagon:
          "Stepping the radius marks points $60^\\circ$ apart, six of which close the circle.",
        triangle:
          "Points $60^\\circ$ apart, taken two at a time, are $120^\\circ$ apart, and three of those close the circle.",
        square:
          "Perpendicular diameters make four central angles of $90^\\circ$, and four equal chords join the endpoints.",
      };
      return {
        tag: `method-${shape}`,
        label: "Construction method",
        prompt: `Which method inscribes a ${methods[shape][0]} in a circle with compass and straightedge?`,
        correct: methods[shape][1],
        wrong: [
          ...others.map(
            (o) =>
              [
                methods[o][1],
                `That inscribes a ${methods[o][0]}, not a ${methods[shape][0]}.`,
              ] as Wrong,
          ),
          [
            "Mark any three points on the circle and join them.",
            "Arbitrary points do not give equal sides, so the figure is not regular.",
          ],
        ],
        hint: `Think about the central angle between neighboring vertices of a ${methods[shape][0]}, then ask which compass or straightedge step produces points that far apart.`,
        explanation: [why[shape], methods[shape][1]],
      };
    },
  ],
};

/* ───────────── 10. triangle-circles ───────────── */
const centers = {
  circum:
    "Construct the perpendicular bisectors of two sides; the circle's center is where they meet.",
  in: "Construct the bisectors of two angles; the circle's center is where they meet.",
  median: "Construct two medians; the circle's center is where they meet.",
  altitude: "Construct two altitudes; the circle's center is where they meet.",
};
const centerFeedback = {
  circum:
    "Perpendicular bisectors give points equally far from two vertices. That locates the circumcenter, the center of the circle through the vertices.",
  in: "Angle bisectors give points equally far from two sides. That locates the incenter, the center of the circle tangent to all three sides.",
  median:
    "Medians meet at the centroid, the balance point of the triangle. It is not generally equidistant from the vertices or the sides.",
  altitude:
    "Altitudes meet at the orthocenter, which is not generally equidistant from the vertices or the sides.",
};
const triangleCirclesFamily: Family = {
  meta: {
    id: "triangle-circle-centers",
    title: "Find circles tied to a triangle or quadrilateral",
    skillId: "triangle-circles",
    difficultyOffset: 0.3,
    description:
      "Choose the construction for a triangle's circumcenter or incenter, and compute angles of an inscribed quadrilateral and the circumradius of a right triangle.",
  },
  variants: [
    (r) => {
      const incircle = r(0, 1) === 1;
      const key = incircle ? "in" : "circum";
      return {
        tag: incircle ? "incenter" : "circumcenter",
        label: "Construction",
        prompt: incircle
          ? "Which construction locates the center of the circle inside triangle $ABC$ that touches all three sides?"
          : "Which construction locates the center of the circle that passes through all three vertices of triangle $ABC$?",
        correct: centers[key],
        wrong: (["circum", "in", "median", "altitude"] as const)
          .filter((k) => k !== key)
          .map((k) => [centers[k], centerFeedback[k]] as Wrong),
        hint: incircle
          ? "The center must be the same distance from all three sides. Decide which line contains the points equally far from two sides of an angle."
          : "The center must be the same distance from all three vertices. Decide which line contains the points equally far from two points.",
        explanation: [
          centerFeedback[key],
          incircle
            ? "The two bisectors meet at a point equally far from all three sides, so it is the center of the inscribed circle."
            : "The two bisectors meet at a point equally far from all three vertices, so it is the center of the circumscribed circle.",
        ],
      };
    },
    (r) => {
      let a = 2 * r(28, 59);
      if (a === 90) a = 92;
      const c = 180 - a;
      const [A, C] = pick(r, [
        ["A", "C"],
        ["B", "D"],
      ]);
      return {
        tag: "cyclic-opposite",
        label: "Angle measure",
        prompt: `Quadrilateral $ABCD$ is inscribed in a circle, with vertices in order around the circle. $m\\angle ${A} = ${dg(a)}$. What is $m\\angle ${C}$?`,
        correct: deg(c),
        wrong: [
          [
            deg(a),
            "That is the angle at the same vertex. Opposite angles of an inscribed quadrilateral are supplementary, not equal.",
          ],
          [
            deg(360 - a),
            "The four angles total $360^\\circ$, but the supplementary pair totals $180^\\circ$.",
          ],
          [
            deg(90),
            "That would require both opposite angles to be right angles, which is not given.",
          ],
          [
            deg(a / 2),
            "Half an angle is not related to its opposite angle here.",
          ],
        ],
        hint: `Angles ${A} and ${C} are at opposite vertices of the inscribed quadrilateral. Recall how the opposite angles of a quadrilateral inscribed in a circle relate.`,
        explanation: [
          `Opposite angles of a quadrilateral inscribed in a circle are supplementary.`,
          `$m\\angle ${C}=180-${a}=${c}$.`,
        ],
        model: { a, c },
      };
    },
    (r) => {
      const x0 = r(5, 15);
      const p = r(2, 4);
      const c = r(2, 4);
      let alpha = r(60, 120);
      if (alpha === 90) alpha = 80;
      const q = alpha - p * x0;
      const d = 180 - alpha - c * x0;
      return {
        tag: "cyclic-algebra",
        label: "Angle measure",
        prompt: `Quadrilateral $ABCD$ is inscribed in a circle. $m\\angle A=(${lin(p, q)})^\\circ$ and the opposite angle has $m\\angle C=(${lin(c, d)})^\\circ$. What is $m\\angle A$?`,
        correct: deg(alpha),
        wrong: [
          [deg(180 - alpha), "That is $m\\angle C$, the opposite angle."],
          [
            m(`${x0}`),
            "That is the value of $x$. Substitute it into the expression for $\\angle A$.",
          ],
          [
            deg(90),
            "The opposite angles total $180^\\circ$, but they need not be equal.",
          ],
          [
            deg(360 - alpha),
            "Check the sum; opposite angles total $180^\\circ$.",
          ],
        ],
        hint: `$\\angle A$ and $\\angle C$ are opposite angles of an inscribed quadrilateral. Write their sum as an equation, solve it for $x$, then substitute into the expression for $\\angle A$.`,
        explanation: [
          `Opposite angles of an inscribed quadrilateral are supplementary: $(${lin(p, q)})+(${lin(c, d)})=180$.`,
          `Solving gives $x=${x0}$.`,
          `$m\\angle A=${p}(${x0})${q < 0 ? "-" : "+"}${Math.abs(q)}=${alpha}$.`,
        ],
        model: { p, q, c, d, x0, alpha },
      };
    },
    (r) => {
      const [a, b, h] = pick(r, [
        [6, 8, 10],
        [5, 12, 13],
        [9, 12, 15],
        [8, 15, 17],
        [12, 16, 20],
      ]);
      const circum = h / 2;
      const inr = (a + b - h) / 2;
      return {
        tag: "right-triangle-circumradius",
        label: "Radius",
        prompt: `A right triangle has legs ${a} and ${b}. The circle through all three of its vertices has center at the midpoint of the hypotenuse. What is the radius of that circle?`,
        correct: m(circum),
        wrong: [
          [
            m(h),
            "That is the hypotenuse, which is the diameter of the circle, not its radius.",
          ],
          [
            m(inr),
            "That is the radius of the circle inside the triangle that touches its sides, not the circle through its vertices.",
          ],
          [
            m((a + b) / 2),
            "Averaging the legs does not give a radius. The circle's diameter is the hypotenuse.",
          ],
          [m(a), "That is a leg length."],
        ],
        hint: `The hypotenuse joins two vertices of the circle and passes through its center. First find the hypotenuse of the triangle with legs ${a} and ${b}.`,
        explanation: [
          `Hypotenuse: $\\sqrt{${a}^2+${b}^2}=${h}$.`,
          `The hypotenuse is a diameter of the circle through the vertices, so the radius is $${h}\\div 2=${circum}$.`,
        ],
        model: { a, b, h },
      };
    },
  ],
};

/* ───────────── 11. tangent-construction ───────────── */
const triples: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 15, 17],
  [9, 12, 15],
  [7, 24, 25],
  [12, 16, 20],
];
const tangentFamily: Family = {
  meta: {
    id: "tangent-circle-computation",
    title: "Compute with tangents to a circle",
    skillId: "tangent-construction",
    difficultyOffset: 0.3,
    description:
      "Use the perpendicular radius and equal tangent segments from an external point to find tangent lengths, radii and angles.",
  },
  variants: [
    (r) => {
      const [x, y, d] = pick(r, triples);
      const [rad, t] = r(0, 1) ? [x, y] : [y, x];
      return {
        tag: "tangent-length",
        label: "Length",
        prompt: `Point $P$ is outside a circle with center $O$ and radius ${rad}. $OP=${d}$ and $\\overline{PT}$ is tangent to the circle at $T$. What is $PT$?`,
        correct: m(t),
        wrong: [
          [
            m(d - rad),
            "That subtracts the radius from $OP$. The three segments $OT$, $PT$, $OP$ form a right triangle, so they relate by the Pythagorean theorem.",
          ],
          [
            m(d),
            "That is $OP$, the hypotenuse, which is the longest side of the right triangle.",
          ],
          [
            m(`\\sqrt{${d * d + rad * rad}}`),
            "That adds the squares, as if $PT$ were the hypotenuse. $OP$ is the hypotenuse.",
          ],
          [
            m(d + rad),
            "Lengths of the sides of a triangle do not combine by adding the hypotenuse to a leg.",
          ],
        ],
        hint: `Draw the radius $OT$. A tangent is perpendicular to the radius at the point of tangency, so triangle $OTP$ has a right angle. Decide which of its sides is the hypotenuse; $OP=${d}$ and $OT=${rad}$.`,
        explanation: [
          `The radius $OT$ is perpendicular to the tangent $PT$, so triangle $OTP$ is right-angled at $T$ with hypotenuse $OP=${d}$.`,
          `$PT^2=${d}^2-${rad}^2=${d * d - rad * rad}$, so $PT=${t}$.`,
        ],
        model: { rad, d, t },
      };
    },
    (r) => {
      const x0 = r(2, 9);
      const p = r(2, 5);
      let c = r(2, 5);
      while (c === p) c = r(2, 5);
      const t = 2 * r(4, 15);
      const q = t - p * x0;
      const d = t - c * x0;
      return {
        tag: "equal-tangents",
        label: "Length",
        prompt: `From an external point $P$, tangent segments $\\overline{PA}$ and $\\overline{PB}$ touch a circle at $A$ and $B$. $PA=${lin(p, q)}$ and $PB=${lin(c, d)}$ (same units). What is $PA$?`,
        correct: m(t),
        wrong: [
          [
            m(x0),
            "That is the value of $x$. Substitute it into the expression for $PA$.",
          ],
          [
            m(2 * t),
            "That is $PA+PB$. The question asks for one tangent segment.",
          ],
          [m(t / 2), "That is half a tangent segment."],
          [
            m(t + 2),
            "Substitute the solved value of $x$ into the expression for $PA$.",
          ],
        ],
        hint: `Two tangent segments drawn to a circle from the same external point have a special relationship. Write it as an equation in $x$ using the expressions given for $PA$ and $PB$, then solve.`,
        explanation: [
          `Two tangent segments from one external point are congruent, so $${lin(p, q)}=${lin(c, d)}$.`,
          `Solving gives $x=${x0}$, so $PA=${p}(${x0})${q < 0 ? "-" : "+"}${Math.abs(q)}=${t}$.`,
        ],
        model: { p, q, c, d, x0, t },
      };
    },
    (r) => {
      const [x, y, d] = pick(r, triples);
      const [rad, t] = r(0, 1) ? [x, y] : [y, x];
      return {
        tag: "radius-from-tangent",
        label: "Length",
        prompt: `Line $PT$ is tangent to a circle with center $O$ at point $T$. $OP=${d}$ and $PT=${t}$. What is the radius of the circle?`,
        correct: m(rad),
        wrong: [
          [
            m(d - t),
            "Lengths in a right triangle do not combine by subtraction; use the Pythagorean theorem.",
          ],
          [m(d + t), "That adds the hypotenuse and a leg."],
          [m(t), "That is $PT$, the tangent segment, not the radius $OT$."],
          [
            m(`\\sqrt{${d * d + t * t}}`),
            "That adds the squares, as if the radius were the hypotenuse. $OP$ is the hypotenuse.",
          ],
        ],
        hint: `The radius $OT$ ends at the point of tangency. What does that tell you about the angle between $OT$ and $PT$, and which side of triangle $OTP$ is the longest?`,
        explanation: [
          `A tangent is perpendicular to the radius at the point of tangency, so triangle $OTP$ has a right angle at $T$ and hypotenuse $OP=${d}$.`,
          `$OT^2=${d}^2-${t}^2=${d * d - t * t}$, so the radius is $${rad}$.`,
        ],
        model: { rad, d, t },
      };
    },
    (r) => {
      const a = R(r, [20, 25, 30, 35, 40, 55, 60, 65, 70]);
      return {
        tag: "tangent-angle",
        label: "Angle measure",
        prompt: `Line $PT$ is tangent to a circle with center $O$ at $T$. $m\\angle TOP=${dg(a)}$. What is $m\\angle OPT$?`,
        correct: deg(90 - a),
        wrong: [
          [deg(a), "That is $m\\angle TOP$, the angle at $O$."],
          [
            deg(180 - a),
            "That ignores the right angle at $T$; the three angles of triangle $OTP$ total $180^\\circ$.",
          ],
          [
            deg(90 + a),
            "The two non-right angles of triangle $OTP$ total $90^\\circ$; neither can exceed it.",
          ],
          [
            deg(90),
            "That is $m\\angle OTP$, the angle at the point of tangency.",
          ],
        ],
        hint: `The tangent $PT$ meets the radius $OT$ at $T$. What is the angle between them, and what do the three angles of triangle $OTP$ add to?`,
        explanation: [
          `The tangent is perpendicular to the radius at $T$, so $m\\angle OTP=90^\\circ$.`,
          `The angles of triangle $OTP$ total $180^\\circ$: $m\\angle OPT=180-90-${a}=${90 - a}$.`,
        ],
        model: { a },
      };
    },
  ],
};

/* ───────────── 12. circle-similarity ───────────── */
const circleOps = (ops: Op[], c: Pt, rad: number): { c: Pt; r: number } => {
  let center = c;
  let radius = rad;
  for (const op of ops) {
    center = applyOp(op, center);
    if (op.k === "dil") radius = (radius * op.fn) / op.fd;
  }
  return { c: center, r: radius };
};
const circleSimilarityFamily: Family = {
  meta: {
    id: "circle-dilation-scaling",
    title: "Map one circle onto another by a dilation",
    skillId: "circle-similarity",
    difficultyOffset: 0.2,
    description:
      "Find the scale factor between two circles, how circumference and area scale, and the translation and dilation that map one circle onto another.",
  },
  variants: [
    (r) => {
      const r1 = r(2, 12);
      let r2 = r(2, 12);
      while (r2 === r1) r2 = r(2, 12);
      return {
        tag: "scale-factor",
        label: "Scale factor",
        prompt: `Two circles have radii ${r1} and ${r2}. A dilation maps the circle of radius ${r1} onto the circle of radius ${r2}. What is its scale factor?`,
        correct: m(frac(r2, r1)),
        wrong: [
          [
            m(frac(r1, r2)),
            "That is the factor from the second circle back to the first. The scale factor is image radius divided by original radius.",
          ],
          [
            m(r2 - r1),
            "A dilation multiplies lengths by a factor; the difference of radii is not the factor.",
          ],
          [
            m(frac(r2 * r2, r1 * r1)),
            "That is the factor for areas, the square of the scale factor.",
          ],
          [
            m(r1 + r2),
            "A dilation multiplies lengths by a factor; the sum of radii is not the factor.",
          ],
        ],
        hint: `A dilation multiplies every length, including the radius, by the same scale factor. Divide the image radius ${r2} by the original radius ${r1}, or decide which of those divisions gives the factor.`,
        explanation: [
          `A dilation multiplies the radius by its scale factor $k$, so $${r1}k=${r2}$.`,
          `Therefore $k=\\frac{${r2}}{${r1}}=${frac(r2, r1)}$.`,
        ],
        model: { r1, r2 },
      };
    },
    (r) => {
      const [n, dd] = pick(r, [
        [2, 1],
        [3, 1],
        [4, 1],
        [5, 1],
        [1, 2],
        [1, 3],
        [3, 2],
      ]) as [number, number];
      const k = frac(n, dd);
      return {
        tag: "area-factor",
        label: "Area factor",
        prompt: `A dilation with scale factor $${k}$ maps circle $A$ onto circle $B$. The area of $B$ is how many times the area of $A$?`,
        correct: m(frac(n * n, dd * dd)),
        wrong: [
          [
            m(k),
            "That is the factor for lengths such as the radius and circumference. Area is two-dimensional.",
          ],
          [m(frac(2 * n, dd)), "Doubling the factor is not squaring it."],
          [
            m(frac(n * n * n, dd * dd * dd)),
            "That is the factor for volume, the cube of the scale factor.",
          ],
          [
            m(`${frac(n * n, dd * dd)}\\pi`),
            "The factor $\\pi$ appears in both areas, so it cancels in the ratio.",
          ],
        ],
        hint: `Area is $\\pi r^2$. If the dilation multiplies the radius by $${k}$, find how $r^2$ changes, and note the constant $\\pi$ is the same for both circles.`,
        explanation: [
          `The radius of $B$ is $${k}$ times the radius of $A$, so area($B$) $=\\pi(${k}r)^2=${frac(n * n, dd * dd)}\\cdot\\pi r^2$.`,
          `The area is multiplied by $${frac(n * n, dd * dd)}$.`,
        ],
        model: { n, d: dd },
      };
    },
    (r) => {
      const r1 = r(2, 8);
      const k = r(2, 5);
      const cir = 2 * r1;
      return {
        tag: "circumference-factor",
        label: "Circumference",
        prompt: `Circle $A$ has circumference $${cir}\\pi$ cm. A dilation with scale factor ${k} maps circle $A$ onto circle $B$. What is the circumference of circle $B$?`,
        correct: m(`${cir * k}\\pi\\text{ cm}`),
        wrong: [
          [
            m(`${cir * k * k}\\pi\\text{ cm}`),
            "That multiplies by the square of the scale factor, which is the factor for area.",
          ],
          [
            m(`${cir + k}\\pi\\text{ cm}`),
            "A dilation multiplies lengths; it does not add the scale factor.",
          ],
          [
            m(`${frac(cir, k)}\\pi\\text{ cm}`),
            "That divides by the scale factor, which would shrink the circle for a factor above 1.",
          ],
          [
            m(`${cir * k * r1}\\pi\\text{ cm}`),
            "The circumference formula was already used to get the given circumference; multiply it once by the scale factor.",
          ],
        ],
        hint: `Circumference is a length, so a dilation multiplies it by the same scale factor as every other length. Use the given circumference of circle $A$.`,
        explanation: [
          `Circumference is proportional to radius, so a dilation with scale factor ${k} multiplies it by ${k}.`,
          `$${cir}\\pi\\times ${k}=${cir * k}\\pi$ cm.`,
        ],
        model: { r1, k },
      };
    },
    (r) => {
      const k = r(2, 3);
      const r1 = r(1, 3);
      const c1: Pt = [r(1, 4), r(-3, 3)];
      const c2: Pt = [r(5, 9), r(-3, 3)];
      const dx = c2[0] - c1[0];
      const dy = c2[1] - c1[1];
      const r2 = k * r1;
      const correct: Op[] = r(0, 1)
        ? [tr(dx, dy), dil(k, 1, c2[0], c2[1])]
        : [dil(k, 1, c1[0], c1[1]), tr(dx, dy)];
      const pool: Op[][] = [
        [tr(dx, dy), dil(k, 1, c2[0], c2[1])],
        [dil(k, 1, c1[0], c1[1]), tr(dx, dy)],
        [tr(dx, dy), dil(k)],
        [tr(dx, dy), dil(1, k, c2[0], c2[1])],
        [dil(k, 1, c1[0], c1[1]), tr(-dx, -dy)],
        [tr(dx, dy)],
        [dil(k)],
        [dil(k + 1, 1, c2[0], c2[1]), tr(dx, dy)],
      ];
      const matches = (ops: Op[]) => {
        const out = circleOps(ops, c1, r1);
        return samePt(out.c, c2) && Math.abs(out.r - r2) < 1e-9;
      };
      if (!matches(correct)) throw new Error("circle sequence does not map");
      const label = (ops: Op[]) => seqText(ops) + ".";
      const seen = new Set([label(correct)]);
      const wrong = pool
        .filter((ops) => !matches(ops))
        .filter((ops) => {
          const l = label(ops);
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        })
        .map((ops) => {
          const out = circleOps(ops, c1, r1);
          return [
            label(ops),
            `This sends circle $A$ to a circle with center $${pt(out.c)}$ and radius ${out.r}, but circle $B$ has center $${pt(c2)}$ and radius ${r2}.`,
          ] as Wrong;
        });
      return {
        tag: "map-sequence",
        label: "Sequence of transformations",
        prompt: `Circle $A$ has center $${pt(c1)}$ and radius ${r1}. Circle $B$ has center $${pt(c2)}$ and radius ${r2}. Which sequence of transformations maps circle $A$ onto circle $B$?`,
        correct: label(correct),
        wrong,
        hint: `Compare the radii to find the scale factor of the dilation, and compare the centers $${pt(c1)}$ and $${pt(c2)}$ to find the translation. A dilation keeps its own center fixed.`,
        explanation: [
          `The radii ${r1} and ${r2} give scale factor $${r2}\\div ${r1}=${k}$. The centers differ by $\\langle ${sv(dx)},${sv(dy)}\\rangle$.`,
          `${seqText(correct)} maps the center to $${pt(c2)}$ and multiplies the radius by ${k}, so circle $A$ lands on circle $B$.`,
        ],
        model: { c1, r1, c2, r2, k },
      };
    },
  ],
};

/* ───────────── 13. coordinate-proofs ───────────── */
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (u: Pt, v: Pt) => u[0] * v[0] + u[1] * v[1];
const cross = (u: Pt, v: Pt) => u[0] * v[1] - u[1] * v[0];
type QuadType =
  "square" | "rectangle" | "rhombus" | "parallelogram" | "trapezoid";
const quadLabel: Record<QuadType, string> = {
  square: "A square",
  rectangle: "A rectangle that is not a square",
  rhombus: "A rhombus that is not a square",
  parallelogram: "A parallelogram that is neither a rectangle nor a rhombus",
  trapezoid: "A trapezoid with exactly one pair of parallel sides",
};
const quadRequirement: Record<QuadType, string> = {
  square: "A square needs both a right angle at $A$ and equal adjacent sides.",
  rectangle:
    "A rectangle that is not a square needs a right angle at $A$ but unequal adjacent sides.",
  rhombus:
    "A rhombus that is not a square needs equal adjacent sides but no right angle at $A$.",
  parallelogram:
    "A parallelogram that is neither a rectangle nor a rhombus needs both pairs of opposite sides parallel, no right angle at $A$ and unequal adjacent sides.",
  trapezoid:
    "A trapezoid with exactly one pair of parallel sides needs one pair of opposite sides parallel and the other pair not parallel.",
};
export function classifyQuadrilateral(v: [Pt, Pt, Pt, Pt]): QuadType {
  const [A, B, C, D] = v;
  const AB = sub(B, A);
  const DC = sub(C, D);
  const BC = sub(C, B);
  const AD = sub(D, A);
  const par1 = cross(AB, DC) === 0;
  const par2 = cross(BC, AD) === 0;
  const right = dot(AB, AD) === 0;
  const equal = dot(AB, AB) === dot(AD, AD);
  if (par1 && par2)
    return right && equal
      ? "square"
      : right
        ? "rectangle"
        : equal
          ? "rhombus"
          : "parallelogram";
  if (par1 || par2) return "trapezoid";
  throw new Error("not a trapezoid or parallelogram");
}
const equalLengthVectors: Pt[] = [
  [5, 0],
  [0, 5],
  [3, 4],
  [4, 3],
  [-3, 4],
  [-4, 3],
  [3, -4],
  [4, -3],
];
const baseVectors: Pt[] = [
  [2, 0],
  [0, 2],
  [3, 4],
  [4, 3],
  [2, 1],
  [1, 2],
  [3, -1],
  [1, -3],
];
function quadVertices(r: Random, type: QuadType): [Pt, Pt, Pt, Pt] {
  const A: Pt = [r(-4, 4), r(-4, 4)];
  const add = (p: Pt, u: Pt, f = 1): Pt => [p[0] + f * u[0], p[1] + f * u[1]];
  let B: Pt;
  let D: Pt;
  if (type === "square" || type === "rectangle") {
    const u = pick(r, baseVectors);
    const perp: Pt = [-u[1], u[0]];
    const p = r(1, 2);
    let q = type === "square" ? p : r(1, 2);
    if (type === "rectangle" && q === p) q = p + 1;
    B = add(A, u, p);
    D = add(A, perp, q);
  } else if (type === "rhombus") {
    let u: Pt;
    let w: Pt;
    do {
      u = pick(r, equalLengthVectors);
      w = pick(r, equalLengthVectors);
    } while (cross(u, w) === 0 || dot(u, w) === 0);
    B = add(A, u);
    D = add(A, w);
  } else if (type === "parallelogram") {
    let u: Pt;
    let w: Pt;
    do {
      u = [r(2, 6), r(0, 3)];
      w = [r(-3, 3), r(2, 5)];
    } while (cross(u, w) === 0 || dot(u, w) === 0 || dot(u, u) === dot(w, w));
    B = add(A, u);
    D = add(A, w);
  } else {
    const w = r(3, 6);
    let e = r(1, 8);
    while (e === w) e = r(1, 8);
    const h = r(2, 4);
    const d = r(-2, 3);
    const B2: Pt = [A[0] + w, A[1]];
    const D2: Pt = [A[0] + d, A[1] + h];
    return [A, B2, [D2[0] + e, D2[1]], D2];
  }
  const C: Pt = [B[0] + D[0] - A[0], B[1] + D[1] - A[1]];
  return [A, B, C, D];
}
const coordinateProofFamily: Family = {
  meta: {
    id: "coordinate-quadrilateral-claims",
    title: "Decide what coordinates prove about a quadrilateral",
    skillId: "coordinate-proofs",
    difficultyOffset: 0.3,
    description:
      "From the vertices of a quadrilateral, use slopes, distances and dot products to choose the most specific claim the coordinates prove.",
  },
  variants: (
    [
      "square",
      "rectangle",
      "rhombus",
      "parallelogram",
      "trapezoid",
    ] as QuadType[]
  ).map((type) => (r: Random): ProofVariant => {
    const v = quadVertices(r, type);
    const truth = classifyQuadrilateral(v);
    if (truth !== type)
      throw new Error(`quadrilateral type mismatch ${type} ${truth}`);
    const [A, B, C, D] = v;
    const AB = sub(B, A);
    const AD = sub(D, A);
    const DC = sub(C, D);
    const BC = sub(C, B);
    const npar = Number(cross(AB, DC) === 0) + Number(cross(BC, AD) === 0);
    const facts = `For these vertices, $\\overrightarrow{AB}\\cdot\\overrightarrow{AD}=${dot(AB, AD)}$, $AB^2=${dot(AB, AB)}$, $AD^2=${dot(AD, AD)}$, and ${npar === 2 ? "both pairs of opposite sides are parallel" : "exactly one pair of opposite sides is parallel"}.`;
    const vec = (u: Pt) => `\\langle ${u[0]},${u[1]}\\rangle`;
    const others = (Object.keys(quadLabel) as QuadType[]).filter(
      (t) => t !== type,
    );
    return {
      tag: `type-${type}`,
      label: "Claim",
      prompt: `Quadrilateral $ABCD$ has vertices $A${pt(A)}$, $B${pt(B)}$, $C${pt(C)}$ and $D${pt(D)}$, in that order. Using slopes, distances or vectors, which is the most specific statement the coordinates prove?`,
      correct: quadLabel[type],
      wrong: others.map(
        (t) => [quadLabel[t], `${facts} ${quadRequirement[t]}`] as Wrong,
      ),
      hint: `Find the vectors for two adjacent sides, $\\overrightarrow{AB}=${vec(AB)}$ and $\\overrightarrow{AD}=${vec(AD)}$, and for the opposite sides $\\overrightarrow{DC}$ and $\\overrightarrow{BC}$. Compare opposite sides for parallelism, then test the right angle with a dot product and the side lengths.`,
      explanation: [
        `$\\overrightarrow{AB}=${vec(AB)}$ and $\\overrightarrow{DC}=${vec(DC)}$; $\\overrightarrow{BC}=${vec(BC)}$ and $\\overrightarrow{AD}=${vec(AD)}$. ${facts}`,
        `The coordinates prove: ${quadLabel[type].toLowerCase()}.`,
      ],
      model: { A, B, C, D, type },
    };
  }),
};

/* ───────────── 14. measurement-formula-proofs ───────────── */
const measurementFamily: Family = {
  meta: {
    id: "measurement-formula-justifications",
    title: "Justify circle and solid measurement formulas",
    skillId: "measurement-formula-proofs",
    difficultyOffset: 0.4,
    description:
      "Choose the step that justifies the circumference and area of a circle and the volume of a pyramid or cone by dissection, comparison and limits.",
  },
  variants: [
    (r) => {
      const rad = r(3, 12);
      return {
        tag: "sector-rearrangement",
        label: "Area",
        prompt: `A circle of radius ${rad} is cut into many equal thin sectors, and the sectors are laid side by side, alternately pointing up and down. The arrangement looks like a rectangle whose long side is about half the circumference and whose short side is about the radius. What area does this shape approach as the sectors get thinner?`,
        correct: m(`${rad * rad}\\pi`),
        wrong: [
          [
            m(`${2 * rad * rad}\\pi`),
            "That uses the whole circumference as the long side. The long side is only half of it, because half the sectors point up and half point down.",
          ],
          [
            m(`${rad}\\pi`),
            "That is the long side alone, half the circumference. Area is long side times short side.",
          ],
          [
            m(`${rad * rad}`),
            "The long side contains the factor $\\pi$: half the circumference is $\\pi r$.",
          ],
          [
            m(`${2 * rad}\\pi`),
            "That is the whole circumference, not an area.",
          ],
        ],
        hint: `The long side is half the circumference $2\\pi r$, and the short side is the radius ${rad}. A rectangle's area is its long side times its short side.`,
        explanation: [
          `Half the circumference is $\\pi r=${rad}\\pi$, and the short side is $r=${rad}$.`,
          `Area $\\approx ${rad}\\pi\\times ${rad}=${rad * rad}\\pi$. As the sectors get thinner the approximation becomes exact, giving $\\pi r^2$.`,
        ],
        model: { r: rad },
      };
    },
    (r) => {
      const e = R(r, [3, 6, 9, 12]);
      return {
        tag: "cube-three-pyramids",
        label: "Volume",
        prompt: `A cube with edge ${e} is cut into three congruent square pyramids whose apexes all meet at one vertex of the cube. Each pyramid has one face of the cube as its base and height ${e}. What is the volume of one pyramid?`,
        correct: m(e ** 3 / 3),
        wrong: [
          [
            m(e ** 3),
            "That is the whole cube. There are three pyramids, so each has one third of it.",
          ],
          [
            m(e ** 3 / 2),
            "The cube is cut into three congruent pieces, not two.",
          ],
          [
            m(e ** 2 / 3),
            "That divides the base area by 3 but omits the height factor; the cube's volume is base area times height.",
          ],
          [m(e ** 3 / 6), "That would give six pieces."],
        ],
        hint: `The three pyramids are congruent and together fill the cube, whose volume is edge cubed (${e} cubed). Decide what part of the cube's volume each pyramid has.`,
        explanation: [
          `The cube has volume $${e}^3=${e ** 3}$.`,
          `The three congruent pyramids fill the cube, so each has volume $${e ** 3}\\div 3=${e ** 3 / 3}$. With base area $B=${e * e}$ and height $h=${e}$, this is $\\frac{1}{3}Bh$.`,
        ],
        model: { e },
      };
    },
    (r) => {
      const k = r(2, 15);
      const V = 6 * k;
      return {
        tag: "cone-cylinder",
        label: "Volume",
        prompt: `A cone and a cylinder have the same base area and the same height. At every height, the cone's cross-section is a smaller circle, and a comparison of the two solids shows the cone's volume is the same fraction of the cylinder's volume as a pyramid's is of a prism with the same base and height. The cylinder's volume is ${V} cm³. What is the cone's volume?`,
        correct: m(`${V / 3}\\text{ cm}^3`),
        wrong: [
          [
            m(`${V / 2}\\text{ cm}^3`),
            "A pyramid or cone is one third of the matching prism or cylinder, not one half.",
          ],
          [
            m(`${(2 * V) / 3}\\text{ cm}^3`),
            "That is two thirds. The pyramid or cone is one third; the remainder is two thirds.",
          ],
          [
            m(`${3 * V}\\text{ cm}^3`),
            "That multiplies instead of dividing; the cone fits inside the cylinder.",
          ],
        ],
        hint: `The cone fits inside the cylinder with the same base and height. A pyramid's volume is what fraction of the volume of the prism with the same base and height?`,
        explanation: [
          `A cube splits into three congruent pyramids, so a pyramid is one third of the prism with the same base and height. The same fraction holds for a cone and the cylinder with the same base and height.`,
          `Cone volume $=${V}\\div 3=${V / 3}$ cm³.`,
        ],
        model: { V },
      };
    },
    () => ({
      tag: "circumference-justification",
      label: "Justification",
      prompt:
        "Which statement justifies the formula $C=2\\pi r$ for the circumference of a circle of radius $r$?",
      correct:
        "$\\pi=C/d$ is the same for every circle because all circles are similar, so $C=\\pi d=2\\pi r$.",
      wrong: [
        [
          "Measuring a few circles gave ratios close to $6.28$, so the formula holds for every circle.",
          "A few measurements suggest a pattern but do not show it holds for every circle.",
        ],
        [
          "The circumference is the area $\\pi r^2$ divided by $r$.",
          "That gives $\\pi r$, half the circumference. Area and circumference are related by the dissection argument, not by division.",
        ],
        [
          "A circle is a regular polygon with $r$ sides, each of length $2\\pi$.",
          "A circle is not a polygon with a fixed number of sides, and $r$ is a length, not a count.",
        ],
      ],
      hint: "Ask which choice is true for every circle, not only the ones measured, and starts from a definition or a proved fact rather than an observation.",
      explanation: [
        "All circles are similar, so the ratio of circumference to diameter is the same for every circle. That constant is named $\\pi$.",
        "Hence $C=\\pi d$, and since $d=2r$, $C=2\\pi r$.",
      ],
    }),
    () => ({
      tag: "limit-justification",
      label: "Justification",
      prompt:
        "In the argument that cuts a circle into sectors and rearranges them into a rectangle-like shape, why does the shape approach a rectangle as the number of sectors grows?",
      correct:
        "Thinner sectors have nearly straight curved edges, so the long sides become nearly straight and parallel.",
      wrong: [
        [
          "Each sector gets larger as more sectors are cut, so the pieces fill a rectangle.",
          "More cuts make each sector smaller, not larger.",
        ],
        [
          "The radius grows with the number of sectors, which stretches the shape into a rectangle.",
          "The radius of the circle does not change when it is cut into more sectors.",
        ],
        [
          "Cutting into more sectors adds area, so the shape grows to fill a rectangle.",
          "Cutting and rearranging does not change the total area; only the shape of the boundary changes.",
        ],
      ],
      hint: "Picture one sector as the number of sectors increases. What happens to its angle and to the curve on its outer edge?",
      explanation: [
        "As the number of sectors grows, each sector's angle shrinks, so its outer arc becomes closer to a straight segment and its two straight edges become closer to parallel.",
        "The rearranged shape then has nearly straight, nearly parallel long sides and nearly straight short sides, which is close to a rectangle with the same area as the circle.",
      ],
    }),
  ],
};

/* ───────────── registry ───────────── */
const families: Family[] = [
  lineAngleFamily,
  triangleProofFamily,
  parallelogramFamily,
  definitionsFamily,
  transformationInvariantFamily,
  polygonSymmetryFamily,
  transformationConstructionFamily,
  constructionFamily,
  inscribedFamily,
  triangleCirclesFamily,
  tangentFamily,
  circleSimilarityFamily,
  coordinateProofFamily,
  measurementFamily,
];
export const proofConstructionTemplates: readonly TemplateMetadata[] =
  families.map((f) => ({
    ...f.meta,
    version: 1,
    gradeBand: "9–12",
    requiredResponseCapability: "single-choice-v1",
  }));
export function proofConstructionVariantCount(id: string) {
  return families.find((f) => f.meta.id === id)?.variants.length ?? 0;
}
export function proofConstructionCase(id: string, seed: string) {
  const family = families.find((f) => f.meta.id === id);
  const meta = proofConstructionTemplates.find((t) => t.id === id);
  if (!family || !meta) throw new Error("Unknown proof-construction template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  const v = pick(r, family.variants)(r);
  const seen = new Set([v.correct]);
  const wrong = v.wrong.filter(([label]) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(`${id}/${v.tag}: fewer than three distinct wrong choices`);
  const chosen = shuffle(r, wrong).slice(0, 3);
  const assembled = assemble(
    meta,
    seed,
    {
      prompt: v.prompt,
      choices: [
        { label: v.correct, correct: true as const },
        ...chosen.map(([label, feedback]) => ({ label, feedback })),
      ],
      explanation: v.explanation,
      hint: v.hint,
      tags: [v.tag],
    },
    r,
    v.label,
  );
  return { ...assembled, model: v.model };
}
