import { term } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  ClauseBuilder,
  clauseDraw,
  math,
  matrix,
  multiply,
  pick,
  rad,
  round,
  same,
  scale,
  sceneFigure,
  sum,
  table,
  transpose,
  vector,
} from "./clause-variant-kit";
import { graph } from "./scene/author";

/** A negative factor in parentheses, so "+ -2" does not appear. */
const signedFactor = (n: number) => (n < 0 ? `(${n})` : String(n));

export const vectorMatrixClauses: Record<string, readonly string[]> = {
  "matrix-linear-system": ["three-by-three-tool-inverse"],
  "vector-components": [
    "draw-the-arrow",
    "parallelogram-rule",
    "sum-vs-sum-of-lengths",
    "opposite-vector",
    "scale-the-arrow",
    "scalar-multiple-direction",
  ],
  "vector-resultant": ["non-perpendicular-resultant"],
  "matrix-laws": [
    "zero-and-identity-roles",
    "compute-both-orders",
    "noncommutative-laws",
  ],
  "matrix-data-reading": ["network-and-payoff", "build-from-text"],
  "matrix-operations": ["scale-in-context", "difference"],
};
type Vec = [number, number];
const add = (u: Vec, v: Vec): Vec => [u[0] + v[0], u[1] + v[1]];
const times = (c: number, v: Vec): Vec => [c * v[0], c * v[1]];
const length = (v: Vec) => Math.hypot(...v);
const cross = (u: Vec, v: Vec) => u[0] * v[1] - u[1] * v[0];
const angle = (a: number) => ((a % 360) + 360) % 360;
const I = [
    [1, 0],
    [0, 1],
  ],
  O = [
    [0, 0],
    [0, 0],
  ];
function arrows(tail: Vec, vectors: Vec[], end?: Vec) {
  const tips = vectors.map((v) => add(tail, v));
  const all = [tail, ...tips, ...(end ? [end] : [])];
  const bound = Math.max(5, ...all.flat().map(Math.abs)) + 1;
  const g = graph({
    x: [-bound, bound],
    y: [-bound, bound],
    grid: Math.max(1, Math.ceil(bound / 10)),
    aspect: 1,
  }).point(...tail, "O");
  tips.forEach((p, i) =>
    g
      .segment(tail, p, { arrow: true, color: i ? "warm" : "accent" })
      .point(...p, i ? "W" : "V"),
  );
  return g;
}
const radtex = (n: number): string => {
  if (!n) return "0";
  let k = 1,
    d = n;
  for (let f = 2; f * f <= d; f++)
    while (d % (f * f) === 0) {
      d /= f * f;
      k *= f;
    }
  return d === 1 ? `${k}` : `${k === 1 ? "" : k}\\sqrt{${d}}`;
};

