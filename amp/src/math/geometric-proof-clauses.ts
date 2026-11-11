import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  blanks,
  choice,
  figures,
  math as m,
  pick,
  picture,
  plot,
  scene,
  type ClauseExtension,
  type ClauseSurface,
} from "./clause-kit";
import { random, shuffle } from "./distribution-practice";
import {
  figureAngleMark,
  figureName,
  figureParallelMark,
  figureRightMark,
  figureSegment,
  figureTicks,
} from "./geometry-teaching-figures";
import { proofWork, type ProofModel } from "./structured-work-kit";
import type { Element, Point, Scene } from "./scene/spec";
import type { Random } from "./variation/axes";

type Line = { text: string; reason: string; needs: number[] };
type Proof = {
  prompt: string;
  lines: Line[];
  wrong: string[];
  extra?: string[];
  figure: Scene;
  hint: string;
  explanation: string[];
  fillOnly?: boolean;
};
const line = (text: string, reason: string, ...needs: number[]): Line => ({
  text,
  reason,
  needs,
});
const midpoint = (a: Point, b: Point): Point => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];
const polar = (r: number, deg: number, c: Point = [0, 0]): Point => [
  c[0] + r * Math.cos((deg * Math.PI) / 180),
  c[1] + r * Math.sin((deg * Math.PI) / 180),
];
type Drawing = {
  at: Record<string, Point>;
  segments: string[];
  ticks?: string[][];
  angles?: string[][];
  right?: string[];
  parallel?: string[];
};
function drawing(d: Drawing): Scene {
  const els: Element[] = [];
  for (const s of d.segments)
    els.push(figureSegment(`s${s}`, d.at[s[0]!]!, d.at[s[1]!]!));
  d.ticks?.forEach((group, i) =>
    group.forEach((s) =>
      els.push(...figureTicks(`tick${s}`, d.at[s[0]!]!, d.at[s[1]!]!, i + 1)),
    ),
  );
  d.angles?.forEach((group, i) =>
    group.forEach((s) =>
      els.push(
        ...figureAngleMark(
          `angle${s}`,
          d.at[s[1]!]!,
          d.at[s[0]!]!,
          d.at[s[2]!]!,
          { r: 0.35, arcs: i + 1 },
        ),
      ),
    ),
  );
  d.right?.forEach((s) =>
    els.push(
      figureRightMark(
        `right${s}`,
        d.at[s[1]!]!,
        d.at[s[0]!]!,
        d.at[s[2]!]!,
        0.23,
      ),
    ),
  );
  d.parallel?.forEach((s) =>
    els.push(
      ...figureParallelMark(`parallel${s}`, d.at[s[0]!]!, d.at[s[1]!]!, 1, 0.3),
    ),
  );
  const center: Point = [
    Object.values(d.at).reduce((s, p) => s + p[0], 0) /
      Object.keys(d.at).length,
    Object.values(d.at).reduce((s, p) => s + p[1], 0) /
      Object.keys(d.at).length,
  ];
  for (const [label, p] of Object.entries(d.at))
    els.push(
      figureName(`n${label}`, label, p, [p[0] - center[0], p[1] - center[1]]),
    );
  return scene(els);
}

/** The existing work protocol holds six rows. Longer arguments have front/back tasks;
 * the earlier proved lines are explicitly supplied in the back task's givens. */
function proofSurface(r: Random, p: Proof): ClauseSurface {
  const start =
    p.lines.length > 6 && r(0, 1) ? Math.ceil(p.lines.length / 2) : 0;
  const end =
    p.lines.length > 6 && start === 0
      ? Math.ceil(p.lines.length / 2)
      : p.lines.length;
  const selected = p.lines.slice(start, end),
    mode = p.fillOnly || r(1, 5) > 3 ? "fill" : "build";
  const statements = shuffle(r, [
    ...selected.map((s, i) => ({ id: `s${i}`, label: s.text })),
    ...(p.extra ?? [])
      .slice(0, 2)
      .map((text, i) => ({ id: `x${i}`, label: text })),
  ]);
  const reasons = shuffle(
    r,
    [...new Set([...selected.map((s) => s.reason), ...p.wrong])].slice(0, 12),
  ).map((label, i) => ({ id: `r${i.toString(36)}`, label }));
  const rid = (reason: string) => reasons.find((x) => x.label === reason)!.id;
  const claims = Object.fromEntries(
    selected.map((s, i) => [
      `s${i}`,
      {
        [rid(s.reason)]: [
          s.needs.filter((n) => n >= start).map((n) => `s${n - start}`),
        ],
      },
    ]),
  );
  const model: ProofModel = {
    statements,
    reasons,
    claims,
    goal: `s${selected.length - 1}`,
    goalTex: selected.at(-1)!.text,
    path: selected.map((s, i) => [`s${i}`, rid(s.reason)]),
  };
  const built = proofWork(
    model,
    mode,
    r,
    mode === "fill" ? "Complete the reasons" : "Build the proof",
  );
  const before = start
    ? ` Already proved: ${p.lines
        .slice(0, start)
        .map((s) => s.text)
        .join("; ")}.`
    : "";
  return {
    ...built,
    prompt: `${p.prompt}${before} ${start || end < p.lines.length ? `Complete this part of the argument, ending with ${selected.at(-1)!.text}.` : ""} ${mode === "build" ? "Choose statements and reasons in a justified order." : "Supply the missing reasons."}`,
    hint: p.hint,
    explanation: [
      ...p.explanation,
      ...p.lines.map((s, i) => `${i + 1}. ${s.text} — ${s.reason}.`),
    ],
    figure: picture(p.figure),
  };
}

