import { useQuery } from "@tanstack/react-query";
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
import { LevelAxis, levelPositionDescription } from "./ui/LevelChart";
import { fitScale, LevelRange, LevelRangeStart } from "./ui/level-range";
import { sessionOptions } from "./lib/query";
import { useHeroAction } from "./lib/shell-slots";
import { levelTrendOptions } from "./features/level/api";
import { freeProblemsLeft } from "./lib/free-allowance";
export { gradeName } from "../learning/level-check";
export type FrontierMap = Frontier;
const COLLEGE = 13;

type Props = {
  navigation?: ReactNode;
  name: string;
  /** For the level's path; without it the path waits. */
  learnerId?: string;
  /** "other": someone else reads this learner's Overview (a parent), so it
   * names them; "self": the learner reads it, so it speaks to them. */
  reader?: "self" | "other";
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

/** The learner's Overview: their level leads, with the one action beside
 * it. Before any answer, the starting estimate from their age; after, the
 * best guess, the likely range, every area practiced and how it narrowed.
 * Grade numbers follow the learner's setting on this device. */
export function Home(props: Props) {
  const { shown } = useCurriculumDetails();
  const f = props.frontier;
  const measured = !!f && f.overall.answered > 0;
  const session = useQuery(sessionOptions).data;
  const trend = useQuery({
    ...levelTrendOptions(
      session ?? { accountId: "", token: "" },
      props.learnerId ?? "",
    ),
    enabled: !!session && !!props.learnerId && measured,
  });
  const who = props.reader === "other" ? props.name : undefined;
  // The grade typical for their age, behind every bar, when it is known.
  const grade =
    props.birthYear != null && f
      ? ([f.expected - 0.5, f.expected + 0.5] as const)
      : null;
  // One Practice per screen: the bar's, once there is a level to read. On
  // day 0 the page's own start is the one, and the bar's steps back. A
  // labelled action that isn't Practice (a second parent's "Let … practice
  // here") always stays: the bar has none for it.
  const ownStart = !!props.go && !props.goLabel && !!f && !measured;
  useHeroAction(ownStart);
  const go = props.go && (props.goLabel || ownStart) && (
    <button
      className="go-button"
      disabled={props.busy}
      aria-busy={props.busy}
      onClick={props.go}
    >
      {props.goLabel ?? (props.resuming ? "Continue" : "Start practicing")}
    </button>
  );
  const areas = f
    ? props.strands
        .filter((strand) => (f.strands[strand]?.answered ?? 0) > 0)
        .map((strand) => ({
          id: strand,
          label: strandNames[strand] ?? strand,
          estimate: f.strands[strand]!,
        }))
    : [];
  return (
    <main className="home">
      {props.navigation}
      <section className="home-hero">
        <div>
          {/* Whose Overview, for someone reading another's; a learner's
              own never names them (docs/design/ia.md). */}
          <h1
            id="home-title"
            className={who ? "home-learner" : "home-learner home-learner-own"}
          >
            {who ? props.name : "Where you are"}
          </h1>
          {props.freeLeft != null && (
            <p className="home-free" data-free-left={props.freeLeft}>
              {freeProblemsLeft(props.freeLeft)}
            </p>
          )}
        </div>
        {go}
      </section>
      {/* `.frontier-map` and `aria-busy` mark the level's place for the
          browser checks that wait on the Overview. */}
      <div className="frontier-map home-level-slot" aria-busy={!f}>
        {!f ? (
          <div
            className="home-level-wait amp-skeleton"
            aria-busy="true"
            aria-label="Loading the level"
          />
        ) : measured ? (
          <LevelRange
            title={who ? `Where ${who} is` : null}
            labelledBy={who ? undefined : "home-title"}
            overall={f.overall}
            answered={f.overall.answered}
            areas={areas}
            grade={grade}
            path={trend.data ?? null}
            pathState={
              trend.isError ? "failed" : trend.data ? "ready" : "loading"
            }
            numbers={shown}
            who={who}
          />
        ) : (
          <LevelRangeStart
            title={who ? `Where ${who} is` : null}
            labelledBy={who ? undefined : "home-title"}
            start={f.overall}
            grade={grade}
            numbers={shown}
            who={who}
          />
        )}
      </div>
      <CurriculumDetailsControl />
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
  // Six grades around the age reference, widened to hold every practiced
  // area's whole likely range and every best guess: no measured band or dot
  // is pinned against an end. An unpracticed area's wide, striped band may
  // run on past one.
  const fitted = f
    ? fitScale(
        props.strands
          .filter((strand) => (f.strands[strand]?.answered ?? 0) > 0)
          .map((strand) => f.strands[strand]!),
        {
          minSpan: 6,
          include: [
            center,
            ...props.strands.map((strand) => strandEstimate(f, strand).level),
          ],
        },
      )
    : null;
  const lo = fitted?.lo ?? Math.max(0, Math.min(center - 3, COLLEGE - 6)),
    hi = fitted?.hi ?? lo + 6;
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
