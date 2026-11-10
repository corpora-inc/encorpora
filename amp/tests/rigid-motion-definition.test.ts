import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { applyMotion } from "../src/math/plane-motion";
import {
  HOUSE,
  flawedPool,
  rigidMotionDefinitionCases as cases,
  rigidMotionDefinitionTemplates,
  slotParts,
} from "../src/math/rigid-motion-definition-practice";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";

type Pt = [number, number];
const ids = rigidMotionDefinitionTemplates.map((t) => t.id);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-7;
const same = (p: Pt, q: Pt) => near(p[0], q[0]) && near(p[1], q[1]);
const sub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1]];
const dot = (p: Pt, q: Pt) => p[0] * q[0] + p[1] * q[1];
const cross = (p: Pt, q: Pt) => p[0] * q[1] - p[1] * q[0];
const len = (p: Pt) => Math.hypot(p[0], p[1]);
/** Counterclockwise angle from u to v in degrees, in [0, 360). */
const ccw = (u: Pt, v: Pt) =>
  ((((Math.atan2(cross(u, v), dot(u, v)) * 180) / Math.PI) % 360) + 360) % 360;

test("templates are registered, deterministic and valid", () => {
  for (const id of ids) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    for (let i = 0; i < 80; i++) {
      const a = generateProblem(id, `det-${i}`);
      assert.deepEqual(a, generateProblem(id, `det-${i}`));
      generatedProblemSchema.parse(a);
      assert.equal(gradeAnswer(a, a.answer), true);
      assert.equal(a.public.skillId, "transformation-invariants");
    }
  }
});

test("every motion and variant is reached at least 10 times in 300 seeds", () => {
  const seen = new Map<string, number>();
  for (const id of ids)
    for (let i = 0; i < 300; i++) {
      const v = generateProblem(id, `sweep-${i}`).variant!.id;
      seen.set(`${id}:${v}`, (seen.get(`${id}:${v}`) ?? 0) + 1);
    }
  const want = [
    ...["complete", "repair"].flatMap((a) =>
      ["reflection", "rotation", "translation"].map(
        (m) => `rigid-motion-definition-select:${a}-${m}`,
      ),
    ),
    ...["midpoint", "perp-bisector", "parallel", "circle-90", "dilation"].map(
      (k) => `rigid-motion-definition-select:name-${k}`,
    ),
    ...[
      "reflection-true-image",
      "reflection-equidistant-not-perpendicular",
      "reflection-perpendicular-not-equidistant",
      "reflection-neither",
      "rotation-true-image",
      "rotation-on-circle-wrong-angle",
      "rotation-right-angle-wrong-radius",
      "rotation-neither",
      "translation-true-image",
      "translation-opposite-direction",
      "translation-wrong-length",
      "translation-not-parallel",
    ].map((k) => `rigid-motion-definition-check:${k}`),
    ...[
      "reflection",
      "translation",
      "rotation-90",
      "rotation-120",
      "rotation-135",
    ].map((k) => `rigid-motion-definition-slots:${k}`),
  ];
  // A name statement is one of five, so it is drawn about 12 times.
  for (const k of want)
    assert.ok(
      (seen.get(k) ?? 0) >= (k.includes(":name-") ? 5 : 10),
      `${k}: ${seen.get(k)}`,
    );
});

/* ----------------------------------------------------------- select */

/** Whether a point fits a flawed definition's wording, computed here from
 * the figure's apparatus, never by the generator. */