export function vectorMatrixClause(
  meta: TemplateMetadata,
  seed: string,
  force?: string,
): GeneratedProblem | null {
  const variants = vectorMatrixClauses[meta.id];
  if (!variants) return null;
  const variant = force ?? clauseDraw(meta.id, seed, variants);
  if (variant === "legacy") return null;
  const b = new ClauseBuilder(meta, seed, variant),
    r = b.r;
  const nz = (max: number) =>
    pick(
      r,
      Array.from({ length: 2 * max }, (_, i) =>
        i < max ? i - max : i - max + 1,
      ),
    );
  const randomMatrix = (rows = 2, cols = 2, max = 6) =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => r(-max, max)),
    );
  if (variant === "three-by-three-tool-inverse") {
    for (let attempt = 0; attempt < 10000; attempt++) {
      const L = [
        [1, 0, 0],
        [r(-3, 3), 1, 0],
        [r(-3, 3), r(-3, 3), 1],
      ];
      const U = [
        [nz(1), r(-3, 3), r(-3, 3)],
        [0, nz(1), r(-3, 3)],
        [0, 0, nz(1)],
      ];
      const A = multiply(L, U);
      const det =
        A[0]![0]! * (A[1]![1]! * A[2]![2]! - A[1]![2]! * A[2]![1]!) -
        A[0]![1]! * (A[1]![0]! * A[2]![2]! - A[1]![2]! * A[2]![0]!) +
        A[0]![2]! * (A[1]![0]! * A[2]![1]! - A[1]![1]! * A[2]![0]!);
      const inv = transpose(
        A.map((row, i) =>
          row.map((_, j) => {
            const minor = A.filter((_, k) => k !== i).map((v) =>
              v.filter((_, k) => k !== j),
            );
            return (
              ((-1) ** (i + j) *
                (minor[0]![0]! * minor[1]![1]! -
                  minor[0]![1]! * minor[1]![0]!)) /
              det
            );
          }),
        ),
      );
      if (
        A.flat().some((x) => Math.abs(x) > 9) ||
        inv.flat().some((x) => Math.abs(x) > 12) ||
        !A.every((row) => row.some((x) => x < 0)) ||
        !A.flat().some((x) => Math.abs(x) === 1)
      )
        continue;
      const X = Array.from({ length: 3 }, () => [r(-5, 5)]),
        B = multiply(A, X);
      const slip = A.map((row) => [...row]);
      const negative = slip.flat().findIndex((x) => x < 0);
      slip[Math.floor(negative / 3)]![negative % 3]! *= -1;
      const solutionChoices = [
        X,
        multiply(transpose(inv), B),
        multiply(A, B),
        [...X].reverse(),
      ].map((x) => vector(x.map((row) => row[0]!)));
      const coefficientChoices = [
        matrix(A),
        matrix(transpose(A)),
        matrix(slip),
        "The augmented matrix, including the constants column",
      ];
      if (
        new Set(solutionChoices).size !== 4 ||
        new Set(coefficientChoices).size !== 4
      )
        continue;
      const equation = (row: number[], value: number) =>
        row
          .flatMap((v, i) =>
            v === 0
              ? []
              : [
                  `${v < 0 ? "-" : "+"}${Math.abs(v) === 1 ? "" : Math.abs(v)}${"xyz"[i]}`,
                ],
          )
          .join("")
          .replace(/^\+/, "") + `=${value}`;
      return b.parts(
        {
          prompt: `Write this system as $AX=B$, with $X=(x,y,z)^T$: ${A.map((row, i) => math(equation(row, B[i]![0]!))).join(", ")}. A calculator supplies $A^{-1}=$ ${matrix(inv)}. Identify the coefficient matrix, then use the supplied inverse to solve.`,
          hint: `In the first equation, the coefficients in $x,y,z$ order are ${A[0]!.join(", ")}. The supplied inverse starts ${inv[0]!.join(", ")}. The coefficients form the first row of $A$; then multiply that inverse by $B$.`,
          explanation: [
            `Rows follow equations; columns follow $x,y,z$. Thus $A=$ ${matrix(A)} and $B=$ ${matrix(B)}.`,
            `Multiply on the left: $X=A^{-1}B=$ ${matrix(X)}. Each entry is a row of the inverse dotted with $B$.`,
            ...A.map(
              (row, i) =>
                `Equation ${i + 1}: ${row.map((v, j) => `${term(v)}(${X[j]![0]})`).join(" + ")} = ${B[i]![0]}, as required.`,
            ),
          ],
        },
        [
          {
            label: "Coefficient matrix A",
            correct: coefficientChoices[0]!,
            wrong: coefficientChoices.slice(1),
          },
          {
            label: "Solution (x, y, z)",
            correct: solutionChoices[0]!,
            wrong: solutionChoices.slice(1),
          },
        ],
      );
    }
    throw new Error("3 by 3 rejection limit");
  }
  if (
    variant === "draw-the-arrow" ||
    variant === "scale-the-arrow" ||
    variant === "parallelogram-rule"
  ) {
    const plot = r(0, 1) === 0;
    let u: Vec,
      v: Vec,
      tail: Vec,
      c = 1,
      result: Vec;
    do {
      tail =
        variant === "parallelogram-rule" && r(0, 1) === 0
          ? [0, 0]
          : [r(-3, 3), r(-3, 3)];
      u = [nz(3), nz(3)];
      v = [nz(4), nz(4)];
      if (variant === "scale-the-arrow") {
        c = pick(r, [-3, -2, -0.5, 0.5, 2, 3]);
        if (Math.abs(c) === 0.5) u = [pick(r, [-2, 2]), pick(r, [-2, 2])];
      }
      result = variant === "parallelogram-rule" ? add(u, v) : times(c, u);
    } while (
      cross(u, v) === 0 ||
      [...add(tail, result), ...add(tail, u), ...add(tail, v)].some(
        (x) => Math.abs(x) > 9,
      )
    );
    const tip = add(tail, result),
      isPara = variant === "parallelogram-rule";
    const g = arrows(
      tail,
      variant === "draw-the-arrow" ? [] : isPara ? [u, v] : [u],
      tip,
    );
    if (isPara)
      g.segment(add(tail, u), tip, { dash: "dash" }).segment(
        add(tail, v),
        tip,
        { dash: "dash" },
      );
    const task = isPara
      ? `$u=${vector(u).slice(1, -1)}$, $v=${vector(v).slice(1, -1)}$. The dashed sides complete their parallelogram. Its diagonal from $O$ represents $u+v$.`
      : variant === "scale-the-arrow"
        ? `$v=${vector(u).slice(1, -1)}$. Represent $${c}v$ from the same tail.`
        : `A hiker's displacement is ${Math.abs(u[0])} km ${u[0] > 0 ? "east" : "west"} and ${Math.abs(u[1])} km ${u[1] > 0 ? "north" : "south"}. One grid unit is 1 km.`;
    const copy = {
      prompt: `The tail is $O=(${tail.join(",")})$. ${task} ${plot ? "Plot the tip." : "Choose the arrow representing the requested displacement."}`,
      figure: sceneFigure(g.scene()),
      hint: `Start at (${tail.join(", ")}), then apply the horizontal and vertical moves. ${isPara ? "Add matching components." : variant === "scale-the-arrow" ? `Multiply both components by ${c}.` : "East is positive; south is negative."}`,
      explanation: [
        isPara
          ? `Moving by $u$ then $v$ ends at the same vertex as moving by $v$ then $u$. The diagonal displacement is ${vector(result)}.`
          : `The displacement is ${vector(result)}. ${c < 0 ? "The negative scalar reverses direction as well as scaling length." : "Both components describe movement from the tail."}`,
        `Add the displacement to the tail: (${tail.join(", ")}) + ${vector(result)} gives tip (${tip.join(", ")}).`,
        "A vector is a move, so a translated tail changes the tip's coordinates but not the displacement.",
      ],
    };
    if (plot)
      return b.plot(
        copy,
        [tip],
        { xMin: -10, xMax: 10, yMin: -10, yMax: 10, xLabel: "x", yLabel: "y" },
        [{ x: tail[0], y: tail[1], label: "O" }],
      );
    const wrong = isPara
      ? [add(u, times(-1, v)), times(0.5, result), u]
      : variant === "scale-the-arrow"
        ? [times(-c, u), [c * u[0], u[1]] as Vec, times(-1, u)]
        : [[u[0], -u[1]] as Vec, times(-1, u)];
    const candidates = [result, ...wrong].map((v) => ({
      label: `Arrow from (${tail.join(", ")}) to (${add(tail, v).join(", ")})`,
      scene: arrows(tail, [v]).scene({ width: 280, maxHeight: 280 }),
    }));
    if (variant === "draw-the-arrow")
      candidates.push({
        label: "Two-leg walking route without a displacement arrow",
        scene: graph({ x: [-10, 10], y: [-10, 10] })
          .segment(tail, [tip[0], tail[1]])
          .segment([tip[0], tail[1]], tip)
          .scene({ width: 280, maxHeight: 280 }),
      });
    return b.figures(copy, candidates);
  }
  if (variant === "sum-vs-sum-of-lengths") {
    const [a, c, hyp] = pick(r, [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ] as const),
      equality = r(1, 5) === 1;
    const k = r(1, 2),
      u: Vec = [a, c],
      v: Vec = equality ? times(k, u) : [-a, c];
    const uv = add(u, v),
      lenU = hyp,
      lenV = equality ? hyp * k : hyp,
      lenSum = equality ? hyp * (1 + k) : c * 2;
    const magnitudeOptions = (value: number) => [
      String(value + 1),
      String(value - 1),
      String(value * 2),
      "0",
    ];
    return b.parts(
      {
        prompt: `Let $u=${vector(u).slice(1, -1)}$ and $v=${vector(v).slice(1, -1)}$. Find the three magnitudes, which are the lengths, then compare the length of the sum with the sum of the lengths.`,
        figure: sceneFigure(arrows([0, 0], [u, v], uv).scene()),
        hint: `For $u$, square its components ${a} and ${c}, add, then take the square root. Add components before finding the length of $u+v$.`,
        explanation: [
          `$|u|=\\sqrt{${a * a + c * c}}=${lenU}$ and $|v|=${lenV}$.`,
          `$u+v=${vector(uv).slice(1, -1)}$, so $|u+v|=${lenSum}$. The sum of the separate lengths is ${lenU + lenV}.`,
          equality
            ? "The vectors point in the same direction, so the lengths add exactly."
            : "The two moves bend. Their direct displacement is shorter than their combined route. Equality requires the same direction.",
        ],
      },
      [
        {
          label: "Length of u",
          correct: `${lenU}`,
          wrong: magnitudeOptions(lenU),
        },
        {
          label: "Length of v",
          correct: `${lenV}`,
          wrong: magnitudeOptions(lenV),
        },
        {
          label: "Length of u + v",
          correct: `${lenSum}`,
          wrong: [
            `${lenU + lenV}`,
            math(radtex(lenU ** 2 + lenV ** 2)),
            `${Math.abs(lenU - lenV)}`,
            ...magnitudeOptions(lenSum),
          ],
        },
        {
          label: "Compare |u + v| with |u| + |v|",
          correct: equality ? "Equal" : "Less",
          wrong: [
            equality ? "Less" : "Equal",
            "Greater",
            "Cannot be determined from components",
          ],
        },
      ],
    );
  }
  if (variant === "opposite-vector") {
    let v: Vec, w: Vec;
    do {
      v = [nz(9), nz(9)];
      w = r(0, 1)
        ? pick(r, [
            [3, -4],
            [-5, 12],
            [8, -15],
          ] as Vec[])
        : [nz(9), nz(9)];
    } while (cross(v, w) === 0 || w[0] === w[1]);
    const diff = add(v, times(-1, w)),
      figureAsk = r(0, 1) === 1;
    const g = arrows([0, 0], [v, w]);
    if (figureAsk) g.segment(w, v, { arrow: true, color: "gold" });
    const copy = {
      prompt: `Let $v=${vector(v).slice(1, -1)}$, $w=${vector(w).slice(1, -1)}$. ${figureAsk ? "The gold arrow goes from the tip of w to the tip of v. Which expression represents it?" : "Find the opposite vector, describe its length and direction, then compute the difference."}`,
      figure: sceneFigure(g.scene()),
      hint: `The vector $w$ moves ${w[0]} horizontally and ${w[1]} vertically. Its opposite undoes both moves.`,
      explanation: [
        `$-w=${vector(times(-1, w)).slice(1, -1)}$. Negating both components preserves length and reverses direction.`,
        `$v-w=v+(-w)=${vector(diff).slice(1, -1)}$.`,
        "Starting with w and following the tip-to-tip arrow reaches v. Therefore that arrow is v − w; reversing it gives w − v.",
      ],
    };
    if (figureAsk) return b.choice(copy, "$v-w$", ["$w-v$", "$v+w$", "$-v-w$"]);
    return b.parts(copy, [
      {
        label: "Opposite vector −w",
        correct: vector(times(-1, w)),
        wrong: [
          vector([-w[0], w[1]]),
          vector([-w[1], -w[0]]),
          math(`\\langle 1/${w[0]},1/${w[1]}\\rangle`),
        ],
      },
      {
        label: "Compared with w, −w has…",
        correct: "The same length and the opposite direction",
        wrong: [
          "A negative length and the same direction",
          "The same length and a perpendicular direction",
          "Half the length and the opposite direction",
        ],
      },
      {
        label: "v + (−w)",
        correct: vector(diff),
        wrong: [
          vector(add(v, w)),
          vector(times(-1, diff)),
          vector([v[0] + w[0], v[1] - w[1]]),
        ],
      },
    ]);
  }
  if (variant === "scalar-multiple-direction") {
    const len = pick(r, [5, 10, 13, 15, 17, 25]),
      theta = r(0, 71) * 5,
      c = pick(r, [-5, -3, -2, -1.5, -0.5, 0.5, 1.5, 2, 3, 5]);
    const direction = angle(theta + (c < 0 ? 180 : 0)),
      size = Math.abs(c) * len;
    return b.parts(
      {
        prompt: `Vector $v$ has magnitude ${len} and direction ${theta}° counterclockwise from east. Find the magnitude and direction of $${c}v$. Use direction angles from 0° up to, but not including, 360°.`,
        hint: `Multiply the magnitude ${len} by the absolute value of ${c}. Check the scalar's sign separately for direction.`,
        explanation: [
          `Magnitude is $|${c}|\\times ${len}=${size}$, never negative.`,
          c < 0
            ? `A negative scalar reverses the vector: ${theta}° + 180°, reduced modulo 360°, gives ${direction}°.`
            : `A positive scalar leaves direction unchanged at ${theta}°.`,
          "Scaling components changes length. It does not multiply the angle.",
        ],
      },
      [
        {
          label: "Magnitude",
          correct: `${size}`,
          wrong: [`${c * len}`, `${len}`, `${c ** 2 * len}`, `${size + len}`],
        },
        {
          label: "Direction relative to v",
          correct: c > 0 ? "Along v" : "Against v",
          wrong: [c > 0 ? "Against v" : "Along v", "Perpendicular to v"],
        },
        {
          label: "Direction angle",
          correct: `${direction}°`,
          wrong: [
            ...new Set([
              angle(theta + (c > 0 ? 180 : 0)),
              angle(c * theta),
              angle(180 - theta),
              angle(direction + 90),
              angle(direction + 45),
            ]),
          ].map((x) => `${x}°`),
        },
      ],
    );
  }
  if (variant === "non-perpendicular-resultant") {
    // Exact integer lengths checked by a²+b²+2ab cos(theta)=c².
    const [a, c, theta, magnitude] = pick(r, [
      [3, 5, 60, 7],
      [7, 8, 60, 13],
      [5, 16, 60, 19],
      [11, 24, 60, 31],
      [5, 8, 120, 7],
      [8, 15, 120, 13],
    ] as const);
    const first = r(0, 35) * 10,
      turn = r(0, 1) ? theta : -theta,
      second = angle(first + turn);
    const u: Vec = [a * Math.cos(rad(first)), a * Math.sin(rad(first))],
      v: Vec = [c * Math.cos(rad(second)), c * Math.sin(rad(second))],
      result = add(u, v);
    const direction = round(
        angle((Math.atan2(result[1], result[0]) * 180) / Math.PI),
      ),
      normalized = direction === 360 ? 0 : direction;
    const wrongAngles = [
      angle(first + turn / 2),
      angle(normalized - first),
      angle(90 - normalized),
      angle(normalized + 180),
      angle(normalized + 90),
    ]
      .map((x) => round(x))
      .filter(
        (x) => Math.min(angle(x - normalized), angle(normalized - x)) >= 0.5,
      );
    const distinctAngles: number[] = [];
    for (const x of wrongAngles)
      if (
        distinctAngles.every((y) => Math.min(angle(x - y), angle(y - x)) >= 0.5)
      )
        distinctAngles.push(x);
    const [story, unit] = pick(r, [
      ["Two ropes pull a sled", "N"],
      ["A drone makes two successive flight displacements", "km"],
      ["A surveyor walks two successive displacements", "m"],
    ]);
    const g = arrows([0, 0], [u, v], result)
      .segment(u, result, { arrow: true, dash: "dash", color: "warm" })
      .segment([0, 0], result, { arrow: true, color: "gold" });
    return b.parts(
      {
        figure: sceneFigure(g.scene()),
        prompt: `${story}: the first vector has magnitude ${a} ${unit} and direction ${first}°; the second has magnitude ${c} ${unit} and direction ${second}°. Directions are counterclockwise from east. Their smaller angle is ${theta}°. Find the exact resultant magnitude and its direction to the nearest tenth of a degree.`,
        hint: `Convert the ${a} ${unit} vector to components using cosine horizontally and sine vertically. Do the same for the second, then add.`,
        explanation: [
          `The tip-to-tail triangle has included angle ${180 - theta}°. The cosine law gives $R^2=${a}^2+${c}^2+2(${a})(${c})\\cos ${theta}^\\circ=${magnitude ** 2}$, so $R=${magnitude}$.`,
          `The component sum is (${round(result[0], 4)}, ${round(result[1], 4)}). Its direction, using both component signs, is ${normalized}°.`,
          `The sine law also gives $\\sin\\delta/${c}=\\sin ${180 - theta}^\\circ/${magnitude}$. Use the component signs to select the correct direction.`,
          `Check: ${Math.abs(a - c)} < ${magnitude} < ${a + c}. The resultant lies between the input directions along their smaller angle.`,
        ],
      },
      [
        {
          label: `Magnitude (${unit})`,
          correct: `${magnitude}`,
          wrong: [
            `${a + c}`,
            math(radtex(a * a + c * c)),
            math(radtex(a * a + c * c - (theta === 60 ? 1 : -1) * a * c)),
          ],
        },
        {
          label: "Direction (degrees)",
          correct: `${normalized}°`,
          wrong: distinctAngles.map((x) => `${x}°`),
        },
      ],
    );
  }
  if (variant === "zero-and-identity-roles") {
    const ask = r(0, 3),
      A = [
        [nz(6), nz(6)],
        [nz(6), nz(6)],
      ];
    const explanation = [
      "Adding the zero matrix $O$ changes no entry, just as adding 0 changes no number.",
      "Multiplying by $I$ leaves every column unchanged, just as the number 1 leaves a product unchanged. Multiplying by $O$ gives $O$.",
    ];
    if (ask === 0)
      return b.choice(
        {
          prompt:
            "Which matrix $Z$ satisfies $A+Z=A$ for every 2×2 matrix $A$?",
          hint: "Each entry added to $A$ must leave that entry unchanged.",
          explanation,
        },
        matrix(O),
        [
          matrix(I),
          matrix([
            [0, 1],
            [1, 0],
          ]),
          matrix([
            [1, 1],
            [1, 1],
          ]),
        ],
      );
    if (ask === 1)
      return b.choice(
        {
          prompt:
            "$O$ is the 2×2 zero matrix and $I$ is the identity. Which statement is NOT an identity valid for every 2×2 matrix $A$?",
          hint: "Test what adding $I$ does to a diagonal entry, and what multiplying by $O$ does to a column.",
          explanation: [
            ...explanation,
            "An identity must hold for every $A$. A statement can fail this test even if it happens to hold for a special $A$.",
          ],
        },
        pick(r, ["$A+I=A$", "$AO=A$", "$AI=O$", "$A+O=O$"]),
        ["$A+O=A$", "$AO=OA=O$", "$AI=IA=A$"],
      );
    if (ask === 2) {
      const operation = pick(r, ["A+O", "AO", "AI", "A-A"]),
        result = operation === "A+O" || operation === "AI" ? A : O;
      return b.choice(
        {
          prompt: `Let $A=$ ${matrix(A)}, $O$ be the zero matrix, and $I$ the identity. Find $${operation}$.`,
          hint: `Check whether $${operation}$ adds zero, multiplies by zero, leaves a column unchanged, or subtracts an entry from itself.`,
          explanation,
        },
        matrix(result),
        [matrix(A), matrix(O), matrix(I), matrix(scale(A, -1))],
      );
    }
    return b.parts(
      {
        prompt:
          "Compare the zero and identity matrices with the numbers 0 and 1.",
        hint: "Ask which number leaves multiplication unchanged, and what happens to any number times zero.",
        explanation,
      },
      [
        {
          label: "$I$ plays the role of which number in multiplication?",
          correct: "1",
          wrong: ["0", "−1", "Any nonzero number"],
        },
        {
          label: "$AO = O$ corresponds to…",
          correct: "$a\\cdot0=0$",
          wrong: ["$a+0=a$", "$a\\cdot1=a$", "$a-a=0$"],
        },
      ],
    );
  }
  if (variant === "noncommutative-laws") {
    const wrongIdentity = pick(r, ["$AB=BA$", "$(A+B)(A-B)=A^2-B^2$"]);
    return b.choice(
      {
        prompt:
          "For arbitrary square matrices $A$ and $B$ of the same size, which equation is NOT an identity?",
        hint: "Expand products in order. You may regroup factors, but cannot exchange $A$ and $B$.",
        explanation: [
          "Matrix multiplication is associative and distributive, but generally not commutative.",
          "$(A+B)(A-B)=A^2-AB+BA-B^2$. The middle terms cancel only when $AB=BA$.",
          "For example, a rotation followed by a reflection need not equal the reflection followed by the rotation.",
        ],
      },
      wrongIdentity,
      ["$A(B+B)=AB+AB$", "$(AB)A=A(BA)$", "$A(B-A)=AB-A^2$"],
    );
  }
  if (variant === "compute-both-orders") {
    const commuting = r(1, 5) === 1;
    let A: number[][], B: number[][], AB: number[][], BA: number[][];
    do {
      A = randomMatrix(2, 2, 3);
      B = commuting ? scale(I, nz(3)) : randomMatrix(2, 2, 3);
      AB = multiply(A, B);
      BA = multiply(B, A);
    } while (same(AB, BA) !== commuting || A.flat().every((x) => !x));
    const entrywise = A.map((row, i) => row.map((x, j) => x * B[i]![j]!));
    const slips = (answer: number[][]) => [
      matrix(entrywise),
      matrix(answer.map((row, i) => row.map((x, j) => x + (i === j ? 1 : 0)))),
      matrix(scale(answer, -1)),
      matrix(answer.map((row) => row.map((x) => x + 1))),
    ];
    return b.parts(
      {
        prompt: `Let $A=$ ${matrix(A)} and $B=$ ${matrix(B)}. Compute both orders and distinguish this example from the general rule.`,
        hint: `For the top-left entry of $AB$, use ${signedFactor(A[0]![0]!)} × ${signedFactor(B[0]![0]!)} + ${signedFactor(A[0]![1]!)} × ${signedFactor(B[1]![0]!)}.`,
        explanation: [
          `Row by column gives $AB=$ ${matrix(AB)} and $BA=$ ${matrix(BA)}.`,
          commuting
            ? "These matrices commute: multiplying by a scalar identity commutes with $A$."
            : "These two products differ, providing a counterexample to the claim that all matrices commute.",
          "Some pairs commute, but matrix multiplication is not commutative in general.",
        ],
      },
      [
        {
          label: "$AB$",
          correct: matrix(AB),
          wrong: [matrix(BA), ...slips(AB)],
        },
        {
          label: "$BA$",
          correct: matrix(BA),
          wrong: [matrix(AB), ...slips(BA)],
        },
        {
          label: "Is $AB = BA$ for this pair?",
          correct: commuting ? "Yes" : "No",
          wrong: [commuting ? "No" : "Yes"],
        },
        {
          label: "For square matrices in general, $AB = BA$…",
          correct: "For some pairs, but not in general",
          wrong: [
            "Always",
            "Never",
            "Exactly when their determinants are equal",
          ],
        },
      ],
    );
  }
  if (variant === "network-and-payoff") {
    if (r(0, 1)) {
      const pairs: [number, number][] = [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 2],
        [1, 3],
        [2, 3],
      ];
      const M = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      const edges = r(4, 6);
      for (const [i, j] of pairs.slice(0, edges)) {
        if (r(0, 1)) M[i]![j] = 1;
        else M[j]![i] = 1;
      }
      const nodes: Vec[] = [
          [-3, 3],
          [3, 3],
          [3, -3],
          [-3, -3],
        ],
        g = graph({ x: [-5, 5], y: [-5, 5] });
      nodes.forEach((p, i) => g.point(...p, "ABCD"[i]));
      M.forEach((row, i) =>
        row.forEach((x, j) => {
          if (x) g.segment(nodes[i]!, nodes[j]!, { arrow: true });
        }),
      );
      const ask = r(0, 2),
        totals = transpose(M).map(sum),
        max = Math.max(...totals),
        towns = totals
          .flatMap((n, i) => (n === max ? ["ABCD"[i]!] : []))
          .join(", "),
        townList = (names: string) =>
          names
            .split(", ")
            .map((name) => `$${name}$`)
            .join(", ");
      const copy = {
        prompt: `Each arrow is a one-way road. Rows are FROM towns and columns are TO towns, both in order ${townList("A, B, C, D")}. ${ask === 0 ? "Which matrix represents the network?" : ask === 1 ? "How many roads leave $C$?" : "Which town or towns have the most incoming roads?"}`,
        figure: sceneFigure(g.scene()),
        hint:
          ask === 0
            ? "Follow an arrow from its tail town to its head town; put 1 at that row and column."
            : ask === 1
              ? "Follow each arrow that leaves $C$. Count those arrows; put 1 at each row and column where an arrow runs."
              : "Follow each arrow into a town. The town with the most incoming arrows is the one to name.",
        explanation: [
          `The network matrix is ${matrix(M)}.`,
          `Row $C$ sums to ${sum(M[2]!)}. The column totals are ${totals.join(", ")}, so the maximum is ${max}, for ${townList(towns)}.`,
        ],
      };
      if (ask === 1)
        return b.choice(
          copy,
          `${sum(M[2]!)}`,
          [0, 1, 2, 3, 4].filter((x) => x !== sum(M[2]!)).map(String),
        );
      if (ask === 2)
        return b.choice(
          copy,
          townList(towns),
          ["A", "B", "C", "D", "A, B, C, D"]
            .filter((x) => x !== towns)
            .map(townList),
        );
      const loop = M.map((row, i) => row.map((x, j) => (i === j ? 1 : x))),
        missing = M.map((row) => [...row]);
      const entry = M.flat().findIndex((x) => x === 1);
      missing[Math.floor(entry / 4)]![entry % 4] = 0;
      return b.choice(copy, matrix(M), [
        matrix(transpose(M)),
        matrix(loop),
        matrix(missing),
      ]);
    }
    const P = [
        [-r(1, 5), r(1, 5)],
        [r(1, 5), -r(1, 5)],
      ],
      ask = r(0, 3),
      i = r(0, 1),
      j = r(0, 1);
    const copy = {
      prompt: `Two players each choose Heads or Tails in a zero-sum game. Rows are the row player's choices; columns are the column player's choices, both Heads then Tails. The table gives the row player's winnings in points. ${ask === 0 ? "Which is the column player's payoff matrix?" : ask === 1 ? `What does the row player win for row ${i + 1}, column ${j + 1}?` : `Find the ${ask === 2 ? "row" : "column"} ${i + 1} total.`}`,
      figure: table([
        ["", "Heads", "Tails"],
        ["Heads", ...P[0]!.map(String)],
        ["Tails", ...P[1]!.map(String)],
      ]),
      hint:
        ask === 0
          ? `The table starts at ${P[0]![0]}. In a zero-sum game, the other player's winnings are the negative of these winnings. An entry uses row first, column second.`
          : ask === 1
            ? `Read row ${i + 1}, column ${j + 1}. The table starts at ${P[0]![0]}. An entry uses row first, column second.`
            : `Add the entries of ${ask === 2 ? "row" : "column"} ${i + 1}. The table starts at ${P[0]![0]}. An entry uses row first, column second.`,
      explanation: [
        `The row-player matrix is ${matrix(P)}; the column-player matrix is ${matrix(scale(P, -1))}.`,
        "A negative payoff is a loss. To total a row or column, add its signed entries.",
      ],
    };
    if (ask === 0)
      return b.choice(copy, matrix(scale(P, -1)), [
        matrix(P),
        matrix(I),
        matrix(P.map((row) => row.map(Math.abs))),
      ]);
    const value =
      ask === 1 ? P[i]![j]! : sum(ask === 2 ? P[i]! : transpose(P)[i]!);
    return b.choice(
      copy,
      `${value}`,
      [
        ...new Set([
          -value,
          P[j]![i]!,
          P[i]![i]!,
          value + 1,
          value - 1,
          value + 2,
        ]),
      ].map(String),
    );
  }
  if (variant === "build-from-text") {
    const rows = r(2, 3),
      cols = r(2, 4),
      stores = ["Eastside", "Westside", "Northside"].slice(0, rows),
      items = ["backpacks", "lunch boxes", "notebooks", "pencils"].slice(
        0,
        cols,
      );
    let A: number[][], choices: string[];
    do {
      A = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => r(5, 60)),
      );
      choices = [
        matrix(A),
        matrix(transpose(A)),
        matrix([...A].reverse()),
        matrix(A.map((row) => [...row].reverse())),
      ];
    } while (new Set(choices).size !== 4);
    const reversed = r(0, 1) === 1,
      order = Array.from({ length: cols }, (_, i) => i);
    if (reversed) order.reverse();
    return b.choice(
      {
        prompt: `${stores.map((s, i) => `${s} has ${order.map((j) => `${A[i]![j]} ${items[j]}`).join(", ")}`).join("; ")}. Represent the data with stores as rows in order ${stores.join(", ")}, and items as columns in order ${items.join(", ")}.`,
        hint: `${stores[0]} is the first row. Its sentence starts with ${A[0]![order[0]!]!} ${items[order[0]!]!}, and the first column must count ${items[0]}.`,
        explanation: [
          `Follow the requested order, even when the sentences list items differently.`,
          `Rows in order give ${matrix(A)}. A transpose swaps the roles of stores and items.`,
        ],
      },
      choices[0]!,
      choices.slice(1),
    );
  }
  if (variant === "scale-in-context") {
    const c = pick(r, [2, 3, -1, 0.5, 10]),
      stock = c === 0.5;
    const P = stock
      ? [
          [2 * r(1, 20), 2 * r(1, 20)],
          [2 * r(1, 20), 2 * r(1, 20)],
        ]
      : [
          [-r(1, 8), r(1, 8)],
          [r(1, 8), -r(1, 8)],
        ];
    const correct = scale(P, c);
    return b.choice(
      {
        prompt: `${stock ? "Rows are Eastside and Westside; columns are backpacks and lunch boxes. Half of every stock count remains." : `In a zero-sum game's payoff matrix, rows and columns are Heads then Tails. ${c === -1 ? "Report the other player's winnings, keeping the same row and column choices." : `Multiply every payoff by ${c}.`}`} The original matrix is ${matrix(P)}. What is the resulting matrix?`,
        hint: `Apply the factor ${c} to every entry of ${matrix(P)}, including ${P[0]![0]} and ${P[0]![1]}.`,
        explanation: [
          `Multiply every entry by ${c}, without changing row or column labels.`,
          `For example, ${P[0]![0]} × ${c} = ${correct[0]![0]}. The complete matrix is ${matrix(correct)}.`,
        ],
      },
      matrix(correct),
      [
        matrix(P.map((row, i) => row.map((x, j) => (i === j ? c * x : x)))),
        matrix(P.map((row, i) => row.map((x) => (i === 0 ? c * x : x)))),
        matrix(P.map((row) => row.map((x) => x + c))),
        matrix(transpose(P)),
      ],
    );
  }
  if (variant === "difference") {
    const shape = r(0, 3),
      rows = shape === 2 ? 3 : 2,
      cols = shape === 0 ? 2 : 3,
      mismatch = shape === 3;
    const A = randomMatrix(rows, cols, 9),
      B = randomMatrix(mismatch ? 3 : rows, mismatch ? 2 : cols, 9);
    A[0]![0] = -r(1, 9);
    B[0]![0] = -r(1, 9);
    if (same(A, B)) B[0]![0] = B[0]![0] === -9 ? -8 : B[0]![0]! - 1;
    const weighted = r(0, 1) === 1,
      a = weighted ? 3 : 1,
      c = weighted ? 2 : 1;
    const operation = weighted ? "3A-2B" : "A-B";
    if (mismatch)
      return b.choice(
        {
          prompt: `Let $A=$ ${matrix(A)} and $B=$ ${matrix(B)}. Find $${operation}$.`,
          hint: `Compare ${matrix(A)} with ${matrix(B)}. Count rows and columns before subtracting. Each entry needs a corresponding entry in the other matrix.`,
          explanation: [
            "A is 2×3 and B is 3×2. Their dimensions differ, so subtraction is not defined.",
            "Multiplication would be a different operation; it cannot supply missing matching entries.",
          ],
        },
        "Not defined: the dimensions differ",
        [
          matrix(multiply(A, B)),
          matrix([
            [0, 0],
            [0, 0],
          ]),
          "Subtract only the overlapping 2×2 entries",
          matrix(I),
        ],
      );
    const result = A.map((row, i) => row.map((x, j) => a * x - c * B[i]![j]!));
    const copy = {
      prompt: `Let $A=$ ${matrix(A)} and $B=$ ${matrix(B)}. Find $${operation}$.`,
      hint: `Match entries of ${matrix(A)} with ${matrix(B)}. The top-left entry is ${a}(${A[0]![0]}) − ${c}(${B[0]![0]}). Subtracting a negative adds its opposite.`,
      explanation: [
        `The dimensions agree: ${rows}×${cols}. Match corresponding entries.`,
        `The top-left entry is ${a}(${A[0]![0]}) − ${c}(${B[0]![0]}) = ${result[0]![0]}.`,
        `The complete difference is ${matrix(result)}.`,
      ],
    };
    if (rows === 2 && cols === 2)
      return b.work(
        copy,
        result.flatMap((row, i) =>
          row.map((value, j) => ({
            label: `Row ${i + 1}, column ${j + 1}`,
            value,
          })),
        ),
      );
    const slip = result.map((row) => [...row]);
    slip[0]![0] = a * A[0]![0]! + c * B[0]![0]!;
    return b.choice(copy, matrix(result), [
      matrix(scale(result, -1)),
      matrix(A.map((row, i) => row.map((x, j) => a * x + c * B[i]![j]!))),
      matrix(slip),
      matrix(result.map((row) => row.map((x) => x + 1))),
    ]);
  }
  throw new Error(`Unhandled vector/matrix clause ${variant}`);
}
