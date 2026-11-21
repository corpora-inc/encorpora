import { useEffect, useLayoutEffect } from "react";
import { usePrefersReducedMotion } from "../../practice/look";
import { stage } from "../../practice/celebration/stage";
import type { Moment } from "../../practice/celebration/tier";
import type { PracticeFixtureId } from "../fixtures";
import { Section, SpecimenFrame } from "../Gallery";
import { PracticeSpecimen } from "./practice";

/** Each Colorful state: the practice screen it plays over, and what plays
 * on a loop so the moment can be judged without practicing. */
const states = {
  problem: { fixture: "typed", loop: [] },
  right: { fixture: "correct", loop: [["right"]] },
  strong: { fixture: "mastered", loop: [["right", "strong"]] },
  earned: { fixture: "correct", loop: [["right", "earned"]] },
  streak: {
    fixture: "correct",
    loop: [
      ["right", "streak-3"],
      ["right", "streak-5"],
      ["right", "streak-10"],
    ],
  },
  points: { fixture: "correct", loop: [["right", "points-10"]] },
  choice: { fixture: "choice", loop: [] },
  wrong: { fixture: "wrong", loop: [] },
} satisfies Record<string, { fixture: PracticeFixtureId; loop: Moment[][] }>;
export type ColorfulState = keyof typeof states;

/** The chip's totals as the loop goes round: one to five digits, so its
 * fixed size can be seen to hold. */
const totals = [7, 128, 1_024, 12_345];
const LOOP_MS = 3200;

/** A practice screen in Colorful, alone in its frame, with its moment
 * replaying. Synthetic: the totals are made up. */
export function ColorfulSpecimen({ state }: { state: ColorfulState }) {
  const { fixture, loop } = states[state];
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-look", "bold");
    const shown = stage();
    shown.retain();
    shown.setPoints(state === "points" ? 129 : 128);
    return () => {
      shown.release();
      root.removeAttribute("data-look");
    };
  }, [state]);
  useEffect(() => {
    if (!loop.length) return;
    let turn = 0;
    const play = () => {
      const moments = loop[turn % loop.length]!;
      const from =
        state === "points"
          ? 129 + turn * 10
          : state === "streak"
            ? 128 + turn
            : totals[turn % totals.length]!;
      stage().play({ moments, from, to: from + 1, reduced });
      turn++;
    };
    // After the sheet has risen into place.
    const first = window.setTimeout(play, 400);
    const every = window.setInterval(play, LOOP_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [state, loop, reduced]);
  return <PracticeSpecimen id={fixture} />;
}

const labels: [ColorfulState, string][] = [
  ["problem", "A problem: the page, the bar's band, the points chip"],
  ["choice", "A choice, one selected"],
  ["right", "Right answer: the burst, +1 flying to the chip, the tick"],
  ["strong", "Skill strong: confetti over everything"],
  ["earned", "Skill earned: the stamp"],
  ["streak", "Streak of 3, 5 and 10: the chip's moments, in turn"],
  ["points", "Every tenth point"],
  ["wrong", "Wrong: kind and calm, nothing new"],
];

export const colorfulSpecimens = Object.fromEntries(
  labels.map(([state]) => [
    `colorful-${state}`,
    () => <ColorfulSpecimen state={state} />,
  ]),
);

export function ColorfulSection() {
  return (
    <Section
      id="colorful"
      title="Colorful"
      source={[
        "features/practice/celebration/",
        "ui/tokens.css",
        "features/practice/points.ts",
      ]}
      note="The look a learner may choose for practice. Each frame replays its moment every few seconds. Calm is the section above, unchanged. With reduced motion the colors stay and each moment is a plain change of state."
    >
      {labels.map(([state, label]) => (
        <SpecimenFrame
          key={state}
          specimen={`colorful-${state}`}
          label={label}
        />
      ))}
    </Section>
  );
}
