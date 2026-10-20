import { useEffect, useState } from "react";
import type { GradeBand } from "../curriculum/types";
import { levelRange } from "../learning/level-check";
import { gradeNumber } from "../learning/frontier";
import { strandNames } from "./BirthYearPrompt";
import { LevelAxis, LevelTrack, levelScale } from "./ui/LevelChart";

type Estimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type FrontierMap = {
  expected: number;
  overall: Estimate;
  strands: Record<string, Estimate>;
};

export function gradeName(level: number) {
  const g = Math.round(level);
  if (g <= 0) return "K";
  if (g <= 8) return `Grade ${g}`;
  return (
    ["Algebra 1", "Geometry", "Algebra 2", "Precalculus"][g - 9] ?? "College"
  );
}

type Props = {
  name: string;
  resuming: boolean;
  frontier: FrontierMap | null;
  strands: readonly string[];
  busy: boolean;
  go: () => void;
  changeBirthYear: () => void;
  catalog?: LevelCatalog | null;
  /** The learner's id: this device animates the map from its last visit. */
  memoryKey?: string;
};

/** Home: one action, and each strand's estimated grade level relative to the
 * grade typical for the learner's age, with its uncertainty. */
export function Home(props: Props) {
  const f = props.frontier;
  return (
    <main className="home">
      <section className="home-hero">
        <div>
          <h1>{props.name}</h1>
          {f && f.overall.answered > 0 && (
            <p className="home-level">
              Estimated level: {gradeName(f.overall.level)}
            </p>
          )}
        </div>
        <button className="go-button" disabled={props.busy} onClick={props.go}>
          {props.resuming ? "Continue" : "Go"}
        </button>
      </section>
      <FrontierMap
        name={props.name}
        frontier={props.frontier}
        strands={props.strands}
        catalog={props.catalog}
        memoryKey={props.memoryKey}
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

/** The catalog a map reads to say what a level means in each area. */
export type LevelCatalog = {
  templates: readonly { title: string; skillId: string; gradeBand: string }[];
  skills: readonly { id: string; strand: string; gradeBand: string }[];
};

/**
 * Each area's estimated level as a chart: the likely range as a band, the
 * best guess as a dot, the age-typical grade as a tick. Every row states its
 * level and what that level means there (the problem types at that grade),
 * with no rows to open. Between visits the bars move from where they were
 * last seen on this device to where they are now.
 */
export function FrontierMap(props: {
  name: string;
  frontier: FrontierMap | null;
  strands: readonly string[];
  catalog?: LevelCatalog | null;
  /** This device remembers the last levels shown under this key. */
  memoryKey?: string;
}) {
  const f = props.frontier;
  const shown = useSettledFrontier(props.memoryKey, f);
  const scale = levelScale(
    f?.expected ?? 4,
    f ? [f.overall, ...Object.values(f.strands)] : [],
  );
  const fallback = (estimate: Estimate | undefined): Estimate =>
    estimate ?? {
      level: f?.overall.level ?? scale.center,
      sd: Math.max(1.75, f?.overall.sd ?? 2.5),
      answered: 0,
      independent: 0,
    };
  return (
    <section className="frontier-map" aria-label="Where you are">
      <div className="frontier-heading">
        <h2>Where you are</h2>
        <p>
          Each bar is the likely range and the dot the best guess. The tick
          marks what’s typical for {props.name}’s age.
        </p>
      </div>
      <ul>
        {props.strands.map((strand) => {
          const measured = f?.strands[strand];
          const estimate = fallback(measured);
          const drawn = shown?.strands[strand] ?? estimate;
          const [from, to] = levelRange(estimate);
          const level = gradeName(estimate.level);
          const meaning = props.catalog
            ? levelMeaning(props.catalog, strand, estimate.level)
            : [];
          return (
            <li
              key={strand}
              data-strand={strand}
              data-measured={measured ? "" : undefined}
              className="frontier-row"
            >
              <div className="frontier-row-head">
                <span className="frontier-name">{strandNames[strand]}</span>
                <span className="frontier-level">
                  <strong>{level}</strong>{" "}
                  <span className="frontier-likely">
                    likely {rangeName(from, to)}
                  </span>
                </span>
              </div>
              <LevelTrack
                estimate={measured ? drawn : estimate}
                scale={scale}
                estimated={!measured}
              />
              <p className="frontier-meaning">
                {measured
                  ? `${measured.answered} answered, ${measured.independent} correct without help.`
                  : "Not practiced yet: estimated from the other areas."}
                {meaning.length > 0 && (
                  <>
                    {" "}
                    <span className="frontier-topics">
                      At {level === "K" ? "kindergarten" : level}:{" "}
                      {meaning.join(" · ")}
                    </span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="frontier-axis">
        <LevelAxis scale={scale} name={gradeName} />
      </div>
    </section>
  );
}

/** "Grades 3–5", "K–Grade 2", "Grade 8–Algebra 1", or one name. */
export function rangeName(from: number, to: number) {
  const a = gradeName(from),
    b = gradeName(to);
  if (a === b) return a;
  const grade = /^Grade (\d+)$/;
  const ma = grade.exec(a),
    mb = grade.exec(b);
  if (ma && mb) return `Grades ${ma[1]}–${mb[1]}`;
  return `${a}–${b}`;
}

/** Up to three problem types at the grade nearest `level` in an area: what
 * that level means there. */
export function levelMeaning(
  catalog: LevelCatalog,
  strand: string,
  level: number,
): string[] {
  const skills = new Map(
    catalog.skills
      .filter((skill) => skill.strand === strand)
      .map((skill) => [skill.id, skill]),
  );
  const byGrade = new Map<number, string[]>();
  for (const template of catalog.templates) {
    const skill = skills.get(template.skillId);
    if (!skill) continue;
    const grade = gradeNumber[skill.gradeBand as GradeBand];
    if (grade === undefined) continue;
    const titles = byGrade.get(grade) ?? [];
    if (!titles.includes(template.title)) titles.push(template.title);
    byGrade.set(grade, titles);
  }
  const target = Math.max(0, Math.round(level));
  const grades = [...byGrade.keys()].sort(
    (a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b,
  );
  return grades.length ? byGrade.get(grades[0]!)!.slice(0, 3) : [];
}

type Seen = { strands: Record<string, { level: number; sd: number }> };
const seenKey = (key: string) => `amp.level.seen.${key}`;
/** The levels to draw: first those last seen on this device, then, a frame
 * later, the current ones, so the bars move to the new estimate. Reduced
 * motion makes the move instant (the transition tokens are 0ms). Storage
 * holds levels only and failing storage just skips the motion. */
function useSettledFrontier(
  key: string | undefined,
  frontier: FrontierMap | null,
): Seen | null {
  const [shown, setShown] = useState<Seen | null>(() => {
    if (!key || !frontier) return frontier;
    try {
      const stored = JSON.parse(
        localStorage.getItem(seenKey(key)) ?? "null",
      ) as Seen | null;
      return stored && typeof stored.strands === "object"
        ? { strands: { ...frontier.strands, ...stored.strands } }
        : frontier;
    } catch {
      return frontier;
    }
  });
  useEffect(() => {
    if (!frontier) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(frontier));
    });
    if (key)
      try {
        const strands = Object.fromEntries(
          Object.entries(frontier.strands).map(([strand, e]) => [
            strand,
            { level: e.level, sd: e.sd },
          ]),
        );
        localStorage.setItem(seenKey(key), JSON.stringify({ strands }));
      } catch (error) {
        console.warn("Level map position not remembered", error);
      }
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [key, frontier]);
  return shown;
}
