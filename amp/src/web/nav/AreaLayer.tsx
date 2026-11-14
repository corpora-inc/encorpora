import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { ProgressRecord } from "../../schools/teacher-contracts";
import { gradeName } from "../../learning/level-check";
import { strandNames } from "../BirthYearPrompt";
import { bands, bandLabel, type MapSkill } from "../features/pathways/model";
import { skillCatalogOptions } from "../lib/learning-view";
import { buttonClass } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import {
  fitScale,
  LevelAxis,
  LevelBar,
  likelyRange,
  plainLevel,
  scaleAt,
  type Estimate,
  type LevelRangeArea,
  type PathPoint,
  type RangeScale,
} from "../ui/level-range";
import { percent } from "../ui/level-range/scale";
import { EntityLink } from "./links";
import { LayerWait } from "./LayerWait";
import layers from "./layers.module.css";
import styles from "./AreaLayer.module.css";
import "../features/school/SchoolFrame.module.css";

/**
 * What an area layer reads: the level the page shows, area by area, and the
 * skills shown on their own. The page whose level it is supplies it (its own
 * record, a child's, a student's), so the layer never fetches a level of its
 * own and always agrees with the rows that opened it.
 */
export type AreaSource = {
  /** Null before the first answer: nothing opens. */
  overall: Estimate | null;
  areas: readonly LevelRangeArea[];
  objectives: ProgressRecord["objectives"];
  /** How the overall estimate moved; only where the page has it. */
  path?: readonly PathPoint[] | null;
  /** This reader may start practice for this learner: the one action. */
  practice?: boolean;
};

/** A record's level as an area layer reads it, in the record's own order. */
export function areaSourceOf(record: ProgressRecord): AreaSource {
  const level = record.level;
  return {
    overall: level?.overall ?? null,
    areas: level
      ? record.strands.flatMap((strand) => {
          const estimate = level.strands[strand.id];
          return estimate
            ? [{ id: strand.id, label: strand.label, estimate }]
            : [];
        })
      : [],
    objectives: record.objectives,
  };
}

export const OVERALL = "overall";

/** The skills of one area around a level, as the layer sorts them: earned
 * (shown on their own), working on (inside the likely range, not earned
 * yet, nearest the best guess first) and next up (the first grade above
 * the range that has any). Pure, for the layer and its tests. */
export function areaSkills(
  skills: readonly MapSkill[],
  area: string,
  estimate: Estimate,
  earnedIds: ReadonlySet<string>,
) {
  const [from, to] = likelyRange(estimate);
  const low = Math.round(from),
    high = Math.round(to);
  const own = skills
    .filter((skill) => skill.strand === area)
    .map((skill) => ({ skill, band: bands.indexOf(skill.gradeBand) }))
    .filter((entry) => entry.band >= 0);
  const earned = own.filter((entry) => earnedIds.has(entry.skill.id));
  const open = own.filter((entry) => !earnedIds.has(entry.skill.id));
  const working = open
    .filter((entry) => entry.band >= low && entry.band <= high)
    .sort(
      (a, b) =>
        Math.abs(a.band - estimate.level) - Math.abs(b.band - estimate.level),
    );
  const above = open.filter((entry) => entry.band > high);
  const nextBand = Math.min(...above.map((entry) => entry.band));
  const next = above.filter((entry) => entry.band === nextBand);
  return { all: own, earned, working, next };
}

type Placed = ReturnType<typeof areaSkills>;
type Entry = Placed["all"][number];

/**
 * One area of a learner's level, over the page that shows it
 * (`?open=area:<strand>`, or `area:overall`): its range in plain words, its
 * skills on the same grade scale (earned, working on, next up), each opening
 * its skill over this one, and the one action the reader may take. A side
 * panel on a wide screen, a sheet on a phone (ui/Sheet).
 */
export function AreaLayer({
  area,
  source,
  open,
  onClose,
  back,
}: {
  area: string;
  source: AreaSource;
  open: boolean;
  onClose: () => void;
  back?: string;
}) {
  const overall = area === OVERALL;
  const row: LevelRangeArea | undefined = overall
    ? source.overall
      ? { id: "", label: "Overall", estimate: source.overall }
      : undefined
    : source.areas.find((entry) => entry.id === area);
  const label = row
    ? row.label
    : overall
      ? "Overall"
      : (strandNames[area] ?? "Area");
  return (
    <Sheet
      open={open}
      tall
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={label}
      back={back}
    >
      {!row?.estimate ? (
        <p className={layers.lede}>No level here yet.</p>
      ) : overall ? (
        <OverallDetail source={source} words={plainLevel(row.estimate)} />
      ) : (
        <AreaDetail
          area={area}
          label={label}
          estimate={row.estimate}
          source={source}
        />
      )}
    </Sheet>
  );
}

/** The whole level: how it moved, every area by its best guess (each
 * opening in this layer's place), the skills earned, and Practice. */
