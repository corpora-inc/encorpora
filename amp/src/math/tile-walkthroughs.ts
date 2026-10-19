import { act, lessonStep, polyArea, step } from "./scene/author";
import {
  X,
  sideText as mathSide,
  termText as mathTerm,
} from "./scene/components/poly-area";
import type { Scene, Term } from "./scene/spec";

/**
 * Lesson walkthroughs built on the polyArea component. Each is a worked
 * model of one instance, revealed in its lesson; the problem never sends it.
 */

/** Captions are prose: x² rather than the label notation x^2. */
const sup = (t: string) =>
  t.replace(/\^(\d)/g, (_, d: string) => "⁰¹²³⁴⁵⁶"[Number(d)]!);
const termText = (t: Term) => sup(mathTerm(t));
const sideText = (terms: Term[]) => sup(mathSide(terms));

/** (a x + s)(b x + u) built as an area, corner by corner. `outside` is a
 * numerical factor taken out first (1 when there is none). */
export function factorTiles(
  left: [number, number],
  right: [number, number],
  outside = 1,
  /** The polynomial as the problem states it, before taking out `outside`. */
  given?: string,
): Scene {
  let [s, a] = left,
    [u, b] = right;
  // The longer side runs across, so the model is wide rather than tall.
  if (Math.abs(a) * X + Math.abs(s) < Math.abs(b) * X + Math.abs(u))
    [[s, a], [u, b]] = [
      [u, b],
      [s, a],
    ];
  const across: Term[] = [
      [a, 1],
      [s, 0],
    ],
    down: Term[] = [
      [b, 1],
      [u, 0],
    ];
  const inner = sideText(
    (
      [
        [a * b, 2],
        [a * u + b * s, 1],
        [s * u, 0],
      ] as Term[]
    ).filter(([c]) => c !== 0),
  );
  // The product reads in the order the factors were given.
  const [p, q] = [left, right].map(
      ([c, k]) =>
        `(${sideText([
          [k, 1],
          [c, 0],
        ])})`,
    ),
    product = p === q ? `${p}²` : `${p}${q}`,
    k = outside === 1 ? "" : outside === -1 ? "−" : termText([outside, 0]);
  const model = polyArea(across, down, { sides: "derived" }).id("t");
  return model.scene({
    title: `${inner} as an area model`,
    steps: [
      step(
        `${k ? `Take out ${k === "−" ? "−1" : k} first: ${given ?? inner} = ${k}(${inner}). ` : ""}The ${termText([a * b, 2])} part goes in one corner.`,
        act.appear("t.region.0.0"),
      ),
      step(
        `The constant ${termText([s * u, 0])} goes in the opposite corner.`,
        act.appear("t.region.1.1"),
      ),
      step(
        `The two x parts fill the other corners: ${termText([a * u, 1])} and ${termText([b * s, 1])} make ${a * u + b * s === 0 ? "0: they cancel" : termText([a * u + b * s, 1])}.`,
        act.appear("t.region.0.1"),
        act.appear("t.region.1.0"),
      ),
      lessonStep(
        `The side lengths are the factors: ${inner} = ${product}${k ? `, so ${given ?? inner} = ${k}${product}` : ""}.`,
        act.appear("t.across"),
        act.appear("t.down"),
      ),
    ],
  });
}

/** A monomial times a polynomial as one row of regions: the common factor is
 * the height, and each region is one term of the original polynomial. */
export function commonFactorArea(factor: Term, quotient: Term[]): Scene {
  const model = polyArea(quotient, [factor], { sides: "derived" }).id("t");
  const terms = quotient.map((q) =>
    termText([q[0] * factor[0], q[1] + factor[1]]),
  );
  return model.scene({
    title: "A common factor as the height of an area model",
    steps: [
      step(
        `Each term is one region: ${terms.join(", ")}.`,
        act.appear("t.region"),
      ),
      step(
        `Every region has height ${termText(factor)}, the greatest common monomial factor.`,
        act.appear("t.down"),
      ),
      lessonStep(
        `Divide each region by ${termText(factor)} to find its width: ${termText(factor)}(${sideText(quotient)}).`,
        act.appear("t.across"),
      ),
    ],
  });
}
