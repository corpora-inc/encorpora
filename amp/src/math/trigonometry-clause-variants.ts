import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  ClauseBuilder,
  clauseDraw,
  math,
  pick,
  rad,
  round,
  sceneFigure,
} from "./clause-variant-kit";
import { graph, scene, triangle } from "./scene/author";
import { obliqueFigure } from "./geometry-teaching-figures";
import type { Point } from "./scene/spec";

export const trigonometryClauses: Record<string, readonly string[]> = {
  "special-angle-exact-value": ["cut-derivation"],
  "trig-identity-value": [
    "prove-on-circle",
    "prove-sum-formula",
    "tangent-sum-exact",
  ],
  "complementary-trig": ["explain-from-triangle"],
  "oblique-triangle-solve": ["applied-context"],
  "triangle-law-reasoning": ["right-angle-reduction"],
};
const root = (n: number, d: number) => `${n === 1 ? "" : n}\\sqrt{${d}}`;
const exact: Record<number, Record<string, string>> = {
  30: {
    sin: "\\frac{1}{2}",
    cos: "\\frac{\\sqrt{3}}{2}",
    tan: "\\frac{\\sqrt{3}}{3}",
  },
  45: { sin: "\\frac{\\sqrt{2}}{2}", cos: "\\frac{\\sqrt{2}}{2}", tan: "1" },
  60: { sin: "\\frac{\\sqrt{3}}{2}", cos: "\\frac{1}{2}", tan: "\\sqrt{3}" },
};
const circlePoint = (d: number): Point => [Math.cos(rad(d)), Math.sin(rad(d))];

