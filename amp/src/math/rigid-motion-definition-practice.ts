import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  figureParallelMark,
  figureRightMark,
  figureScene,
  figureTicks,
  sceneFigure,
} from "./geometry-teaching-figures";
import type { MultiPartChoiceResponse } from "./multi-part-choice";
import { graph, scene as sceneOf } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * HSG.CO.A.4: definitions of reflections, rotations and translations in
 * terms of angles, circles, perpendicular lines, parallel lines and line
 * segments. Three types: choose, repair or name a definition; test a
 * claimed image against the two conditions of a definition on a coordinate
 * plane; and complete a definition from its parts with the marks drawn.
 */

const band = "9–12" as const;
const skillId = "transformation-invariants";
export const rigidMotionDefinitionTemplates: readonly TemplateMetadata[] = [
  {
    id: "rigid-motion-definition-select",
    version: 1,
    title: "Which statement defines the motion?",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.1,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Choose the statement that defines a reflection, rotation or translation against statements that leave the image free (distance alone, perpendicular alone, angle alone, no direction) or define another motion; add the missing condition that a drawn counterexample fails; or name the motion a definition describes.",
  },
  {
    id: "rigid-motion-definition-check",
    version: 1,
    title: "Check a claimed image against the definition",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.2,
    requiredResponseCapability: "multi-part-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "On a coordinate plane, test whether a claimed image $P'$ satisfies each of the two conditions in the definition of a reflection, a rotation of $90^\\circ$, $180^\\circ$ or $270^\\circ$, or a translation, then decide whether $P'$ is the image.",
  },
  {
    id: "rigid-motion-definition-slots",
    version: 1,
    title: "Complete the definition of a rigid motion",
    skillId,
    gradeBand: band,
    difficultyOffset: 0,
    requiredResponseCapability: "multi-part-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Fill the three blanks of the definition of a reflection, a rotation or a translation, reading the perpendicular, equal-length, angle and parallel marks on the figure.",
  },
];

/* ------------------------------------------------------------ geometry */

export type Pt = [number, number];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const dist = (a: Pt, b: Pt) => len(sub(a, b));
/** Counterclockwise rotation of p about c by deg degrees. */
export const rotate = (p: Pt, c: Pt, deg: number): Pt => {
  const t = (deg * Math.PI) / 180;
  const v = sub(p, c);
  return [
    c[0] + v[0] * Math.cos(t) - v[1] * Math.sin(t),
    c[1] + v[0] * Math.sin(t) + v[1] * Math.cos(t),
  ];
};
/** Reflection of p across the line through a with direction u. */
export const reflect = (p: Pt, a: Pt, u: Pt): Pt => {
  const foot = add(a, mul(u, dot(sub(p, a), u) / dot(u, u)));
  return sub(mul(foot, 2), p);
};
const foot = (p: Pt, a: Pt, u: Pt): Pt =>
  add(a, mul(u, dot(sub(p, a), u) / dot(u, u)));
/** Distance from p to the line through a with direction u. */
const lineDistance = (p: Pt, a: Pt, u: Pt) =>
  Math.abs(cross(u, sub(p, a))) / len(u);

type Motion = "reflection" | "rotation" | "translation";
const MOTIONS: Motion[] = ["reflection", "rotation", "translation"];

/** A plain drawing of the motion's apparatus and points. */
interface Plain {
  motion: Motion;
  /** Reflection: a point of m and its direction. */
  a: Pt;
  u: Pt;
  /** Rotation center. */
  C: Pt;
  theta: number;
  /** Translation: A and B. */
  A: Pt;
  B: Pt;
  P: Pt;
  image: Pt;
}

const mark = (
  id: string,
  at: Pt,
  color: "accent" | "warm" | "gold" | "ink",
): Element => ({
  type: "point",
  id,
  at,
  r: 4,
  color,
});
const nameAt = (
  id: string,
  text: string,
  at: Pt,
  out: Pt,
  color?: "accent" | "warm" | "gold" | "ink",
): Element => {
  const u = len(out) ? unit(out) : ([0, 1] as Pt);
  return {
    type: "text",
    id,
    at,
    text,
    font: "math",
    bold: true,
    // A halo around a raised prime paints over the top of the letter (P′
    // reads as F′), so primed names are drawn without one.
    ...(text.includes("′") ? {} : { halo: true }),
    ...(color ? { color } : {}),
    align: [
      u[0] > 0.3 ? -1 : u[0] < -0.3 ? 1 : 0,
      u[1] > 0.3 ? 1 : u[1] < -0.3 ? -1 : 0,
    ],
    offset: [u[0] * 8, -u[1] * 8],
  };
};

/** Line m drawn across the figure through `a` with direction `u`. */
function mirror(a: Pt, u: Pt, span: number): Element[] {
  const w = unit(u);
  const end = add(a, mul(w, span));
  return [
    {
      type: "segment",
      id: "m",
      from: sub(a, mul(w, span)),
      to: end,
      stroke: "ink",
      width: 2,
    },
    nameAt("mn", "m", end, [-w[1], w[0]]),
  ];
}

interface Drawn {
  id: string;
  name: string;
  at: Pt;
  color: "accent" | "warm" | "gold" | "ink";
}
/** The apparatus (line m, center C, or directed segment AB) and points. */
function plainScene(f: Plain, points: Drawn[], marks: Element[] = []): Scene {
  const els: Element[] = [];
  const all = [f.P, f.image, ...points.map((p) => p.at)];
  const center: Pt = [
    all.reduce((s, p) => s + p[0], 0) / all.length,
    all.reduce((s, p) => s + p[1], 0) / all.length,
  ];
  if (f.motion === "reflection") {
    const span = Math.max(4, ...all.map((p) => dist(p, f.a) + 2));
    els.push(...mirror(f.a, f.u, span));
  } else if (f.motion === "rotation") {
    els.push(mark("c", f.C, "ink"), nameAt("cn", "C", f.C, sub(f.C, center)));
  } else {
    els.push(
      {
        type: "segment",
        id: "ab",
        from: f.A,
        to: f.B,
        stroke: "ink",
        width: 2,
        arrow: "end",
      },
      mark("a", f.A, "ink"),
      mark("b", f.B, "ink"),
      nameAt("an", "A", f.A, sub(f.A, f.B)),
      nameAt("bn", "B", f.B, sub(f.B, f.A)),
    );
  }
  els.push(...marks);
  for (const p of points)
    els.push(
      mark(p.id, p.at, p.color),
      nameAt(`${p.id}n`, p.name, p.at, sub(p.at, center), p.color),
    );
  const what =
    f.motion === "reflection"
      ? "Line m"
      : f.motion === "rotation"
        ? "Center C"
        : "Directed segment from A to B";
  return figureScene(
    `${what}, with points ${points.map((p) => p.name).join(", ")}`,
    els,
  );
}

