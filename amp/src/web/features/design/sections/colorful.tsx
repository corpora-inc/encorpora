import { useEffect, useLayoutEffect } from "react";
import { usePrefersReducedMotion } from "../../practice/look";
import { GOLDEN_ANGLE, paintHue } from "../../practice/celebration/hue";
import { stage } from "../../practice/celebration/stage";
import type { Moment } from "../../practice/celebration/tier";
import type { PracticeFixtureId } from "../fixtures";
import { Switch } from "../../../ui/Switch";
import { Section } from "../Gallery";
import { PracticeSpecimen } from "./practice";
import styles from "./colorful.module.css";

/** Each Colorful state: the practice screen it plays over, and what plays
 * on a loop (with the run it plays at) so it can be judged unpracticed. */
const states = {
  problem: { label: "A problem", fixture: "typed", loop: [] },
  figures: {
    label: "A choice with figures",
    fixture: "figures",
    loop: [],
  },
  right: {
    label: "Right: the check, the burst, +1 into the chip",
    fixture: "correct",
    loop: [{ moments: ["right"], streak: 1 }],
  },
  "figures-right": {
    label: "Right, on the figures",
    fixture: "figures-correct",
    loop: [{ moments: ["right"], streak: 1 }],
  },
  streak: {
    label: "A run of 3, 5 and 10: each win bigger",
    fixture: "correct",
    loop: [
      { moments: ["right", "streak-3"], streak: 3 },
      { moments: ["right", "streak-5"], streak: 5 },
      { moments: ["right", "streak-10"], streak: 10 },
    ],
  },
  points: {
    label: "Every tenth point",
    fixture: "correct",
    loop: [{ moments: ["right", "points-10"], streak: 2 }],
  },
  earned: {
    label: "A skill earned: the stamp",
    fixture: "correct",
    loop: [{ moments: ["right", "earned"], streak: 1 }],
  },
  strong: {
    label: "A skill strong: the takeover",
    fixture: "mastered",
    loop: [{ moments: ["right", "strong"], streak: 4 }],
  },
  wrong: { label: "Not yet: kind and still", fixture: "wrong", loop: [] },
} satisfies Record<
  string,
  {
    label: string;
    fixture: PracticeFixtureId;
    loop: { moments: Moment[]; streak: number }[];
  }
>;
export type ColorfulState = keyof typeof states;

/** Four worlds far apart on the circle. */
export const galleryHues = [20, 110, 200, 290];
const LOOP_MS = 3400;

/** A practice screen in Colorful at one hue (or, with `cycle`, a new hue
 * every few seconds, as practice turns it), its moment replaying. Every
 * total here is made up. */
export function ColorfulSpecimen({
  state,
  hue,
  cycle = false,
}: {
  state: ColorfulState;
  hue: number;
  cycle?: boolean;
}) {
  const { fixture, loop } = states[state];
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-look", "bold");
    // The problem shown arrived in Colorful: its chip has its room
    // (features/practice/chip-room.ts).
    root.setAttribute("data-chip-room", "");
    paintHue(hue);
    const shown = stage();
    shown.retain();
    shown.setPoints(state === "points" ? 129 : 128);
    return () => {
      shown.release();
      root.removeAttribute("data-look");
      root.removeAttribute("data-chip-room");
    };
  }, [state, hue]);
  useEffect(() => {
    if (!loop.length && !cycle) return;
    let turn = 0;
    const play = () => {
      if (cycle) paintHue((hue + turn * GOLDEN_ANGLE) % 360);
      const step = loop[turn % Math.max(1, loop.length)];
      if (step) {
        const from = state === "points" ? 129 + turn * 10 : 128 + turn;
        stage().play({
          moments: step.moments,
          from,
          to: from + 1,
          reduced,
          streak: step.streak,
        });
      }
      turn++;
    };
    // After the sheet has risen into place.
    const first = window.setTimeout(play, 400);
    const every = window.setInterval(play, LOOP_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [state, hue, cycle, loop, reduced]);
  return <PracticeSpecimen id={fixture} />;
}

const stateIds = Object.keys(states) as ColorfulState[];
export const colorfulSpecimens = {
  ...Object.fromEntries(
    stateIds.flatMap((state) =>
      galleryHues.map((hue) => [
        `colorful-${state}-${hue}`,
        () => <ColorfulSpecimen state={state} hue={hue} />,
      ]),
    ),
  ),
  "colorful-cycle": () => <ColorfulSpecimen state="right" hue={20} cycle />,
};

function Frame({ specimen, label }: { specimen: string; label: string }) {
  const src = `/design/specimen/${specimen}`;
  return (
    <figure className={styles.frame}>
      <figcaption>
        {label}
        <a href={src} target="_blank" rel="noopener">
          Open alone
        </a>
      </figcaption>
      <iframe src={src} title={label} loading="lazy" />
    </figure>
  );
}

export function ColorfulSection() {
  return (
    <Section
      id="colorful"
      title="Colorful"
      source={[
        "ui/tokens.css",
        "features/practice/celebration/",
        "features/practice/points.ts",
      ]}
      note="The look a learner may choose for practice: one world from one hue, turned with every problem. Each state is shown at four hues, side by side (swipe on a phone); each moment replays every few seconds. Calm is the section above, unchanged. An adult's side is one switch, Allow Colorful, on unless they turn it off; off, the learner is in Calm and their menu has no Look."
    >
      <div className={styles.rows}>
        <section className={styles.row} aria-label="Allow Colorful">
          <h3>Allow Colorful: a parent’s, a class’s, a school’s</h3>
          <div className={styles.switches}>
            <Switch label="Allow Colorful" checked onChange={() => {}} />
            <Switch
              label="Allow Colorful"
              checked={false}
              onChange={() => {}}
            />
            <Switch
              label="Allow Colorful"
              checked={false}
              disabled
              detail="Set by Cedar Hill School"
              onChange={() => {}}
            />
          </div>
        </section>
        <section className={styles.row} aria-label="The hue turning">
          <h3>A new world every problem</h3>
          <div className={styles.strip}>
            <Frame
              specimen="colorful-cycle"
              label="Turning by the golden angle"
            />
          </div>
        </section>
        {stateIds.map((state) => (
          <section
            key={state}
            className={styles.row}
            aria-label={states[state].label}
          >
            <h3>{states[state].label}</h3>
            <div className={styles.strip}>
              {galleryHues.map((hue) => (
                <Frame
                  key={hue}
                  specimen={`colorful-${state}-${hue}`}
                  label={`${hue}°`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Section>
  );
}