function fits(
  key: string,
  f: {
    a: Pt;
    u: Pt;
    C: Pt;
    theta: number;
    A: Pt;
    B: Pt;
    P: Pt;
  },
  X: Pt,
): boolean {
  const dm = (p: Pt) => cross(f.u, sub(p, f.a)) / len(f.u); // signed distance to m
  const d = sub(f.B, f.A);
  switch (key) {
    case "distance-only":
      return near(dm(X), -dm(f.P));
    case "perpendicular-only":
      return near(dot(sub(X, f.P), f.u), 0) && !same(X, f.P);
    case "midpoint-only":
      return near(dm([(X[0] + f.P[0]) / 2, (X[1] + f.P[1]) / 2]), 0);
    case "circle-only":
      return near(len(sub(X, f.C)), len(sub(f.P, f.C)));
    case "angle-only":
      return near(ccw(sub(f.P, f.C), sub(X, f.C)), f.theta);
    case "clockwise":
      return (
        near(len(sub(X, f.C)), len(sub(f.P, f.C))) &&
        near(ccw(sub(X, f.C), sub(f.P, f.C)), f.theta)
      );
    case "half-turn":
      return same([(X[0] + f.P[0]) / 2, (X[1] + f.P[1]) / 2], f.C);
    case "arc-length": {
      const rho = len(sub(f.P, f.C));
      const turned = (ccw(sub(f.P, f.C), sub(X, f.C)) * Math.PI) / 180;
      // Arc length theta, counted counterclockwise, possibly past full turns.
      const laps = (f.theta - rho * turned) / (2 * Math.PI * rho);
      return near(len(sub(X, f.C)), rho) && near(laps, Math.round(laps));
    }
    case "length-only":
      return near(len(sub(X, f.P)), len(d));
    case "direction-only":
      return near(cross(d, sub(X, f.P)), 0) && dot(d, sub(X, f.P)) > 0;
    case "no-direction":
      return near(cross(d, sub(X, f.P)), 0) && near(len(sub(X, f.P)), len(d));
    case "on-segment":
      return (
        near(cross(d, sub(X, f.A)), 0) &&
        dot(d, sub(X, f.A)) > 0 &&
        near(len(sub(X, f.A)), len(d))
      );
    case "circle":
      return near(len(sub(X, f.A)), len(sub(f.P, f.B)));
  }
  throw new Error(key);
}