const DIRS: Pt[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
const SELECT_THETAS = [45, 60, 90, 120, 135];

function plain(r: Random, motion: Motion, theta: number): Plain {
  for (;;) {
    const P: Pt = [r(-5, 5), r(-5, 5)];
    if (motion === "reflection") {
      const a: Pt = [r(-2, 2), r(-2, 2)];
      const u = pick(r, DIRS);
      if (lineDistance(P, a, u) < 2) continue;
      // Never the line y = 0: there the rule (x, y) → (x, −y), offered as a
      // wrong definition, would be the reflection itself.
      if (u[1] === 0 && a[1] === 0) continue;
      return {
        motion,
        a,
        u,
        C: [0, 0],
        theta,
        A: [0, 0],
        B: [0, 0],
        P,
        image: reflect(P, a, u),
      };
    }
    if (motion === "rotation") {
      const C: Pt = [r(-2, 2), r(-2, 2)];
      if (dist(P, C) < 2.5 || dist(P, C) > 6) continue;
      return {
        motion,
        a: [0, 0],
        u: [1, 0],
        C,
        theta,
        A: [0, 0],
        B: [0, 0],
        P,
        image: rotate(P, C, theta),
      };
    }
    const A: Pt = [r(-5, 3), r(-5, 3)];
    const d: Pt = [r(-4, 4), r(-4, 4)];
    if (len(d) < 2.5) continue;
    const B = add(A, d);
    if (
      Math.abs(cross(d, sub(P, A))) < 1e-9 ||
      dist(P, A) < 2 ||
      dist(P, B) < 2
    )
      continue;
    const image = add(P, d);
    if (dist(image, A) < 1.5 || dist(image, B) < 1.5) continue;
    // No lengths so close that a wrong condition looks true for the drawn
    // pair: AP′ against BP, AP against AB (so PP′ against AP), AP′ against
    // AB. Each pair differs by at least a tenth of AB.
    const ab = dist(A, B);
    const close = (x: number, y: number) => Math.abs(x - y) < 0.1 * ab;
    if (
      close(dist(image, A), dist(P, B)) ||
      close(dist(P, A), ab) ||
      close(dist(image, A), ab)
    )
      continue;
    return { motion, a: [0, 0], u: [1, 0], C: [0, 0], theta, A, B, P, image };
  }
}

/* ------------------------------------------- type 1: select a definition */

type SelectAsk = "complete" | "repair" | "name";
type NameKey =
  "midpoint" | "perp-bisector" | "parallel" | "circle-90" | "dilation";
const NAME_KEYS: NameKey[] = [
  "midpoint",
  "perp-bisector",
  "parallel",
  "circle-90",
  "dilation",
];

/** One flawed definition and a concrete point that fits its wording but is
 * not the image (or the image it fails to allow). */
export interface Flawed {
  key: string;
  label: string;
  feedback: string;
  /** A point the wording allows that is not the image, or null when the
   * wording allows no point or defines a map named in `other`. */
  counter: (f: Plain) => Pt | null;
}

/** The house definitions, in the words of the correct options. */
export const HOUSE = {
  reflection:
    "Points on $m$ stay put; any other $P$ goes to the $P'$ with $m$ as the perpendicular bisector of $\\overline{PP'}$",
  rotation: (t: number) =>
    `$C$ stays put; any other $P$ goes to $P'$ with $CP'=CP$, $m\\angle PCP'=${t}^\\circ$ counterclockwise from ray $CP$`,
  translation:
    "Each $P$ goes to the $P'$ with $\\overline{PP'}$ parallel to (or on) line $AB$, $PP'=AB$, the same way as $A$ to $B$",
};

export function flawedPool(motion: Motion, theta: number): Flawed[] {
  if (motion === "reflection")
    return [
      {
        key: "distance-only",
        label:
          "Points on $m$ stay put; any other point $P$ goes to a point $P'$ as far from $m$ as $P$ is, on the other side of $m$",
        feedback:
          "Every point of a whole line parallel to $m$ is that far from $m$ on the other side, so this does not pick one $P'$. It leaves out that $\\overline{PP'}$ is perpendicular to $m$.",
        counter: (f) => add(f.image, mul(unit(f.u), 3)),
      },
      {
        key: "perpendicular-only",
        label:
          "Points on $m$ stay put; any other point $P$ goes to a point $P'$ such that $\\overline{PP'}$ is perpendicular to line $m$",
        feedback:
          "Every point of the perpendicular to $m$ through $P$ fits, at any distance. It leaves out that $m$ passes through the midpoint of $\\overline{PP'}$.",
        counter: (f) => add(f.image, sub(f.image, foot(f.P, f.a, f.u))),
      },
      {
        key: "midpoint-only",
        label:
          "Points on $m$ stay put; any other point $P$ goes to a point $P'$ with the midpoint of $\\overline{PP'}$ on line $m$",
        feedback:
          "Any point $P'$ whose segment to $P$ crosses $m$ at its midpoint fits, in any direction. It leaves out that $\\overline{PP'}$ is perpendicular to $m$.",
        counter: (f) =>
          sub(mul(add(foot(f.P, f.a, f.u), mul(unit(f.u), 2)), 2), f.P),
      },
      {
        key: "coordinate-rule",
        label:
          "Every point $(x,y)$, on line $m$ or not, goes to the point $(x,-y)$, its mirror image across the $x$-axis",
        feedback:
          "That rule is the reflection across the $x$-axis only. It never mentions $m$: a point of $m$ off the $x$-axis would move, though a reflection across $m$ keeps it.",
        counter: () => null,
      },
    ];
  if (motion === "rotation")
    return [
      {
        key: "circle-only",
        label:
          "$C$ stays put; any other point $P$ goes to a point $P'$ with $CP'=CP$, on the circle with center $C$ through $P$",
        feedback:
          "Every point of that circle fits. It leaves out the angle: $m\\angle PCP'$ must be the rotation angle, counterclockwise.",
        counter: (f) => rotate(f.P, f.C, f.theta + 90),
      },
      {
        key: "angle-only",
        label: `$C$ stays put; any other point $P$ goes to some point $P'$ with $m\\angle PCP'=${theta}^\\circ$ counterclockwise from ray $CP$`,
        feedback:
          "Every point of ray $CP'$ fits, at any distance from $C$. It leaves out the circle: $CP'$ must equal $CP$.",
        counter: (f) => add(f.C, mul(sub(f.image, f.C), 2)),
      },
      {
        key: "clockwise",
        label: `$C$ stays put; any other point $P$ goes to the $P'$ with $CP'=CP$, $m\\angle PCP'=${theta}^\\circ$ clockwise from ray $CP$`,
        feedback: `This defines the clockwise rotation by $${theta}^\\circ$, a different motion. The counterclockwise direction is part of the definition.`,
        counter: (f) => rotate(f.P, f.C, -f.theta),
      },
      {
        key: "half-turn",
        label:
          "$C$ stays put; any other point $P$ goes to the point $P'$ for which $C$ is the midpoint of $\\overline{PP'}$",
        feedback: `This defines the rotation by $180^\\circ$, a half turn, not the rotation by $${theta}^\\circ$.`,
        counter: (f) => sub(mul(f.C, 2), f.P),
      },
      {
        key: "arc-length",
        label: `$C$ stays put; any other point $P$ moves $${theta}$ units counterclockwise along the circle with center $C$ through $P$`,
        feedback: `Degrees measure turning, not length. Moving $${theta}$ units along its circle turns a point near $C$ through a larger angle than a point far from $C$, so the points do not all turn by $${theta}^\\circ$.`,
        counter: (f) =>
          rotate(f.P, f.C, (theta * 180) / Math.PI / dist(f.P, f.C)),
      },
    ];
  return [
    {
      key: "length-only",
      label:
        "Each point $P$ goes to a point $P'$ with $PP'=AB$, so every point moves exactly the same distance as from $A$ to $B$",
      feedback:
        "Every point of the circle with center $P$ and radius $AB$ fits. It leaves out the direction: $\\overline{PP'}$ must be parallel to line $AB$, the same way.",
      counter: (f) => add(f.P, [-(f.B[1] - f.A[1]), f.B[0] - f.A[0]]),
    },
    {
      key: "direction-only",
      label:
        "Each point $P$ goes to a point $P'$ with $\\overline{PP'}$ parallel to (or on) line $AB$, the same way as from $A$ to $B$",
      feedback:
        "Every point of the ray from $P$ in that direction fits, at any distance. It leaves out $PP'=AB$.",
      counter: (f) => add(f.P, mul(sub(f.B, f.A), 2)),
    },
    {
      key: "no-direction",
      label:
        "Each point $P$ goes to a point $P'$ with $\\overline{PP'}$ parallel to (or on) line $AB$ and with $PP'=AB$",
      feedback:
        "Two points fit: one each way from $P$. It leaves out that $P'$ is the same way from $P$ as $B$ is from $A$.",
      counter: (f) => sub(f.P, sub(f.B, f.A)),
    },
    {
      key: "on-segment",
      label:
        "Each point $P$ goes to the point $P'$ on ray $AB$ with $AP'=AB$, so every point lands where $B$ is",
      feedback:
        "That sends every point to $B$. The image of $P$ is off line $AB$ when $P$ is.",
      counter: (f) => f.B,
    },
    {
      key: "circle",
      label:
        "Each point $P$ goes to a point $P'$ that is the same distance from $A$ as $P$ is from $B$",
      feedback:
        "Every point of a circle with center $A$ fits. A translation is defined by parallel segments of equal length, not by a circle.",
      counter: (f) => add(f.A, [dist(f.P, f.B), 0]),
    },
  ];
}

interface RepairCase {
  partial: string;
  options: ChoiceOption[];
  /** The counterexample: fits the partial statement, is not the image. */
  Q: Pt;
  /** Rotation: a marked point X of m for the "chosen point" option. */
  X?: Pt;
}

/** One of two wordings of the same option, drawn per seed, so the key's
 * length among the options varies the way chance would. */
const either = (r: Random, short: string, long: string) =>
  r(0, 1) === 0 ? short : long;

function repairCase(r: Random, f: Plain): RepairCase {
  if (f.motion === "reflection") {
    const w = unit(f.u);
    const step = pick(r, [-1, 1]) * pick(r, [2, 3, 4]);
    const Q = add(f.image, mul(w, step));
    const F = foot(f.P, f.a, f.u);
    const X = add(F, mul(w, -Math.sign(step) * pick(r, [2, 3])));
    return {
      partial:
        "The reflection across $m$ sends $P$ to the point $P'$ that is the same distance from $m$ as $P$, on the other side.",
      Q,
      X,
      options: [
        {
          label: either(
            r,
            "$\\overline{PP'}$ must be perpendicular to $m$",
            "$\\overline{PP'}$ must be perpendicular to $m$, crossing it at a right angle",
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "$P'$ must be on the other side of $m$",
            "$P'$ must be on the other side of $m$ from $P$, so that $m$ runs between $P$ and $P'$",
          ),
          feedback: "Dana already said that, and $Q$ is on the other side too.",
        },
        {
          label: either(
            r,
            "$\\overline{PP'}$ must be parallel to $m$",
            "$\\overline{PP'}$ must be parallel to $m$, never crossing the line",
          ),
          feedback:
            "A segment parallel to $m$ stays on one side of it, so no point could be on the other side: nothing would qualify.",
        },
        {
          label: either(
            r,
            "$XP'$ must equal $XP$ for the marked point $X$ of $m$",
            "$P'$ must be as far from the marked point $X$ of $m$ as $P$ is",
          ),
          feedback:
            "The circle with center $X$ through $P$ meets Dana's set of points twice: at the true image and at a second point, so $P'$ is still not pinned down.",
        },
      ],
    };
  }
  if (f.motion === "rotation") {
    // Q is on the circle at another angle, at least 2 units from the image.
    const candidates = [-f.theta, 180, f.theta + 90, f.theta - 90].filter(
      (t) =>
        ((t % 360) + 360) % 360 !== 0 &&
        dist(rotate(f.P, f.C, t), f.image) >= 2,
    );
    const Q = rotate(f.P, f.C, pick(r, candidates));
    return {
      partial:
        "The rotation about $C$ sends $P$ to the point $P'$ with $CP'=CP$.",
      Q,
      options: [
        {
          label: either(
            r,
            `$m\\angle PCP'$ must be $${f.theta}^\\circ$, counterclockwise`,
            `$m\\angle PCP'$ must be $${f.theta}^\\circ$, measured counterclockwise from ray $CP$`,
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "$P'$ must be on line $CP$, on the far side of $C$ from $P$",
            "$P'$ must be on line $CP$, on the opposite side of $C$ from $P$",
          ),
          feedback: `That gives the half turn, $180^\\circ$, not the rotation by $${f.theta}^\\circ$.`,
        },
        {
          label: either(
            r,
            "$PP'$ must be the same for every point $P$",
            "$\\overline{PP'}$ must be the same length for every point $P$",
          ),
          feedback:
            "Points farther from $C$ move farther, so no rotation keeps $PP'$ the same; the map that moves nothing would fit instead.",
        },
        {
          label: either(
            r,
            "$\\overline{CP'}$ must be perpendicular to $\\overline{CP}$",
            "$\\overline{CP'}$ must be perpendicular to $\\overline{CP}$, meeting it at the center $C$",
          ),
          feedback:
            f.theta === 90
              ? "That allows two points, a quarter turn either way. The direction, counterclockwise, is still missing."
              : `That makes the angle $90^\\circ$, not $${f.theta}^\\circ$.`,
        },
      ],
    };
  }
  const d = sub(f.B, f.A);
  const perp: Pt = pick(r, [1, -1]) === 1 ? [-d[1], d[0]] : [d[1], -d[0]];
  return {
    partial:
      "The translation along $\\overrightarrow{AB}$ sends $P$ to the point $P'$ with $PP'=AB$.",
    Q: add(f.P, perp),
    options: [
      {
        label: either(
          r,
          "$\\overrightarrow{PP'}$ must point the same way as $\\overrightarrow{AB}$",
          "$\\overline{PP'}$ must be parallel to (or on) line $AB$, the same way as $A$ to $B$",
        ),
        correct: true,
      },
      {
        label: either(
          r,
          "$P'$ must be as far from $A$ as $P$ is",
          "$P'$ must be the same distance from $A$ as $P$ is",
        ),
        feedback:
          "The circle with center $A$ through $P$ meets Dana's circle in up to two points, so this does not pick out one image, and in general neither point is the image.",
      },
      {
        label: either(
          r,
          "$\\overrightarrow{PP'}$ must be at a right angle to $\\overrightarrow{AB}$",
          "$\\overline{PP'}$ must be perpendicular to line $AB$, at a right angle to the direction from $A$ to $B$",
        ),
        feedback:
          "Two points fit, one on each side, and neither is the image: $Q$ in the figure is one of them.",
      },
      {
        label: either(
          r,
          "$P'$ must be on the line through $A$ and $B$",
          "$P'$ must be on line $AB$, the line through $A$ and $B$",
        ),
        feedback:
          "The image of $P$ is on line $AB$ only when $P$ is. Here no point of line $AB$ is the image.",
      },
    ],
  };
}

interface NameCase {
  key: NameKey;
  statement: string;
  options: ChoiceOption[];
  figure: Plain;
  hint: string;
}

function nameCase(r: Random, key: NameKey): NameCase {
  const motion: Motion =
    key === "perp-bisector"
      ? "reflection"
      : key === "parallel"
        ? "translation"
        : "rotation";
  const f = plain(r, motion, key === "circle-90" ? 90 : 180);
  if (key === "midpoint")
    return {
      key,
      figure: { ...f, image: sub(mul(f.C, 2), f.P) },
      statement:
        "$C$ stays put, and every other point $P$ goes to the point $P'$ for which $C$ is the midpoint of $\\overline{PP'}$",
      hint: "Picture $P$ and the point straight through $C$ at the same distance. How far has ray $CP$ turned to reach ray $CP'$?",
      options: [
        {
          label: either(
            r,
            "The rotation about $C$ by $180^\\circ$",
            "The rotation about $C$ by $180^\\circ$, a half turn that keeps $C$ in place",
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "A reflection across a line through $C$",
            "A reflection across a line through $C$, which keeps $C$ in place",
          ),
          feedback:
            "A reflection keeps every point of its line in place; this motion keeps only $C$ in place.",
        },
        {
          label: either(
            r,
            "The rotation about $C$ by $90^\\circ$",
            "The rotation about $C$ by $90^\\circ$ counterclockwise",
          ),
          feedback:
            "A quarter turn puts $P'$ at a right angle to $CP$; here $P'$ is straight across from $P$.",
        },
        {
          label: either(
            r,
            "The dilation about $C$ with scale factor $2$",
            "The dilation about $C$ with scale factor $2$, doubling each distance from $C$",
          ),
          feedback:
            "That puts $P'$ on ray $CP$ twice as far out; here $P'$ is on the opposite ray at the same distance.",
        },
      ],
    };
  if (key === "perp-bisector")
    return {
      key,
      figure: f,
      statement:
        "every point of line $m$ stays put, and any other point $P$ goes to the point $P'$ for which $m$ is the perpendicular bisector of $\\overline{PP'}$",
      hint: "Which motion keeps a whole line in place and puts each other point the same distance away on the other side of that line?",
      options: [
        {
          label: either(
            r,
            "The reflection across line $m$",
            "The reflection across line $m$, keeping each point of $m$ in place",
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "A rotation by $90^\\circ$ about a point of $m$",
            "A rotation by $90^\\circ$ about a point of $m$, a quarter turn",
          ),
          feedback:
            "A rotation keeps only its center in place, but this motion keeps every point of $m$ in place. Perpendicular does not mean a quarter turn.",
        },
        {
          label: either(
            r,
            "A translation across line $m$",
            "A translation perpendicular to $m$, moving every point the same distance",
          ),
          feedback:
            "A translation moves every point, including the points of $m$.",
        },
        {
          label: either(
            r,
            "A rotation by $180^\\circ$ about a point of $m$",
            "A half turn, a rotation by $180^\\circ$ about a point of $m$",
          ),
          feedback:
            "A half turn keeps only its center in place and sends the other points of $m$ elsewhere on $m$.",
        },
      ],
    };
  if (key === "parallel")
    return {
      key,
      figure: f,
      statement:
        "$\\overline{PP'}$ is parallel to (or on) line $AB$, $PP'=AB$, and $P'$ is the same way from $P$ as $B$ is from $A$",
      hint: "Every point moves by the same length, in the same direction as from $A$ to $B$. Which motion moves all points alike?",
      options: [
        {
          label: either(
            r,
            "The translation along $\\overrightarrow{AB}$",
            "The translation that moves each point by $\\overrightarrow{AB}$",
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "The translation by $\\overrightarrow{BA}$",
            "The translation along $\\overrightarrow{BA}$, from $B$ toward $A$",
          ),
          feedback:
            "That moves each point the way from $B$ to $A$, the opposite direction.",
        },
        {
          label: either(
            r,
            "The reflection across line $AB$",
            "The reflection across line $AB$, which keeps $AB$ in place",
          ),
          feedback:
            "A reflection moves points across line $AB$, perpendicular to it, and keeps the points of $AB$ in place.",
        },
        {
          label: either(
            r,
            "The rotation about $A$ by $180^\\circ$",
            "The half turn about $A$, a rotation by $180^\\circ$",
          ),
          feedback:
            "A half turn about $A$ sends $B$ to the other side of $A$; points do not all move the same way.",
        },
      ],
    };
  if (key === "circle-90")
    return {
      key,
      figure: { ...f, theta: 90, image: rotate(f.P, f.C, 90) },
      statement:
        "$C$ stays put, and every other point $P$ goes to the point $P'$ with $CP'=CP$ and $m\\angle PCP'=90^\\circ$, counterclockwise from ray $CP$",
      hint: "$P'$ stays on the circle with center $C$ through $P$, and ray $CP$ turns $90^\\circ$ to reach it. Which way does it turn?",
      options: [
        {
          label: either(
            r,
            "The rotation about $C$ by $90^\\circ$ counterclockwise",
            "The rotation about $C$ by $90^\\circ$ counterclockwise, a quarter turn",
          ),
          correct: true,
        },
        {
          label: either(
            r,
            "The rotation about $C$ by $90^\\circ$ clockwise",
            "The rotation about $C$ by $90^\\circ$ clockwise, a quarter turn",
          ),
          feedback: "The angle is measured counterclockwise from ray $CP$.",
        },
        {
          label: either(
            r,
            "A reflection across a line through $C$, a mirror line",
            "A reflection across a line through $C$, which keeps every point of that line in place",
          ),
          feedback:
            "A reflection keeps every point of its line in place; this motion keeps only $C$ in place.",
        },
        {
          label: either(
            r,
            "The rotation about $C$ by $180^\\circ$, a half turn about $C$",
            "The half turn about $C$: the rotation about $C$ by $180^\\circ$",
          ),
          feedback:
            "A half turn makes $m\\angle PCP'=180^\\circ$, not $90^\\circ$.",
        },
      ],
    };
  return {
    key,
    figure: { ...f, image: add(f.C, mul(sub(f.P, f.C), 2)) },
    statement:
      "$C$ stays put, and every other point $P$ goes to the point $P'$ on ray $CP$ with $CP'=2\\,CP$",
    hint: "Each point stays on its ray from $C$ but ends up $2$ times as far from $C$. Does that keep the distance between two points?",
    options: [
      {
        label: either(
          r,
          "The dilation about $C$ with scale factor $2$",
          "The dilation about $C$ with scale factor $2$, doubling each distance from $C$",
        ),
        correct: true,
      },
      {
        label: either(
          r,
          "A translation, since every point but $C$ moves",
          "A translation, because every point other than $C$ moves",
        ),
        feedback:
          "A translation moves every point, $C$ too, and all by the same length.",
      },
      {
        label: either(
          r,
          "The rotation about $C$ by $180^\\circ$",
          "The rotation about $C$ by $180^\\circ$, a half turn about $C$",
        ),
        feedback:
          "A half turn keeps each point's distance from $C$; here it doubles.",
      },
      {
        label: either(
          r,
          "The dilation about $C$ with scale factor $\\frac{1}{2}$",
          "The dilation about $C$ with scale factor $\\frac{1}{2}$, halving each distance from $C$",
        ),
        feedback:
          "Scale factor $\\frac{1}{2}$ halves each distance from $C$; here it doubles.",
      },
    ],
  };
}

export interface SelectCase {
  ask: SelectAsk;
  motion: Motion;
  f: Plain;
  /** complete: the three flawed definitions shown. */
  flawed: Flawed[];
  repair?: RepairCase;
  name?: NameCase;
}

const motionName = (f: Plain) =>
  f.motion === "reflection"
    ? "the reflection across line $m$"
    : f.motion === "rotation"
      ? `the rotation about $C$ by $${f.theta}^\\circ$ counterclockwise`
      : "the translation along $\\overrightarrow{AB}$";

function selectSurface(m: SelectCase, r: Random): Surface | null {
  const f = m.f;
  if (m.ask === "complete") {
    const correct =
      f.motion === "reflection"
        ? HOUSE.reflection
        : f.motion === "rotation"
          ? HOUSE.rotation(f.theta)
          : HOUSE.translation;
    const options: ChoiceOption[] = [
      { label: correct, correct: true },
      ...m.flawed.map((x) => ({ label: x.label, feedback: x.feedback })),
    ];
    const surface = choiceSurface(r, {
      prompt: `${f.motion === "reflection" ? "Line $m$ is drawn" : f.motion === "rotation" ? "Point $C$ is drawn" : "The directed segment from $A$ to $B$ is drawn"}, with a point $P$ and its image $P'$. Which statement defines ${motionName(f)}? A definition must say exactly where the image $P'$ of every point $P$ is.`,
      options,
      hint: `Test each statement on $P$: could two different points both fit it, or does it describe another motion? A definition of ${motionName(f)} allows exactly one $P'$.`,
      explanation: [
        "A definition must pin down one image $P'$ for every point $P$. A condition that two different points satisfy is not yet a definition.",
        f.motion === "reflection"
          ? "Being as far from $m$ on the other side allows a whole line of points parallel to $m$; being on the perpendicular through $P$ allows a whole line too. Together they meet in one point: $m$ is the perpendicular bisector of $\\overline{PP'}$."
          : f.motion === "rotation"
            ? `$CP'=CP$ puts $P'$ on the circle with center $C$ through $P$; $m\\angle PCP'=${f.theta}^\\circ$ counterclockwise puts it on one ray from $C$. The circle and the ray meet in one point.`
            : "Parallel to line $AB$ and the same way puts $P'$ on one ray from $P$; $PP'=AB$ picks one point of that ray.",
        `So the definition is: ${correct}.`,
        ...m.flawed.map((x) => `Not "${x.label}": ${x.feedback}`),
      ],
    });
    return (
      surface && {
        ...surface,
        figure: sceneFigure(
          plainScene(f, [
            { id: "p", name: "P", at: f.P, color: "accent" },
            { id: "q", name: "P′", at: f.image, color: "warm" },
          ]),
        ),
      }
    );
  }
  if (m.ask === "repair") {
    const rep = m.repair!;
    const correct = rep.options.find((o) => o.correct)!;
    const surface = choiceSurface(r, {
      prompt: `Dana writes: "${rep.partial}" Point $Q$ in the figure fits Dana's statement, but $Q$ is not the image of $P$. What must Dana add so that the statement is a definition of ${motionName(f)}?`,
      options: rep.options,
      hint: `$Q$ fits Dana's words but is not the image $P'$ under ${motionName(f)}. Look at what $Q$ gets wrong compared with $P'$, and choose the condition that $P'$ meets and $Q$ fails.`,
      explanation: [
        "A definition must pin down one image $P'$ for every point $P$. Dana's statement fits both $P'$ and $Q$, so it is not yet a definition.",
        f.motion === "reflection"
          ? "Every point as far from $m$ as $P$, on the other side, lies on one line parallel to $m$; $Q$ is one of them. Requiring $\\overline{PP'}\\perp m$ leaves only the point straight across."
          : f.motion === "rotation"
            ? `Every point of the circle with center $C$ through $P$ has $CP'=CP$; $Q$ is one of them. Requiring $m\\angle PCP'=${f.theta}^\\circ$ counterclockwise leaves only one point of the circle.`
            : "Every point of the circle with center $P$ and radius $AB$ has $PP'=AB$; $Q$ is one of them. Requiring $\\overline{PP'}$ parallel to line $AB$, the same way, leaves only one point.",
        `So Dana must add: ${correct.label}. Then $P'$ fits and $Q$ does not.`,
        ...rep.options
          .filter((o) => !o.correct)
          .map((o) => `Not "${o.label}": ${o.feedback}`),
      ],
    });
    const points: Drawn[] = [
      { id: "p", name: "P", at: f.P, color: "accent" },
      { id: "i", name: "P′", at: f.image, color: "warm" },
      { id: "q", name: "Q", at: rep.Q, color: "gold" },
    ];
    if (rep.X) points.push({ id: "x", name: "X", at: rep.X, color: "ink" });
    return (
      surface && { ...surface, figure: sceneFigure(plainScene(f, points)) }
    );
  }
  const nc = m.name!;
  const correct = nc.options.find((o) => o.correct)!;
  const surface = choiceSurface(r, {
    prompt: `A motion is defined this way: ${nc.statement}. Which motion is it?`,
    options: nc.options,
    hint: nc.hint,
    explanation: [
      "Each definition is built from one kind of object: a midpoint or a circle and an angle (rotation), a perpendicular bisector (reflection), parallel segments of equal length (translation), or a ray and a scale factor (dilation).",
      `This one matches ${correct.label.charAt(0).toLowerCase()}${correct.label.slice(1)}.`,
      ...nc.options
        .filter((o) => !o.correct)
        .map((o) => `Not "${o.label}": ${o.feedback}`),
    ],
  });
  return (
    surface && {
      ...surface,
      figure: sceneFigure(
        plainScene(nc.figure, [
          { id: "p", name: "P", at: nc.figure.P, color: "accent" },
          { id: "q", name: "P′", at: nc.figure.image, color: "warm" },
        ]),
      ),
    }
  );
}

const selectFamily = chainFamily({
  template: rigidMotionDefinitionTemplates[0]!,
  axes: {
    motion: defineAxis("motion", [
      "reflection",
      "rotation",
      "translation",
    ] as const),
    ask: defineAxis("ask", ["complete", "repair", "name"] as const, {
      weights: [2, 2, 1],
    }),
  },
  model: (r, axes): SelectCase => {
    const theta = pick(r, SELECT_THETAS);
    const motion = axes.motion as Motion;
    if (axes.ask === "name") {
      const name = nameCase(r, pick(r, NAME_KEYS));
      return {
        ask: "name",
        motion: name.figure.motion,
        f: name.figure,
        flawed: [],
        name,
      };
    }
    const f = plain(r, motion, theta);
    if (axes.ask === "repair")
      return { ask: "repair", motion, f, flawed: [], repair: repairCase(r, f) };
    const flawed = shuffle(r, flawedPool(motion, theta)).slice(0, 3);
    return { ask: "complete", motion, f, flawed };
  },
  render: (m, _axes, r) => selectSurface(m, r),
  variant: (m) =>
    m.ask === "name" ? `name-${m.name!.key}` : `${m.ask}-${m.motion}`,
});

/* ---------------------------------------- type 2: check a claimed image */

type Category = "true" | "first-only" | "second-only" | "neither";
export interface CheckCase {
  motion: Motion;
  /** Reflection line: kind and constant. */
  line?: { kind: "x" | "y" | "diag" | "anti"; k: number };
  C?: Pt;
  theta?: 90 | 180 | 270;
  A?: Pt;
  B?: Pt;
  P: Pt;
  candidate: Pt;
  image: Pt;
  /** The candidate's construction (true image, or which condition holds). */
  kind: string;
  first: boolean;
  second: boolean;
}

const lineTex = (l: NonNullable<CheckCase["line"]>) =>
  l.kind === "x"
    ? `x=${l.k}`
    : l.kind === "y"
      ? `y=${l.k}`
      : `y=${l.kind === "anti" ? "-" : ""}x${l.k === 0 ? "" : l.k < 0 ? l.k : `+${l.k}`}`;
/** Exact integer image across the reflection line. */
export function reflectLine(l: NonNullable<CheckCase["line"]>, p: Pt): Pt {
  const [x, y] = p;
  if (l.kind === "x") return [2 * l.k - x, y];
  if (l.kind === "y") return [x, 2 * l.k - y];
  if (l.kind === "diag") return [y - l.k, x + l.k];
  return [l.k - y, l.k - x];
}
const lineDir = (l: NonNullable<CheckCase["line"]>): Pt =>
  l.kind === "x"
    ? [0, 1]
    : l.kind === "y"
      ? [1, 0]
      : l.kind === "diag"
        ? [1, 1]
        : [1, -1];
const lineNormal = (l: NonNullable<CheckCase["line"]>): Pt =>
  l.kind === "x"
    ? [1, 0]
    : l.kind === "y"
      ? [0, 1]
      : l.kind === "diag"
        ? [1, -1]
        : [1, 1];
/** Twice the midpoint is on the line (exact integers). */
const midpointOn = (l: NonNullable<CheckCase["line"]>, p: Pt, q: Pt) => {
  const sx = p[0] + q[0];
  const sy = p[1] + q[1];
  if (l.kind === "x") return sx === 2 * l.k;
  if (l.kind === "y") return sy === 2 * l.k;
  if (l.kind === "diag") return sy === sx + 2 * l.k;
  return sy === -sx + 2 * l.k;
};
/** Exact integer rotation by a multiple of 90° counterclockwise. */
const turn = (v: Pt, theta: 90 | 180 | 270): Pt =>
  theta === 90 ? [-v[1], v[0]] : theta === 180 ? [-v[0], -v[1]] : [v[1], -v[0]];
export const angleHolds = (v: Pt, w: Pt, theta: 90 | 180 | 270) =>
  theta === 180
    ? cross(v, w) === 0 && dot(v, w) < 0
    : dot(v, w) === 0 && (theta === 90 ? cross(v, w) > 0 : cross(v, w) < 0);
const inBox = (...ps: Pt[]) =>
  ps.every((p) => Math.abs(p[0]) <= 9 && Math.abs(p[1]) <= 9);
const retry = () => {
  throw new Error("Need three retry: candidate");
};

function categoryOf(first: boolean, second: boolean): Category {
  return first && second
    ? "true"
    : first
      ? "first-only"
      : second
        ? "second-only"
        : "neither";
}

function checkCase(r: Random, motion: Motion): CheckCase {
  if (motion === "reflection") {
    const kind = pick(r, ["x", "y", "diag", "anti"] as const);
    const line = {
      kind,
      k: kind === "x" || kind === "y" ? r(-3, 3) : pick(r, [-2, 0, 2]),
    };
    const P: Pt = [r(-7, 7), r(-7, 7)];
    const n = lineNormal(line);
    const offset =
      line.kind === "x"
        ? P[0] - line.k
        : line.kind === "y"
          ? P[1] - line.k
          : line.kind === "diag"
            ? P[1] - P[0] - line.k
            : P[1] + P[0] - line.k;
    // Distance from m at least 2 (a diagonal offset of 3 is about 2.1).
    if (Math.abs(offset) < (line.kind === "x" || line.kind === "y" ? 2 : 3))
      retry();
    const image = reflectLine(line, P);
    const u = lineDir(line);
    const axis = line.kind === "x" || line.kind === "y";
    const roll = r(1, 20);
    let candidate: Pt;
    let label: string;
    if (roll <= 6) [candidate, label] = [image, "true-image"];
    else if (roll <= 11) {
      const t = pick(r, [-1, 1]) * (axis ? pick(r, [2, 3, 4]) : 2);
      [candidate, label] = [
        add(image, mul(u, t)),
        "equidistant-not-perpendicular",
      ];
    } else if (roll <= 16) {
      const s =
        pick(r, [-1, 1]) * (axis ? pick(r, [1, 2, 3]) : pick(r, [1, 2]));
      [candidate, label] = [
        add(image, mul(n, s)),
        "perpendicular-not-equidistant",
      ];
    } else {
      [candidate, label] = [[r(-8, 8), r(-8, 8)], "neither"];
      if (dist(candidate, image) < 2) retry();
    }
    if (candidate[0] === P[0] && candidate[1] === P[1]) retry();
    if (!inBox(P, image, candidate)) retry();
    const first = dot(sub(candidate, P), u) === 0;
    const second = midpointOn(line, P, candidate);
    const want =
      label === "true-image"
        ? "true"
        : label === "equidistant-not-perpendicular"
          ? "second-only"
          : label === "perpendicular-not-equidistant"
            ? "first-only"
            : "neither";
    if (categoryOf(first, second) !== want) retry();
    return { motion, line, P, candidate, image, kind: label, first, second };
  }
  if (motion === "rotation") {
    const C: Pt = [r(-3, 3), r(-3, 3)];
    const theta = pick(r, [90, 180, 270] as const);
    const comp = () => pick(r, [-1, 1]) * r(1, 5);
    const v: Pt = [comp(), comp()];
    if (Math.abs(v[0]) === Math.abs(v[1])) retry();
    const P = add(C, v);
    const wTrue = turn(v, theta);
    const image = add(C, wTrue);
    const roll = r(1, 20);
    let w: Pt;
    let label: string;
    if (roll <= 6) [w, label] = [wTrue, "true-image"];
    else if (roll <= 12) {
      const pool: Pt[] = [
        turn(v, 90),
        turn(v, 180),
        turn(v, 270),
        [v[1], v[0]],
        [-v[0], v[1]],
        [v[0], -v[1]],
        [-v[1], -v[0]],
      ].filter((x) => !angleHolds(v, x as Pt, theta)) as Pt[];
      [w, label] = [pick(r, pool), "on-circle-wrong-angle"];
    } else if (roll <= 17) {
      const half = wTrue[0] % 2 === 0 && wTrue[1] % 2 === 0;
      [w, label] = [
        half && r(0, 1) ? [wTrue[0] / 2, wTrue[1] / 2] : mul(wTrue, 2),
        "right-angle-wrong-radius",
      ];
    } else {
      [w, label] = [[r(-6, 6), r(-6, 6)], "neither"];
      if (
        dot(w, w) === dot(v, v) ||
        angleHolds(v, w, theta) ||
        (w[0] === 0 && w[1] === 0)
      )
        retry();
    }
    const candidate = add(C, w);
    if (!inBox(C, P, image, candidate)) retry();
    const first = dot(w, w) === dot(v, v);
    const second = angleHolds(v, w, theta);
    const want =
      label === "true-image"
        ? "true"
        : label === "on-circle-wrong-angle"
          ? "first-only"
          : label === "right-angle-wrong-radius"
            ? "second-only"
            : "neither";
    if (categoryOf(first, second) !== want) retry();
    return {
      motion,
      C,
      theta,
      P,
      candidate,
      image,
      kind: label,
      first,
      second,
    };
  }
  const A: Pt = [r(-5, 5), r(-5, 5)];
  const d: Pt = [pick(r, [-1, 1]) * r(1, 4), pick(r, [-1, 1]) * r(1, 4)];
  const B = add(A, d);
  const P: Pt = [r(-5, 5), r(-5, 5)];
  if (cross(d, sub(P, A)) === 0) retry();
  const image = add(P, d);
  const roll = r(1, 20);
  let candidate: Pt;
  let label: string;
  if (roll <= 6) [candidate, label] = [image, "true-image"];
  else if (roll <= 10) [candidate, label] = [sub(P, d), "opposite-direction"];
  else if (roll <= 15) [candidate, label] = [add(P, mul(d, 2)), "wrong-length"];
  else [candidate, label] = [add(P, [-d[1], d[0]]), "not-parallel"];
  if (!inBox(A, B, P, image, candidate)) retry();
  const step = sub(candidate, P);
  const first = cross(d, step) === 0 && dot(d, step) > 0;
  const second = dot(step, step) === dot(d, d);
  const want =
    label === "true-image"
      ? "true"
      : label === "wrong-length"
        ? "first-only"
        : "second-only";
  if (categoryOf(first, second) !== want) retry();
  return { motion, A, B, P, candidate, image, kind: label, first, second };
}

const pt = (p: Pt) => `(${p[0]},${p[1]})`;
/** A square in TeX, with a negative base in parentheses. */
const sq = (n: number) => (n < 0 ? `(${n})^2` : `${n}^2`);
const VERDICTS: Record<Category, string> = {
  true: "Yes: both conditions hold",
  "first-only": "No: only the first condition holds",
  "second-only": "No: only the second condition holds",
  neither: "No: neither condition holds",
};

function checkScene(c: CheckCase): Scene {
  const pts: Pt[] = [c.P, c.candidate];
  if (c.C) pts.push(c.C);
  if (c.A && c.B) pts.push(c.A, c.B);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...xs, ...ys, -1) - 1;
  const hi = Math.max(...xs, ...ys, 1) + 1;
  const g = graph({
    x: [lo, hi],
    y: [lo, hi],
    grid: 1,
    tick: hi - lo > 12 ? 2 : 1,
    aspect: 1,
    axisNames: ["x", "y"],
  });
  if (c.line) {
    const l = c.line;
    g.line(
      l.kind === "x"
        ? { x: l.k }
        : l.kind === "y"
          ? { m: 0, b: l.k }
          : { m: l.kind === "diag" ? 1 : -1, b: l.k },
      { label: "m", color: "ink" },
    );
  }
  if (c.C) g.point(c.C[0], c.C[1], "C", { color: "ink" });
  if (c.A && c.B) {
    g.segment(c.A, c.B, { arrow: true, color: "ink" });
    g.point(c.A[0], c.A[1], "A", { color: "ink" });
    g.point(c.B[0], c.B[1], "B", { color: "ink" });
  }
  g.point(c.P[0], c.P[1], "P", { color: "accent" });
  // The graph haloes its point labels, which hides the top of P under the
  // prime; P′ is named by a plain label beside its point instead.
  g.point(c.candidate[0], c.candidate[1], undefined, { color: "warm" });
  const away = sub(c.candidate, c.P);
  const primeName = nameAt(
    "pq",
    "P′",
    c.candidate,
    len(away) ? away : [1, 1],
    "warm",
  );
  const what = c.line
    ? `line m, ${lineTex(c.line)}`
    : c.C
      ? `center C${pt(c.C)}`
      : `the directed segment from A${pt(c.A!)} to B${pt(c.B!)}`;
  return sceneOf(g, primeName).build({
    title: `A coordinate plane with ${what}, P${pt(c.P)} and the claimed image P′${pt(c.candidate)}`,
  });
}