function isosceles(r: Random): Proof {
  const sub = r(0, 2),
    apex = 2 * r(12, 55),
    height = 4,
    half = height * Math.tan((apex * Math.PI) / 360);
  const A: Point = [0, height],
    B: Point = [-half, 0],
    C: Point = [half, 0],
    D: Point = [0, 0];
  const first =
    sub === 2 ? m("\\angle ABD\\cong\\angle ACD") : m("AB\\cong AC");
  const second =
    sub === 1 ? m("BD\\cong CD") : m("\\angle BAD\\cong\\angle CAD");
  return {
    prompt: `In triangle $ABC$, ${sub === 2 ? "$\\angle B\\cong\\angle C$" : "$AB\\cong AC$"}. ${sub === 1 ? "$D$ is the midpoint of $BC$." : "$AD$ bisects angle $BAC$ and meets $BC$ at $D$."} Prove ${sub === 2 ? "$AB\\cong AC$" : "$\\angle B\\cong\\angle C$"}.`,
    lines: [
      line(first, "Given"),
      line(
        second,
        sub === 1 ? "Definition of midpoint" : "Definition of angle bisector",
      ),
      line("$AD\\cong AD$", "Reflexive property"),
      line(
        "$\\triangle BAD\\cong\\triangle CAD$",
        sub === 0 ? "SAS" : sub === 1 ? "SSS" : "AAS",
        0,
        1,
        2,
      ),
      line(
        sub === 2 ? "$AB\\cong AC$" : "$\\angle B\\cong\\angle C$",
        "CPCTC",
        3,
      ),
    ],
    wrong: [
      "Base angles of an isosceles triangle are congruent",
      "SSA",
      sub === 2 ? "SAS" : "Vertical angles are congruent",
    ],
    extra: ["$AD\\perp BC$"],
    figure: drawing({
      at: { A, B, C, D },
      segments: ["AB", "AC", "BC", "AD"],
      ticks:
        sub === 1
          ? [
              ["AB", "AC"],
              ["BD", "CD"],
            ]
          : sub === 0
            ? [["AB", "AC"]]
            : [],
      angles:
        sub === 1
          ? []
          : sub === 0
            ? [["BAD", "CAD"]]
            : [
                ["BAD", "CAD"],
                ["ABD", "ACD"],
              ],
    }),
    hint: "Find three matching parts of the two triangles before using CPCTC.",
    explanation: [
      "Congruent triangles have the same size and shape. CPCTC means their corresponding parts are congruent.",
      sub === 2
        ? "Two angle pairs and the shared non-included side prove the triangles congruent by AAS."
        : "The given equal parts and the shared side make the two halves congruent. Then the base angles match.",
    ],
  };
}
function midsegment(r: Random): Proof {
  const A: Point = [r(-1, 2), r(5, 7)],
    B: Point = [-4, 0],
    C: Point = [4, 0],
    D = midpoint(A, B),
    E = midpoint(A, C),
    F: Point = [2 * E[0] - D[0], 2 * E[1] - D[1]];
  return {
    prompt:
      "$D$ and $E$ are midpoints of $AB$ and $AC$. Extend ray $DE$ to $F$ with $DE=EF$. Prove $DE\\parallel BC$ and $DE=\\tfrac12 BC$.",
    lines: [
      line("$AE\\cong EC,\\ AD\\cong DB$", "Definition of midpoint"),
      line("$DE\\cong EF$", "Given"),
      line("$\\angle AED\\cong\\angle CEF$", "Vertical angles are congruent"),
      line("$\\triangle ADE\\cong\\triangle CFE$", "SAS", 0, 1, 2),
      line("$AD\\cong CF,\\ \\angle DAE\\cong\\angle FCE$", "CPCTC", 3),
      line("$CF\\parallel AB$", "Converse of alternate interior angles", 4),
      line("$CF\\cong DB$", "Transitive property", 0, 4),
      line(
        "$DBCF$ is a parallelogram",
        "One opposite pair both congruent and parallel",
        5,
        6,
      ),
      line(
        "$DF\\parallel BC,\\ DF=BC$",
        "Opposite sides of a parallelogram",
        7,
      ),
      line(
        "$DE\\parallel BC,\\ DE=\\tfrac12 DF=\\tfrac12 BC$",
        "Segment addition and substitution",
        1,
        8,
      ),
    ],
    wrong: [
      "Midsegment theorem",
      "Alternate interior angles are congruent",
      "SSA",
    ],
    extra: ["$DE=\\tfrac12 AB$"],
    figure: drawing({
      at: { A, B, C, D, E, F },
      segments: ["AB", "AC", "BC", "DF", "CF"],
      ticks: [
        ["AD", "DB"],
        ["AE", "EC"],
        ["DE", "EF"],
      ],
    }),
    hint: "Compare triangles $ADE$ and $CFE$ using the two midpoint lengths and the crossing angles.",
    explanation: [
      "A half turn about $E$ sends $A$ to $C$ and $D$ to $F$. The congruence proof establishes the matching parts.",
      "The copied side and the other half of $AB$ make a parallelogram. Its opposite side $DF$ equals $BC$; $DE$ is half of $DF$.",
    ],
  };
}
function medians(r: Random): Proof {
  const A: Point = [-2, 6],
    B: Point = [-5, 0],
    C: Point = [6 + r(0, 2), 0],
    E = midpoint(A, C),
    F = midpoint(A, B),
    G: Point = [(A[0] + B[0] + C[0]) / 3, 2],
    M = midpoint(B, G),
    N = midpoint(C, G),
    D = midpoint(B, C);
  return {
    prompt:
      "In triangle $ABC$, medians $BE$ and $CF$ meet at $G$. A median joins a vertex to the opposite side's midpoint. $D$ is the midpoint of $BC$. $M,N$ are midpoints of $BG,CG$. Prove the two-to-one division, then justify why the third median passes through $G$.",
    lines: [
      line("$E,F$ are midpoints of $AC,AB$", "Definition of median"),
      line(
        "$FE\\parallel BC,\\ FE=\\tfrac12 BC$",
        "Midsegment theorem in triangle $ABC$",
        0,
      ),
      line(
        "$MN\\parallel BC,\\ MN=\\tfrac12 BC$",
        "Midsegment theorem in triangle $GBC$",
      ),
      line(
        "$FE\\parallel MN,\\ FE=MN$",
        "Transitive property and substitution",
        1,
        2,
      ),
      line(
        "$FMNE$ is a parallelogram",
        "One opposite pair both congruent and parallel",
        3,
      ),
      line(
        "$FG=GN,\\ EG=GM$",
        "Diagonals of a parallelogram bisect each other",
        4,
      ),
      line("$GN=NC,\\ GM=MB$", "Definition of midpoint"),
      line("$BG=2GE,\\ CG=2GF$", "Segment addition and substitution", 5, 6),
      line(
        "The third median also passes through $G$",
        "Repeat with AD and BE: the same two-thirds point of BE",
        7,
      ),
    ],
    wrong: [
      "Opposite sides of a parallelogram are congruent",
      "The medians are congruent",
      "Each median is a perpendicular bisector",
    ],
    fillOnly: true,
    figure: drawing({
      at: { A, B, C, D, E, F, G, M, N },
      segments: ["AB", "AC", "BC", "BE", "CF", "FE", "MN", "FM", "NE"],
    }),
    hint: "Compare $FE$ in triangle $ABC$ with $MN$ in triangle $GBC$; each joins two midpoints.",
    explanation: [
      "Both midsegments are parallel to $BC$ and half its length, so they are equal and parallel.",
      "The parallelogram is $FENM$ (equivalently $FMNE$). Its diagonals are $FN$ and $EM$, meeting at $G$.",
      "Bisected diagonals and the midpoints $M,N$ give the two-to-one ratios. Repeating the argument with $AD$ and $BE$ reaches the same unique point two-thirds along $BE$.",
    ],
  };
}
function perpendicularBisector(r: Random): Proof {
  const converse = r(0, 1) === 1,
    exactly = r(0, 1) === 1,
    half = r(3, 6),
    height = r(3, 9) * pick(r, [-1, 1]),
    A: Point = [-half, 0],
    B: Point = [half, 0],
    M: Point = [0, 0],
    P: Point = [0, height];
  const lines = converse
    ? [
        line("$PA\\cong PB$", "Given"),
        line("$AM\\cong MB$", "Definition of midpoint"),
        line("$PM\\cong PM$", "Reflexive property"),
        line("$\\triangle PAM\\cong\\triangle PBM$", "SSS", 0, 1, 2),
        line("$\\angle PMA\\cong\\angle PMB$", "CPCTC", 3),
        line("$m\\angle PMA+m\\angle PMB=180^\\circ$", "Linear pair postulate"),
        line("$m\\angle PMA=90^\\circ$", "Equal halves of 180 degrees", 4, 5),
        line(
          "$P$ lies on the perpendicular bisector of $AB$",
          "Perpendicular at the midpoint",
          1,
          6,
        ),
      ]
    : [
        line("$AM\\cong MB$", "Definition of perpendicular bisector"),
        line(
          "$\\angle PMA,\\angle PMB$ are right angles",
          "Definition of perpendicular",
        ),
        line(
          "$\\angle PMA\\cong\\angle PMB$",
          "All right angles are congruent",
          1,
        ),
        line("$PM\\cong PM$", "Reflexive property"),
        line("$\\triangle PMA\\cong\\triangle PMB$", "SAS", 0, 2, 3),
        line("$PA\\cong PB$", "CPCTC", 4),
      ];
  if (exactly)
    lines.push(
      line(
        converse
          ? "To obtain exactly all equidistant points, also prove the forward direction"
          : "To obtain exactly all equidistant points, also prove the converse",
        converse
          ? "Every point on the perpendicular bisector is equidistant from the endpoints"
          : "Every point equidistant from the endpoints lies on the perpendicular bisector",
        lines.length - 1,
      ),
    );
  return {
    prompt: converse
      ? "Given $PA=PB$, $M$ the midpoint of $AB$, and $P$ not on line $AB$, prove $P$ lies on the perpendicular bisector of $AB$."
      : "Line $PM$ is the perpendicular bisector of $AB$, meeting it at $M$. Given $P\\ne M$, prove $PA=PB$.",
    lines,
    wrong: [
      "Perpendicular bisector theorem",
      converse ? "AAS" : "HL",
      "SSA",
      ...(exactly
        ? [
            converse
              ? "If a point is off the bisector, its endpoint distances differ"
              : "If the endpoint distances differ, the point is off the bisector",
          ]
        : []),
    ],
    extra: ["$M$ is the midpoint of $PA$"],
    figure: drawing({
      at: { A, B, M, P },
      segments: ["AB", "PA", "PB", "PM"],
      ticks: converse
        ? [
            ["PA", "PB"],
            ["AM", "MB"],
          ]
        : [["AM", "MB"]],
      right: converse ? [] : ["PMA"],
    }),
    hint: "Compare the two triangles sharing $PM$. Use only the given lengths and angles.",
    explanation: [
      "A perpendicular bisector passes through a segment's midpoint at a right angle.",
      converse
        ? "Equal endpoint distances and the shared side give SSS. Equal adjacent angles filling a straight line must each be 90°."
        : "The two halves match by SAS. Their remaining sides are therefore equal.",
      ...(exactly
        ? [
            "An 'exactly' statement requires both directions. The contrapositive restates the proved direction; it does not supply the missing converse.",
            "The midpoint itself also lies on the bisector and is equidistant; the triangle argument covers the other points.",
          ]
        : []),
    ],
  };
}

