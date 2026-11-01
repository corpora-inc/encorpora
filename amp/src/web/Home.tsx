import { useState, type ReactNode } from "react";
import { strandNames } from "./BirthYearPrompt";

import {
  strandEstimate,
  type Frontier,
  type Estimate,
} from "../learning/frontier";
import { gradeName, levelDetails, levelRange } from "../learning/level-check";
import { LevelReadout } from "./ui/LevelReadout";
export { gradeName } from "../learning/level-check";
export type FrontierMap = Frontier;
const COLLEGE = 13;

type Props = {
  navigation?: ReactNode;
  name: string;
  resuming: boolean;
  frontier: FrontierMap | null;
  strands: readonly string[];
  busy: boolean;
  go: () => void;
  changeBirthYear: () => void;
};

/** Home: one action, and each strand's estimated grade level relative to the
 * grade typical for the learner's age, with its uncertainty. */
export function Home(props: Props) {
  const f = props.frontier;
  return (
    <main className="home">
      {props.navigation}
      <section className="home-hero">
        <div>
          <h1>{props.name}</h1>
          <HomeLevel frontier={f} />
        </div>
        <button className="go-button" disabled={props.busy} onClick={props.go}>
          {props.resuming ? "Continue" : "Go"}
        </button>
      </section>
      <FrontierMap
        name={props.name}
        frontier={props.frontier}
        strands={props.strands}
      />
      <button
        className="text-button home-birth-year"
        onClick={props.changeBirthYear}
      >
        Change birth year
      </button>
    </main>
  );
}

/** The working level, in space reserved from the first frame: while the
 * estimate loads an invisible readout holds its place, and before any answer
 * a short line takes that same place, so the action below never moves. */
function HomeLevel({ frontier }: { frontier: FrontierMap | null }) {
  const measured = !!frontier && frontier.overall.answered > 0;
  return (
    <div className="home-level" aria-busy={!frontier}>
      <div
        className="home-level-readout"
        aria-hidden={!measured}
        style={{ visibility: measured ? "visible" : "hidden" }}
      >
        <LevelReadout
          estimate={
            measured && frontier
              ? frontier.overall
              : { level: frontier?.expected ?? 4, sd: 1 }
          }
        />
      </div>
      {frontier && !measured && (
        <p className="home-level-empty">
          Your level appears after a few problems.
        </p>
      )}
    </div>
  );
}

/** Each strand's estimated grade level and its uncertainty range, on a scale centred
 * on the grade typical for the learner's age. Rows open to show the data. */
export function FrontierMap(props: {
  name: string;
  frontier: FrontierMap | null;
  strands: readonly string[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const f = props.frontier;
  const center = f?.expected ?? 4;
  const lo = Math.max(0, Math.min(center - 3, COLLEGE - 6)),
    hi = lo + 6;
  const at = (v: number) =>
    `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  return (
    <section className="frontier-map" aria-label="Where you are">
      <div className="frontier-heading">
        <h2>Where you are</h2>
        <p>
          Estimated grade level in each area. The centre line is typical for{" "}
          {props.name}’s age. Wider bars mean more uncertainty.
        </p>
      </div>
      <ul>
        {props.strands.map((strand) => {
          const measured = f?.strands[strand];
          const estimate: Estimate = f
            ? strandEstimate(f, strand)
            : {
                level: center,
                sd: 2.5,
                answered: 0,
                independent: 0,
              };
          const [from, to] = levelRange(estimate);
          const detail = levelDetails(estimate);
          const expanded = open === strand;
          return (
            <li key={strand} data-strand={strand}>
              <button
                className="frontier-row"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : strand)}
              >
                <span className="frontier-name">{strandNames[strand]}</span>
                <span
                  className={`frontier-track ${measured ? "" : "estimated"}`}
                  aria-hidden="true"
                >
                  <span className="frontier-center" />
                  <span
                    className="frontier-range"
                    style={{
                      left: at(from),
                      width: `calc(${at(to)} - ${at(from)})`,
                    }}
                  />
                  <span
                    className="frontier-dot"
                    style={{ left: at(estimate.level) }}
                  />
                </span>
              </button>
              {expanded && (
                <p className="frontier-detail">
                  {measured
                    ? `Level ${detail.point} (${gradeName(estimate.level)}). Estimated range ${detail.from} to ${detail.to}. ${measured.answered} answered, ${measured.independent} correct without help.`
                    : `Not practiced yet. Estimated from other areas: level ${detail.point} (${gradeName(estimate.level)}), range ${detail.from} to ${detail.to}.`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="frontier-axis" aria-hidden="true">
        <span>{gradeName(lo)}</span>
        <span>{gradeName(center)}</span>
        <span>
          {gradeName(hi)}
          {hi < COLLEGE ? "+" : ""}
        </span>
      </div>
    </section>
  );
}