function checkSurface(c: CheckCase): Surface {
  const P = c.P;
  const Q = c.candidate;
  const step = sub(Q, P);
  let claim: string;
  let first: string;
  let second: string;
  let work: string[];
  if (c.motion === "reflection") {
    const l = c.line!;
    claim = `The reflection across line $m$, with equation $${lineTex(l)}$, is claimed to send $P${pt(P)}$ to $P'${pt(Q)}$.`;
    first = "First condition: is $\\overline{PP'}$ perpendicular to $m$?";
    second =
      "Second condition: does $m$ pass through the midpoint of $\\overline{PP'}$?";
    const u = lineDir(l);
    const mid = `(${(P[0] + Q[0]) / 2},${(P[1] + Q[1]) / 2})`;
    work = [
      `First condition: $\\overline{PP'}$ moves $\\langle ${step[0]},${step[1]}\\rangle$ and $m$ runs along $\\langle ${u[0]},${u[1]}\\rangle$. Their dot product is $${dot(step, u)}$, so ${c.first ? "they are perpendicular: yes" : "they are not perpendicular: no"}.`,
      `Second condition: the midpoint of $\\overline{PP'}$ is $${mid}$, and it ${c.second ? "satisfies" : "does not satisfy"} $${lineTex(l)}$: ${c.second ? "yes" : "no"}.`,
    ];
  } else if (c.motion === "rotation") {
    const C = c.C!;
    const t = c.theta!;
    const v = sub(P, C);
    const w = sub(Q, C);
    claim = `The rotation about $C${pt(C)}$ by $${t}^\\circ$ counterclockwise is claimed to send $P${pt(P)}$ to $P'${pt(Q)}$.`;
    first =
      "First condition: is $CP'=CP$ (is $P'$ on the circle with center $C$ through $P$)?";
    second = `Second condition: is ray $CP'$ a $${t}^\\circ$ counterclockwise turn of ray $CP$?`;
    work = [
      `First condition: $CP^2=${sq(v[0])}+${sq(v[1])}=${dot(v, v)}$ and $CP'^2=${sq(w[0])}+${sq(w[1])}=${dot(w, w)}$, so ${c.first ? "$CP'=CP$: yes" : "$CP'\\ne CP$: no"}.`,
      t === 180
        ? `Second condition: $\\overrightarrow{CP}=\\langle ${v[0]},${v[1]}\\rangle$ and $\\overrightarrow{CP'}=\\langle ${w[0]},${w[1]}\\rangle$. A half turn needs them to point in exactly opposite directions; ${c.second ? "they do: yes" : "they do not: no"}.`
        : `Second condition: $\\overrightarrow{CP}=\\langle ${v[0]},${v[1]}\\rangle$ turned $${t}^\\circ$ counterclockwise points along $\\langle ${turn(v, t)[0]},${turn(v, t)[1]}\\rangle$, and $\\overrightarrow{CP'}=\\langle ${w[0]},${w[1]}\\rangle$ ${c.second ? "points the same way: yes" : "does not point that way: no"}.`,
    ];
  } else {
    const A = c.A!;
    const B = c.B!;
    const d = sub(B, A);
    claim = `The translation along $\\overrightarrow{AB}$, from $A${pt(A)}$ to $B${pt(B)}$, is claimed to send $P${pt(P)}$ to $P'${pt(Q)}$.`;
    first =
      "First condition: is $\\overline{PP'}$ parallel to (or on) line $AB$, the same way as $A$ to $B$?";
    second = "Second condition: is $PP'=AB$?";
    work = [
      `First condition: $\\overrightarrow{AB}=\\langle ${d[0]},${d[1]}\\rangle$ and $\\overrightarrow{PP'}=\\langle ${step[0]},${step[1]}\\rangle$. ${c.first ? "The second is a positive multiple of the first: yes" : cross(d, step) === 0 ? "They are parallel but point opposite ways: no" : "They are not parallel: no"}.`,
      `Second condition: $AB^2=${dot(d, d)}$ and $PP'^2=${dot(step, step)}$, so ${c.second ? "$PP'=AB$: yes" : "$PP'\\ne AB$: no"}.`,
    ];
  }
  const blanks = [
    {
      id: "first",
      label: first,
      options: [
        { id: "a", label: "Yes" },
        { id: "b", label: "No" },
      ],
    },
    {
      id: "second",
      label: second,
      options: [
        { id: "a", label: "Yes" },
        { id: "b", label: "No" },
      ],
    },
    {
      id: "verdict",
      label: "So is $P'$ the image of $P$?",
      options: (["true", "first-only", "second-only", "neither"] as const).map(
        (k, i) => ({
          id: "abcd"[i]!,
          label: VERDICTS[k],
        }),
      ),
    },
  ];
  const cat = categoryOf(c.first, c.second);
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each part",
    layout: "slots",
    blanks,
  };
  const answer = JSON.stringify({
    first: c.first ? "a" : "b",
    second: c.second ? "a" : "b",
    verdict: "abcd"[
      ["true", "first-only", "second-only", "neither"].indexOf(cat)
    ],
  });
  const image = `$${pt(c.image)}$`;
  const definition =
    c.motion === "reflection"
      ? "The reflection across $m$ sends $P$ to the point $P'$ for which $m$ is the perpendicular bisector of $\\overline{PP'}$: $\\overline{PP'}\\perp m$, and $m$ passes through its midpoint."
      : c.motion === "rotation"
        ? `The rotation about $C$ by $${c.theta}^\\circ$ sends $P$ to the point $P'$ on the circle with center $C$ through $P$ with ray $CP'$ a $${c.theta}^\\circ$ counterclockwise turn of ray $CP$.`
        : "The translation along $\\overrightarrow{AB}$ sends $P$ to the point $P'$ with $\\overline{PP'}$ parallel to line $AB$, the same way as $A$ to $B$, and $PP'=AB$.";
  return {
    prompt: `${claim} Check it against the definition: answer each condition, then decide.`,
    response,
    answer,
    hint:
      c.motion === "reflection"
        ? `Compare the step from $P${pt(P)}$ to $P'${pt(Q)}$ with the direction of $m$: $${lineTex(c.line!)}$. Then find the midpoint of $\\overline{PP'}$ and test it in the equation of $m$.`
        : c.motion === "rotation"
          ? `Write $\\overrightarrow{CP}$ and $\\overrightarrow{CP'}$ from $C${pt(c.C!)}$. Compare their squared lengths, then check whether turning $\\overrightarrow{CP}$ by $${c.theta}^\\circ$ counterclockwise gives the direction of $\\overrightarrow{CP'}$.`
          : `Write $\\overrightarrow{AB}$ from $A${pt(c.A!)}$ to $B${pt(c.B!)}$ and $\\overrightarrow{PP'}$. Is the second a positive multiple of the first, and are their squared lengths equal?`,
    explanation: [
      definition,
      ...work,
      cat === "true"
        ? "Both conditions hold, and only one point satisfies both, so $P'$ is the image."
        : `${cat === "neither" ? "Neither condition holds" : `Only the ${cat === "first-only" ? "first" : "second"} condition holds`}, so $P'$ is not the image. The image of $P$ is ${image}.`,
    ],
    figure: sceneFigure(checkScene(c)),
  };
}

