import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EntityLink } from "../../nav/links";
import { Disclosure } from "../../ui/Disclosure";
import { Loading } from "../../ui/Loading";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import {
  bandLabel,
  bandsHere,
  areaSlot,
  connections,
  planRows,
  skillState,
  type AreaId,
  type Evidence,
  type MapSkill,
  type SkillState,
} from "./model";
import { AreaKey } from "./AreaKey";
import styles from "./PathwayPlan.module.css";

const BANDS_KEY = "amp.pathways-bands";
/** The bands this device has opened or folded by choice; a band with no
 * choice is open when it is the learner's own. */
function savedChoices(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(BANDS_KEY) ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? Object.fromEntries(
          Object.entries(saved).filter(
            (entry): entry is [string, boolean] =>
              typeof entry[1] === "boolean",
          ),
        )
      : {};
  } catch {
    return {};
  }
}
function saveChoices(choices: Record<string, boolean>) {
  try {
    localStorage.setItem(BANDS_KEY, JSON.stringify(choices));
  } catch {
    // Kept for this visit only.
  }
}
const STATE_WORDS: Record<SkillState, string> = {
  earned: "earned",
  progress: "in progress",
  new: "not started",
};

/**
 * The curriculum by grade: a section per grade band, first steps to
 * precalculus, each folded under its name and how much of it is earned, the
 * learner's own band marked "Where you are". Open, a band holds its skills
 * by area, the five in order, each easiest to hardest (a column per area on
 * a wide screen). Its key shows one area at a time (`area`): then each band
 * lists and counts only that area's skills. Each skill opens its layer;
 * its dot is solid once earned, half while in progress, an outline before.
 *
 * It flows in the page. Bands start folded and stay as this device left
 * them; a skill chosen anywhere (its address, the search, the list, a
 * sheet's link) opens its band and is centred on the screen.
 */
