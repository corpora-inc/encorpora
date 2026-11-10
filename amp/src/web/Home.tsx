import { useState, type ReactNode } from "react";
import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "./features/curriculum/CurriculumDetails";
import { strandNames } from "./BirthYearPrompt";

import {
  strandEstimate,
  type Frontier,
  type Estimate,
} from "../learning/frontier";
import { gradeName, levelDetails, levelRange } from "../learning/level-check";
import { LevelReadout } from "./ui/LevelReadout";
import { LevelAxis, levelPositionDescription } from "./ui/LevelChart";
import { freeProblemsLeft } from "./lib/free-allowance";
export { gradeName } from "../learning/level-check";
export type FrontierMap = Frontier;
const COLLEGE = 13;

type Props = {
  navigation?: ReactNode;
  name: string;
  birthYear?: number | null;
  resuming: boolean;
  frontier: FrontierMap | null;
  strands: readonly string[];
  busy: boolean;
  /** Absent when practice isn't this screen's to start: a second parent's
   * family's child who can't practice yet. */
  go?: () => void;
  /** The action's own words, instead of Go or Continue. */
  goLabel?: string;
  /** Absent for a school student, whose school manages this. */
  changeBirthYear?: () => void;
  /** Free problems left, for a learner no plan covers yet. */
  freeLeft?: number | null;
};

/** Home: continue practice, with optional estimates and their uncertainty. */
export function Home(props: Props) {
  const { shown } = useCurriculumDetails();
  const f = props.frontier;
  return (
    <main className="home">
      {props.navigation}
      <section className="home-hero">
        <div>
          <h1>{props.name}</h1>
          {props.freeLeft != null && (
            <p className="home-free" data-free-left={props.freeLeft}>
              {freeProblemsLeft(props.freeLeft)}
            </p>
          )}
          {shown && <HomeLevel frontier={f} />}
        </div>
        {props.go && (
          <button
            className="go-button"
            disabled={props.busy}
            aria-busy={props.busy}
            onClick={props.go}
          >
            {props.goLabel ?? (props.resuming ? "Continue" : "Go")}
          </button>
        )}
      </section>
      <CurriculumDetailsControl />
      <FrontierMap
        name={props.name}
        birthYear={props.birthYear}
        frontier={props.frontier}
        strands={props.strands}
      />
      {props.changeBirthYear && (
        <button
          className="text-button home-birth-year"
          onClick={props.changeBirthYear}
        >
          Change birth year
        </button>
      )}
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
  birthYear?: number | null;
  frontier: FrontierMap | null;
  strands: readonly string[];
}) {
  const { shown } = useCurriculumDetails();
  const [open, setOpen] = useState<string | null>(null);
  const f = props.frontier;
  const center = f?.expected ?? 4;
  const lo = Math.max(0, Math.min(center - 3, COLLEGE - 6)),
    hi = lo + 6;
  const at = (v: number) =>
    `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  const reference = props.birthYear != null && f ? center : undefined;
  return (
    <section className="frontier-map" aria-label="Where you are" aria-busy={!f}>
      <div className="frontier-heading">
        <h2>{f ? "Where you are" : "Loading estimates…"}</h2>
        <p>
          Dots show estimates; bands show uncertainty.{" "}
          {props.birthYear != null && (
            <>Vertical marks show the age reference. </>
          )}
          Striped bands mark areas not practiced yet.
        </p>
      </div>
      <ul>
        {props.strands.map((strand) => {
          const own = f?.strands[strand];
          const measured = own && own.answered > 0 ? own : undefined;
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
                aria-label={
                  f
                    ? `${strandNames[strand]}. ${levelPositionDescription(estimate, reference)}`
                    : `${strandNames[strand]}. Loading estimate.`
                }
                disabled={!f}
                onClick={() => setOpen(expanded ? null : strand)}
              >
                <span className="frontier-name">{strandNames[strand]}</span>
                <span
                  className={`frontier-track ${measured ? "" : "estimated"}`}
                  aria-hidden="true"
                >
                  {f && (
                    <>
                      {reference !== undefined && (
                        <span
                          className="frontier-center"
                          style={{ left: at(center) }}
                        />
                      )}
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
                    </>
                  )}
                </span>
              </button>
              {expanded && f && (
                <p className="frontier-detail">
                  {shown
                    ? measured
                      ? `Level ${detail.point} (${gradeName(estimate.level)}). Estimated range ${detail.from} to ${detail.to}. ${measured.answered} answered, ${measured.independent} correct without help.`
                      : `Not practiced yet. Estimated level ${detail.point} (${gradeName(estimate.level)}), range ${detail.from} to ${detail.to}.`
                    : `${measured ? `${measured.answered} answered, ${measured.independent} correct without help.` : "Not practiced yet."} ${levelPositionDescription(estimate, reference)}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="frontier-axis">
        <LevelAxis
          scale={{ lo, hi, center }}
          name={shown && f ? gradeName : () => ""}
          reference={reference !== undefined}
        />
      </div>
    </section>
  );
}