function triangleSum(r: Random): Proof {
  const degA = r(35, 70),
    degB = r(35, 70),
    base = 7,
    ta = Math.tan((degA * Math.PI) / 180),
    tb = Math.tan((degB * Math.PI) / 180),
    x = (base * tb) / (ta + tb),
    y = ta * x;
  const A: Point = [0, 0],
    B: Point = [base, 0],
    C: Point = [x, y],
    D: Point = [x - 4, y],
    E: Point = [x + 4, y];
  return {
    prompt:
      "Line $DE$ passes through $C$ parallel to $AB$, with $D$ on $A$'s side. Prove that the three interior angles of triangle $ABC$ sum to 180°.",
    lines: [
      line("$DE\\parallel AB$", "Given"),
      line("$\\angle DCA\\cong\\angle CAB$", "Alternate interior angles", 0),
      line("$\\angle ECB\\cong\\angle ABC$", "Alternate interior angles", 0),
      line(
        "$m\\angle DCA+m\\angle ACB+m\\angle ECB=180^\\circ$",
        "Straight angle and angle addition",
        1,
        2,
      ),
      line(
        "$m\\angle CAB+m\\angle ACB+m\\angle ABC=180^\\circ$",
        "Substitution",
        1,
        2,
        3,
      ),
    ],
    wrong: [
      "Triangle angle sum theorem",
      "Corresponding angles",
      "Definition of linear pair",
    ],
    extra: ["$\\angle DCA\\cong\\angle ABC$"],
    figure: drawing({
      at: { A, B, C, D, E },
      segments: ["AB", "AC", "BC", "DE"],
      parallel: ["AB", "DE"],
      angles: [
        ["DCA", "CAB"],
        ["ECB", "ABC"],
      ],
    }),
    hint: "Use the parallel line to carry the two base angles to $C$. Locate the straight angle of 180° there.",
    explanation: [
      "Each base angle equals an alternate interior angle at $C$. Those two angles and the triangle's angle at $C$ fill a straight line.",
      "Replace the two carried angles by their equal base angles. This proves the sum without assuming it.",
    ],
  };
}
function verticalProof(r: Random): Proof {
  const deg = r(40, 75),
    at = {
      O: [0, 0] as Point,
      A: [-3, 0] as Point,
      C: [3, 0] as Point,
      B: polar(3, deg),
      D: polar(3, deg + 180),
    };
  const other = r(0, 1),
    a = other ? "BOC" : "AOB",
    b = other ? "COD" : "BOC",
    c = other ? "DOA" : "COD";
  return {
    prompt: `Lines $AC$ and $BD$ intersect at $O$. Points $A,O,C$ and $B,O,D$ are collinear. Prove $\\angle ${a}\\cong\\angle ${c}$.`,
    lines: [
      line(
        m(
          `\\angle ${a},\\angle ${b}\\text{ and }\\angle ${b},\\angle ${c}\\text{ are linear pairs}`,
        ),
        "Definition of linear pair",
      ),
      line(
        m(
          `m\\angle ${a}+m\\angle ${b}=180^\\circ,\\quad m\\angle ${b}+m\\angle ${c}=180^\\circ`,
        ),
        "Linear pair postulate",
        0,
      ),
      line(
        m(`m\\angle ${a}+m\\angle ${b}=m\\angle ${b}+m\\angle ${c}`),
        "Transitive property of equality",
        1,
      ),
      line(
        m(`m\\angle ${a}=m\\angle ${c}`),
        "Subtraction property of equality",
        2,
      ),
      line(
        m(`\\angle ${a}\\cong\\angle ${c}`),
        "Definition of congruent angles",
        3,
      ),
    ],
    wrong: [
      "Vertical angles are congruent",
      "Addition property of equality",
      "Corresponding angles are congruent",
    ],
    extra: [
      m(`\\angle ${a}\\text{ and }\\angle ${c}\\text{ form a linear pair}`),
    ],
    figure: drawing({ at, segments: ["AC", "BD"] }),
    hint: "Both target angles form a linear pair with the same neighboring angle, so compare their sums of 180°.",
    explanation: [
      "Both target angles equal 180° minus the same neighboring angle. Subtracting that common angle proves equality.",
      "Using the vertical-angle theorem as a reason would assume the conclusion.",
    ],
  };
}
function correspondingProof(r: Random): Proof {
  const deg = r(55, 70),
    run = 3 / Math.tan((deg * Math.PI) / 180),
    P: Point = [run, 3],
    Q: Point = [0, 0];
  const els: Element[] = [
    figureSegment("upper", [-4, 3], [5, 3]),
    figureSegment("lower", [-4, 0], [5, 0]),
    figureSegment("cross", [-run / 3, -1], [(4 * run) / 3, 4]),
  ];
  [P, Q].forEach((pt, crossing) =>
    [0, 1, 2, 3].forEach((i) =>
      els.push({
        type: "text",
        at: [pt[0] + (i % 2 ? 0.55 : -0.55), pt[1] + (i < 2 ? 0.4 : -0.4)],
        text: String(crossing * 4 + i + 1),
        font: "math",
      }),
    ),
  );
  els.push(
    figureName("P", "P", P, [1, 1]),
    figureName("Q", "Q", Q, [-1, -1]),
    { type: "text", at: [4.5, 3.3], text: "ℓ", font: "math" },
    { type: "text", at: [4.5, 0.3], text: "m", font: "math" },
    { type: "text", at: [(4 * run) / 3 + 0.4, 4], text: "t", font: "math" },
  );
  const translation = r(0, 1) === 0;
  return {
    prompt: translation
      ? "Given $\\ell\\parallel m$, let $T$ translate along $t$ from crossing $P$ to crossing $Q$. Prove $\\angle1\\cong\\angle5$. Use that a line through a point has exactly one parallel to a given distinct line."
      : "Postulate: alternate interior angles of parallel lines cut by a transversal are congruent. Given $\\ell\\parallel m$, prove $\\angle1\\cong\\angle5$.",
    lines: translation
      ? [
          line("$T(P)=Q$", "Definition of the translation"),
          line("$T(t)=t$", "Translation along a line preserves that line", 0),
          line(
            "$T(\\ell)$ passes through $Q$ parallel to $\\ell$",
            "A translation maps a line to a parallel line",
            0,
          ),
          line("$T(\\ell)=m$", "Uniqueness of the parallel through $Q$", 2),
          line(
            "$T$ maps the rays of $\\angle1$ to those of $\\angle5$",
            "Images of the two rays",
            1,
            4 - 1,
          ),
          line(
            "$\\angle1\\cong\\angle5$",
            "Translations preserve angle measure",
            4,
          ),
        ]
      : [
          line("$\\ell\\parallel m$", "Given"),
          line("$\\angle1\\cong\\angle4$", "Vertical angles are congruent"),
          line(
            "$\\angle4\\cong\\angle5$",
            "Alternate interior angles postulate",
            0,
          ),
          line(
            "$\\angle1\\cong\\angle5$",
            "Transitive property of congruence",
            1,
            2,
          ),
        ],
    wrong: [
      "Corresponding angles are congruent",
      "Same-side interior angles are supplementary",
      translation
        ? "Translations preserve distance"
        : "Definition of linear pair",
    ],
    figure: scene(els),
    fillOnly: translation,
    hint: translation
      ? "Follow the two rays making angle 1 as $P$ moves to $Q$."
      : "Find the angle vertical to angle 1, then its alternate interior partner.",
    explanation: [
      translation
        ? "A slide preserves direction. Both rays land on the corresponding rays at the lower crossing; a translation preserves angle measure."
        : "Angle 1 is vertical to angle 4. Angle 4 and angle 5 are alternate interior angles under the stated postulate.",
      "The corresponding-angle theorem is the conclusion, so it cannot serve as its own reason.",
    ],
  };
}