test("select: the correct option is the house definition; every flawed one has a counterexample", () => {
  // The key may not be the longest option in more than 35% of the items of
  // any kind, by raw label length or by the length of the rendered words.
  // In repair and name items it is also not kept to the middle: as rendered,
  // it is the longest and the shortest option each in 15-35% of the items,
  // about the 1 in 4 of chance.
  const longest = new Map<
    string,
    { raw: number; shown: number; shownShort: number; n: number }
  >();
  const rendered = (s: string) =>
    s
      .replace(/\\(overline|overrightarrow)\{([^}]*)\}/g, "$2")
      .replace(/\\angle /g, "∠")
      .replace(/\^\\circ/g, "°")
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
      .replace(/[$\\{}]/g, "").length;
  for (let i = 0; i < 900; i++) {
    const c = cases["rigid-motion-definition-select"](`sel-${i}`);
    const p = c.problem;
    const r = p.public.response;
    if (r.kind !== "choice") continue;
    assert.equal(new Set(r.options.map((o) => o.label)).size, r.options.length);
    const key = r.options.find((o) => o.id === p.answer)!.label;
    const m = c.model;
    const f = m.f;
    const tally = longest.get(m.ask) ?? {
      raw: 0,
      shown: 0,
      shownShort: 0,
      n: 0,
    };
    tally.n++;
    if (
      r.options.every((o) => o.id === p.answer || o.label.length < key.length)
    )
      tally.raw++;
    if (
      r.options.every(
        (o) => o.id === p.answer || rendered(o.label) < rendered(key),
      )
    )
      tally.shown++;
    if (
      r.options.every(
        (o) => o.id === p.answer || rendered(o.label) > rendered(key),
      )
    )
      tally.shownShort++;
    longest.set(m.ask, tally);
    if (m.motion === "reflection") {
      // Never the x-axis: there (x, y) -> (x, -y) is the reflection itself.
      assert.equal(f.u[1] === 0 && f.a[1] === 0, false);
    }
    if (m.ask === "complete") {
      const house =
        m.motion === "reflection"
          ? HOUSE.reflection
          : m.motion === "rotation"
            ? HOUSE.rotation(f.theta)
            : HOUSE.translation;
      assert.equal(key, house);
      assert.notEqual(f.theta, 180);
      // The true image under the motion.
      for (const flawed of m.flawed) {
        const X = flawed.counter(f);
        if (X === null) {
          assert.equal(flawed.key, "coordinate-rule");
          continue;
        }
        assert.ok(
          fits(flawed.key, f, X),
          `${flawed.key} counter fits the wording`,
        );
        assert.equal(
          same(X, f.image),
          false,
          `${flawed.key} counter is not the image`,
        );
      }
    }
    if (m.ask === "repair") {
      const rep = m.repair!;
      const Q = rep.Q;
      assert.ok(
        len(sub(Q, f.image)) >= 2 - 1e-9,
        "Q is at least 2 units from the image",
      );
      if (m.motion === "reflection") {
        assert.ok(
          fits("distance-only", f, Q) && fits("distance-only", f, f.image),
        );
        // The added condition: P'P perpendicular to m. Q fails, the image passes.
        assert.ok(
          fits("perpendicular-only", f, f.image) &&
            !fits("perpendicular-only", f, Q),
        );
        // The marked point X: the circle through P meets Dana's line twice.
        const X = rep.X!;
        const second: Pt = (() => {
          const w: Pt = [f.u[0] / len(f.u), f.u[1] / len(f.u)];
          const along = dot(sub(f.image, X), w);
          return [f.image[0] - 2 * along * w[0], f.image[1] - 2 * along * w[1]];
        })();
        for (const pt of [f.image, second]) {
          assert.ok(near(len(sub(pt, X)), len(sub(f.P, X))));
          assert.ok(fits("distance-only", f, pt));
        }
        assert.equal(same(second, f.image), false);
      } else if (m.motion === "rotation") {
        assert.ok(near(len(sub(Q, f.C)), len(sub(f.P, f.C))));
        assert.ok(fits("angle-only", f, f.image) && !fits("angle-only", f, Q));
        // "On line CP, other side": the half turn, not the image.
        assert.equal(
          same(f.image, [2 * f.C[0] - f.P[0], 2 * f.C[1] - f.P[1]]),
          false,
        );
      } else {
        const d = sub(f.B, f.A);
        assert.ok(near(len(sub(Q, f.P)), len(d)));
        assert.ok(
          fits("direction-only", f, f.image) && !fits("direction-only", f, Q),
        );
        // Perpendicular: the image fails. On line AB: the image is off it.
        assert.equal(near(dot(sub(f.image, f.P), d), 0), false);
        assert.equal(near(cross(d, sub(f.image, f.A)), 0), false);
        // Same distance from A as P: the image fails, or a second point fits too.
        const fitsA = (X: Pt) =>
          near(len(sub(X, f.A)), len(sub(f.P, f.A))) &&
          near(len(sub(X, f.P)), len(d));
        if (fitsA(f.image)) {
          const mirror: Pt = (() => {
            const u = sub(f.P, f.A);
            const w: Pt = [u[0] / len(u), u[1] / len(u)];
            const v = sub(f.image, f.A);
            const k = 2 * dot(v, w);
            return [f.A[0] + k * w[0] - v[0], f.A[1] + k * w[1] - v[1]];
          })();
          assert.ok(fitsA(mirror) && !same(mirror, f.image));
        }
      }
      assert.ok(key.length > 10);
    }
    if (m.ask === "name") {
      // Each key has a short and a long wording; both name the same motion.
      const expected: Record<string, string[]> = {
        midpoint: [
          "The rotation about $C$ by $180^\\circ$",
          "The rotation about $C$ by $180^\\circ$, a half turn that keeps $C$ in place",
        ],
        "perp-bisector": [
          "The reflection across line $m$",
          "The reflection across line $m$, keeping each point of $m$ in place",
        ],
        parallel: [
          "The translation along $\\overrightarrow{AB}$",
          "The translation that moves each point by $\\overrightarrow{AB}$",
        ],
        "circle-90": [
          "The rotation about $C$ by $90^\\circ$ counterclockwise",
          "The rotation about $C$ by $90^\\circ$ counterclockwise, a quarter turn",
        ],
        dilation: [
          "The dilation about $C$ with scale factor $2$",
          "The dilation about $C$ with scale factor $2$, doubling each distance from $C$",
        ],
      };
      assert.ok(expected[m.name!.key].includes(key), `${m.name!.key}: ${key}`);
    }
  }
  for (const [ask, t] of longest) {
    assert.ok(
      t.raw / t.n <= 0.35,
      `${ask}: key longest by characters in ${t.raw}/${t.n}`,
    );
    assert.ok(
      t.shown / t.n <= 0.35,
      `${ask}: key longest as rendered in ${t.shown}/${t.n}`,
    );
    if (ask === "complete") continue;
    assert.ok(
      t.raw / t.n >= 0.15,
      `${ask}: key longest by characters in only ${t.raw}/${t.n}`,
    );
    assert.ok(
      t.shown / t.n >= 0.15,
      `${ask}: key longest as rendered in only ${t.shown}/${t.n}`,
    );
    assert.ok(
      t.shownShort / t.n >= 0.15 && t.shownShort / t.n <= 0.35,
      `${ask}: key shortest as rendered in ${t.shownShort}/${t.n}`,
    );
  }
  assert.deepEqual([...longest.keys()].sort(), ["complete", "name", "repair"]);
});

