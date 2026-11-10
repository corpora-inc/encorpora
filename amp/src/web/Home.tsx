import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  useCurriculumDetails,
} from "./features/curriculum/CurriculumDetails";
import { strandNames } from "./BirthYearPrompt";

import {
  strandEstimate,
  type Frontier,
  type Estimate,
} from "../learning/frontier";
import { gradeName, levelDetails, levelRange } from "../learning/level-check";
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
  const freeLine = props.freeLeft != null && (
    <span className="home-free" data-free-left={props.freeLeft}>
      {freeProblemsLeft(props.freeLeft)}
    </span>
  );
  // Day 0 (docs/design/ia.md, rule 7): one centred hero, its start the only
  // Practice on screen.
  const dayZero = !!f && !measured;
  return (
    <main className="home">
      {props.navigation}
      {!dayZero && (
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
            {freeLine && <p className="home-free-line">{freeLine}</p>}
          </div>
          {go}
        </section>
      )}
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
            title={who ? `Where ${who} is` : "Where you are"}
            heading={1}
            start={f.overall}
            grade={grade}
            numbers={shown}
            who={who}
            action={go}
            secondary={freeLine}
          />
        )}
      </div>
      {/* Grade numbers are a setting of the drawer (docs/design/ia.md,
          "Where settings live"); the birth year, a quiet line under the
          level, centred with it. */}
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