export function PathwayPlan({
  skills,
  evidence,
  selected,
  frame = null,
  here,
  levelLoading = false,
  area = null,
}: {
  skills: MapSkill[];
  evidence: Evidence[];
  selected: string;
  frame?: { id: string } | null;
  /** The learner's overall estimate, in grade bands; null until there is one. */
  here: { lo: number; hi: number; level: number } | null;
  /** The estimate is on its way: the bands wait for it (1.5 s at most), so
   * the learner's own band is open from the start, never opening later. */
  levelLoading?: boolean;
  /** One area chosen (`?area=`): only its skills, and its counts. */
  area?: AreaId | null;
}) {
  const { shown, decided } = useCurriculumDetails();
  // The grades view names its grades, unless a school has chosen not to
  // show levels: then its bands are numbered.
  const named = shown || !decided;
  const box = useRef<HTMLElement>(null);
  const rows = useMemo(() => planRows(skills, area), [skills, area]);
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
  const firstHere = rows.find((row) => hereBands.has(row.index))?.band;
  const [ready, setReady] = useState(!levelLoading);
  useEffect(() => {
    if (!levelLoading) return setReady(true);
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, [levelLoading]);
  // The learner's own band opens with the view, once; after that only a
  // person's choice (or a skill chosen in it) opens or folds a band.
  const [ownBand, setOwnBand] = useState<string | undefined>();
  useEffect(() => {
    if (ready && ownBand === undefined) setOwnBand(firstHere ?? "");
  }, [ready, firstHere]);
  const [choices, setChoices] = useState(savedChoices);
  // Bands opened for a skill chosen in them: open for this visit only, so
  // following a few links never leaves the device's view unfolded.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const isOpen = (band: string) =>
    revealed.has(band) || (choices[band] ?? band === ownBand);
  /** A person opening or folding a band: remembered on the device. */
  const choose = (band: string, open: boolean) => {
    if (!open && revealed.has(band))
      setRevealed((current) => {
        const next = new Set(current);
        next.delete(band);
        return next;
      });
    setChoices((current) => {
      if ((current[band] ?? band === ownBand) === open) return current;
      const next = { ...current, [band]: open };
      saveChoices(next);
      return next;
    });
  };
  /** The band a skill sits in on this view (an unknown band sits with the
   * first, as `planRows` places it). */
  const bandOf = (id: string) =>
    rows.find((row) => row.areas.some((list) => list.some((s) => s.id === id)))
      ?.band;
  const skillEl = (id: string) =>
    box.current?.querySelector<HTMLElement>(
      `[data-plan-skill="${CSS.escape(id)}"]`,
    );
  /** The skill to bring into view once its band is open. */
  const pending = useRef<string | null>(null);
  /** The frame that centres it again once the page has settled. */
  const settle = useRef(0);
  const reveal = (id: string) => {
    const band = bandOf(id);
    if (!band) return;
    pending.current = id;
    setRevealed((current) =>
      current.has(band) ? current : new Set(current).add(band),
    );
  };
  useLayoutEffect(() => {
    if (selected && ready) reveal(selected);
  }, [selected, skills, ready]);
  useEffect(() => {
    if (frame) reveal(frame.id);
  }, [frame]);
  /** Centres a skill on the screen, under the app bar and the sticky area
   * names, unless it is already in view. */
  const centre = (target: HTMLElement) => {
    if (!target.isConnected || !target.getClientRects().length) return;
    const head = box.current?.querySelector<HTMLElement>(`.${styles.areas}`);
    const bar =
      parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
      0;
    const sticky =
      head && getComputedStyle(head).position === "sticky"
        ? head.offsetHeight
        : 0;
    const top = bar + sticky;
    const rect = target.getBoundingClientRect();
    if (rect.top >= top && rect.bottom <= innerHeight) return;
    window.scrollTo({
      top: scrollY + rect.top - top - (innerHeight - top - rect.height) / 2,
      behavior: "auto",
    });
  };
  // Once its band is open and drawn: centre the skill, and again once the
  // page has settled (an arrival's own scroll to the top comes after this).
  useLayoutEffect(() => {
    const id = pending.current;
    const target = id ? skillEl(id) : null;
    if (!target || !target.getClientRects().length) return;
    pending.current = null;
    centre(target);
    settle.current = requestAnimationFrame(() => {
      settle.current = requestAnimationFrame(() => centre(target));
    });
  });
  useEffect(() => () => cancelAnimationFrame(settle.current), []);
  if (!ready) return <Loading>Loading the curriculum…</Loading>;
  return (
    <section
      ref={box}
      className={`pathways-plan ${styles.plan}`}
      aria-label="Curriculum by grade"
    >
      <AreaKey area={area} className={styles.areas} />
      <ol className={styles.rows}>
        {rows.map((row, order) => {
          const all = row.areas.flat();
          const earned = all.filter(
            (skill) => skillState(stats.get(skill.id)) === "earned",
          ).length;
          const current = row.band === firstHere;
          return (
            <li
              key={row.band}
              className={styles.row}
              data-plan-band={row.index}
              data-here={hereBands.has(row.index) || undefined}
            >
              <Disclosure
                className={styles.band}
                open={isOpen(row.band)}
                onOpenChange={(next) => choose(row.band, next)}
                summary={
                  // One line at a fixed height: nothing in it moves as the
                  // record or the level arrives.
                  <span className={styles.head}>
                    <strong className={styles.name}>
                      {named ? bandLabel(row.band) : `Stage ${order + 1}`}
                    </strong>
                    {current && (
                      <span className={styles.here}>Where you are</span>
                    )}
                    <span className={styles.count}>
                      <span aria-hidden="true">{`${earned} / ${all.length}`}</span>
                      <span className="sr-only">{`${earned} of ${all.length} earned`}</span>
                    </span>
                    <span
                      className={styles.bar}
                      aria-hidden="true"
                      style={
                        {
                          "--share": all.length ? earned / all.length : 0,
                        } as CSSProperties
                      }
                    />
                  </span>
                }
              >
                <div className={styles.cells}>
                  {row.areas.map((list, area) => (
                    <ul key={area} className={styles.cell}>
                      {list.map((skill) => {
                        const state = skillState(stats.get(skill.id));
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
                              style={areaColor(areaSlot(skill))}
                            >
                              <span
                                className={styles.check}
                                data-state={state}
                                aria-hidden="true"
                              >
                                {state === "earned" && (
                                  <svg viewBox="0 0 16 16">
                                    <path d="m4 8.4 2.6 2.6L12 5.6" />
                                  </svg>
                                )}
                              </span>
                              <span className={styles.title}>
                                {skill.title}
                                {state !== "new" && (
                                  <span className="sr-only">
                                    {` · ${STATE_WORDS[state]}`}
                                  </span>
                                )}
                              </span>
                            </EntityLink>
                          </li>
                        );
                      })}
                    </ul>
                  ))}
                </div>
              </Disclosure>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const areaColor = (area: number) =>
  ({ "--area": `var(--atlas-area-${area})` }) as CSSProperties;