const checkFamily = chainFamily({
  template: rigidMotionDefinitionTemplates[1]!,
  axes: {
    motion: defineAxis("motion", [
      "reflection",
      "rotation",
      "translation",
    ] as const),
  },
  model: (r, axes) => checkCase(r, axes.motion as Motion),
  render: (c) => checkSurface(c),
  variant: (c) => `${c.motion}-${c.kind}`,
});

/* ------------------------------------- type 3: build it from its parts */

type Slot = {
  id: string;
  label: string;
  options: { label: string; correct?: true; why: string }[];
};
export interface SlotsCase {
  motion: Motion;
  theta: number;
  f: Plain;
  parts: ({ text: string } | { slot: Slot })[];
}

export function slotParts(motion: Motion, theta: number): SlotsCase["parts"] {
  if (motion === "reflection")
    return [
      { text: "The reflection across line $m$ sends each point of $m$ to " },
      {
        slot: {
          id: "fixed",
          label: "where each point of $m$ goes",
          options: [
            {
              label: "itself",
              correct: true,
              why: "Points of the mirror line do not move.",
            },
            {
              label: "a point on the other side of $m$",
              why: "A point of $m$ is on neither side; the reflection leaves it where it is.",
            },
            {
              label: "no point at all",
              why: "A transformation gives every point an image; a point of $m$ is its own image.",
            },
          ],
        },
      },
      {
        text: ", and each other point $P$ to the point $P'$ such that $\\overline{PP'}$ is ",
      },
      {
        slot: {
          id: "angle",
          label: "how $\\overline{PP'}$ meets $m$",
          options: [
            {
              label: "perpendicular to",
              correct: true,
              why: "The box at the foot marks a right angle.",
            },
            {
              label: "parallel to",
              why: "A segment parallel to $m$ with its midpoint on $m$ would lie on $m$, so no $P'$ would exist for $P$ off $m$.",
            },
            {
              label: "at a $45^\\circ$ angle to",
              why: "Two directions make $45^\\circ$ with $m$, so two points would fit.",
            },
          ],
        },
      },
      { text: " line $m$, and line $m$ passes through " },
      {
        slot: {
          id: "where",
          label: "which point of $\\overline{PP'}$ is on $m$",
          options: [
            {
              label: "the midpoint",
              correct: true,
              why: "The equal ticks mark the two halves as equal.",
            },
            {
              label: "an endpoint",
              why: "With $P$ off $m$, $P'$ would be the foot on $m$: every point would land on $m$.",
            },
            {
              label: "a point",
              why: "Any point of the perpendicular beyond $m$ would fit, at any distance.",
            },
          ],
        },
      },
      { text: " of $\\overline{PP'}$." },
    ];
  if (motion === "rotation")
    return [
      {
        text: `The rotation about $C$ by $${theta}^\\circ$ sends $C$ to itself and each other point $P$ to the point $P'$ on `,
      },
      {
        slot: {
          id: "path",
          label: "where $P'$ lies",
          options: [
            {
              label: "the circle with center $C$ through $P$",
              correct: true,
              why: "The equal ticks on $\\overline{CP}$ and $\\overline{CP'}$ mark $CP'=CP$.",
            },
            {
              label: "the line through $C$ and $P$",
              why: `A point of line $CP$ makes an angle of $0^\\circ$ or $180^\\circ$ at $C$, never $${theta}^\\circ$.`,
            },
            {
              // Never true of the drawn pair: PP′ = PC only for a 60° turn.
              label: "the circle with center $P$ through $C$",
              why: `That circle is centered at $P$. A rotation about $C$ keeps each point's distance from $C$, so $P'$ lies on the circle centered at $C$; a turn of $${theta}^\\circ$ never lands on this one.`,
            },
          ],
        },
      },
      { text: " such that " },
      {
        slot: {
          id: "angle",
          label: "which angle measures the turn",
          options: [
            {
              label: "$m\\angle PCP'$",
              correct: true,
              why: "The arc sits at $C$, so the angle is measured at $C$.",
            },
            {
              label: "$m\\angle CPP'$",
              why: `That angle is at $P$. With $CP'=CP$ it is a base angle of an isosceles triangle, always under $90^\\circ$, so it cannot be $${theta}^\\circ$.`,
            },
            {
              label: "$PP'$",
              why: "$PP'$ is a length, not an angle; degrees measure turning.",
            },
          ],
        },
      },
      { text: ` $=${theta}^\\circ$, measured ` },
      {
        slot: {
          id: "dir",
          label: "the direction of the turn",
          options: [
            {
              label: "counterclockwise from ray $CP$",
              correct: true,
              why: "The arrow on the arc turns counterclockwise.",
            },
            {
              label: "clockwise from ray $CP$",
              why: `That defines the clockwise rotation by $${theta}^\\circ$, a different motion.`,
            },
            {
              label: "in either direction from ray $CP$",
              why: "Two points would fit, one each way, so $P'$ would not be pinned down.",
            },
          ],
        },
      },
      { text: "." },
    ];
  return [
    {
      text: "The translation along $\\overrightarrow{AB}$ sends each point $P$ to the point $P'$ such that $\\overline{PP'}$ is ",
    },
    {
      slot: {
        id: "line",
        label: "how $\\overline{PP'}$ lies",
        options: [
          {
            label: "parallel to (or on) line $AB$",
            correct: true,
            why: "The matching arrow marks show the segments parallel.",
          },
          {
            label: "perpendicular to line $AB$",
            why: "A perpendicular segment cannot point the same way as $A$ to $B$, so no point would fit.",
          },
          {
            label: "on line $AB$",
            why: "For a point $P$ off line $AB$, no segment from $P$ lies on line $AB$.",
          },
        ],
      },
    },
    { text: ", " },
    {
      slot: {
        id: "length",
        label: "which lengths are equal",
        options: [
          {
            label: "$PP'=AB$",
            correct: true,
            why: "The equal ticks mark $PP'$ and $AB$ as equal.",
          },
          {
            label: "$AP'=AB$",
            why: "That measures from $A$, not from $P$; the image would depend on where $A$ is, and points would not all move alike.",
          },
          {
            label: "$PP'=AP$",
            why: "Then points farther from $A$ would move farther; a translation moves every point the same length.",
          },
        ],
      },
    },
    { text: ", and $P'$ is " },
    {
      slot: {
        id: "dir",
        label: "which way $P'$ is from $P$",
        options: [
          {
            label: "in the same direction from $P$ as $B$ is from $A$",
            correct: true,
            why: "The arrowheads point the same way.",
          },
          {
            label: "on the same side of line $AB$ as $P$",
            why: "Both points along the parallel at distance $AB$ are on that side, so two points would fit.",
          },
          {
            label: "the same distance from $A$ as $P$ is from $B$",
            why: "With the other two conditions this picks the point the opposite way, $P$ moved from $B$ toward $A$.",
          },
        ],
      },
    },
    { text: "." },
  ];
}