function construction(r: Random, variant: string): ClauseSurface {
  const kind = r(0, 2),
    length = r(4, 10),
    theta = pick(
      r,
      Array.from({ length: 111 }, (_, i) => i + 30).filter((x) => x !== 60),
    ),
    radius = r(3, 6);
  const figure = drawing({
    at: { A: [0, 3], B: [length, 3], P: [0, 0], Q: [length, 0] },
    segments: ["AB", "PQ"],
  });
  if (variant === "copy-segment") {
    const extension = r(0, 3) === 0,
      tool = pick(r, ["compass", "string", "software"] as const);
    const open =
      tool === "compass"
        ? "Open the compass to the length $AB$."
        : tool === "string"
          ? "Set the string length to $AB$."
          : "Use the circle tool with radius equal to $AB$.";
    const arc =
      tool === "string"
        ? "Pin the string at $P$ and mark its intersection $Q$ with the ray."
        : "Keep that radius, center at $P$, and mark intersection $Q$ with the ray.";
    const steps = [
      "Draw a ray from $P$.",
      open,
      arc,
      ...(extension
        ? [
            "Keep the same radius, center at $Q$, and mark $R$ farther along the ray.",
          ]
        : []),
    ];
    const target = extension ? "$PR=2AB$" : "$PQ=AB$";
    return choice(
      r,
      `Copy segment $AB$ of length ${length} using ${tool === "software" ? "a dynamic geometry circle tool" : tool === "string" ? "a taut string" : "a compass and unmarked straightedge"}. ${extension ? "Construct twice its length. " : ""}${kind === 0 ? "A ray from $P$ has been drawn. What is next?" : kind === 1 ? "Which order works?" : `Why does ${target} hold?`}`,
      kind === 0
        ? open
        : kind === 1
          ? extension
            ? "Ray from $P$; radius $AB$; center $P$ marks $Q$; same radius at $Q$ marks $R$ farther along."
            : "Draw ray from $P$; set radius $AB$; center at $P$ with that radius to mark $Q$."
          : extension
            ? "Each consecutive radius has length $AB$, so segment addition gives $PR = 2AB$."
            : "$Q$ lies on the circle centered at $P$ with radius $AB$, so $PQ = AB$.",
      kind === 0
        ? [
            "Measure $AB$ with markings on the straightedge.",
            "Use $PA$ as the radius instead of $AB$.",
            "Draw line $AP$.",
          ]
        : kind === 1
          ? [
              "Draw the ray. Center at $Q$ before $Q$ has been constructed. Then locate $Q$.",
              "Draw the ray. Set the radius to $AB$, then change it to half of $AB$ before marking $Q$.",
              "Draw the ray. Use radius $PA$ instead of $AB$ and mark $Q$.",
            ]
          : [
              "The perpendicular bisector theorem gives the copied length.",
              "The straightedge has the same length as $AB$.",
              "CPCTC gives the length because every construction has congruent triangles.",
            ],
      [
        `A circle records one fixed distance from its center. Keep the opening ${length} when moving the center.`,
        ...steps,
        `Therefore ${target}.`,
      ],
      `Preserve the given length ${length} when transferring it to the new ray.`,
      picture(
        kind === 2
          ? extension
            ? drawing({
                at: {
                  A: [0, 3],
                  B: [length, 3],
                  P: [0, 0],
                  Q: [length, 0],
                  R: [2 * length, 0],
                },
                segments: ["AB", "PQ", "QR"],
              })
            : figure
          : scene([
              ...drawing({
                at: { A: [0, 3], B: [length, 3], P: [0, 0] },
                segments: ["AB"],
              }).elements,
              {
                type: "segment",
                from: [0, 0],
                to: [length + 2, 0],
                arrow: "end",
              },
            ]),
      ),
    );
  }
  if (variant === "copy-angle") {
    const A: Point = [0, 0],
      B: Point = [radius, 0],
      C = polar(radius, theta),
      P: Point = [2 * radius + 2, 0],
      Q: Point = [P[0] + radius, 0],
      R = polar(radius, theta, P);
    const fig = drawing({
      at: kind === 2 ? { A, B, C, P, Q, R } : { A, B, C, P, Q },
      segments:
        kind === 2
          ? ["AB", "AC", "BC", "PQ", "PR", "QR"]
          : ["AB", "AC", "BC", "PQ"],
      ticks:
        kind === 2
          ? [
              ["AB", "AC", "PQ", "PR"],
              ["BC", "QR"],
            ]
          : [["AB", "AC", "PQ"]],
    });
    fig.elements.push(
      {
        type: "arc",
        center: A,
        r: radius,
        from: 0,
        to: theta,
        stroke: "muted",
      },
      { type: "arc", center: P, r: radius, from: 0, to: 160, stroke: "muted" },
    );
    return choice(
      r,
      `Copy $\\angle CAB=${theta}^\\circ$ at $P$. Equal-radius arcs centered at $A$ and $P$ mark $B,C$ and $Q$. ${kind === 0 ? "Which step constructs $R$?" : kind === 1 ? "Which order finishes the copy?" : "Why will the copied angle equal the original?"}`,
      kind === 0
        ? "Set the radius to $BC$; center at $Q$; intersect the arc centered at $P$ at $R$."
        : kind === 1
          ? "Set the radius to $BC$. Center at $Q$ and mark $R$ on the arc centered at $P$. Draw ray $PR$."
          : "$AB = AC = PQ = PR$ and $BC = QR$, so SSS and CPCTC give equal angles.",
      kind === 0
        ? [
            "Center at $Q$ with the original radius $AB$.",
            "Center at $P$ with radius $BC$.",
            "Measure the angle with a protractor.",
          ]
        : kind === 1
          ? [
              "Draw ray $PR$ before $R$ has been constructed. Then mark $R$.",
              "Center at $Q$ with radius $AB$, mark $R$, and draw $PR$.",
              "Center at $P$ with radius $BC$, mark $R$, and draw $PR$.",
            ]
          : [
              "SAS: the angle to be proved is already known.",
              "Equal-radius arcs alone always enclose equal angles.",
              "AAA proves the three side lengths equal.",
            ],
      [
        "The compass transfers three side lengths: two radii and the chord between them.",
        "The two triangles match by SSS, so their corresponding angles match (CPCTC). Equal radii alone would not fix the chord or the angle.",
      ],
      `To copy the ${theta}° angle, keep the chord $BC$ distinct from the radius $AB$.`,
      picture(fig),
    );
  }
  if (variant === "parallel-through-point") {
    const rhombus = r(0, 1) === 0,
      h = r(3, 7),
      x = h / Math.tan((r(50, 75) * Math.PI) / 180),
      rad = Math.hypot(h, x);
    const A: Point = [0, 0],
      B: Point = [rad, 0],
      P: Point = [x, h],
      Q: Point = [rad + x, h];
    const correct = rhombus
      ? kind === 0
        ? "Center at $B$ with the same radius; mark $Q$ on the first arc, choosing $Q$ distinct from $A$."
        : kind === 1
          ? "Center $P$ marks $A$; center $A$ marks $B$ on the line; center $B$ marks $Q$ distinct from $A$. Draw $PQ$."
          : "$PA = AB = BQ = QP$, so $PABQ$ is a rhombus; its opposite sides $PQ$ and $AB$ are parallel."
      : kind === 0
        ? "Copy the angle between the transversal and the line at $P$ in the corresponding position."
        : kind === 1
          ? "Draw a transversal from $P$ to $A$. Copy its angle with the line at $P$. Draw the copied ray through $P$."
          : "Equal corresponding angles imply parallel lines by the converse of the corresponding-angle theorem.";
    return choice(
      r,
      rhombus
        ? `Construct a line through $P$ parallel to line $AB$. Equal-radius arcs centered at $P$ and $A$ have located $A$ and $B$. ${kind === 0 ? "What is next?" : kind === 1 ? "Which complete order works?" : "After locating $Q$ distinct from $A$, why is $PQ$ parallel to $AB$?"}`
        : `A transversal through $P$ meets line $AB$ at $A$. Construct the parallel through $P$. ${kind === 0 ? "What is next?" : kind === 1 ? "Which order works?" : "Why does copying the corresponding angle prove parallelism?"}`,
      correct,
      kind === 2
        ? [
            "Corresponding angles are congruent because parallelism is already known.",
            "$PQ$ is perpendicular to the transversal.",
            "Two equal sides always make a parallelogram.",
          ]
        : [
            "Slide the straightedge by eye to $P$ and draw.",
            "Center at $Q$ before $Q$ has been constructed.",
            rhombus
              ? "Change the radius before drawing the arc centered at $B$."
              : "Copy the supplementary angle in the corresponding position.",
          ],
      [
        rhombus
          ? "Use the second intersection of the circles centered at $P$ and $B$; their first intersection is $A$. The four equal sides form a nondegenerate rhombus."
          : "Equal corresponding angles force the lines to be parallel. This uses the converse, because parallelism is the conclusion.",
        "A single perpendicular to the transversal does not establish this construction.",
      ],
      rhombus
        ? "Keep the same opening and choose the arc intersection different from $A$."
        : "Match the angle's position relative to the transversal, not just its size.",
      picture(
        drawing({
          at: kind === 2 ? { P, A, B, Q } : { P, A, B },
          segments: kind === 2 ? ["PA", "AB", "BQ", "QP"] : ["PA", "AB"],
          ticks: rhombus
            ? [kind === 2 ? ["PA", "AB", "BQ", "QP"] : ["PA", "AB"]]
            : [],
          parallel: [],
        }),
      ),
    );
  }
  if (variant === "fold-constructions") {
    const form = r(0, 5),
      mirror = r(0, 1) === 0;
    const prompts = [
      "Fold tracing paper so point $A$ lands exactly on $B$. What is the crease?",
      "Fold one ray of an angle onto the other, keeping the vertex fixed. What is the crease inside the angle?",
      "Fold a line onto itself with a distinct crease through $P$ on the line. What is the crease?",
      "Fold a line onto itself with a crease through $P$ off the line. What is the crease?",
      "A first fold through $P$ is perpendicular to line $\\ell$. Which second fold through $P$ creates a parallel to $\\ell$?",
      "A reflection in a crease sends $A$ to $B$. Why is every point $P$ on the crease equidistant from $A$ and $B$?",
    ];
    const answers = [
      "The perpendicular bisector of $AB$.",
      "The angle bisector.",
      "The perpendicular to the line through $P$.",
      "The perpendicular to the line through $P$.",
      "Fold the first crease onto itself; use the new distinct crease through $P$.",
      "$P$ stays fixed; reflection preserves distance and sends $A$ to $B$, so $PA = PB$.",
    ];
    const foldFigure =
      form === 0 || form === 5
        ? scene([
            ...drawing({
              at: { A: [-length / 2, 0], B: [length / 2, 0], P: [0, 3] },
              segments: ["AB", "PA", "PB"],
            }).elements,
            {
              type: "segment",
              from: [0, -2],
              to: [0, 4],
              dash: "dash",
              stroke: "accent",
            },
          ])
        : form === 1
          ? scene([
              ...drawing({
                at: {
                  P: [0, 0],
                  A: polar(4, theta / 2),
                  B: polar(4, -theta / 2),
                },
                segments: ["PA", "PB"],
              }).elements,
              {
                type: "segment",
                from: [0, 0],
                to: [5, 0],
                dash: "dash",
                stroke: "accent",
              },
            ])
          : scene([
              ...drawing({
                at: { A: [-4, 0], B: [4, 0], P: [0, form === 2 ? 0 : 3] },
                segments: ["AB"],
              }).elements,
              {
                type: "segment",
                from: [0, -1],
                to: [0, 5],
                dash: "dash",
                stroke: "accent",
              },
            ]);
    return choice(
      r,
      `${prompts[form]}${mirror && form === 0 ? " A mirror placed so the image of $A$ falls on $B$ gives the same line." : ""}`,
      answers[form]!,
      form === 5
        ? [
            "The crease has equal lengths on both sides.",
            "Every line through $P$ makes $PA$ equal $PB$.",
            "A fold always moves $P$ to the midpoint of $AB$.",
          ]
        : form === 4
          ? [
              "Fold $P$ onto any point of $\\ell$ once.",
              "Repeat exactly the first fold.",
              "Use any line through $P$ without matching an image.",
            ]
          : [
              "The line through $A$ and $B$.",
              "Any line through the midpoint of $AB$, whether perpendicular or not.",
              "The perpendicular to $AB$ at $A$.",
            ],
      [
        "A fold acts as a reflection: points on the crease stay fixed, and distances and angle sizes are preserved.",
        form === 4
          ? "Two successive perpendicular directions give parallel lines. The second crease through $P$ is perpendicular to the first."
          : answers[form]!,
      ],
      "Identify what the reflection keeps fixed and which points or rays it matches.",
      picture(foldFigure),
    );
  }
  // Construction decisions are partial practice of the physical construction.
  const constructionKind = r(0, 6);
  if (constructionKind > 0) return constructionDecision(r, constructionKind);
  const AB = 2 * r(3, 5),
    half = AB / 2;
  if (kind === 0) {
    const options = [0.35, 0.5, 0.65, 0.9].map((factor, i) => ({
      id: `option-${"abcd"[i]}`,
      label: `${roundLength(factor * AB)} units`,
    }));
    return {
      prompt: `Segment $AB$ has length ${AB}. To construct its perpendicular bisector with two equal-radius arcs, which compass openings produce two distinct intersections? Select both.`,
      response: {
        kind: "multi-select",
        label: "Select both openings",
        options,
        selectionCount: 2,
      },
      answer: JSON.stringify(["option-c", "option-d"]),
      hint: `Compare each opening with half of ${AB}.`,
      explanation: [
        `Two equal-radius circles centered ${AB} apart meet twice exactly when the radius exceeds ${half}.`,
        `The openings ${roundLength(0.65 * AB)} and ${roundLength(0.9 * AB)} work. Half the segment gives one tangent meeting point, not two.`,
      ],
      figure: picture(
        drawing({ at: { A: [0, 0], B: [AB, 0] }, segments: ["AB"] }),
      ),
    };
  }
  if (kind === 1)
    return {
      ...plot(
        `An arc centered at $A$ has been drawn. To construct the perpendicular bisector of $AB$, place the compass center for the matching arc. $A=(0,2)$ and $B=(${AB},2)$.`,
        [[AB, 2]],
        {
          xMin: 0,
          xMax: 12,
          yMin: 0,
          yMax: 8,
          step: 1,
          xLabel: "x",
          yLabel: "y",
        },
        [
          "Use the other endpoint as center and keep the same radius. Equal distances from $A$ and $B$ locate their perpendicular bisector.",
        ],
        `Use the other endpoint of the segment of length ${AB}.`,
      ),
      figure: picture(
        drawing({ at: { A: [0, 2], B: [AB, 2] }, segments: ["AB"] }),
      ),
    };
  const radiusA = 0.75 * AB;
  const optionScene = (
    center: Point,
    radiusB: number,
    asLine = false,
  ): Scene => ({
    v: 1,
    width: 260,
    maxHeight: 260,
    elements: [
      { type: "segment", from: [0, 0], to: [AB, 0] },
      { type: "circle", center: [0, 0], r: radiusA, stroke: "muted" },
      asLine
        ? { type: "segment", from: [AB, -AB], to: [AB, AB] }
        : { type: "circle", center, r: radiusB, stroke: "accent" },
      { type: "text", at: [0, -0.5], text: "A", font: "math" },
      { type: "text", at: [AB, -0.5], text: "B", font: "math" },
    ],
  });
  const out = figures(
    r,
    `Construct the perpendicular bisector of $AB$, length ${AB}. A circle of radius ${radiusA} centered at $A$ is drawn. Which picture adds the correct next circle?`,
    [
      {
        label: "A circle at $B$ with the same radius as the circle at $A$.",
        scene: optionScene([AB, 0], radiusA),
      },
      {
        label: "A smaller circle centered at $B$, with a changed radius.",
        scene: optionScene([AB, 0], 0.2 * AB),
      },
      {
        label:
          "A circle centered at the midpoint instead of the other endpoint.",
        scene: optionScene([half, 0], radiusA),
      },
      {
        label: "A line through $B$ instead of a second circle.",
        scene: optionScene([AB, 0], radiusA, true),
      },
    ],
    [
      "The second circle must be centered at $B$ with exactly the same radius. Their two intersection points are equidistant from the endpoints.",
      "Join the intersection points to make the perpendicular bisector.",
    ],
    `Keep the radius ${radiusA} and move the center to the other endpoint.`,
  );
  if (out.response.kind === "figure-choice") {
    out.response.noun = "Picture";
    out.response.label = "Choose the picture";
  }
  return out;
}
const roundLength = (n: number) => Math.round(n * 100) / 100;