export function trigonometryClause(
  meta: TemplateMetadata,
  seed: string,
  force?: string,
): GeneratedProblem | null {
  const variants = trigonometryClauses[meta.id];
  if (!variants) return null;
  const variant = force ?? clauseDraw(meta.id, seed, variants);
  if (variant === "legacy") return null;
  const b = new ClauseBuilder(meta, seed, variant),
    r = b.r;
  if (variant === "cut-derivation") {
    const degrees = pick(r, [30, 45, 60]),
      fn = pick(r, ["sin", "cos", "tan"]),
      square = degrees === 45;
    const k = pick(r, square ? [1, 2, 4, 6, 10] : [1, 2, 3, 5]),
      h = k * Math.sqrt(3),
      diagonal = k * Math.sqrt(2);
    const first = square ? root(k, 2) : root(k, 3),
      value = exact[degrees]![fn]!;
    const t = square
      ? triangle([
          [0, 0],
          [k, 0],
          [k, k],
        ])
          .names("A", "B", "C")
          .side(0, { label: `${k}` })
          .side(1, { label: `${k}` })
          .side(2, { label: "?" })
          .angle(1, { mark: "right" })
          .angle(0, { mark: "arc", label: "45°", color: "gold" })
      : triangle([
          [0, 0],
          [k, 0],
          [0, h],
        ])
          .names("D", "B", "A")
          .side(0, { label: `${k}` })
          .side(1, { label: `${2 * k}` })
          .side(2, { label: "?" })
          .angle(0, { mark: "right" })
          .angle(degrees === 30 ? 2 : 1, {
            mark: "arc",
            label: `${degrees}°`,
            color: "gold",
          });
    const figure = square
      ? sceneFigure(
          scene(
            t,
            { type: "segment", from: [0, 0], to: [0, k] },
            { type: "segment", from: [0, k], to: [k, k] },
          ).build({ title: `A square of side ${k}, cut along its diagonal` }),
        )
      : sceneFigure(
          scene(
            t,
            { type: "segment", from: [-k, 0], to: [0, h] },
            { type: "segment", from: [-k, 0], to: [0, 0] },
          ).build({
            title: `An equilateral triangle of side ${2 * k}, cut by its altitude`,
          }),
        );
    const radians =
      degrees === 30 ? "\\pi/6" : degrees === 45 ? "\\pi/4" : "\\pi/3";
    const opposite =
        degrees === 30 ? `${k}` : degrees === 45 ? `${k}` : root(k, 3),
      adjacent = degrees === 30 ? root(k, 3) : `${k}`,
      hyp = square ? root(k, 2) : `${2 * k}`;
    const numerator = fn === "cos" ? adjacent : opposite,
      denominator = fn === "tan" ? adjacent : hyp;
    void diagonal;
    return b.parts(
      {
        prompt: square
          ? `A square has side ${k}. Its diagonal creates two congruent right triangles. Find the diagonal length, then use the gold 45° angle to derive $\\${fn}(${radians})$. Here $45^\\circ=${radians}$.`
          : `An equilateral triangle has side ${2 * k}. Its altitude bisects the base into lengths ${k} and ${k} and the apex into two 30° angles. Find the altitude length, then derive $\\${fn}(${radians})$ at the gold angle. Here $${degrees}^\\circ=${radians}$.`,
        figure,
        hint: square
          ? `The diagonal is the hypotenuse: square both legs of length ${k} and add.`
          : `The sloping side ${2 * k} is the hypotenuse. Subtract the square of the base leg ${k} from its square.`,
        explanation: [
          square
            ? `$d^2=${k}^2+${k}^2=${2 * k * k}$, so $d=${first}$.`
            : `$h^2=(${2 * k})^2-${k}^2=${3 * k * k}$, so $h=${first}$.`,
          `At ${degrees}°, opposite is $${opposite}$, adjacent is $${adjacent}$, and hypotenuse is $${hyp}$.`,
          `$\\${fn}(${radians})=\\frac{${numerator}}{${denominator}}=${value}$.`,
          "The scale factor cancels. The ratio depends on the angle, not the size of the triangle.",
        ],
      },
      [
        {
          label: square ? "Diagonal length" : "Altitude length",
          correct: math(first),
          wrong: [
            math(`${2 * k}`),
            math(root(k, square ? 3 : 2)),
            math(root(k, 5)),
            math(`${k}`),
          ],
        },
        {
          label: `Exact ${fn} at the gold angle`,
          correct: math(value),
          wrong: [
            ...new Set([
              "\\frac{1}{2}",
              "\\frac{\\sqrt{2}}{2}",
              "\\frac{\\sqrt{3}}{2}",
              "\\frac{\\sqrt{3}}{3}",
              "\\sqrt{3}",
              "\\sqrt{2}",
              "1",
              "2",
              "3",
            ]),
          ]
            .filter((x) => x !== value)
            .map(math),
        },
      ],
    );
  }
  if (variant === "prove-on-circle") {
    const angles = Array.from({ length: 51 }, (_, i) => 100 + 5 * i).filter(
      (d) =>
        (d <= 170 || (d >= 190 && d <= 260) || d >= 280) &&
        d % 30 &&
        d % 45 &&
        Math.abs(
          round(Math.cos(rad(d)), 2) ** 2 + round(Math.sin(rad(d)), 2) ** 2 - 1,
        ) < 0.005,
    );
    const theta = pick(r, angles),
      [x, y] = circlePoint(theta),
      negative = x < 0 ? "cos" : "sin";
    const g = graph({ x: [-1.4, 1.4], y: [-1.4, 1.4], aspect: 1 })
      .circle([0, 0], 1)
      .point(x, y, "P")
      .segment([0, 0], [x, y], { color: "accent" })
      .segment([0, 0], [x, 0], { color: "gold" })
      .segment([x, 0], [x, y], { color: "warm" });
    return b.parts(
      {
        figure: sceneFigure(g.scene()),
        prompt: `Point $P=(\\cos\\theta,\\sin\\theta)$ is on the circle of radius 1 at $\\theta=${theta}^\\circ$, approximately (${round(x, 2)}, ${round(y, 2)}). The reference triangle has hypotenuse 1 and legs $|\\cos\\theta|$ and $|\\sin\\theta|$. Here $\\${negative}\\theta<0$. Complete the proof, then divide the identity by $\\cos^2\\theta$ (which is nonzero).`,
        hint: "Apply the right-triangle rule to the two leg lengths and hypotenuse 1. Squares of negative coordinates equal squares of their positive lengths.",
        explanation: [
          "Pythagoras gives $|\\cos\\theta|^2+|\\sin\\theta|^2=1^2$.",
          "Squaring removes signs, so $\\cos^2\\theta+\\sin^2\\theta=1$, in every quadrant.",
          "Divide every term by $\\cos^2\\theta$: $1+\\tan^2\\theta=\\sec^2\\theta$. Here $\\tan\\theta=\\sin\\theta/\\cos\\theta$ and $\\sec\\theta=1/\\cos\\theta$. The divided identity requires $\\cos\\theta\\ne0$.",
        ],
      },
      [
        {
          label: "Which equation follows from Pythagoras?",
          correct: "$\\cos^2\\theta+\\sin^2\\theta=1$",
          wrong: [
            "$\\cos\\theta+\\sin\\theta=1$",
            "$\\cos^2\\theta-\\sin^2\\theta=1$",
            "The equation only holds in quadrant I",
          ],
        },
        {
          label: "Why does the negative coordinate not invalidate the proof?",
          correct:
            "Squaring a coordinate gives the same square as its absolute length",
          wrong: [
            "The identity only holds for acute angles",
            "Only the reference angle satisfies the identity",
            "Both coordinates are positive in every quadrant",
          ],
        },
        {
          label: "After dividing by cos²θ",
          correct: "$1+\\tan^2\\theta=\\sec^2\\theta$",
          wrong: [
            "$1+\\tan^2\\theta=\\csc^2\\theta$",
            "$1+\\tan^2\\theta=1$",
            "$1+\\tan\\theta=\\sec\\theta$",
          ],
        },
      ],
    );
  }
  if (variant === "prove-sum-formula") {
    const ask = r(0, 4),
      sign = r(0, 1) ? "+" : "-";
    let alpha: number, beta: number;
    const separates = (a: number, c: number) => {
      const sa = Math.sin(rad(a)),
        ca = Math.cos(rad(a)),
        sb = Math.sin(rad(c)),
        cb = Math.cos(rad(c)),
        s = sign === "+" ? 1 : -1;
      const values =
        ask === 0
          ? [0, 1, 2, 3]
          : ask <= 2
            ? [
                ca * cb + (ask === 1 ? 1 : -1) * sa * sb,
                ca + (ask === 1 ? -1 : 1) * cb,
                ca * cb + (ask === 1 ? -1 : 1) * sa * sb,
                sa * sb - ca * cb,
              ]
            : ask === 3
              ? [
                  sa * cb + s * ca * sb,
                  sa * sb + ca * cb,
                  sa * cb - s * ca * sb,
                  sa + s * sb,
                ]
              : [
                  (sa / ca + (s * sb) / cb) / (1 - (((s * sa) / ca) * sb) / cb),
                  (sa / ca + (s * sb) / cb) / (1 + (((s * sa) / ca) * sb) / cb),
                  sa / ca + (s * sb) / cb,
                  -(sa / ca + (s * sb) / cb) /
                    (1 - (((s * sa) / ca) * sb) / cb),
                ];
      return values.every(
        (v, i) =>
          Number.isFinite(v) &&
          values.slice(i + 1).every((w) => Math.abs(v - w) > 0.05),
      );
    };
    do {
      alpha = r(19, 32) * 5;
      beta = r(4, 14) * 5;
    } while (
      alpha === 2 * beta ||
      Math.abs(Math.cos(rad(alpha))) < 0.05 ||
      Math.abs(Math.cos(rad(alpha + beta))) < 0.1 ||
      Math.abs(Math.cos(rad(alpha - beta))) < 0.1 ||
      !separates(alpha, beta)
    );
    const A = circlePoint(alpha),
      B = circlePoint(beta),
      C: Point = [1, 0],
      D = circlePoint(alpha - beta);
    const g = graph({ x: [-1.4, 1.4], y: [-1.4, 1.4], aspect: 1 })
      .circle([0, 0], 1)
      .point(...A, "A")
      .point(...B, "B")
      .point(...C, "C")
      .point(...D, "D")
      .segment(A, B, { color: "accent" })
      .segment(C, D, { color: "warm" })
      .segment([0, 0], A, { dash: "dash" })
      .segment([0, 0], B, { dash: "dash" })
      .segment([0, 0], C, { dash: "dash" })
      .segment([0, 0], D, { dash: "dash" });
    const context = `On the unit circle, $A=(\\cos\\alpha,\\sin\\alpha)$, $B=(\\cos\\beta,\\sin\\beta)$, $C=(1,0)$, and $D=(\\cos(\\alpha-\\beta),\\sin(\\alpha-\\beta))$. The drawing uses $\\alpha=${alpha}^\\circ$, $\\beta=${beta}^\\circ$. Both chords subtend angle $\\alpha-\\beta$.`;
    const proof = [
      "A rotation by −β takes A to D and B to C, preserving lengths. Thus AB = CD.",
      "$AB^2=2-2(\\cos\\alpha\\cos\\beta+\\sin\\alpha\\sin\\beta)$ and $CD^2=2-2\\cos(\\alpha-\\beta)$.",
      "Equate them and cancel to obtain $\\cos(\\alpha-\\beta)=\\cos\\alpha\\cos\\beta+\\sin\\alpha\\sin\\beta$.",
      "Replacing β by −β gives the cosine sum formula, because cosine is even and sine is odd.",
      "Use $\\sin t=\\cos(\\pi/2-t)$ to derive sine sums and differences. Dividing sine by cosine then gives tangent formulas where the denominators are nonzero.",
    ];
    let prompt: string, correct: string, wrong: string[];
    if (ask === 0) {
      prompt = "Why are the two chords equal?";
      correct =
        "Rotating by −β carries one chord to the other and preserves length.";
      wrong = [
        "Both chords are radii.",
        "A and D must have the same vertical coordinate.",
        "All chords on the unit circle have equal length.",
      ];
    } else if (ask === 1 || ask === 2) {
      const plus = ask === 2;
      prompt = plus
        ? "After proving the cosine difference formula, replace β by −β. Which formula follows using even cosine and odd sine?"
        : "Expand AB² = CD² with the distance formula and use sin² + cos² = 1. Which formula follows?";
      const s = plus ? "+" : "-",
        termSign = plus ? "-" : "+";
      correct = `$\\cos(\\alpha${s}\\beta)=\\cos\\alpha\\cos\\beta${termSign}\\sin\\alpha\\sin\\beta$`;
      wrong = [
        `$\\cos(\\alpha${s}\\beta)=\\cos\\alpha${s}\\cos\\beta$`,
        `$\\cos(\\alpha${s}\\beta)=\\cos\\alpha\\cos\\beta${plus ? "+" : "-"}\\sin\\alpha\\sin\\beta$`,
        `$\\cos(\\alpha${s}\\beta)=\\sin\\alpha\\sin\\beta-\\cos\\alpha\\cos\\beta$`,
      ];
    } else if (ask === 3) {
      prompt = `Start from $\\sin(\\alpha${sign}\\beta)=\\cos(\\pi/2-(\\alpha${sign}\\beta))$. Expand with the cosine formula and simplify the complementary-angle values. Which result follows?`;
      correct = `$\\sin\\alpha\\cos\\beta${sign}\\cos\\alpha\\sin\\beta$`;
      wrong = [
        "$\\sin\\alpha\\sin\\beta+\\cos\\alpha\\cos\\beta$",
        `$\\sin\\alpha\\cos\\beta${sign === "+" ? "-" : "+"}\\cos\\alpha\\sin\\beta$`,
        `$\\sin\\alpha${sign}\\sin\\beta$`,
      ];
    } else {
      const opp = sign === "+" ? "-" : "+";
      prompt = `For $\\tan(\\alpha${sign}\\beta)$, divide $\\frac{\\sin\\alpha\\cos\\beta${sign}\\cos\\alpha\\sin\\beta}{\\cos\\alpha\\cos\\beta${opp}\\sin\\alpha\\sin\\beta}$ above and below by $\\cos\\alpha\\cos\\beta$. Assume all denominators are nonzero. What results?`;
      correct = `$\\frac{\\tan\\alpha${sign}\\tan\\beta}{1${opp}\\tan\\alpha\\tan\\beta}$`;
      wrong = [
        `$\\frac{\\tan\\alpha${sign}\\tan\\beta}{1${sign}\\tan\\alpha\\tan\\beta}$`,
        `$\\tan\\alpha${sign}\\tan\\beta$`,
        `$-\\frac{\\tan\\alpha${sign}\\tan\\beta}{1${opp}\\tan\\alpha\\tan\\beta}$`,
      ];
    }
    return b.choice(
      {
        prompt: `${context} ${prompt}`,
        figure: sceneFigure(g.scene()),
        hint:
          ask <= 1
            ? "Rotation by −β sends the point at angle β to angle 0. Track where it sends the other endpoint."
            : "Keep products in the expansion. Replacing an angle by its negative changes sine's sign but not cosine's sign.",
        explanation: proof,
      },
      correct,
      wrong,
    );
  }
  if (variant === "tangent-sum-exact") {
    const degrees = pick(r, [15, 75, 105, 165]),
      radians = r(0, 1) === 1;
    const values: Record<number, string> = {
      15: "2-\\sqrt{3}",
      75: "2+\\sqrt{3}",
      105: "-(2+\\sqrt{3})",
      165: "-(2-\\sqrt{3})",
    };
    const pair: Record<number, [number, number, "+" | "-"]> = {
      15: [45, 30, "-"],
      75: [45, 30, "+"],
      105: [60, 45, "+"],
      165: [135, 30, "+"],
    };
    const [a, c, sign] = pair[degrees]!,
      name = radians
        ? `${degrees / 15 === 1 ? "" : degrees / 15}\\pi/12`
        : `${degrees}^\\circ`,
      ta = a === 45 ? "1" : a === 60 ? "\\sqrt{3}" : "-1",
      tc = c === 30 ? "\\sqrt{3}/3" : "1";
    const wrongAdded =
      a === 135
        ? "-1+\\sqrt{3}/3"
        : degrees === 15
          ? "1-\\sqrt{3}/3"
          : degrees === 75
            ? "1+\\sqrt{3}/3"
            : "\\sqrt{3}+1";
    return b.choice(
      {
        prompt: `Use the tangent addition or subtraction formula to find the exact value of $\\tan(${name})$. Use $${degrees}^\\circ=${a}^\\circ${sign}${c}^\\circ$.`,
        hint: `Use $\\tan(A${sign}B)=\\frac{\\tan A${sign}\\tan B}{1${sign === "+" ? "-" : "+"}\\tan A\\tan B}$. Substitute the known values at ${a}° and ${c}°.`,
        explanation: [
          `$\\tan ${a}^\\circ=${ta}$ and $\\tan ${c}^\\circ=${tc}$.`,
          `$\\tan ${degrees}^\\circ=\\frac{(${ta})${sign}(${tc})}{1${sign === "+" ? "-" : "+"}(${ta})(${tc})}=${values[degrees]}$.`,
          "Rationalize a denominator containing a square root by multiplying above and below by its conjugate (the same terms with the middle sign reversed).",
          `Numerically the value is about ${round(Math.tan(rad(degrees)), 4)}, consistent with the angle's quadrant.`,
        ],
      },
      math(values[degrees]!),
      [
        math(
          values[
            degrees === 15
              ? 75
              : degrees === 75
                ? 15
                : degrees === 105
                  ? 165
                  : 105
          ]!,
        ),
        math(wrongAdded),
        math(
          degrees === 15 || degrees === 165
            ? "(\\sqrt{6}-\\sqrt{2})/4"
            : "(\\sqrt{6}+\\sqrt{2})/4",
        ),
      ],
    );
  }
  if (
    variant === "explain-from-triangle" ||
    variant === "right-angle-reduction"
  ) {
    const [baseA, baseB, baseC] = pick(r, [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
        [20, 21, 29],
      ] as const),
      k = r(1, 3),
      a = baseA * k,
      c = baseC * k,
      d = baseB * k;
    const goldA = r(0, 1) === 1,
      named = goldA ? "A" : "B",
      other = goldA ? "B" : "A",
      opposite = goldA ? a : d;
    const figure = sceneFigure(
      triangle([
        [d, 0],
        [0, a],
        [0, 0],
      ])
        .names("A", "B", "C")
        .side(0, {
          label: variant === "right-angle-reduction" ? "c = ?" : `c = ${c}`,
        })
        .side(1, { label: `a = ${a}` })
        .side(2, { label: `b = ${d}` })
        .angle(2, { mark: "right" })
        .angle(goldA ? 0 : 1, { mark: "arc", color: "gold" })
        .scene(),
    );
    if (variant === "explain-from-triangle") {
      const reason = r(0, 1) === 1;
      const correct = reason
        ? `The side opposite ${named} touches ${other}; both ratios divide it by the hypotenuse.`
        : `$\\cos ${other}$`;
      return b.choice(
        {
          figure,
          prompt: `Triangle ABC has right angle C and sides $a=${a}$, $b=${d}$, $c=${c}$. ${reason ? `Why is $\\sin ${named}=\\cos ${other}$ for every such right triangle?` : `$\\sin ${named}=${opposite}/${c}$. Which ratio at the other acute angle uses these same two sides?`}`,
          hint: `Locate the side of length ${opposite}. It is opposite ${named}; look at its position relative to ${other}.`,
          explanation: [
            `At ${named}, sine is opposite over hypotenuse: ${opposite}/${c}.`,
            `At ${other}, that same side is adjacent, so cosine is ${opposite}/${c}.`,
            "The acute angles add to 90° because the triangle's angles total 180° and C is 90°. Changing the reference angle changes the side's role, not its length.",
          ],
        },
        correct,
        reason
          ? [
              "The two acute angles in every right triangle are equal.",
              "The two legs of every right triangle have equal length.",
              "Sine and cosine are equal at every acute angle.",
            ]
          : [`$\\sin ${other}$`, `$\\tan ${other}$`, `$\\tan ${named}$`],
      );
    }
    const ask = r(0, 2);
    const copy = {
      figure,
      prompt: `In triangle ABC, $C=90^\\circ$, $a=${a}$, and $b=${d}$. ${ask === 0 ? "What does the law of cosines for side c become?" : ask === 1 ? "What does a/sin A = c/sin C become?" : "Use the law of cosines to find c."}`,
      hint: `The law of cosines has correction term $2ab\\cos C$. Substitute $C=90^\\circ$ before calculating.`,
      explanation: [
        "Since $\\cos90^\\circ=0$, $c^2=a^2+b^2-2ab\\cos C$ becomes $c^2=a^2+b^2$.",
        `$c=\\sqrt{${a ** 2}+${d ** 2}}=${c}$.`,
        `Since $\\sin90^\\circ=1$, $a/\\sin A=c$ gives $\\sin A=a/c=${a}/${c}$. The laws include right-triangle trigonometry.`,
      ],
    };
    if (ask === 2) return b.work(copy, [{ label: "Hypotenuse c", value: c }]);
    return ask === 0
      ? b.choice(copy, "$c^2=a^2+b^2$", [
          "$c^2=a^2+b^2-2ab$",
          "$c^2=a^2+b^2+2ab$",
          "$c^2=a^2-b^2$",
        ])
      : b.choice(copy, "$\\sin A=a/c$", [
          "$\\cos A=a/c$",
          "$\\sin A=c/a$",
          "$a/\\sin A=c\\sin90^\\circ=0$",
        ]);
  }
  if (variant === "applied-context") {
    const context = r(0, 2),
      structured = r(0, 1) === 1;
    if (context === 0) {
      let P: number,
        Q: number,
        R: number,
        baseline: number,
        result: number,
        wrong: number[];
      do {
        P = r(35, 85);
        Q = r(30, 80);
        R = 180 - P - Q;
        baseline = 20 * r(6, 24);
        result = (baseline * Math.sin(rad(Q))) / Math.sin(rad(R));
        wrong = [
          (baseline * Math.sin(rad(P))) / Math.sin(rad(R)),
          (baseline * Math.sin(rad(Q))) / Math.sin(rad(P)),
          result * Math.sin(rad(P)),
        ];
      } while (
        R < 30 ||
        wrong.some((x) => Math.abs(x - result) <= 2) ||
        new Set([result, ...wrong].map((x) => round(x, 0))).size < 4
      );
      const answer = round(result, 0),
        otherSide = (baseline * Math.sin(rad(P))) / Math.sin(rad(R));
      const figure = sceneFigure(
        obliqueFigure({
          names: ["P", "Q", "R"],
          sides: [otherSide, result, baseline],
          shown: { c: `${baseline} m`, b: null },
          angles: { A: `${P}°`, B: `${Q}°` },
        }),
      );
      const copy = {
        figure,
        prompt: `Surveying: stations P and Q are on one riverbank, ${baseline} m apart. Landmark R is across the river. The triangle angles are P = ${P}° and Q = ${Q}°. Find the distance PR to the nearest meter.`,
        hint: `Find angle R by subtracting ${P}° and ${Q}° from 180°. PR lies opposite angle Q.`,
        explanation: [
          `$R=180^\\circ-${P}^\\circ-${Q}^\\circ=${R}^\\circ$.`,
          `The sine law gives $PR/\\sin ${Q}^\\circ=${baseline}/\\sin ${R}^\\circ$.`,
          `$PR=${baseline}\\sin ${Q}^\\circ/\\sin ${R}^\\circ\\approx${round(result, 4)}$ m, which rounds to ${answer} m.`,
          "The perpendicular river width is a different distance, shorter than PR here.",
        ],
      };
      return structured
        ? b.work(copy, [
            { label: "Angle R (degrees)", value: R },
            { label: "Distance PR (nearest meter)", value: answer },
          ])
        : b.choice(
            copy,
            `${answer} m`,
            wrong.map((x) => `${round(x, 0)} m`),
          );
    }
    let first: number,
      second: number,
      phi: number,
      result: number,
      wrong: number[];
    do {
      first = r(context === 1 ? 10 : 8, context === 1 ? 90 : 60);
      second = r(context === 1 ? 10 : 8, context === 1 ? 90 : 60);
      phi = pick(
        r,
        Array.from({ length: 21 }, (_, i) => 40 + 5 * i),
      );
      result = Math.sqrt(
        first ** 2 + second ** 2 + 2 * first * second * Math.cos(rad(phi)),
      );
      wrong = [
        Math.sqrt(
          first ** 2 + second ** 2 - 2 * first * second * Math.cos(rad(phi)),
        ),
        first + second,
        Math.hypot(first, second),
        Math.abs(first - second),
      ];
    } while (
      !structured &&
      (phi === 90 ||
        new Set([result, ...wrong].map((x) => round(x))).size < 5 ||
        wrong.some((x) => Math.abs(x - result) <= 0.2))
    );
    const answer = round(result),
      interior = 180 - phi,
      bearing1 = r(0, 17) * 10,
      bearing2 = bearing1 + phi;
    const unit = context === 1 ? "N" : "km";
    const u: Point = [first, 0],
      end: Point = [
        first + second * Math.cos(rad(phi)),
        second * Math.sin(rad(phi)),
      ];
    const g = graph({
      x: [Math.min(0, end[0]) - 5, Math.max(first, end[0]) + 5],
      y: [-5, Math.max(5, end[1]) + 5],
      grid: 10,
      aspect: 1,
    })
      .segment([0, 0], u, { arrow: true, color: "accent" })
      .segment(u, end, { arrow: true, color: "warm" })
      .segment([0, 0], end, { color: "gold" })
      .point(0, 0, "P")
      .point(...u, "Q")
      .point(...end, "R");
    const copy = {
      figure: sceneFigure(
        g.scene({
          note:
            context === 2
              ? "Triangle rotated to show the first leg horizontally; bearings are measured clockwise from north."
              : "Vectors placed tail to head; the gold segment is the resultant.",
        }),
      ),
      prompt:
        context === 1
          ? `Two forces of ${first} N and ${second} N act at a point with angle ${phi}° between them. Find the resultant magnitude to the nearest tenth of a newton.`
          : `A ship leaves harbor on bearing ${bearing1}° for ${first} km, then travels ${second} km on bearing ${bearing2}°. Bearings are clockwise from north. How far is the ship from harbor, to the nearest tenth of a kilometer?`,
      hint: `The direction change is ${phi}°, so the interior triangle angle at the join is 180° − ${phi}°.`,
      explanation: [
        `The triangle's included angle is ${interior}°.`,
        `$R^2=${first}^2+${second}^2-2(${first})(${second})\\cos ${interior}^\\circ=${first}^2+${second}^2+2(${first})(${second})\\cos ${phi}^\\circ$.`,
        `Take the square root and round once: $R\\approx${round(result, 4)}$, giving ${answer} ${unit}.`,
        `Check: the result is between ${Math.abs(first - second)} and ${first + second} ${unit}.`,
      ],
    };
    return structured
      ? b.work(copy, [
          { label: "Interior angle at the join (degrees)", value: interior },
          { label: `Result (nearest tenth, ${unit})`, value: answer },
        ])
      : b.choice(
          copy,
          `${answer} ${unit}`,
          wrong.map((x) => `${round(x)} ${unit}`),
        );
  }
  throw new Error(`Unhandled trigonometry clause ${variant}`);
}