function slotsScene(f: Plain): Scene {
  const marks: Element[] = [];
  const points: Drawn[] = [
    { id: "p", name: "P", at: f.P, color: "accent" },
    { id: "q", name: "P′", at: f.image, color: "warm" },
  ];
  if (f.motion === "reflection") {
    const F = foot(f.P, f.a, f.u);
    marks.push(
      {
        type: "segment",
        id: "pp",
        from: f.P,
        to: f.image,
        stroke: "muted",
        width: 1.75,
        dash: "dash",
      },
      figureRightMark("box", F, f.P, add(F, unit(f.u)), 0.4),
      ...figureTicks("t1", f.P, F, 1),
      ...figureTicks("t2", F, f.image, 1),
    );
  } else if (f.motion === "rotation") {
    const from = (Math.atan2(f.P[1] - f.C[1], f.P[0] - f.C[0]) * 180) / Math.PI;
    marks.push(
      {
        type: "segment",
        id: "cp",
        from: f.C,
        to: f.P,
        stroke: "muted",
        width: 1.75,
      },
      {
        type: "segment",
        id: "cq",
        from: f.C,
        to: f.image,
        stroke: "muted",
        width: 1.75,
      },
      ...figureTicks("t1", f.C, f.P, 1),
      ...figureTicks("t2", f.C, f.image, 1),
      {
        type: "arc",
        id: "turn",
        center: f.C,
        r: 0.9,
        from,
        to: from + f.theta,
        stroke: "gold",
        width: 2,
        arrow: "end",
      },
      {
        type: "text",
        id: "turnl",
        at: add(f.C, [
          1.6 * Math.cos(((from + f.theta / 2) * Math.PI) / 180),
          1.6 * Math.sin(((from + f.theta / 2) * Math.PI) / 180),
        ]),
        text: `${f.theta}°`,
        font: "math",
        size: "sm",
        color: "gold",
        halo: true,
        align: [0, 0],
      },
    );
  } else {
    marks.push(
      {
        type: "segment",
        id: "pp",
        from: f.P,
        to: f.image,
        stroke: "muted",
        width: 2,
        arrow: "end",
      },
      ...figureParallelMark("par1", f.A, f.B, 1, 0.3),
      ...figureParallelMark("par2", f.P, f.image, 1, 0.3),
      ...figureTicks("t1", add(f.A, mul(sub(f.B, f.A), 0.3)), f.B, 1),
      ...figureTicks("t2", add(f.P, mul(sub(f.image, f.P), 0.3)), f.image, 1),
    );
  }
  return plainScene(f, points, marks);
}