function constructionDecision(r: Random, family: number): ClauseSurface {
  if (family === 6) {
    const h = r(3, 7),
      P: Point = [1, h];
    const base = drawing({
      at: { A: [0, 0], B: [6, 0], P },
      segments: ["AB", "AP"],
    });
    const option = (dy: number) => ({
      v: 1 as const,
      width: 260,
      maxHeight: 260,
      elements: [
        ...base.elements,
        {
          type: "segment" as const,
          from: P,
          to: [6, h + dy] as Point,
          stroke: "accent" as const,
        },
      ],
    });
    const out = figures(
      r,
      "A transversal $AP$ meets line $AB$. At $P$, the angle with $AP$ has been copied in the corresponding position. Which final ray from $P$ is parallel to $AB$?",
      [
        {
          label:
            "The new ray through $P$ is horizontal, matching $AB$'s direction.",
          scene: option(0),
        },
        {
          label: "The new ray rises to the right instead of matching $AB$.",
          scene: option(3),
        },
        {
          label: "The new ray falls to the right instead of matching $AB$.",
          scene: option(-3),
        },
        {
          label: "The new ray follows the transversal's direction.",
          scene: option(5 * h),
        },
      ],
      [
        "Equal corresponding angles force parallel lines by the converse theorem. The constructed ray must have the same direction as $AB$.",
      ],
      `Keep the copied angle at $P$, ${h} units above $AB$.`,
    );
    if (out.response.kind === "figure-choice") {
      out.response.noun = "Picture";
      out.response.label = "Choose the picture";
    }
    return out;
  }
  let at: Record<string, Point>,
    segments: string[],
    center: string,
    radius: number,
    prompt: string,
    previous: Element[] = [],
    angleGiven: number | undefined;
  if (family === 1 || family === 2) {
    const half = r(3, 5),
      height = family === 1 ? 0 : r(3, 6);
    at = { A: [-half, 0], B: [half, 0], P: [0, height] };
    segments = ["AB"];
    center = "B";
    radius = half + 2;
    prompt = `Construct the perpendicular ${family === 1 ? "through $P$ on" : "from $P$ to"} line $AB$. A preliminary arc centered at $P$ marked $A$ and $B$, equidistant from $P$. A circle of radius ${radius} centered at $A$ is drawn. Which picture adds the matching circle?`;
    previous = [
      {
        type: "circle",
        center: at.P!,
        r: Math.hypot(half, height),
        stroke: "muted",
      },
      { type: "circle", center: at.A!, r: radius, stroke: "muted" },
    ];
  } else if (family === 3) {
    const angle = r(40, 120);
    at = { A: [0, 0], B: [4, 0], C: polar(4, angle) };
    segments = ["AB", "AC"];
    center = "C";
    radius = 4;
    prompt = `Bisect angle $BAC$. An arc centered at $A$ marked $B$ and $C$ on the rays. A circle of radius ${radius} centered at $B$ is drawn. Which picture adds the matching circle?`;
    previous = [
      { type: "arc", center: at.A!, r: 4, from: 0, to: angle, stroke: "muted" },
      { type: "circle", center: at.B!, r: radius, stroke: "muted" },
    ];
  } else if (family === 4) {
    radius = r(4, 8);
    at = { A: [0, 4], B: [radius, 4], P: [0, 0] };
    segments = ["AB"];
    center = "P";
    prompt = `Copy segment $AB$ of length ${radius} onto the ray from $P$. The opening is set to $AB$. Which picture places the next circle?`;
    previous = [
      { type: "segment", from: at.P!, to: [radius + 2, 0], arrow: "end" },
    ];
  } else {
    const angle = pick(r, [40, 50, 70, 80, 100, 120]),
      rad = r(3, 5);
    angleGiven = angle;
    at = {
      A: [0, 0],
      B: [rad, 0],
      C: polar(rad, angle),
      P: [2 * rad + 3, 0],
      Q: [3 * rad + 3, 0],
    };
    segments = ["AB", "AC", "BC", "PQ"];
    center = "Q";
    radius = Math.hypot(at.B![0] - at.C![0], at.B![1] - at.C![1]);
    prompt = `Copy angle $BAC=${angle}^\\circ$ at $P$. Equal-radius arcs centered at $A$ and $P$ marked $B,C$ and $Q$. The opening has been set to chord $BC$. Which picture adds the next circle?`;
    previous = [
      { type: "arc", center: at.P!, r: rad, from: 0, to: 160, stroke: "muted" },
    ];
  }
  const base = drawing({ at, segments });
  const target = at[center]!,
    wrongCenter = Object.entries(at).find(([name]) => name !== center)![1];
  const candidate = (c: Point, rr: number, lineInstead = false): Scene => ({
    v: 1,
    width: 260,
    maxHeight: 260,
    elements: [
      ...base.elements,
      ...previous,
      lineInstead
        ? { type: "segment", from: c, to: [c[0], c[1] + 5], stroke: "accent" }
        : { type: "circle", center: c, r: rr, stroke: "accent" },
    ],
  });
  const out = figures(
    r,
    prompt,
    [
      {
        label: `Circle centered at $${center}$ with the required opening unchanged.`,
        scene: candidate(target, radius),
      },
      {
        label: `Circle centered at $${center}$ but with the opening halved.`,
        scene: candidate(target, radius / 2),
      },
      {
        label:
          "Circle with the required opening but at the wrong existing center.",
        scene: candidate(wrongCenter, radius),
      },
      {
        label: `A straight line from $${center}$, instead of the required circle.`,
        scene: candidate(target, radius, true),
      },
    ],
    [
      `Use center $${center}$ and keep the stated opening. Changing the center or radius changes the distances enforced by the construction.`,
      family === 5
        ? "The copied angle follows from SSS: two radii and the chord match."
        : "The intersections of equal-radius circles have equal distances to their centers.",
    ],
    angleGiven
      ? `To copy the ${angleGiven}° angle, transfer the chord length with its center on the new arc.`
      : `Keep the given opening ${radius}; identify the center that matches the construction step.`,
  );
  if (out.response.kind === "figure-choice") {
    out.response.noun = "Picture";
    out.response.label = "Choose the picture";
  }
  return out;
}