function OverallDetail({
  source,
  words,
}: {
  source: AreaSource;
  words: string;
}) {
  return (
    <div className={layers.layer} data-area-layer={OVERALL}>
      <p className={styles.plain} data-area-words="">
        {words}
      </p>
      {source.path && source.path.length >= 3 && (
        <Sparkline points={source.path} />
      )}
      {source.practice && (
        <div className={layers.actions}>
          <Link
            to="/$"
            params={{ _splat: "practice" }}
            className={buttonClass("primary", styles.practice)}
            data-area-practice=""
          >
            Practice
          </Link>
        </div>
      )}
      {source.areas.length > 0 && (
        <section>
          <h3 className={layers.heading}>By area</h3>
          <ul className={layers.rows}>
            {source.areas.map((entry) =>
              entry.estimate ? (
                <li key={entry.id} data-strand={entry.id}>
                  <EntityLink
                    entity={{ kind: "area", id: entry.id }}
                    replace
                    className={layers.row}
                    data-area-row={entry.id}
                  >
                    <span className={styles.areaName}>
                      <span className={styles.swatch} aria-hidden="true" />
                      {entry.label}
                    </span>
                    <span className={styles.rowEnd}>
                      <span className={layers.rowFact}>
                        {gradeName(entry.estimate.level)}
                      </span>
                      {chevron}
                    </span>
                  </EntityLink>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}
      <SkillGroup
        title="Earned"
        empty={null}
        entries={source.objectives.map((objective) => ({
          id: objective.skillId,
          title: objective.title,
          strand: objective.strand,
        }))}
        state="earned"
      />
    </div>
  );
}

/** One area: its skills placed on the grade scale, then the lists. */
function AreaDetail({
  area,
  label,
  estimate,
  source,
}: {
  area: string;
  label: string;
  estimate: Estimate;
  source: AreaSource;
}) {
  const catalog = useQuery(skillCatalogOptions);
  if (!catalog.data)
    return catalog.isError ? (
      <p role="alert">
        The skills in {label} didn’t load. Check your connection, then try
        again.
      </p>
    ) : (
      <LayerWait />
    );
  const earnedIds = new Set(
    source.objectives
      .filter((objective) => objective.strand === area)
      .map((objective) => objective.skillId),
  );
  const placed = areaSkills(catalog.data.skills, area, estimate, earnedIds);
  const focus = placed.working[0] ?? placed.next[0];
  const skillItem = (entry: Entry) => ({
    id: entry.skill.id,
    title: entry.skill.title,
    strand: area,
    band: entry.skill.gradeBand,
  });
  return (
    <div className={layers.layer} data-area-layer={area} data-strand={area}>
      <p className={styles.plain} data-area-words="">
        {plainLevel(estimate)}
      </p>
      <SkillField placed={placed} estimate={estimate} />
      {source.practice && focus && (
        <div className={layers.actions}>
          <Link
            to="/$"
            params={{ _splat: "practice" }}
            search={{ skill: focus.skill.id } as never}
            className={buttonClass("primary", styles.practice)}
            data-area-practice={focus.skill.id}
          >
            {`Practice ${inSentence(focus.skill.title)}`}
          </Link>
        </div>
      )}
      <SkillGroup
        title="Working on"
        entries={placed.working.map(skillItem)}
        state="working"
        empty={null}
      />
      <SkillGroup
        title="Next up"
        entries={placed.next.map(skillItem)}
        state="next"
        empty={null}
      />
      <SkillGroup
        title="Earned"
        entries={[...placed.earned]
          .sort((a, b) => b.band - a.band)
          .map(skillItem)}
        state="earned"
        empty={null}
      />
    </div>
  );
}

const chevron = (
  <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

/** The area's skills as marks over its grades: earned solid, working on
 * ringed in the area's hue, next up an outline, the rest faint, with the
 * likely range and best guess under them on the same scale. */
function SkillField({
  placed,
  estimate,
}: {
  placed: Placed;
  estimate: Estimate;
}) {
  const state = (entry: Entry) =>
    placed.earned.includes(entry)
      ? "earned"
      : placed.working.includes(entry)
        ? "working"
        : placed.next.includes(entry)
          ? "next"
          : "other";
  const shown = [...placed.earned, ...placed.working, ...placed.next];
  const scale: RangeScale = fitScale([estimate], {
    minSpan: 5,
    include: shown.map((entry) => entry.band),
  });
  const columns = new Map<number, Entry[]>();
  for (const entry of placed.all) {
    if (entry.band < scale.lo || entry.band > scale.hi) continue;
    columns.set(entry.band, [...(columns.get(entry.band) ?? []), entry]);
  }
  const order = { earned: 0, working: 1, next: 2, other: 3 } as const;
  // A grade with many skills wraps into narrow side-by-side stacks, so no
  // column towers over the rest.
  const tallest = Math.min(
    STACK,
    Math.max(1, ...[...columns.values()].map((c) => c.length)),
  );
  const [from, to] = likelyRange(estimate);
  return (
    <figure
      className={styles.field}
      aria-label={`${placed.earned.length} earned, ${placed.working.length} working on, ${placed.next.length} next up, between ${gradeName(scale.lo)} and ${gradeName(scale.hi)}. Likely ${gradeName(from)} to ${gradeName(to)}.`}
      role="img"
    >
      <div
        className={styles.marks}
        style={{ "--stack": tallest } as CSSProperties}
        aria-hidden="true"
      >
        {[...columns.entries()].map(([band, entries]) => (
          <span
            key={band}
            className={styles.column}
            style={{ left: percent(scaleAt(scale, band)) }}
          >
            {[...entries]
              .sort((a, b) => order[state(a)] - order[state(b)])
              .map((entry) => (
                <i
                  key={entry.skill.id}
                  className={styles.mark}
                  data-state={state(entry)}
                />
              ))}
          </span>
        ))}
      </div>
      <div className={styles.fieldBar} aria-hidden="true">
        <LevelBar estimate={estimate} scale={scale} />
      </div>
      <LevelAxis scale={scale} />
      <figcaption className={styles.key} aria-hidden="true">
        <span>
          <i className={styles.mark} data-state="earned" />
          Earned
        </span>
        <span>
          <i className={styles.mark} data-state="working" />
          Working on
        </span>
        <span>
          <i className={styles.mark} data-state="next" />
          Next up
        </span>
      </figcaption>
    </figure>
  );
}

/** The most marks one grade stacks before wrapping beside itself. */
const STACK = 7;
const SHOWN = 6;
type Item = { id: string; title: string; strand: string; band?: string };
/** A list of skills, each opening over this layer; long lists show their
 * first few and a quiet "Show all". */
function SkillGroup({
  title,
  entries,
  state,
  empty,
}: {
  title: string;
  entries: readonly Item[];
  state: "earned" | "working" | "next";
  empty: ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (!entries.length) return empty;
  return (
    <section data-area-group={state}>
      <h3 className={layers.heading}>{title}</h3>
      <ul className={layers.rows}>
        {(all ? entries : entries.slice(0, SHOWN)).map((item) => (
          <li key={item.id} data-strand={item.strand}>
            <EntityLink
              entity={{ kind: "skill", id: item.id }}
              className={layers.row}
              data-area-skill={item.id}
            >
              <span className={styles.areaName}>
                <i
                  className={styles.mark}
                  data-state={state}
                  aria-hidden="true"
                />
                {item.title}
              </span>
              <span className={styles.rowEnd}>
                {item.band && (
                  <span className={layers.rowFact}>{bandLabel(item.band)}</span>
                )}
                {chevron}
              </span>
            </EntityLink>
          </li>
        ))}
      </ul>
      {entries.length > SHOWN && (
        <button
          type="button"
          className={layers.more}
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}
    </section>
  );
}

/** How the overall best guess moved, small: the band and the line, from
 * the first answer to the latest. */
function Sparkline({ points }: { points: readonly PathPoint[] }) {
  const lows = points.map((p) => likelyRange(p)[0]);
  const highs = points.map((p) => likelyRange(p)[1]);
  const lo = Math.floor(Math.min(...lows)),
    hi = Math.ceil(Math.max(...highs));
  const span = Math.max(1, hi - lo);
  const last = Math.max(1, points.at(-1)!.answered);
  const x = (p: PathPoint) => (p.answered / last) * 100;
  const y = (level: number) => 100 - ((level - lo) / span) * 100;
  const band = [
    ...points.map((p, i) => `${x(p)},${y(highs[i]!)}`),
    ...[...points].reverse().map((p, i) => {
      const at = points.length - 1 - i;
      return `${x(p)},${y(lows[at]!)}`;
    }),
  ].join(" ");
  const line = points.map((p) => `${x(p)},${y(p.level)}`).join(" ");
  const first = points[0]!,
    latest = points.at(-1)!;
  return (
    <figure className={styles.spark} data-area-path="">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`From ${gradeName(first.level)} at the start to ${gradeName(latest.level)} after ${latest.answered} answers`}
      >
        <polygon className={styles.sparkBand} points={band} />
        <polyline className={styles.sparkLine} points={line} />
      </svg>
      <figcaption className={styles.sparkAxis} aria-hidden="true">
        <span>Start</span>
        <span>{`${latest.answered} answers`}</span>
      </figcaption>
    </figure>
  );
}

/** A skill title inside a sentence: its first word lowercased when that is
 * an ordinary word ("Practice the standard multiplication algorithm"), kept
 * when it is a name or a symbol ("Practice Pythagorean triples"). */
export function inSentence(title: string) {
  const [first = "", ...rest] = title.split(" ");
  const ordinary =
    /^[A-Z][a-z]+$/.test(first) && !PROPER.has(first) && rest.length > 0;
  return ordinary ? [first.toLowerCase(), ...rest].join(" ") : title;
}
const PROPER = new Set(["Pythagorean", "Euclidean", "Cartesian", "Roman"]);