const slotsFamily = chainFamily({
  template: rigidMotionDefinitionTemplates[2]!,
  axes: {
    motion: defineAxis("motion", [
      "reflection",
      "rotation",
      "translation",
    ] as const),
  },
  model: (r, axes): SlotsCase => {
    // 180° is left out: a half turn needs no circle condition, and with 60°
    // the angle at P in an equilateral triangle would also fit.
    const theta = pick(r, [90, 120, 135]);
    const motion = axes.motion as Motion;
    return {
      motion,
      theta,
      f: plain(r, motion, theta),
      parts: slotParts(motion, theta),
    };
  },
  render: (m, _axes, r): Surface => {
    const blanks: MultiPartChoiceResponse["blanks"] = [];
    const key: Record<string, string> = {};
    const sentence: NonNullable<MultiPartChoiceResponse["sentence"]> = [];
    const why: string[] = [];
    for (const part of m.parts) {
      if ("text" in part) {
        sentence.push({ text: part.text });
        continue;
      }
      const shown = shuffle(r, [...part.slot.options]);
      const options = shown.map((o, i) => ({ id: "abc"[i]!, label: o.label }));
      key[part.slot.id] = options[shown.findIndex((o) => o.correct)]!.id;
      blanks.push({ id: part.slot.id, label: part.slot.label, options });
      sentence.push({ blank: part.slot.id });
      const right = part.slot.options.find((o) => o.correct)!;
      why.push(
        `${part.slot.label.charAt(0).toUpperCase()}${part.slot.label.slice(1)}: ${right.label}. ${right.why} ${part.slot.options
          .filter((o) => !o.correct)
          .map((o) => `Not "${o.label}": ${o.why}`)
          .join(" ")}`,
      );
    }
    const full = m.parts
      .map((p) =>
        "text" in p ? p.text : p.slot.options.find((o) => o.correct)!.label,
      )
      .join("");
    return {
      prompt: `Complete the definition. The figure shows ${m.motion === "reflection" ? "a point $P$ and its reflection $P'$ across line $m$" : m.motion === "rotation" ? `a point $P$ and its image $P'$ under the rotation about $C$ by $${m.theta}^\\circ$` : "a point $P$ and its image $P'$ under the translation along $\\overrightarrow{AB}$"}, with the marks that define it.`,
      response: {
        kind: "multi-part-choice",
        label: "Choose an option for each blank",
        layout: "inline",
        blanks,
        sentence,
      },
      answer: JSON.stringify(key),
      hint:
        m.motion === "reflection"
          ? "Read the marks at line $m$: a box means perpendicular, and equal ticks on the two halves of $\\overline{PP'}$ mean $m$ cuts it into equal parts."
          : m.motion === "rotation"
            ? `Read the marks at $C$: equal ticks mean $CP'=CP$, the arc of $${m.theta}^\\circ$ sits at the vertex where the angle is measured, and its arrow gives the direction.`
            : "Read the marks: matching arrows mean parallel, equal ticks mean equal lengths, and the arrowheads show which way each segment points.",
      explanation: [
        "A definition of a rigid motion must place the image of every point exactly, using only angles, circles, perpendicular lines, parallel lines and segments.",
        ...why,
        `The complete definition: ${full}`,
      ],
      figure: sceneFigure(slotsScene(m.f)),
    };
  },
  variant: (m) => (m.motion === "rotation" ? `rotation-${m.theta}` : m.motion),
});

export const rigidMotionDefinitionGenerate = dispatch(
  rigidMotionDefinitionTemplates,
  {
    "rigid-motion-definition-select": (seed) =>
      selectFamily.generate(seed).problem,
    "rigid-motion-definition-check": (seed) =>
      checkFamily.generate(seed).problem,
    "rigid-motion-definition-slots": (seed) =>
      slotsFamily.generate(seed).problem,
  },
);
export const rigidMotionDefinitionCases = {
  "rigid-motion-definition-select": selectFamily.generate,
  "rigid-motion-definition-check": checkFamily.generate,
  "rigid-motion-definition-slots": slotsFamily.generate,
};
export { MOTIONS };
