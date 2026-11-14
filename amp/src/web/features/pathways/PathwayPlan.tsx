import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { EntityLink } from "../../nav/links";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import {
  bandLabel,
  bandsHere,
  connections,
  neighborhood,
  neighborhoods,
  planRows,
  skillLight,
  type Evidence,
  type MapSkill,
} from "./model";
import styles from "./PathwayPlan.module.css";

/**
 * The curriculum map, flat: for a browser that can't draw the 3D map. The
 * same skills and the same record, a row per grade band from the first steps
 * down to precalculus, a column per area (one flowing list on a phone).
 * Each skill opens its layer, as on the map; brighter gems are stronger
 * practice, and "Where you are" marks the learner's estimated range.
 *
 * It opens on the learner's level (or a skill the address names); a skill
 * found by the search or the list scrolls into view. Only the pathway's own
 * box scrolls, never the page.
 */
export function PathwayPlan({
  skills,
  evidence,
  selected,
  frame = null,
  here,
}: {
  skills: MapSkill[];
  evidence: Evidence[];
  selected: string;
  frame?: { id: string } | null;
  /** The learner's overall estimate, in grade bands; null until there is one. */
  here: { lo: number; hi: number; level: number } | null;
}) {
  const { shown } = useCurriculumDetails();
  const box = useRef<HTMLElement>(null);
  const rows = useMemo(() => planRows(skills), [skills]);
  const stats = useMemo(
    () => new Map(evidence.map((entry) => [entry.skillId, entry])),
    [evidence],
  );
  const near = useMemo(
    () => (selected ? connections(skills, selected) : null),
    [skills, selected],
  );
  const hereBands = useMemo(
    () => (here ? bandsHere(here, rows) : new Set<number>()),
    [here?.lo, here?.hi, here?.level, rows],
  );
  const firstHere = rows.find((row) => hereBands.has(row.index))?.index;
  /** Brings a part of the pathway into its box (never the page). */
  const reveal = (target: HTMLElement | null | undefined, smooth: boolean) => {
    const el = box.current;
    if (!el || !target) return;
    const head = el.querySelector<HTMLElement>(`.${styles.areas}`);
    const top =
      target.getBoundingClientRect().top -
      el.getBoundingClientRect().top +
      el.scrollTop -
      (head?.offsetHeight ?? 0);
    el.scrollTo({
      top: Math.max(0, top),
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
  };
  const skillEl = (id: string) =>
    box.current?.querySelector<HTMLElement>(
      `[data-plan-skill="${CSS.escape(id)}"]`,
    );
  /** Until the person scrolls or a skill is chosen, the first view may follow
   * the level as it arrives; once only. */
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (placed.current) return;
    if (selected) {
      placed.current = true;
      // A skill's address opens there, row above it in view.
      reveal(skillEl(selected)?.closest<HTMLElement>(`.${styles.row}`), false);
    } else if (firstHere !== undefined) {
      placed.current = true;
      reveal(
        box.current?.querySelector<HTMLElement>(
          `[data-plan-band="${firstHere}"]`,
        ),
        false,
      );
    }
  }, [selected, firstHere]);
  useEffect(() => {
    if (!frame) return;
    placed.current = true;
    const target = skillEl(frame.id);
    const el = box.current;
    if (!target || !el) return;
    const outer = el.getBoundingClientRect();
    const inner = target.getBoundingClientRect();
    const head = el.querySelector<HTMLElement>(`.${styles.areas}`);
    // Already in full view: nothing moves.
    if (
      inner.top >= outer.top + (head?.offsetHeight ?? 0) &&
      inner.bottom <= outer.bottom
    )
      return;
    reveal(target.closest<HTMLElement>(`.${styles.row}`), true);
  }, [frame]);
  return (
    <section
      ref={box}
      className={`pathways-plan ${styles.plan}`}
      aria-label="Curriculum pathway"
      onPointerDown={() => (placed.current = true)}
      onWheel={() => (placed.current = true)}
    >
      <div className={styles.areas} aria-hidden="true">
        {neighborhoods.map((area, index) => (
          <span key={area.title} style={areaColor(index)}>
            {area.title}
          </span>
        ))}
      </div>
      <ol className={styles.rows}>
        {rows.map((row) => {
          const isHere = hereBands.has(row.index);
          return (
            <li
              key={row.band}
              className={styles.row}
              data-plan-band={row.index}
              data-here={isHere || undefined}
            >
              {/* The row's head line is always there, so the level's tag
                  arriving never moves a skill. */}
              <div className={styles.head}>
                {shown && <span>{bandLabel(row.band)}</span>}
                {row.index === firstHere && (
                  <strong className={styles.here}>Where you are</strong>
                )}
              </div>
              <div className={styles.cells}>
                {row.areas.map((list, area) => (
                  <ul key={area} className={styles.cell}>
                    {list.map((skill) => {
                      const light = skillLight(stats.get(skill.id));
                      return (
                        <li key={skill.id}>
                          <EntityLink
                            entity={{ kind: "skill", id: skill.id }}
                            className={styles.skill}
                            data-plan-skill={skill.id}
                            data-near={
                              near?.prerequisites.has(skill.id)
                                ? "before"
                                : near?.dependents.has(skill.id)
                                  ? "after"
                                  : undefined
                            }
                            aria-current={
                              selected === skill.id ? "page" : undefined
                            }
                            style={areaColor(neighborhood(skill))}
                          >
                            <i
                              className={styles.gem}
                              data-stage={light.stage}
                              aria-hidden="true"
                            />
                            <span>
                              {skill.title}
                              {light.stage > 0 && (
                                <span className="sr-only"> · earned</span>
                              )}
                            </span>
                          </EntityLink>
                        </li>
                      );
                    })}
                  </ul>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const areaColor = (area: number) =>
  ({ "--area": `var(--atlas-area-${area})` }) as CSSProperties;
