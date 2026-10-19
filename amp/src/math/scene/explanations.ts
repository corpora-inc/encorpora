import { act, areaModel, lessonStep, numberLine, step } from "./author";
import { areaScale } from "./components/models";
import type { Scene } from "./spec";
import type { Step } from "./timeline";

/**
 * Scenes with walkthroughs for specific problem types. Each takes only the
 * problem's givens; values the learner finds stay masked in hints and appear
 * in lessons, where the example is a different instance.
 */

/** a + b on a number line, as the method teaches it: start at the greater
 * addend and count on the smaller, making ten first when the sum crosses 10. */
export function makeTenHops(a: number, b: number): Scene {
  const big = Math.max(a, b),
    small = Math.min(a, b);
  const line = numberLine({ id: "nl", min: 0, max: 20 }).mark(big, {
    color: "warm",
  });
  const title = `${a} + ${b} on a number line`;
  const start = step(
    a === b ? `Start at ${big}.` : `Start at the greater number, ${big}.`,
    act.highlight("nl.mark.0"),
  );
  if (small === 0)
    return line.scene({
      title,
      steps: [
        step(
          `Start at ${big}. Adding 0 does not move the point.`,
          act.highlight("nl.mark.0"),
        ),
      ],
    });
  if (big < 10 && big + small > 10) {
    const toTen = 10 - big,
      rest = small - toTen;
    return (
      line
        // 10 is already a labeled tick; only the final landing gets a label.
        .hop(big, toTen, { landing: "none" })
        .then(rest)
        .scene({
          title,
          steps: [
            start,
            step(
              `${big} needs ${toTen} more to make 10. Jump ${toTen}.`,
              act.trace("nl.hop.0"),
            ),
            step(
              `${small} is ${toTen} + ${rest}, so jump the other ${rest}.`,
              act.trace("nl.hop.1"),
            ),
            lessonStep(
              `${a} + ${b} = {nl.hop.1.landing}`,
              act.highlight("nl.hop.1.landing"),
            ),
          ],
        })
    );
  }
  return line.hop(big, small).scene({
    title,
    steps: [
      start,
      step(
        `Count on ${small}: jump ${small} to the right.`,
        act.trace("nl.hop.0"),
      ),
      lessonStep(
        `${a} + ${b} = {nl.hop.0.landing}`,
        act.highlight("nl.hop.0.landing"),
      ),
    ],
  });
}

/** n × m with n split by place value. The start frame (the problem's
 * figure) is the split rectangle with its side lengths; the walkthrough
 * separates the parts and counts each partial product up. */
export function partialProducts(n: number, m: number): Scene {
  const tens = n - (n % 10),
    ones = n % 10;
  const across = ones ? [tens, ones] : [tens];
  const model = areaModel(across, [m]).id("area");
  const title = `${n} × ${m} as an area model`;
  if (!ones)
    return model.scene({
      title,
      steps: [
        step(
          `${n} × ${m} is the area of a ${n}-by-${m} rectangle.`,
          act.highlight("area.region"),
        ),
        lessonStep(
          `${n} × ${m} = {area.product.0.0}`,
          act.appear("area.product.0.0"),
          act.count("area.product.0.0"),
        ),
      ],
    });
  // Separate the parts by 6% of the drawn width, whatever the scale mode.
  const width = areaScale({ across, down: [m] }) === "proportional" ? n : 10;
  const gap = width * 0.06;
  const onesPart = ["area.region.1.0", "area.across.1", "area.product.1.0"];
  return model.scene({
    title,
    steps: [
      step(
        `${n} × ${m} is the area of a ${n}-by-${m} rectangle.`,
        act.highlight("area.region"),
      ),
      step(
        `Split ${n} into ${tens} + ${ones}: two rectangles.`,
        ...onesPart.map((t) => act.move(t, [gap, 0])),
      ),
      step(
        `The tens part: ${tens} × ${m} = {area.product.0.0}`,
        act.highlight("area.region.0.0"),
        act.appear("area.product.0.0"),
        act.count("area.product.0.0"),
      ),
      lessonStep(
        `The ones part: ${ones} × ${m} = {area.product.1.0}`,
        act.highlight("area.region.1.0"),
        act.appear("area.product.1.0"),
        act.count("area.product.1.0"),
      ),
      lessonStep(
        `Join the parts: ${n} × ${m} = {area.product.0.0} + {area.product.1.0}`,
        ...onesPart.map((t) => act.move(t, [-gap, 0])),
      ),
    ],
  });
}

/** The hint cue for "find the tens partial product", over the learner's own
 * \`partialProducts\` scene: the tens side, then the tens region with its
 * product still unknown. */
export function partialProductsHint(n: number, m: number): Step[] {
  const tens = n - (n % 10);
  return [
    step(
      `The tens part of ${n} is ${tens}, not ${tens / 10}.`,
      act.highlight("area.across.0"),
    ),
    step(
      `Multiply only the tens part: ${tens} × ${m} = {area.product.0.0}`,
      act.highlight("area.region.0.0"),
      act.appear("area.product.0.0"),
    ),
  ];
}