export const triangleProofTemplate: TemplateMetadata = {
  id: "two-column-triangle-proof",
  version: 1,
  title: "Prove triangle and perpendicular-bisector theorems",
  skillId: "triangle-proofs",
  gradeBand: "9–12",
  requiredResponseCapability: "structured-work-v1",
  requiredFigureCapability: "scenes-v1",
  description:
    "Build or complete proofs of isosceles base angles and their converse, the midsegment theorem, median concurrency, and both directions of the perpendicular-bisector theorem. Longer proofs are divided into justified parts.",
};
export const triangleProofVariants = [
  "isosceles-base-angles",
  "midsegment-theorem",
  "medians-concur",
  "perpendicular-bisector-theorem",
] as const;
export function triangleProofProblem(
  seed: string,
  force?: (typeof triangleProofVariants)[number],
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(triangleProofTemplate.id, seed),
    variant = force ?? pick(r, triangleProofVariants);
  const proof =
    variant === "isosceles-base-angles"
      ? isosceles(r)
      : variant === "midsegment-theorem"
        ? midsegment(r)
        : variant === "medians-concur"
          ? medians(r)
          : perpendicularBisector(r);
  const s = proofSurface(r, proof);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([triangleProofTemplate.id, 1, seed]))
        .digest("hex"),
      templateId: triangleProofTemplate.id,
      templateVersion: 1,
      skillId: triangleProofTemplate.skillId,
      seed,
      prompt: s.prompt,
      response: s.response,
      figure: s.figure,
    },
    answer: s.answer,
    hint: s.hint,
    explanation: s.explanation,
    workGrading: s.workGrading,
    variant: { id: variant },
  };
}
export const geometricClauseExtensions: Record<string, ClauseExtension> = {
  "two-column-angle-proof": {
    variants: [
      "triangle-sum-theorem",
      "vertical-angles-theorem",
      "corresponding-angles-theorem",
    ],
    capability: "structured-work-v1",
    build: (r, v) =>
      proofSurface(
        r,
        v === "triangle-sum-theorem"
          ? triangleSum(r)
          : v === "vertical-angles-theorem"
            ? verticalProof(r)
            : correspondingProof(r),
      ),
  },
  "compass-straightedge-reasoning": {
    variants: [
      "construct-by-figure",
      "fold-constructions",
      "copy-segment",
      "copy-angle",
      "parallel-through-point",
    ],
    capability: "figure-choice-v1",
    build: construction,
  },
};