test("select: no item offers two options that state the same omission", () => {
  for (const motion of ["reflection", "rotation", "translation"] as const) {
    const pool = flawedPool(motion, 60);
    assert.equal(new Set(pool.map((x) => x.key)).size, pool.length);
    if (motion === "reflection")
      assert.equal(
        pool.some((x) => /some point|a point \$M\$/.test(x.label)),
        false,
      );
  }
});

/* ------------------------------------------------------------ check */

function parse(prompt: string) {
  const pts = Object.fromEntries(
    [...prompt.matchAll(/\$([A-Z]'?)\((-?\d+),(-?\d+)\)\$/g)].map((m) => [
      m[1]!,
      [Number(m[2]), Number(m[3])] as Pt,
    ]),
  );
  const line = /equation \$(x|y)=(-?x)?([+-]?\d*)\$/.exec(prompt);
  const angle = /by \$(\d+)\^\\circ\$ counterclockwise/.exec(prompt);
  return { pts, line, theta: angle ? Number(angle[1]) : null };
}

test("check: both conditions and the verdict are computed exactly from the prompt", () => {
  let yes = 0;
  let total = 0;
  for (let i = 0; i < 900; i++) {
    const c = cases["rigid-motion-definition-check"](`chk-${i}`);
    const p = c.problem;
    const r = p.public.response as MultiPartChoiceResponse;
    const { pts, line, theta } = parse(p.public.prompt);
    const P = pts.P!;
    const Q = pts["P'"]!;
    let first: boolean;
    let second: boolean;
    let image: Pt;
    if (c.model.motion === "reflection") {
      assert.ok(line, p.public.prompt);
      const [, lhs, slope, rest] = line!;
      // Lines x=k, y=k, y=x+b, y=-x+b.
      let u: Pt;
      let onLine: (x: number, y: number) => boolean;
      if (lhs === "x") {
        const k = Number(rest);
        u = [0, 1];
        onLine = (x) => x === k;
        image = [2 * k - P[0], P[1]];
      } else if (!slope) {
        const k = Number(rest);
        u = [1, 0];
        onLine = (_x, y) => y === k;
        // The engine's own reflection across the x-axis, shifted to y = k.
        const moved = applyMotion(
          { kind: "reflect", axis: "x" },
          { x: P[0], y: P[1] - k },
        );
        image = [moved.x, moved.y + k];
      } else {
        const sgn = slope === "-x" ? -1 : 1;
        const b = rest === "" ? 0 : Number(rest);
        u = [1, sgn];
        onLine = (x, y) => y === sgn * x + b;
        image = sgn === 1 ? [P[1] - b, P[0] + b] : [b - P[1], b - P[0]];
      }
      first = dot(sub(Q, P), u) === 0;
      // Twice the midpoint is an integer point; test the midpoint exactly.
      const mx = (P[0] + Q[0]) / 2;
      const my = (P[1] + Q[1]) / 2;
      second = onLine(mx, my);
    } else if (c.model.motion === "rotation") {
      const C = pts.C!;
      const v = sub(P, C);
      const w = sub(Q, C);
      first = dot(v, v) === dot(w, w);
      const turned = applyMotion(
        { kind: "rotate", degrees: theta as 90 | 180 | 270 },
        { x: v[0], y: v[1] },
      );
      image = [C[0] + turned.x, C[1] + turned.y];
      second =
        cross([turned.x, turned.y], w) === 0 &&
        dot([turned.x, turned.y], w) > 0;
    } else {
      const A = pts.A!;
      const B = pts.B!;
      const d = sub(B, A);
      const step = sub(Q, P);
      first = cross(d, step) === 0 && dot(d, step) > 0;
      second = dot(step, step) === dot(d, d);
      const moved = applyMotion(
        { kind: "translate", dx: d[0], dy: d[1] },
        { x: P[0], y: P[1] },
      );
      image = [moved.x, moved.y];
    }
    const key = JSON.parse(p.answer) as Record<string, string>;
    const label = (blank: string) =>
      r.blanks
        .find((b) => b.id === blank)!
        .options.find((o) => o.id === key[blank])!.label;
    assert.equal(label("first"), first ? "Yes" : "No");
    assert.equal(label("second"), second ? "Yes" : "No");
    const verdict = label("verdict");
    assert.equal(
      verdict,
      first && second
        ? "Yes: both conditions hold"
        : first
          ? "No: only the first condition holds"
          : second
            ? "No: only the second condition holds"
            : "No: neither condition holds",
    );
    assert.deepEqual(
      c.model.image,
      image,
      "true image matches the engine's motion",
    );
    assert.equal(same(Q, image), first && second, "only the image passes both");
    if (!(first && second))
      assert.ok(p.explanation.at(-1)!.includes(`(${image[0]},${image[1]})`));
    for (const pt of Object.values(pts))
      assert.ok(Math.abs(pt[0]) <= 9 && Math.abs(pt[1]) <= 9);
    if (first && second) yes++;
    total++;
  }
  assert.ok(yes / total > 0.2 && yes / total < 0.4, `yes in ${yes}/${total}`);
});

/* ------------------------------------------------------------ slots */

test("slots: no wrong length or circle condition holds, or looks as if it holds, for the drawn pair", () => {
  for (let i = 0; i < 600; i++) {
    const { f } = cases["rigid-motion-definition-slots"](`fit-${i}`).model;
    const d = (p: Pt, q: Pt) => len(sub(p, q));
    if (f.motion === "translation") {
      // Compared lengths differ by at least a tenth of AB, so by eye the
      // drawn image does not fit a wrong blank.
      const ab = d(f.A, f.B);
      const apart = (x: number, y: number, what: string) =>
        assert.ok(
          Math.abs(x - y) >= 0.1 * ab,
          `fit-${i}: ${what} (${x.toFixed(3)} vs ${y.toFixed(3)}, AB ${ab.toFixed(3)})`,
        );
      apart(d(f.image, f.A), d(f.P, f.B), "AP′ against BP");
      apart(d(f.P, f.A), ab, "AP against AB, so PP′ against AP");
      apart(d(f.image, f.A), ab, "AP′ against AB");
    }
    if (f.motion === "rotation") {
      const pc = d(f.C, f.P);
      assert.ok(
        Math.abs(d(f.image, f.P) - pc) >= 0.1 * pc,
        "P′ near the circle with center P through C",
      );
      const atP = ccw(sub(f.C, f.P), sub(f.image, f.P));
      assert.ok(
        !near(atP, f.theta) && !near(360 - atP, f.theta),
        "the angle at P equals the turn",
      );
    }
  }
});

test("slots: the completed sentence is the house definition", () => {
  const house: Record<string, string> = {
    reflection:
      "The reflection across line $m$ sends each point of $m$ to itself, and each other point $P$ to the point $P'$ such that $\\overline{PP'}$ is perpendicular to line $m$, and line $m$ passes through the midpoint of $\\overline{PP'}$.",
    translation:
      "The translation along $\\overrightarrow{AB}$ sends each point $P$ to the point $P'$ such that $\\overline{PP'}$ is parallel to (or on) line $AB$, $PP'=AB$, and $P'$ is in the same direction from $P$ as $B$ is from $A$.",
  };
  for (let i = 0; i < 300; i++) {
    const c = cases["rigid-motion-definition-slots"](`slot-${i}`);
    const p = c.problem;
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const text = r
      .sentence!.map((part) =>
        "text" in part
          ? part.text
          : r.blanks
              .find((b) => b.id === part.blank)!
              .options.find((o) => o.id === key[part.blank])!.label,
      )
      .join("");
    const expected =
      c.model.motion === "rotation"
        ? `The rotation about $C$ by $${c.model.theta}^\\circ$ sends $C$ to itself and each other point $P$ to the point $P'$ on the circle with center $C$ through $P$ such that $m\\angle PCP'$ $=${c.model.theta}^\\circ$, measured counterclockwise from ray $CP$.`
        : house[c.model.motion]!;
    assert.equal(text, expected);
    assert.ok([90, 120, 135].includes(c.model.theta));
  }
});

/** Each slot option as a condition on P′ for a fixed sample (independent
 * semantics); undefined marks an option that constrains only points of m. */
type Pred = (X: Pt) => boolean;
function slotPredicates(motion: string, theta: number) {
  if (motion === "reflection") {
    // m: y = 0, P = (1, 2); the image is (1, -2).
    const P: Pt = [1, 2];
    const preds: Record<string, Pred> = {
      "perpendicular to": (X) => near(X[0] - P[0], 0) && !same(X, P),
      "parallel to": (X) => near(X[1] - P[1], 0) && !same(X, P),
      "at a $45^\\circ$ angle to": (X) =>
        near(Math.abs(X[0] - P[0]), Math.abs(X[1] - P[1])) && !same(X, P),
      "the midpoint": (X) => near((X[1] + P[1]) / 2, 0),
      "an endpoint": (X) => near(X[1], 0),
      "a point": (X) => X[1] * P[1] <= 0,
    };
    return { image: [1, -2] as Pt, preds, candidates: grid(P) };
  }
  if (motion === "rotation") {
    const C: Pt = [0, 0];
    const P: Pt = [2, 0];
    const t = (theta * Math.PI) / 180;
    const angleAt = (v: Pt, from: Pt, to: Pt) => ccw(sub(from, v), sub(to, v));
    const preds: Record<string, Pred> = {
      "the circle with center $C$ through $P$": (X) => near(len(X), 2),
      "the line through $C$ and $P$": (X) => near(X[1], 0),
      "the circle with center $P$ through $C$": (X) =>
        near(len(sub(X, P)), len(sub(C, P))),
    };
    // Angle and direction combine: [angle option][direction option].
    const angle =
      (which: string, dir: string): Pred =>
      (X) => {
        if (which === "$PP'$") return false; // a length is never a number of degrees
        const raw =
          which === "$m\\angle PCP'$" ? angleAt(C, P, X) : angleAt(P, C, X);
        const both = [raw, (360 - raw) % 360];
        if (dir === "counterclockwise from ray $CP$")
          return (
            near(raw, theta) ||
            (which !== "$m\\angle PCP'$" && near(both[1]!, theta))
          );
        if (dir === "clockwise from ray $CP$")
          return (
            near(both[1]!, theta) ||
            (which !== "$m\\angle PCP'$" && near(raw, theta))
          );
        return both.some((a) => near(a, theta));
      };
    return {
      image: [2 * Math.cos(t), 2 * Math.sin(t)] as Pt,
      preds,
      angle,
      candidates: [
        ...grid(P),
        ...[1, 2, 3, 4].flatMap((rad) =>
          Array.from(
            { length: 72 },
            (_, k) =>
              [
                rad * Math.cos((k * Math.PI) / 36),
                rad * Math.sin((k * Math.PI) / 36),
              ] as Pt,
          ),
        ),
        ...[1, 2, 3].flatMap((rad) =>
          [theta, -theta].map(
            (a) =>
              [
                rad * Math.cos((a * Math.PI) / 180),
                rad * Math.sin((a * Math.PI) / 180),
              ] as Pt,
          ),
        ),
      ],
    };
  }
  // A = (0, 0), B = (3, 1), P = (1, 4); the image is (4, 5). (AP differs
  // from AB, so "PP′ = AP" is not the translation by accident.)
  const A: Pt = [0, 0];
  const B: Pt = [3, 1];
  const P: Pt = [1, 4];
  const d = sub(B, A);
  const side = (X: Pt) => Math.sign(cross(d, sub(X, A)));
  const preds: Record<string, Pred> = {
    "parallel to (or on) line $AB$": (X) =>
      near(cross(d, sub(X, P)), 0) && !same(X, P),
    "perpendicular to line $AB$": (X) =>
      near(dot(d, sub(X, P)), 0) && !same(X, P),
    "on line $AB$": (X) =>
      near(cross(d, sub(P, A)), 0) && near(cross(d, sub(X, A)), 0),
    "$PP'=AB$": (X) => near(len(sub(X, P)), len(d)),
    "$AP'=AB$": (X) => near(len(sub(X, A)), len(d)),
    "$PP'=AP$": (X) => near(len(sub(X, P)), len(sub(P, A))),
    "in the same direction from $P$ as $B$ is from $A$": (X) =>
      near(cross(d, sub(X, P)), 0) && dot(d, sub(X, P)) > 0,
    "on the same side of line $AB$ as $P$": (X) => side(X) === side(P),
    "the same distance from $A$ as $P$ is from $B$": (X) =>
      near(len(sub(X, A)), len(sub(P, B))),
  };
  const perp: Pt = [-d[1], d[0]];
  return {
    image: [4, 5] as Pt,
    preds,
    candidates: [
      ...grid(P),
      sub(P, d),
      [P[0] + 2 * d[0], P[1] + 2 * d[1]],
      [P[0] + perp[0], P[1] + perp[1]],
      sub(P, perp),
      B,
    ] as Pt[],
  };
}
/** Lattice and half-lattice points around a sample point. */
function grid(P: Pt): Pt[] {
  const out: Pt[] = [];
  for (let x = -8; x <= 8; x += 0.5)
    for (let y = -8; y <= 8; y += 0.5) out.push([P[0] + x, P[1] + y]);
  return out;
}

test("slots: only the key combination defines the motion; every other combination allows no point, another point, or several", () => {
  for (const motion of ["reflection", "rotation", "translation"] as const)
    for (const theta of motion === "rotation" ? [90, 120, 135] : [90]) {
      const parts = slotParts(motion, theta);
      const slots = parts.flatMap((p) => ("slot" in p ? [p.slot] : []));
      assert.equal(slots.length, 3);
      for (const s of slots)
        assert.equal(s.options.filter((o) => o.correct).length, 1);
      const model = slotPredicates(motion, theta);
      // Slots that constrain P′ for P off m (the reflection's first slot
      // only names where points of m go).
      const live = motion === "reflection" ? slots.slice(1) : slots;
      const combos = (i: number): string[][] =>
        i === live.length
          ? [[]]
          : live[i]!.options.flatMap((o) =>
              combos(i + 1).map((rest) => [o.label, ...rest]),
            );
      for (const combo of combos(0)) {
        const isKey = combo.every(
          (label, i) =>
            live[i]!.options.find((o) => o.label === label)!.correct,
        );
        let pred: Pred;
        if (motion === "rotation") {
          const where = model.preds[combo[0]!]!;
          const angle = (
            model as { angle: (a: string, d: string) => Pred }
          ).angle(combo[1]!, combo[2]!);
          pred = (X) => where(X) && angle(X);
        } else pred = (X) => combo.every((label) => model.preds[label]!(X));
        const imageFits = pred(model.image);
        const others = model.candidates.filter(
          (X) => !same(X, model.image) && pred(X),
        );
        if (isKey) {
          assert.ok(imageFits, `${motion}: key fits the image`);
          assert.equal(
            others.length,
            0,
            `${motion}: key allows only the image`,
          );
        } else
          assert.ok(
            !imageFits || others.length > 0,
            `${motion} ${combo.join(" | ")} would define the motion`,
          );
      }
      if (motion === "reflection") {
        // Points of m: "itself" keeps them; the other two options do not.
        const fixed = slots[0]!;
        assert.deepEqual(
          fixed.options.filter((o) => o.correct).map((o) => o.label),
          ["itself"],
        );
      }
    }
});

test("hints never quote the keyed option", () => {
  for (const id of ids)
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(id, `hint-${i}`);
      const r = p.public.response;
      if (r.kind === "choice") {
        const key = r.options.find((o) => o.id === p.answer)!.label;
        assert.equal(p.hint.includes(key), false, p.hint);
      }
    }
});
